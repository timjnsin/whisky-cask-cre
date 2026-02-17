"use client";

import { useState } from "react";

export function PrivacyExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <section className="panel section">
      <button
        type="button"
        className="collapsible-header"
        onClick={() => setOpen((value) => !value)}
      >
        <span>How does confidential attestation work?</span>
        <span className={`chevron ${open ? "open" : ""}`} aria-hidden>
          \u2304
        </span>
      </button>

      {open ? (
        <div className="privacy-content">
          <ol>
            <li>Warehouse API returns inventory count.</li>
            <li>DON nodes fetch via Confidential HTTP and reach consensus.</li>
            <li>Workflow computes casks x tokensPerCask {"\u2265"} totalTokenSupply.</li>
            <li>Only boolean result and attestation hash are written onchain.</li>
          </ol>
          <p>
            Raw inventory count never appears in contract storage or emitted events in confidential mode.
          </p>
        </div>
      ) : null}
    </section>
  );
}
