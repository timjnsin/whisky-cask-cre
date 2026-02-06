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
    note: "Local simulation scripts are fetch-based; CRE runtime entrypoints now live in each workflow's index.ts.",
  };
}
