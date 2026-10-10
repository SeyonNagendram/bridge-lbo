import { Calculator } from "@/components/Calculator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { APP_NAME } from "@/lib/site";

export default function Home() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 lg:px-8">
      <header className="flex items-start justify-between gap-4 pt-6">
        <div>
          <h1 className="font-serif text-[28px] leading-9 font-semibold">{APP_NAME}</h1>
          <p className="text-muted">LBO returns calculator</p>
        </div>
        <ThemeToggle />
      </header>
      <main className="pt-3">
        <Calculator />
      </main>
    </div>
  );
}
