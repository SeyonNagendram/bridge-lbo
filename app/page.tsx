import { Calculator } from "@/components/Calculator";
import { Footer } from "@/components/Footer";
import { Methodology } from "@/components/Methodology";
import { ThemeToggle } from "@/components/ThemeToggle";
import { APP_NAME, APP_SUBTITLE } from "@/lib/site";

export default function Home() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 lg:px-8">
      <header className="flex items-start justify-between gap-4 pt-6">
        <div>
          <h1 className="font-serif text-[28px] leading-9 font-semibold">{APP_NAME}</h1>
          <p className="text-muted">{APP_SUBTITLE}</p>
        </div>
        <ThemeToggle />
      </header>
      <main className="pt-3">
        <Calculator />
        {/* Static text, rendered on the server: no JavaScript. On desktop it lines up with the results
            column (340px panel + 32px gap). */}
        <div className="mt-16 border-t border-border pt-8 lg:ml-[372px]">
          <Methodology />
        </div>
      </main>
      <Footer />
    </div>
  );
}
