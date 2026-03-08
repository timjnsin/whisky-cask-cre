import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const API_BASE_URL = process.env.DEMO_API_BASE_URL ?? "http://127.0.0.1:3000";
const API_READY_PATH = `${API_BASE_URL}/inventory`;
const TSX_CLI_PATH = fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url));

function runCommand(command: string, args: string[], label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${label} failed with ${code === null ? `signal ${signal ?? "unknown"}` : `exit code ${code}`}`,
        ),
      );
    });
  });
}

function runTsx(args: string[], label: string): Promise<void> {
  return runCommand(process.execPath, [TSX_CLI_PATH, ...args], label);
}

async function waitForApiReady(): Promise<void> {
  const deadline = Date.now() + 15_000;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(API_READY_PATH);
      if (response.ok) {
        return;
      }
      lastError = new Error(`received HTTP ${response.status} from ${API_READY_PATH}`);
    } catch (error) {
      lastError = error;
    }

    await delay(500);
  }

  throw new Error(
    `API did not become ready at ${API_READY_PATH}${lastError ? `: ${String(lastError)}` : ""}`,
  );
}

async function stopApi(apiProcess: ChildProcess): Promise<void> {
  if (!apiProcess.pid) {
    return;
  }

  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(apiProcess.pid), "/T", "/F"], {
        stdio: "ignore",
      });

      killer.once("error", () => resolve());
      killer.once("exit", () => resolve());
    });
    return;
  }

  apiProcess.kill("SIGTERM");
  await delay(750);

  if (apiProcess.exitCode === null) {
    apiProcess.kill("SIGKILL");
  }
}

async function main(): Promise<void> {
  await runTsx(["api/src/scripts/seed.ts"], "seed");

  const apiProcess = spawn(process.execPath, [TSX_CLI_PATH, "api/src/index.ts"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  apiProcess.once("error", (error) => {
    console.error("demo:all API process failed to start", error);
  });

  try {
    await waitForApiReady();
    await runTsx(["workflows/proof-of-reserve/workflow.ts"], "simulate:por");
    await runTsx(["workflows/physical-attributes/workflow.ts"], "simulate:attributes");
    await runTsx(["workflows/lifecycle-webhook/workflow.ts"], "simulate:lifecycle:webhook");
    await runTsx(["workflows/lifecycle-reconcile/workflow.ts"], "simulate:lifecycle:reconcile");
  } finally {
    await stopApi(apiProcess);
  }
}

main().catch((error) => {
  console.error("demo:all failed", error);
  process.exitCode = 1;
});
