import { Calculator } from "@/components/Calculator";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/SiteHeader";

export default function Home() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 lg:px-8">
      <SiteHeader page="model" />
      <main className="pt-3">
        <Calculator />
      </main>
      <Footer />
    </div>
  );
}
