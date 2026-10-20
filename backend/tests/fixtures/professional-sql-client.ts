import type { SupabaseClient } from "@supabase/supabase-js";
import type { PGlite } from "@electric-sql/pglite";

/** Test transport only: real SQL constraints/functions, not mocked RPC outcomes.
 * Does not emulate PostgREST/Auth; only the service calls exercised by this suite.
 */
export function professionalSqlClient(db: PGlite): SupabaseClient {
  const identifier = (value: string) => {
    if (!/^[a-z_]+$/.test(value)) throw new Error("Unsupported test SQL identifier.");
    return `"${value}"`;
  };
  const result = async (sql: string, args: unknown[]) => {
    try { return { data: (await db.query<{ data: unknown }>(sql, args)).rows[0]?.data ?? null, error: null }; }
    catch (error) { return { data: null, error: { message: (error as Error).message, code: (error as { code?: string }).code } }; }
  };
  return { schema(schema: string) {
    if (schema !== "professional_service") throw new Error("Unexpected test schema.");
    return {
      rpc(name: string, args: Record<string, unknown>) {
        const entries = Object.entries(args);
        return result(`select to_jsonb(professional_service.${identifier(name)}(${entries.map(([key], index) => `${identifier(key)}=>$${index + 1}`).join(",")})) data`, entries.map(([, value]) => Array.isArray(value) ? JSON.stringify(value) : value));
      },
      from(table: string) {
        const filters: Array<[string, unknown]> = [];
        const query = {
          select: (_columns: string) => query,
          eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
          maybeSingle: () => result(`select to_jsonb(t) data from professional_service.${identifier(table)} t where ${filters.map(([key], index) => `${identifier(key)}=$${index + 1}`).join(" and ")} limit 1`, filters.map(([, value]) => value)),
        };
        return query;
      },
    };
  } } as unknown as SupabaseClient;
}
