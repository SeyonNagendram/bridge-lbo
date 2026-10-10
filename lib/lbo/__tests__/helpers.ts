import { expect } from "vitest";
import { INPUT_SPECS } from "../inputs";
import type { LboInputs } from "../types";

/** Tolerances from brief §6. */
export const TOL = {
  eur: 0.05, // €m
  multiple: 0.05, // x
  irr: 0.001, // 0.1 percentage points
} as const;

// Tiny slack so a value exactly on the tolerance edge isn't failed by float noise.
const FLOAT_SLACK = 1e-9;

export function expectWithin(actual: number, expected: number, tolerance: number, label?: string) {
  const diff = Math.abs(actual - expected);
  expect(
    diff <= tolerance + FLOAT_SLACK,
    `${label ?? "value"}: expected ${expected} ± ${tolerance}, got ${actual}`,
  ).toBe(true);
}

/** Deterministic PRNG (mulberry32) so random tests are reproducible. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random input set that is valid by construction (every range in §3, leverage < entry). */
export function randomValidInputs(rand: () => number): LboInputs {
  const u = (key: keyof LboInputs) => {
    const { min, max } = INPUT_SPECS[key];
    return min + rand() * (max - min);
  };
  const entryMultiple = u("entryMultiple");
  const maxLeverage = Math.min(INPUT_SPECS.leverage.max, entryMultiple - 0.01);
  const { min: hpMin, max: hpMax } = INPUT_SPECS.holdingPeriod;

  return {
    revenue0: u("revenue0"),
    ebitdaMargin: u("ebitdaMargin"),
    entryMultiple,
    leverage: rand() * maxLeverage,
    feePct: u("feePct"),
    revenueGrowth: u("revenueGrowth"),
    interestRate: u("interestRate"),
    taxRate: u("taxRate"),
    capexPct: u("capexPct"),
    daPct: u("daPct"),
    nwcPct: u("nwcPct"),
    exitMultiple: u("exitMultiple"),
    holdingPeriod: hpMin + Math.floor(rand() * (hpMax - hpMin + 1)),
  };
}

/** Recursively asserts every number in a value is finite and nothing is undefined. */
export function expectAllFinite(value: unknown, path = "result"): void {
  if (value === undefined) throw new Error(`${path} is undefined`);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} is ${value}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => expectAllFinite(v, `${path}[${i}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) expectAllFinite(v, `${path}.${k}`);
  }
}
