// Verifies the frontend renders from the SAME generated registry bundle the
// backend produces. If the mirror import breaks or drifts, this fails.
import { describe, it, expect } from "vitest";
import { citeInProse, CITATIONS, LAW_VERSION } from "./cite.js";

describe("frontend citeInProse (generated registry mirror)", () => {
  it("renders section + subsection + Act", () => {
    expect(citeInProse("FCRA_611", "a_1_A")).toBe("§611(a)(1)(A) of the FCRA (15 U.S.C. §1681i)");
    expect(citeInProse("FCRA_605")).toBe("§605 of the FCRA (15 U.S.C. §1681c)");
  });

  it("labels FDCPA sections as FDCPA, not FCRA", () => {
    expect(citeInProse("FDCPA_809")).toBe("§809 of the FDCPA (15 U.S.C. §1692g)");
  });

  it("imports the same catalog the backend generated (13 sections, semver version)", () => {
    expect(Object.keys(CITATIONS)).toHaveLength(13);
    expect(CITATIONS.FCRA_611.usc).toBe("15 U.S.C. §1681i");
    expect(LAW_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
