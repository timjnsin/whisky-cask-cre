import Link from "next/link";
import { ModeBadge } from "@/components/status-badge";
import { AttestationMode } from "@/lib/types";

interface NavProps {
  mode: AttestationMode;
  active: "reserve" | "casks" | "lifecycle";
}

const tabs = [
  { id: "reserve", href: "/", label: "Reserve" },
  { id: "casks", href: "/casks", label: "Casks" },
  { id: "lifecycle", href: "/lifecycle", label: "Lifecycle" },
] as const;

export function Nav({ mode, active }: NavProps) {
  return (
    <header className="top-nav panel">
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          \u25C6
        </span>
        <span className="brand-text">Whisky Cask Vault</span>
      </div>

      {mode === "public" ? (
        <nav className="tabs" aria-label="Primary">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={`tab-link ${active === tab.id ? "active" : ""}`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      ) : (
        <div className="tabs-placeholder">Reserve</div>
      )}

      <ModeBadge mode={mode} />
    </header>
  );
}