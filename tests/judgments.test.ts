import { describe, expect, it } from "vitest";
import { decideLayout, LAYOUT_OVERRIDE_THRESHOLD, verdictForQuality, verdictForScreen } from "@/lib/judgments";
import { normalizeTemplateType, summarizeJudgments } from "@/lib/types";

describe("decideLayout", () => {
  it("falls back to the user's layout when there is no judgment", () => {
    const decision = decideLayout({ preferred: "COMPARISON" });

    expect(decision.template).toBe("COMPARISON");
    expect(decision.source).toBe("fallback");
    expect(decision.probability).toBeNull();
  });

  it("keeps the judgment's pick when it agrees with the user", () => {
    const decision = decideLayout({ preferred: "KPI_STACK", pick: "KPI_STACK", probability: 0.91 });

    expect(decision.template).toBe("KPI_STACK");
    expect(decision.source).toBe("typesafe");
  });

  it("replaces the user's layout when the judgment is confident enough", () => {
    const decision = decideLayout({ preferred: "KPI_STACK", pick: "PROCESS_FLOW", probability: 0.78 });

    expect(decision.template).toBe("PROCESS_FLOW");
    expect(decision.source).toBe("typesafe");
    expect(decision.reason).toContain("Process Flow");
  });

  it("keeps the user's layout when the judgment is not decisive", () => {
    const decision = decideLayout({ preferred: "KPI_STACK", pick: "PROCESS_FLOW", probability: 0.44 });

    expect(decision.template).toBe("KPI_STACK");
    expect(decision.source).toBe("preference");
  });

  it("keeps the user's layout when the judgment gives no probability", () => {
    const decision = decideLayout({ preferred: "DIGEST", pick: "COMPARISON", probability: null });

    expect(decision.template).toBe("DIGEST");
    expect(decision.source).toBe("preference");
  });

  it("switches exactly at the override threshold", () => {
    const at = decideLayout({ preferred: "DIGEST", pick: "COMPARISON", probability: LAYOUT_OVERRIDE_THRESHOLD });
    const below = decideLayout({ preferred: "DIGEST", pick: "COMPARISON", probability: LAYOUT_OVERRIDE_THRESHOLD - 0.01 });

    expect(at.source).toBe("typesafe");
    expect(below.source).toBe("preference");
  });

  it("carries the full probability distribution through", () => {
    const probabilities = { KPI_STACK: 0.1, PROCESS_FLOW: 0.8, COMPARISON: 0.05, DIGEST: 0.05 };
    const decision = decideLayout({ preferred: "KPI_STACK", pick: "PROCESS_FLOW", probability: 0.8, probabilities });

    expect(decision.probabilities).toEqual(probabilities);
  });
});

describe("verdictForScreen", () => {
  it("accepts a source that clearly supports an infographic", () => {
    expect(verdictForScreen(0.92).verdict).toBe("ready");
  });

  it("rejects a source with nothing specific in it", () => {
    expect(verdictForScreen(0.08).verdict).toBe("rejected");
  });

  it("treats an undecided answer as thin rather than rounding it either way", () => {
    expect(verdictForScreen(0.5).verdict).toBe("thin");
  });

  it("marks a source as not screened when there is no answer", () => {
    expect(verdictForScreen(null).verdict).toBe("skipped");
  });

  it("treats the thresholds as inclusive", () => {
    expect(verdictForScreen(0.7).verdict).toBe("ready");
    expect(verdictForScreen(0.3).verdict).toBe("rejected");
  });
});

describe("verdictForQuality", () => {
  it("reports a score of null when the result was not scored", () => {
    const verdict = verdictForQuality(null, null);

    expect(verdict.score).toBeNull();
    expect(verdict.level).toBe("Not scored");
    expect(verdict.max).toBe(3);
  });

  it("maps a score onto the rubric level it rounds to", () => {
    expect(verdictForQuality(2.4, 0.8).level).toBe("Strong");
    expect(verdictForQuality(0.2, 0.7).level).toBe("Weak");
    expect(verdictForQuality(3, 0.9).level).toBe("Exceptional");
  });

  it("flags a result below the review threshold", () => {
    expect(verdictForQuality(1.2, 0.6).reason).toContain("below the review threshold");
    expect(verdictForQuality(2.6, 0.8).reason).not.toContain("below the review threshold");
  });

  it("clamps a score outside the rubric", () => {
    expect(verdictForQuality(-1, 0.5).level).toBe("Weak");
    expect(verdictForQuality(9, 0.5).level).toBe("Exceptional");
  });
});

describe("normalizeTemplateType", () => {
  it("keeps a known layout", () => {
    expect(normalizeTemplateType("PROCESS_FLOW")).toBe("PROCESS_FLOW");
  });

  it("falls back to the editorial digest for anything else", () => {
    expect(normalizeTemplateType("nope")).toBe("DIGEST");
    expect(normalizeTemplateType(undefined)).toBe("DIGEST");
    expect(normalizeTemplateType(null)).toBe("DIGEST");
  });
});

describe("summarizeJudgments", () => {
  it("returns nothing when there are no judgments", () => {
    expect(summarizeJudgments(null)).toBe("");
    expect(summarizeJudgments(undefined)).toBe("");
  });

  it("reports the layout and the quality grade", () => {
    const summary = summarizeJudgments({
      layout: { template: "PROCESS_FLOW", source: "typesafe", probability: 0.84, confidence: 0.9, probabilities: null, reason: "" },
      quality: { score: 2.4, max: 3, level: "Strong", confidence: 0.8, reason: "" },
      screen: { verdict: "ready", noul: 0.95, reason: "" }
    });

    expect(summary).toContain("Process Flow");
    expect(summary).toContain("84%");
    expect(summary).toContain("2.4/3");
    expect(summary).toContain("Strong");
  });

  it("warns when the source was thin", () => {
    const summary = summarizeJudgments({
      screen: { verdict: "thin", noul: 0.5, reason: "" }
    });

    expect(summary).toContain("thin");
  });
});
