import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { z } from "zod";
import { MockWarehouseAdapter } from "./adapters/warehouse/mockWarehouseAdapter.js";
import { PortfolioStore } from "./services/portfolio.js";

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
    const asOf = new Date().toISOString();
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

    const estimate = adapter.getEstimate(caskId, new Date().toISOString());
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

  app.get("/portfolio/summary", (c) => {
    const asOf = new Date().toISOString();
    return c.json(adapter.getSummary(asOf));
  });

  app.get("/market-data", (c) => {
    const asOf = new Date().toISOString();
    return c.json(adapter.getMarketData(asOf));
  });

  app.get("/cask/:id/reference-valuation", (c) => {
    const caskId = parseCaskId(c.req.param("id"));
    if (!caskId) return c.json({ error: "invalid cask id" }, 400);

    const valuation = adapter.getReferenceValuation(caskId, new Date().toISOString());
    if (!valuation) return c.json({ error: "cask not found" }, 404);
    return c.json(valuation);
  });

  app.post("/events/lifecycle", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = lifecyclePayloadSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "invalid payload", issues: parsed.error.issues }, 400);
    }

    const event = await adapter.recordLifecycle(parsed.data);
    if (!event) return c.json({ error: "cask not found" }, 404);
    return c.json({ ok: true, event });
  });

  const port = Number(process.env.PORT ?? 3000);
  serve({ fetch: app.fetch, port });
  console.log(`[warehouse-api] listening on http://localhost:${port}`);
}

bootstrap().catch((error) => {
  console.error("Failed to boot API", error);
  process.exit(1);
});
