import { beforeEach, describe, expect, it, vi } from "vitest";
import { judgeEditorialQuality, judgeSource } from "@/lib/judgments";
import type { InfographicResponse } from "@/lib/infographic-schema";

const project: InfographicResponse = {
  title: "Renewable capacity",
  subtitle: "A visual briefing on the energy transition.",
  kickerTag: "ENERGY / 2026",
  recommendedTemplate: "KPI_STACK",
  heroStatValue: "3×",
  heroStatLabel: "More clean power",
  heroStatDelta: "+18%",
  takeawayQuote: "The next energy era will be built as much on smarter grids as on new generation.",
  sections: [
    { indexLabel: "01", heading: "Solar scales up", summary: "Falling costs are changing the economics of electricity.", metricValue: "01", metricUnit: "Generation", barRatio: 0.9 }
  ]
};

const longSource = "Global renewable energy capacity grew rapidly in 2024. Solar and wind led new additions. Grid modernisation and storage remain important to reliability.";

describe("judgments when TypeSafe is not configured", () => {
  beforeEach(() => {
    // An empty key counts as not configured, which is how the app behaves without one.
    vi.stubEnv("TYPESAFE_API_KEY", "");
  });

  it("skips the screen and keeps the user's layout", async () => {
    const result = await judgeSource({ sourceText: longSource, hasImage: false, preferred: "COMPARISON" });

    expect(result.screen.verdict).toBe("skipped");
    expect(result.screen.noul).toBeNull();
    expect(result.layout.template).toBe("COMPARISON");
    expect(result.layout.source).toBe("fallback");
  });

  it("leaves the finished infographic unscored", async () => {
    const verdict = await judgeEditorialQuality({ project, sourceText: longSource });

    expect(verdict.score).toBeNull();
    expect(verdict.level).toBe("Not scored");
  });
});

describe("judgments on a source with too little to judge", () => {
  beforeEach(() => {
    vi.stubEnv("TYPESAFE_API_KEY", "");
  });

  it("does not judge a source shorter than the minimum", async () => {
    const result = await judgeSource({ sourceText: "Too short.", hasImage: false, preferred: "DIGEST" });

    expect(result.screen.verdict).toBe("skipped");
    expect(result.layout.source).toBe("fallback");
  });
});
