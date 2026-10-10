// Golden values from Seyon's Excel model (brief §6). If these fail, the code is wrong.
import { describe, expect, it } from "vitest";
import { runLbo } from "../engine";
import { BASE_CASE } from "../inputs";
import { sensitivityGrid } from "../sensitivity";
import { TOL, expectWithin } from "./helpers";

describe("base case matches the Excel model", () => {
  const r = runLbo(BASE_CASE);
  const y = (t: number) => r.years[t - 1];

  it("entry: EV, fees, equity invested", () => {
    expectWithin(r.entry.enterpriseValue, 80.0, TOL.eur, "EV entry");
    expectWithin(r.entry.fees, 1.6, TOL.eur, "Fees");
    expectWithin(r.entry.equity, 31.6, TOL.eur, "Equity invested");
  });

  it("revenue Y1 / Y5", () => {
    expectWithin(y(1).revenue, 53.0, TOL.eur, "Revenue Y1");
    expectWithin(y(5).revenue, 66.9, TOL.eur, "Revenue Y5");
  });

  it("EBITDA Y5 and interest Y1", () => {
    expectWithin(y(5).ebitda, 13.38, TOL.eur, "EBITDA Y5");
    expectWithin(y(1).interest, 3.5, TOL.eur, "Interest Y1");
  });

  it("FCF Y1 … Y5", () => {
    const expected = [3.56, 4.09, 4.67, 5.31, 6.0];
    expect(r.years).toHaveLength(5);
    expected.forEach((v, i) => expectWithin(r.years[i].fcf, v, TOL.eur, `FCF Y${i + 1}`));
  });

  it("debt end of Y1 … Y5", () => {
    const expected = [46.44, 42.35, 37.68, 32.37, 26.37];
    expected.forEach((v, i) => expectWithin(r.years[i].debt, v, TOL.eur, `Debt Y${i + 1}`));
  });

  it("exit: EV, equity, MoM, IRR", () => {
    expectWithin(r.exit.enterpriseValue, 107.06, TOL.eur, "EV exit");
    expectWithin(r.exit.equity, 80.69, TOL.eur, "Equity at exit");
    expectWithin(r.returns.mom, 2.55, TOL.multiple, "MoM");
    expect(r.returns.irr).not.toBeNull();
    expectWithin(r.returns.irr!, 0.206, TOL.irr, "IRR");
  });

  it("raises no warnings", () => {
    expect(r.warnings).toEqual([]);
  });
});

describe("sensitivity grid (IRR) matches the Excel model", () => {
  const grid = sensitivityGrid(BASE_CASE);
  const multiples = [7.0, 7.5, 8.0, 8.5, 9.0];
  // rows = entry multiple, columns = exit multiple
  const expected = [
    [25.8, 28.2, 30.4, 32.5, 34.5],
    [20.5, 22.8, 24.9, 26.9, 28.8],
    [16.3, 18.6, 20.6, 22.6, 24.4],
    [12.9, 15.1, 17.1, 18.9, 20.7],
    [10.0, 12.1, 14.1, 15.9, 17.6],
  ];

  it("has 7.0x … 9.0x on both axes", () => {
    expect(grid.entryMultiples).toEqual(multiples);
    expect(grid.exitMultiples).toEqual(multiples);
  });

  expected.forEach((row, i) => {
    it(`entry ${multiples[i].toFixed(1)}x row`, () => {
      row.forEach((pct, j) => {
        const cell = grid.cells[i][j];
        expect(cell).not.toBeNull();
        expect(cell!.irr).not.toBeNull();
        expectWithin(
          cell!.irr!,
          pct / 100,
          TOL.irr,
          `IRR @ entry ${multiples[i]}x / exit ${multiples[j]}x`,
        );
      });
    });
  });

  it("centre cell equals the base case exactly", () => {
    const base = runLbo(BASE_CASE);
    expect(grid.cells[2][2]!.irr).toBe(base.returns.irr);
    expect(grid.cells[2][2]!.mom).toBe(base.returns.mom);
  });
});
