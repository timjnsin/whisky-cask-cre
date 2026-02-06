import { CaskRecord, EstimateResponse } from "../domain/types.js";
import { daysBetween, round2 } from "../domain/units.js";

const BOTTLES_PER_PROOF_GALLON_AT_46_ABV = 5.48;

export function estimateCask(cask: CaskRecord, asOf: string): EstimateResponse {
  const daysSinceLastGauge = daysBetween(cask.lastGauge.date, asOf);
  const years = daysSinceLastGauge / 365;
  const estimatedCurrentProofGallons = round2(
    cask.lastGauge.proofGallons * Math.pow(1 - cask.angelShareRate, years),
  );

  const estimatedBottleYield = Math.max(
    0,
    Math.floor(estimatedCurrentProofGallons * BOTTLES_PER_PROOF_GALLON_AT_46_ABV * cask.qualityFactor),
  );

  return {
    caskId: cask.caskId,
    estimatedCurrentProofGallons,
    estimatedBottleYield,
    modelVersion: "angels_share_v1",
    angelShareRate: cask.angelShareRate,
    daysSinceLastGauge,
  };
}
