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
    if (!["professional_service", "notification_service", "insights_service", "user_service"].includes(schema)) throw new Error("Unexpected test schema.");
    return {
      async rpc(name: string, args: Record<string, unknown> = {}) {
        const entries = Object.entries(args);
        const response = await result(`select to_jsonb(${identifier(schema)}.${identifier(name)}(${entries.map(([key], index) => `${identifier(key)}=>$${index + 1}`).join(",")})) data`, entries.map(([, value]) => Array.isArray(value) ? JSON.stringify(value) : value));
        await afterRpc?.(name);
        return response;
      },
      from(table: string) {
        const filters: Array<[string, unknown]> = [];
        const lists: Array<[string, unknown[]]> = [];
        const comparisons: Array<[string, string, unknown]> = [];
        const ordering: string[] = [];
        let pageLimit: number | undefined;
        let pageOffset = 0;
        let exactCount = false;
        let boundary: { at: string; id: string } | undefined;
        const where = () => [...filters.map(([key], index) => key === "support_requests.user_id" && table === "appointments" ? `request_id in (select id from professional_service.support_requests where user_id=$${index + 1})` : `${identifier(key)}=$${index + 1}`), ...lists.map(([key], index) => `${identifier(key)}::text=any($${filters.length + index + 1}::text[])`), ...comparisons.map(([key, operator], index) => `${identifier(key)}${operator}$${filters.length + lists.length + index + 1}`), ...(boundary ? [`(created_at,id)<($${filters.length + lists.length + comparisons.length + 1}::timestamptz,$${filters.length + lists.length + comparisons.length + 2}::uuid)`] : [])].join(" and ") || "true";
        const values = () => [...filters.map(([, value]) => value), ...lists.map(([, value]) => value.map(String)), ...comparisons.map(([, , value]) => value), ...(boundary ? [boundary.at, boundary.id] : [])];
        const query = {
          select: (_columns: string, options?: { count?: string }) => { exactCount = options?.count === "exact"; return query; },
          range: (from: number, through: number) => {
            if (![from, through].every(Number.isInteger) || from < 0 || through < from) throw new Error("Invalid test range");
            pageOffset = from; pageLimit = through - from + 1; return query;
          },
          upsert: async (row: Record<string, unknown>, options: { onConflict: string }) => {
            const entries = Object.entries(row);
            return result(`insert into ${identifier(schema)}.${identifier(table)} (${entries.map(([key]) => identifier(key)).join(",")}) values(${entries.map((_, i) => "$" + (i + 1)).join(",")}) on conflict (${options.onConflict.split(",").map(identifier).join(",")}) do update set ${entries.map(([key]) => `${identifier(key)}=excluded.${identifier(key)}`).join(",")} returning to_jsonb(${identifier(table)}.*) data`, entries.map(([, value]) => value));
          },
          insert: async (row: Record<string, unknown>) => {
            const entries = Object.entries(row);
            return result(`insert into ${identifier(schema)}.${identifier(table)} (${entries.map(([key]) => identifier(key)).join(",")}) values(${entries.map((_, i) => `$${i + 1}`).join(",")}) returning to_jsonb(${identifier(table)}.*) data`, entries.map(([, value]) => value));
          },
          eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
          in: (key: string, value: unknown[]) => { lists.push([key, value]); return query; },
          gte: (key: string, value: unknown) => { comparisons.push([key, ">=", value]); return query; },
          lt: (key: string, value: unknown) => { comparisons.push([key, "<", value]); return query; },
          or: (filter: string) => {
            const match = /^created_at\.lt\.([^,]+),and\(created_at\.eq\.([^,]+),id\.lt\.([a-f0-9-]+)\)$/.exec(filter);
            if (!match || match[1] !== match[2]) throw new Error("Unsupported test boundary.");
            boundary = { at: match[1], id: match[3] }; return query;
          },
          order: (column: string, options?: { ascending?: boolean }) => { ordering.push(`${identifier(column)} ${options?.ascending === false ? "desc" : "asc"}`); return query; },
          limit: (limit: number) => { if (!Number.isInteger(limit) || limit < 0) throw new Error("Invalid test limit"); pageLimit = limit; return query; },
          then: async (resolve: (value: unknown) => unknown) => {
            const response = await result(`select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) data from (select * from ${identifier(schema)}.${identifier(table)} where ${where()}${ordering.length ? ` order by ${ordering.join(",")}` : ""}${pageLimit === undefined ? "" : ` limit ${pageLimit}`} offset ${pageOffset}) t`, values());
            if (!exactCount || response.error) return resolve(response);
            const count = await result(`select count(*)::int data from ${identifier(schema)}.${identifier(table)} where ${where()}`, values());
            return resolve({ ...response, count: count.data, error: count.error });
          },
          maybeSingle: () => result(`select to_jsonb(t) data from ${identifier(schema)}.${identifier(table)} t where ${where()} limit 1`, values()),
        };
        return query;
      },
    };
  } } as unknown as SupabaseClient;
}
