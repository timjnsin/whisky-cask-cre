import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type AttestationMode = "public" | "confidential";

export interface WorkflowConfig {
  apiBaseUrl: string;
  contractAddress: string;
  chainSelector: string;
  tokensPerCask: number;
  attestationMode: AttestationMode;
  tokenSupplyUnits?: number;
}

export async function loadConfig(fromModuleUrl: string): Promise<WorkflowConfig> {
  const moduleDir = path.dirname(fileURLToPath(fromModuleUrl));
  const configPath = path.join(moduleDir, "config.staging.json");
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = JSON.parse(raw.replace(/^\uFEFF/, "")) as WorkflowConfig;

  if (!parsed.apiBaseUrl || !parsed.contractAddress || !parsed.chainSelector) {
    throw new Error(`Invalid workflow config at ${configPath}`);
  }
  if (!parsed.tokensPerCask || parsed.tokensPerCask <= 0) {
    throw new Error(`tokensPerCask must be > 0 in ${configPath}`);
  }
  if (parsed.attestationMode !== "public" && parsed.attestationMode !== "confidential") {
    throw new Error(`attestationMode must be public or confidential in ${configPath}`);
  }

  return parsed;
}
