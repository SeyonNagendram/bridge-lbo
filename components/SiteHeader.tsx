// Page header shared by the model and the methodology page: name, subtitle, Methodology link, theme toggle.

import { APP_NAME, APP_SUBTITLE } from "@/lib/site";
import { ScenarioLink } from "./ScenarioLink";
import { ThemeToggle } from "./ThemeToggle";

const title = "font-serif text-[28px] leading-9 font-semibold";

export function SiteHeader({ page }: { page: "model" | "methodology" }) {
  return (
    <header className="flex items-start justify-between gap-4 pt-6">
      <div>
        {/* The name is the model page's heading; the methodology page has its own h1. */}
        {page === "model" ? <h1 className={title}>{APP_NAME}</h1> : <p className={title}>{APP_NAME}</p>}
        <p className="text-muted">{APP_SUBTITLE}</p>
      </div>
      <nav aria-label="Pages" className="flex items-center gap-4">
        <ScenarioLink
          href="/methodology"
          aria-current={page === "methodology" ? "page" : undefined}
          className="text-[13px] text-muted underline-offset-4 transition-colors duration-150 hover:text-text hover:underline aria-[current=page]:text-text"
        >
          Methodology
        </ScenarioLink>
        <ThemeToggle />
      </nav>
    </header>
  );
}
