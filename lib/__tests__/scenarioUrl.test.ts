import { describe, expect, it } from "vitest";
import { BASE_CASE, INPUT_KEYS, INPUT_SPECS, validateInputs, type LboInputs } from "../lbo";
import { formatInputValue, parseInputValue } from "../format";
import { initialState } from "../calculatorState";
import { URL_KEYS, inputsFromQuery, mergeScenarioQuery, scenarioQuery } from "../scenarioUrl";
import { seededRandom } from "../lbo/__tests__/helpers";

const scenario = (overrides: Partial<LboInputs>): LboInputs => ({ ...BASE_CASE, ...overrides });

describe("scenarioQuery", () => {
  it("is empty for the base case", () => {
    expect(scenarioQuery(BASE_CASE)).toBe("");
  });

  it("writes only the inputs that differ, in field units", () => {
    expect(scenarioQuery(scenario({ entryMultiple: 9, revenueGrowth: 0.065, holdingPeriod: 7 }))).toBe(
      "entry=9&growth=6.5&yrs=7",
    );
    expect(scenarioQuery(scenario({ revenue0: 10_000, leverage: 0, revenueGrowth: -0.1 }))).toBe(
      "rev=10000&lev=0&growth=-10",
    );
  });

  it("has a distinct short key for every input", () => {
    expect(Object.keys(URL_KEYS).sort()).toEqual([...INPUT_KEYS].sort());
    expect(new Set(Object.values(URL_KEYS)).size).toBe(INPUT_KEYS.length);
  });
});

describe("mergeScenarioQuery", () => {
  it("keeps other parameters and replaces the scenario's own", () => {
    expect(mergeScenarioQuery("?utm_source=linkedin&entry=7", scenario({ exitMultiple: 9 }))).toBe(
      "?utm_source=linkedin&exit=9",
    );
  });
  it("is empty for the base case with nothing else in the URL", () => {
    expect(mergeScenarioQuery("?entry=9&lev=6", BASE_CASE)).toBe("");
  });
});

describe("inputsFromQuery", () => {
  it("restores what scenarioQuery wrote (500 random scenarios at field precision)", () => {
    const random = seededRandom(11);
    for (let i = 0; i < 500; i++) {
      const inputs = {} as LboInputs;
      for (const key of INPUT_KEYS) {
        const spec = INPUT_SPECS[key];
        const raw = spec.min + random() * (spec.max - spec.min);
        // As the fields hold them: rounded to display precision.
        inputs[key] = parseInputValue(formatInputValue(raw, spec), spec);
      }
      if (validateInputs(inputs).length > 0) continue; // leverage ≥ entry: not a scenario anyone can have
      expect(inputsFromQuery(`?${scenarioQuery(inputs)}`)).toEqual(inputs);
    }
  });

  it("returns the base case for an empty or unrelated query", () => {
    expect(inputsFromQuery("")).toEqual(BASE_CASE);
    expect(inputsFromQuery("?utm_source=linkedin")).toEqual(BASE_CASE);
  });

  it("falls back to the base case per input for malformed or out-of-range values", () => {
    expect(inputsFromQuery("?entry=abc&exit=9")).toEqual(scenario({ exitMultiple: 9 }));
    expect(inputsFromQuery("?rev=0&margin=70&yrs=8&growth=-11&exit=12")).toEqual(scenario({ exitMultiple: 12 }));
    expect(inputsFromQuery("?yrs=4.5&tax=25")).toEqual(scenario({ taxRate: 0.25 }));
    expect(inputsFromQuery("?rev=Infinity&rate=NaN&capex=&da=1e400")).toEqual(BASE_CASE);
  });

  it("falls back on both multiples when leverage would not be below the entry multiple", () => {
    expect(inputsFromQuery("?lev=8")).toEqual(BASE_CASE); // 8.0x leverage against the base 8.0x entry
    expect(inputsFromQuery("?entry=4&lev=6&exit=10")).toEqual(scenario({ exitMultiple: 10 }));
  });

  it("rounds to what the fields show, so the link restores exactly what is on screen", () => {
    expect(inputsFromQuery("?rev=50.25&margin=20.04").revenue0).toBe(50.3);
    expect(inputsFromQuery("?margin=20.04").ebitdaMargin).toBe(0.2);
  });

  it("always yields inputs that pass validation, whatever the query (2,000 random queries)", () => {
    const random = seededRandom(5);
    const junk = ["", "-", "abc", "1e9", "-0", "0", "3", "7.5", "100", "-50", "8x", "20%", "1,000", "Infinity"];
    for (let i = 0; i < 2000; i++) {
      const params = new URLSearchParams();
      for (const key of Object.values(URL_KEYS)) {
        if (random() < 0.5) params.set(key, junk[Math.floor(random() * junk.length)]);
      }
      expect(validateInputs(inputsFromQuery(`?${params}`))).toEqual([]);
    }
  });
});

describe("initialState from a shared scenario", () => {
  it("opens on the restored inputs, with the grid centred on them", () => {
    const state = initialState(inputsFromQuery("?entry=9&exit=10&yrs=7"));
    expect(state.result.inputs).toEqual(scenario({ entryMultiple: 9, exitMultiple: 10, holdingPeriod: 7 }));
    expect(state.drafts.entryMultiple).toBe("9.0");
    expect(state.anchor).toEqual({ entryMultiple: 9, exitMultiple: 10 });
    expect(state.errors).toEqual([]);
  });
});
