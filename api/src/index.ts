import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { z } from "zod";
import { MockWarehouseAdapter } from "./adapters/warehouse/mockWarehouseAdapter.js";
import { LifecycleValidationError, PortfolioStore } from "./services/portfolio.js";

const lifecyclePayloadSchema = z.object({
  caskId: z.number().int().positive(),
  toState: z.enum(["filled", "maturation", "regauged", "transfer", "bottling_ready", "bottled"]),
  gaugeProofGallons: z.number().nonnegative().optional(),
  gaugeWineGallons: z.number().nonnegative().optional(),
  gaugeProof: z.number().nonnegative().optional(),
  reason: z.enum(["regauge", "transfer", "bottling"]).optional(),
  timestamp: z.string().datetime().optional(),
});

function parseCaskId(param: string): number | null {
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function parseIdList(rawIds: string | undefined): number[] | undefined {
  if (!rawIds) return undefined;
  const ids = rawIds
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
  return ids.length > 0 ? ids : undefined;
}

function parseLimit(rawLimit: string | undefined, fallback: number, min = 1, max = 200): number {
  const parsed = Number(rawLimit ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function parseAsOf(rawAsOf: string | undefined): string | null {
  if (!rawAsOf) return new Date().toISOString();
  const parsed = new Date(rawAsOf);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

async function bootstrap(): Promise<void> {
  const store = new PortfolioStore();
  await store.init();
  const adapter = new MockWarehouseAdapter(store);

  const app = new Hono();

  app.get("/health", (c) =>
    c.json({
      status: "ok",
      service: "warehouse-api",
      asOf: new Date().toISOString(),
    }),
  );

  app.get("/inventory", (c) => {
    const asOf = parseAsOf(c.req.query("asOf"));
    if (!asOf) return c.json({ error: "invalid asOf timestamp" }, 400);
    return c.json(adapter.getInventory(asOf));
  });

  app.get("/cask/:id/gauge-record", (c) => {
    const caskId = parseCaskId(c.req.param("id"));
    if (!caskId) return c.json({ error: "invalid cask id" }, 400);

    const record = adapter.getGaugeRecord(caskId);
    if (!record) return c.json({ error: "cask not found" }, 404);
    return c.json(record);
  });

  app.get("/cask/:id/estimate", (c) => {
    const caskId = parseCaskId(c.req.param("id"));
    if (!caskId) return c.json({ error: "invalid cask id" }, 400);

    const asOf = parseAsOf(c.req.query("asOf"));
    if (!asOf) return c.json({ error: "invalid asOf timestamp" }, 400);

    const estimate = adapter.getEstimate(caskId, asOf);
    if (!estimate) return c.json({ error: "cask not found" }, 404);
    return c.json(estimate);
  });

  app.get("/cask/:id/lifecycle", (c) => {
    const caskId = parseCaskId(c.req.param("id"));
    if (!caskId) return c.json({ error: "invalid cask id" }, 400);

    const lifecycle = adapter.getLifecycle(caskId);
    if (!lifecycle) return c.json({ error: "cask not found" }, 404);
    return c.json({ caskId, events: lifecycle });
  });

  app.get("/casks/batch", (c) => {
    const asOf = parseAsOf(c.req.query("asOf"));
    if (!asOf) return c.json({ error: "invalid asOf timestamp" }, 400);
    const ids = parseIdList(c.req.query("ids"));
    const limit = parseLimit(c.req.query("limit"), 20, 1, 50);
    return c.json(adapter.getCaskBatch(ids, limit, asOf));
  });

  app.get("/lifecycle/recent", (c) => {
    const asOf = parseAsOf(c.req.query("asOf"));
    if (!asOf) return c.json({ error: "invalid asOf timestamp" }, 400);
    const limit = parseLimit(c.req.query("limit"), 100, 1, 200);
    return c.json(adapter.getRecentLifecycle(limit, asOf));
  });

  app.get("/portfolio/summary", (c) => {
    const asOf = parseAsOf(c.req.query("asOf"));
    if (!asOf) return c.json({ error: "invalid asOf timestamp" }, 400);
    return c.json(adapter.getSummary(asOf));
  });

  app.get("/market-data", (c) => {
    const asOf = parseAsOf(c.req.query("asOf"));
    if (!asOf) return c.json({ error: "invalid asOf timestamp" }, 400);
    return c.json(adapter.getMarketData(asOf));
  });

  app.get("/cask/:id/reference-valuation", (c) => {
    const caskId = parseCaskId(c.req.param("id"));
    if (!caskId) return c.json({ error: "invalid cask id" }, 400);

    const asOf = parseAsOf(c.req.query("asOf"));
    if (!asOf) return c.json({ error: "invalid asOf timestamp" }, 400);

    const valuation = adapter.getReferenceValuation(caskId, asOf);
    if (!valuation) return c.json({ error: "cask not found" }, 404);
    return c.json(valuation);
  });

  app.post("/events/lifecycle", async (c) => {
    const lifecycleApiKey = process.env.LIFECYCLE_API_KEY;
    if (lifecycleApiKey) {
      const suppliedKey = c.req.header("x-lifecycle-key");
      if (!suppliedKey || suppliedKey !== lifecycleApiKey) {
        return c.json({ error: "unauthorized lifecycle event source" }, 401);
      }
    }

    const body = await c.req.json().catch(() => null);
    const parsed = lifecyclePayloadSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid payload", issues: parsed.error.issues }, 400);
    }

    try {
      const event = await adapter.recordLifecycle(parsed.data);
      if (!event) return c.json({ error: "cask not found" }, 404);
      return c.json({ ok: true, event });
    } catch (error) {
      if (error instanceof LifecycleValidationError) {
        return c.json({ error: error.message }, error.statusCode);
      }
      throw error;
    }
  });

  const port = Number(process.env.PORT ?? 3000);
  serve({ fetch: app.fetch, port });
  console.log(`[warehouse-api] listening on http://localhost:${port}`);
}

bootstrap().catch((error) => {
  console.error("Failed to boot API", error);
  process.exit(1);
});
