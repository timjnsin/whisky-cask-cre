import { CaskRecord, ReferenceValuationResponse } from "../domain/types.js";
import { monthsBetween, round2 } from "../domain/units.js";

export function buildReferenceValuation(cask: CaskRecord, asOf: string): ReferenceValuationResponse {
  const ageMonths = monthsBetween(cask.fillDate, asOf);
  const base = cask.entryGauge.proofGallons * 120;
  const ageMultiplier = 1 + ageMonths / 120;

  const caskTypePremium =
    cask.caskType === "sherry_butt"
      ? 1.15
      : cask.caskType === "port_pipe"
        ? 1.12
        : cask.caskType === "hogshead"
          ? 1.05
          : 1;

  const estimatedValueUsd = round2(base * ageMultiplier * caskTypePremium);

  return {
    caskId: cask.caskId,
    estimatedValueUsd,
    methodology: "age_curve_v1",
    confidence: "low",
    asOf,
  };
}
