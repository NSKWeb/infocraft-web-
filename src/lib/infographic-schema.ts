import { z } from "zod";

export const infographicSchema = z.object({
  title: z.string().min(1).max(140),
  subtitle: z.string().max(280),
  kickerTag: z.string().max(48),
  recommendedTemplate: z.enum(["KPI_STACK", "PROCESS_FLOW", "COMPARISON", "DIGEST"]),
  heroStatValue: z.string().max(40),
  heroStatLabel: z.string().max(100),
  heroStatDelta: z.string().max(40),
  takeawayQuote: z.string().max(320),
  sections: z.array(z.object({
    indexLabel: z.string().max(8),
    heading: z.string().min(1).max(80),
    summary: z.string().max(500),
    metricValue: z.string().max(40),
    metricUnit: z.string().max(80),
    barRatio: z.number().min(0).max(1)
  })).min(1).max(8)
});

export type InfographicResponse = z.infer<typeof infographicSchema>;
