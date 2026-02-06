import { InventoryResponse } from "../../api/src/domain/types.js";
import { loadConfig } from "../shared/config.js";
import { getJson } from "../shared/http.js";
import { buildReserveReport } from "../shared/reports.js";

async function main() {
  const config = await loadConfig(import.meta.url);
  const inventory = await getJson<InventoryResponse>(`${config.apiBaseUrl}/inventory`);

  const totalTokenSupply = config.tokenSupplyUnits ?? Number(process.env.TOKEN_SUPPLY_UNITS ?? 47000);
  const timestamp = new Date().toISOString();

  const report = buildReserveReport({
    mode: config.attestationMode,
    inventory,
    totalTokenSupply,
    tokensPerCask: config.tokensPerCask,
    timestamp,
  });

  console.log("[proof-of-reserve] inventory", {
    physicalCaskCount: inventory.physical_cask_count,
    totalTokenSupply,
    tokensPerCask: config.tokensPerCask,
    mode: config.attestationMode,
  });

  console.log("[proof-of-reserve] report payload");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error("proof-of-reserve workflow failed", error);
  process.exit(1);
});
