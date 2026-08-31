import { Router } from "express";
import {
  asyncRoute,
  createInternalClient,
  createServiceApp,
  gatewayUserHeaders,
  requireGatewayUser,
  sendData,
  ServiceError,
} from "@echo/service-core";
import { z } from "zod";
import { dashboard, emotionInsights } from "./insights.js";

const rangeSchema = z.enum(["7d", "30d", "90d"]).default("7d");
const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 } as const;

function startDate(days: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - (days - 1));
  return date.toISOString().slice(0, 10);
}

export function createInsightsApp(options: {
  serviceToken: string;
  userServiceToken: string;
  journalServiceToken: string;
  userUrl: string;
  journalUrl: string;
  timeoutMs: number;
}) {
  const router = Router();
  const user = requireGatewayUser(options.serviceToken);
  const users = createInternalClient({ baseUrl: options.userUrl, token: options.userServiceToken, timeoutMs: options.timeoutMs, serviceName: "user-service" });
  const journals = createInternalClient({ baseUrl: options.journalUrl, token: options.journalServiceToken, timeoutMs: options.timeoutMs, serviceName: "journal-service" });
  const headers = (req: any, secret: string) => gatewayUserHeaders({ requestId: req.requestId, userId: req.auth.id, secret });

  const parseRange = (value: unknown) => {
    const parsed = rangeSchema.safeParse(value);
    if (!parsed.success) throw new ServiceError(400, "VALIDATION_ERROR", "Range must be 7d, 30d, or 90d.");
    return parsed.data;
  };

  async function journalEntries(req: any, range: keyof typeof RANGE_DAYS) {
    const pageSize = 100;
    const query = new URLSearchParams({
      page: "1",
      pageSize: String(pageSize),
      dateFrom: startDate(RANGE_DAYS[range]),
      sort: "newest",
    });
    const first = await journals(`/api/v1/journals?${query}`, { headers: headers(req, options.journalServiceToken) });
    const entries = [...first.data.entries];
    const pages = Math.ceil(first.data.total / pageSize);
    for (let page = 2; page <= pages; page += 1) {
      query.set("page", String(page));
      const next = await journals(`/api/v1/journals?${query}`, { headers: headers(req, options.journalServiceToken) });
      entries.push(...next.data.entries);
    }
    return entries;
  }

  router.get("/insights/emotions", user, asyncRoute(async (req, res) => {
    const range = parseRange(req.query.range ?? "30d");
    sendData(res, emotionInsights(await journalEntries(req, range), RANGE_DAYS[range]), req.requestId);
  }));

  router.get("/dashboard", user, asyncRoute(async (req, res) => {
    const range = parseRange(req.query.range);
    const [entries, settingsResult] = await Promise.all([
      journalEntries(req, range),
      users("/api/v1/settings", { headers: headers(req, options.userServiceToken) }),
    ]);
    sendData(res, dashboard(entries, settingsResult.data, RANGE_DAYS[range]), req.requestId);
  }));
  return createServiceApp({ name: "insights-service", router });
}
