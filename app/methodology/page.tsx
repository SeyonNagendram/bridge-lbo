import { Footer } from "@/components/Footer";
import { Methodology } from "@/components/Methodology";
import { ScenarioLink } from "@/components/ScenarioLink";
import { SiteHeader } from "@/components/SiteHeader";
import { pageMetadata } from "@/lib/metadata";
import { APP_NAME } from "@/lib/site";

export const metadata = pageMetadata({
  title: `Methodology · ${APP_NAME}`,
  description:
    "How the Bridge LBO model works, step by step with every formula: entry, operations, debt and cash sweep, exit returns, credit statistics, the value creation bridge, sensitivity and the simplifying assumptions.",
  path: "/methodology",
});

// Static text, rendered on the server; the only JavaScript is the theme toggle and the scenario links.
export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 lg:px-8">
      <SiteHeader page="methodology" />
      <main className="pt-6">
        <ScenarioLink
          href="/"
          className="text-[13px] text-muted underline-offset-4 transition-colors duration-150 hover:text-text hover:underline"
        >
          <span aria-hidden="true">← </span>Back to model
        </ScenarioLink>
        <div className="mt-8 border-t border-border pt-8">
          <Methodology />
        </div>
      </main>
      <Footer />
    </div>
  );
}
