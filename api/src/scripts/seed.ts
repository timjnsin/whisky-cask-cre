import { promises as fs } from "node:fs";
import path from "node:path";
import { generatePortfolioData } from "../services/seed.js";

const dataPath = path.resolve(process.cwd(), "api/data/portfolio.json");

async function main() {
  const portfolio = generatePortfolioData();
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(portfolio, null, 2), "utf8");

  const proofGallons = portfolio.casks.reduce((sum, c) => sum + c.lastGauge.proofGallons, 0);
  console.log(
    JSON.stringify(
      {
        written: dataPath,
        caskCount: portfolio.casks.length,
        totalLastGaugeProofGallons: Math.round(proofGallons * 100) / 100,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
  return;
});
