import type { SupabaseClient } from "@supabase/supabase-js";
import type { PGlite } from "@electric-sql/pglite";

/** Test transport only: real SQL constraints/functions, not mocked RPC outcomes.
 * Does not emulate PostgREST/Auth; only the service calls exercised by this suite.
 */
export function professionalSqlClient(db: PGlite, afterRpc?: (name: string) => Promise<void>): SupabaseClient {
  const identifier = (value: string) => {
    if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error("Unsupported test SQL identifier.");
    return `"${value}"`;
  };
  const result = async (sql: string, args: unknown[]) => {
    try { return { data: (await db.query<{ data: unknown }>(sql, args)).rows[0]?.data ?? null, error: null }; }
    catch (error) { return { data: null, error: { message: (error as Error).message, code: (error as { code?: string }).code } }; }
  };
  return { schema(schema: string) {
    if (!["professional_service", "notification_service", "insights_service"].includes(schema)) throw new Error("Unexpected test schema.");
    return {
      async rpc(name: string, args: Record<string, unknown>) {
        const entries = Object.entries(args);
        const response = await result(`select to_jsonb(${identifier(schema)}.${identifier(name)}(${entries.map(([key], index) => `${identifier(key)}=>$${index + 1}`).join(",")})) data`, entries.map(([, value]) => Array.isArray(value) ? JSON.stringify(value) : value));
        await afterRpc?.(name);
        return response;
      },
      from(table: string) {
        const filters: Array<[string, unknown]> = [];
        const lists: Array<[string, unknown[]]> = [];
        const where = () => [...filters.map(([key], index) => `${identifier(key)}=$${index + 1}`), ...lists.map(([key], index) => `${identifier(key)}::text=any($${filters.length + index + 1}::text[])`)].join(" and ") || "true";
        const values = () => [...filters.map(([, value]) => value), ...lists.map(([, value]) => value.map(String))];
        const query = {
          select: (_columns: string) => query,
          insert: async (row: Record<string, unknown>) => {
            const entries = Object.entries(row);
            return result(`insert into ${identifier(schema)}.${identifier(table)} (${entries.map(([key]) => identifier(key)).join(",")}) values(${entries.map((_, i) => `$${i + 1}`).join(",")}) returning to_jsonb(${identifier(table)}.*) data`, entries.map(([, value]) => value));
          },
          eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
          in: (key: string, value: unknown[]) => { lists.push([key, value]); return query; },
          order: (_column: string, _options?: unknown) => query,
          limit: (_limit: number) => query,
          then: (resolve: (value: unknown) => unknown) => result(`select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) data from ${identifier(schema)}.${identifier(table)} t where ${where()}`, values()).then(resolve),
          maybeSingle: () => result(`select to_jsonb(t) data from ${identifier(schema)}.${identifier(table)} t where ${where()} limit 1`, values()),
        };
        return query;
      },
    };
  } } as unknown as SupabaseClient;
}
