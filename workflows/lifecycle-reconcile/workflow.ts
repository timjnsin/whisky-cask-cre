import { RecentLifecycleResponse } from "../../api/src/domain/types.js";
import { loadConfig } from "../shared/config.js";
import { getCreSdkStatus } from "../shared/cre-sdk.js";
import { getJson } from "../shared/http.js";

async function main() {
  const config = await loadConfig(import.meta.url);
  const creSdk = getCreSdkStatus();

  const recent = await getJson<RecentLifecycleResponse>(
    `${config.apiBaseUrl}/lifecycle/recent?limit=100`,
  );

  const latestTen = recent.events.slice(-10);

  console.log("[lifecycle-reconcile] scanned events", recent.count);
  console.log("[lifecycle-reconcile] httpCalls", 1);
  console.log("[lifecycle-reconcile] latest 10 events");
  console.log(JSON.stringify(latestTen, null, 2));
  console.log("[lifecycle-reconcile] cre-sdk", creSdk);
}

main().catch((error) => {
  console.error("lifecycle-reconcile workflow failed", error);
  process.exit(1);
});
