// Type-only linkage keeps workflow scripts portable while preserving CRE SDK integration points.
export type CreSdkTypeBinding = typeof import("@chainlink/cre-sdk");

export function getCreSdkStatus(): {
  typeLinked: boolean;
  runtimeLoaded: boolean;
  note: string;
} {
  return {
    typeLinked: true,
    runtimeLoaded: false,
    note: "CRE SDK linked at type level; switch to runtime import when moving from local simulation to managed CRE execution.",
  };
}
