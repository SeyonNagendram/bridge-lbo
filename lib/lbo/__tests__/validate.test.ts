import { describe, expect, it } from "vitest";
import { calculate } from "../engine";
import { BASE_CASE, INPUT_KEYS, INPUT_SPECS } from "../inputs";
import type { LboInputs } from "../types";
import { validateInputs } from "../validate";

const scenario = (overrides: Partial<LboInputs>): LboInputs => ({ ...BASE_CASE, ...overrides });

describe("validateInputs", () => {
  it("accepts the base case", () => {
    expect(validateInputs(BASE_CASE)).toEqual([]);
  });

  it.each([
    ["equal to", 8.0, 8.0],
    ["above", 6.0, 7.0],
  ])("rejects leverage %s the entry multiple", (_, entryMultiple, leverage) => {
    const errors = validateInputs(scenario({ entryMultiple, leverage }));
    expect(errors).toEqual([
      { field: "leverage", message: "Leverage must be below the entry multiple." },
    ]);
    expect(calculate(scenario({ entryMultiple, leverage })).ok).toBe(false);
  });

  it("accepts leverage just below the entry multiple", () => {
    expect(validateInputs(scenario({ entryMultiple: 8.0, leverage: 7.5 }))).toEqual([]);
  });

  it("accepts every range boundary (inclusive)", () => {
    for (const key of INPUT_KEYS) {
      for (const bound of [INPUT_SPECS[key].min, INPUT_SPECS[key].max]) {
        // Keep the leverage < entry rule satisfied while probing single-field bounds.
        const inputs = scenario({ [key]: bound, entryMultiple: key === "entryMultiple" ? bound : 20, leverage: key === "leverage" ? bound : 0 });
        expect(validateInputs(inputs), `${key} = ${bound}`).toEqual([]);
      }
    }
  });

  it("rejects values just outside every range", () => {
    for (const key of INPUT_KEYS) {
      const { min, max, step } = INPUT_SPECS[key];
      for (const value of [min - step, max + step]) {
        const errors = validateInputs(scenario({ [key]: value }));
        expect(errors.some((e) => e.field === key), `${key} = ${value}`).toBe(true);
      }
    }
  });

  it("formats range messages in display units", () => {
    expect(validateInputs(scenario({ ebitdaMargin: 0.7 }))[0].message).toBe("Must be between 1% and 60%.");
    expect(validateInputs(scenario({ exitMultiple: 25 }))[0].message).toBe("Must be between 3.0x and 20.0x.");
    expect(validateInputs(scenario({ revenue0: 0 }))[0].message).toBe("Must be between €1m and €10,000m.");
    expect(validateInputs(scenario({ revenueGrowth: -0.2 }))[0].message).toBe("Must be between -10% and 30%.");
  });

  it("rejects a non-integer holding period", () => {
    expect(validateInputs(scenario({ holdingPeriod: 4.5 }))).toEqual([
      { field: "holdingPeriod", message: "Must be a whole number." },
    ]);
  });

  it.each([NaN, Infinity, -Infinity])("rejects %s", (bad) => {
    const errors = validateInputs(scenario({ taxRate: bad }));
    expect(errors).toEqual([{ field: "taxRate", message: "Enter a number." }]);
  });

  it("does not run the model when inputs are invalid", () => {
    const outcome = calculate(scenario({ revenue0: NaN }));
    expect(outcome.ok).toBe(false);
  });
});
