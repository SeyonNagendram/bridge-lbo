import { describe, expect, it } from "vitest";
import { runLbo } from "../engine";
import { BASE_CASE } from "../inputs";
import { sensitivityGrid } from "../sensitivity";

describe("performance (brief §2: < 1 ms for model + 25-cell grid)", () => {
  it("full recalculation averages well under 1 ms", () => {
    const recalc = () => {
      runLbo(BASE_CASE);
      sensitivityGrid(BASE_CASE);
    };
    for (let i = 0; i < 200; i++) recalc(); // warm up the JIT

    const runs = 2000;
    const start = performance.now();
    for (let i = 0; i < runs; i++) recalc();
    const avgMs = (performance.now() - start) / runs;

    console.info(`avg full recalculation: ${(avgMs * 1000).toFixed(1)} µs`);
    expect(avgMs).toBeLessThan(1);
  });
});
