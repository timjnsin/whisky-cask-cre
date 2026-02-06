import { InventoryResponse, LifecycleEvent } from "../../api/src/domain/types.js";
import { loadConfig } from "../shared/config.js";
import { getJson } from "../shared/http.js";

interface LifecycleResponse {
  caskId: number;
  events: LifecycleEvent[];
}

async function main() {
  const config = await loadConfig(import.meta.url);
  const inventory = await getJson<InventoryResponse>(`${config.apiBaseUrl}/inventory`);

  const targetIds = inventory.active_cask_ids_sorted.slice(0, 15);
  const lifecycleRecords = await Promise.all(
    targetIds.map((id) => getJson<LifecycleResponse>(`${config.apiBaseUrl}/cask/${id}/lifecycle`)),
  );

  const replayableEvents = lifecycleRecords
    .flatMap((record) => record.events)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const latestTen = replayableEvents.slice(-10);

  console.log("[lifecycle-reconcile] scanned casks", targetIds.length);
  console.log("[lifecycle-reconcile] replay candidates", replayableEvents.length);
  console.log("[lifecycle-reconcile] latest 10 events");
  console.log(JSON.stringify(latestTen, null, 2));
}

main().catch((error) => {
  console.error("lifecycle-reconcile workflow failed", error);
  process.exit(1);
});
