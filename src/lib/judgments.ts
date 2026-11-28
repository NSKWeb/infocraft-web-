import { choice, noul, score } from "@typesafe-ai/sdk";
import type { InfographicResponse } from "@/lib/infographic-schema";
import { getTypesafeClient, isTypesafeConfigured } from "@/lib/typesafe";
import { formatPercent, TEMPLATE_LABELS, type LayoutDecision, type QualityVerdict, type SourceScreen, type TemplateType } from "@/lib/types";

/**
 * Judgment layer.
 *
 * Three typed questions sit around the generation call:
 *
 *  1. A Noul screen asks whether the source can support an infographic at all, before a
 *     generation call is spent on it.
 *  2. A Choice picks between the four fixed layouts. This replaces the layout the model used
 *     to pick for itself and hand back with no confidence attached, which silently overrode
 *     the layout the user chose on the canvas.
 *  3. A Score grades the finished infographic against an editorial rubric.
 *
 * The screen and the layout pick read the same state, so they are asked together in one
 * request and evaluated in parallel. Code owns the policy: the thresholds, the fallbacks and
 * what happens next all live here, not in the model.
 */

/** A screen answer at or above this counts as "yes, this source can work". */
export const SCREEN_YES_ABOVE = 0.7;

/** A screen answer at or below this counts as "no". */
export const SCREEN_NO_BELOW = 0.3;

/** How sure the layout pick has to be before it replaces the user's selection. */
export const LAYOUT_OVERRIDE_THRESHOLD = 0.6;

/** A finished infographic scoring below this is flagged for review. */
export const QUALITY_REVIEW_BELOW = 2;

/** How much of the source a judgment reads. Enough signal to judge structure, cheap to send. */
const SOURCE_PREVIEW_LIMIT = 4000;

/** Below this the source carries too little signal to judge, so it is left alone. */
const SOURCE_MIN_CHARS = 40;

/**
 * The quality grade runs last in the request, after a slower generation call has already
 * spent most of the budget, so it gets the shortest timeout and no retries.
 */
const QUALITY_TIMEOUT_MS = 2500;

/**
 * The four layouts, described so that each option stands on its own. A criterion without a
 * description would be interpreted by its name alone.
 */
export const LAYOUT_CRITERIA = {
  KPI_STACK: "The source leads with a few headline numbers — KPIs, percentages, totals, growth figures — and those metrics are the point of the content.",
  PROCESS_FLOW: "The source describes an ordered sequence of steps, stages or phases, such as a workflow, a pipeline or a how-to process.",
  COMPARISON: "The source sets two or more alternatives against each other — pros and cons, before and after, one option measured against another.",
  DIGEST: "The source is a general editorial summary with no dominant structure: several related points of roughly equal weight, with no clear sequence and no single headline metric."
} as const satisfies Record<TemplateType, string>;

/** The editorial rubric the finished infographic is graded against, lowest level first. */
export const QUALITY_RUBRIC = [
  "Weak — generic filler, sections that repeat one another, or figures that appear nowhere in the source.",
  "Fair — readable and on topic, but the wording is generic and some figures or claims are not supported by the source.",
  "Strong — specific, faithful to the source, with a clear hierarchy and every section adding something the others do not.",
  "Exceptional — a sharp headline, every figure traceable to the source, tight hierarchy, and a takeaway worth quoting."
] as const;

/** Labels for the levels of the rubric, in the same order. */
export const QUALITY_LEVEL_LABELS = ["Weak", "Fair", "Strong", "Exceptional"] as const;

/**
 * Decide which layout is rendered.
 *
 * The judgment replaces the user's selection only when it is confident enough to do so.
 * Below the threshold the explicit choice the user made on the canvas wins, and the reasoning
 * is still reported so the interface can explain itself.
 */
export function decideLayout(input: {
  preferred: TemplateType;
  pick?: TemplateType | null;
  probability?: number | null;
  confidence?: number | null;
  probabilities?: Partial<Record<TemplateType, number>> | null;
  threshold?: number;
}): LayoutDecision {
  const threshold = input.threshold ?? LAYOUT_OVERRIDE_THRESHOLD;
  const preferred = input.preferred;
  const pick = input.pick ?? null;

  if (!pick) {
    return {
      template: preferred,
      source: "fallback",
      probability: null,
      confidence: null,
      probabilities: null,
      reason: "No layout judgment was available, so your layout was kept."
    };
  }

  const probability = input.probability ?? null;
  const confidence = input.confidence ?? null;
  const probabilities = input.probabilities ?? null;

  if (pick === preferred) {
    return {
      template: pick,
      source: "typesafe",
      probability,
      confidence,
      probabilities,
      reason: `Jev agreed with your layout (${formatPercent(probability)}).`
    };
  }

  if (probability !== null && probability >= threshold) {
    return {
      template: pick,
      source: "typesafe",
      probability,
      confidence,
      probabilities,
      reason: `Jev chose ${TEMPLATE_LABELS[pick]} over ${TEMPLATE_LABELS[preferred]} (${formatPercent(probability)}).`
    };
  }

  return {
    template: preferred,
    source: "preference",
    probability,
    confidence,
    probabilities,
    reason: `Jev was not decisive (${formatPercent(probability)}), so your layout was kept.`
  };
}

/** Turn the screen's probability into the three outcomes the pipeline handles. */
export function verdictForScreen(noul: number | null): SourceScreen {
  if (noul === null) {
    return { verdict: "skipped", noul: null, reason: "The source was not screened." };
  }
  if (noul >= SCREEN_YES_ABOVE) {
    return { verdict: "ready", noul, reason: "The source has enough specific content to build an infographic from." };
  }
  if (noul <= SCREEN_NO_BELOW) {
    return { verdict: "rejected", noul, reason: "The source does not have enough specific content to build an infographic from." };
  }
  return { verdict: "thin", noul, reason: "The source is thin, so the result may be generic." };
}

/** Turn the rubric score into a level and a piece of advice. */
export function verdictForQuality(value: number | null, confidence: number | null): QualityVerdict {
  const max = QUALITY_RUBRIC.length - 1;

  if (value === null) {
    return { score: null, max, level: "Not scored", confidence: null, reason: "The result was not scored." };
  }

  const levelIndex = Math.min(max, Math.max(0, Math.round(value)));
  const level = QUALITY_LEVEL_LABELS[levelIndex];
  const reason = value < QUALITY_REVIEW_BELOW
    ? "Editorial quality is below the review threshold — check every figure against the source before publishing."
    : "Editorial quality looks strong — still verify the figures against the source before publishing.";

  return { score: value, max, level, confidence, reason };
}

/** The source judgment and the layout judgment, taken together. */
export interface SourceJudgment {
  screen: SourceScreen;
  layout: LayoutDecision;
}

/**
 * Judge the source before generating.
 *
 * The screen and the layout pick read the same state, so they are asked in one request and
 * evaluated in parallel. When the service is unavailable, or the source is too short to
 * judge, both fall back to the previous behaviour.
 */
export async function judgeSource(input: {
  sourceText: string;
  hasImage: boolean;
  outputLanguage?: string;
  preferred: TemplateType;
}): Promise<SourceJudgment> {
  const fallback: SourceJudgment = {
    screen: { verdict: "skipped", noul: null, reason: "The source was not screened." },
    layout: decideLayout({ preferred: input.preferred })
  };

  if (!isTypesafeConfigured()) return fallback;
  if (input.sourceText.trim().length < SOURCE_MIN_CHARS) return fallback;

  try {
    const { answers } = await getTypesafeClient().systemOne({
      state: {
        sourceText: input.sourceText.slice(0, SOURCE_PREVIEW_LIMIT),
        hasImage: input.hasImage,
        outputLanguage: input.outputLanguage?.trim() || "the same language as the source"
      },
      questions: {
        screen: noul(
          "Does the source material in `sourceText` contain enough specific, supportable content to build a factual infographic from — concrete figures, named steps, or comparable items rather than general statements?",
          {
            true: "The source contains specific figures, metrics, named steps or comparable items that can be shown as an infographic without inventing anything.",
            false: "The source is general or opinion-based, with no specific figures, named steps or comparable items to visualise."
          }
        ),
        layout: choice(
          "Which single infographic layout best represents the source material in `sourceText`? Judge the structure the source actually has, not the topics it mentions.",
          LAYOUT_CRITERIA
        )
      }
    });

    const pick = answers.layout.choice;
    const probability = answers.layout.probabilities[pick] ?? null;

    return {
      screen: verdictForScreen(answers.screen.noul),
      layout: decideLayout({
        preferred: input.preferred,
        pick,
        probability,
        confidence: answers.layout.confidence,
        probabilities: answers.layout.probabilities
      })
    };
  } catch {
    return fallback;
  }
}

/**
 * Grade the finished infographic against the editorial rubric.
 *
 * The source travels with the result so that figures can be checked against it, which is the
 * part of quality that matters most for something meant to be published.
 */
export async function judgeEditorialQuality(input: {
  project: InfographicResponse;
  sourceText: string;
}): Promise<QualityVerdict> {
  if (!isTypesafeConfigured()) return verdictForQuality(null, null);

  try {
    const { answers } = await getTypesafeClient().systemOne({
      state: {
        sourceText: input.sourceText.slice(0, SOURCE_PREVIEW_LIMIT),
        infographic: {
          title: input.project.title,
          subtitle: input.project.subtitle,
          kickerTag: input.project.kickerTag,
          heroStat: {
            value: input.project.heroStatValue,
            label: input.project.heroStatLabel,
            delta: input.project.heroStatDelta
          },
          takeawayQuote: input.project.takeawayQuote,
          sections: input.project.sections.map(section => ({
            heading: section.heading,
            summary: section.summary,
            metric: section.metricValue,
            unit: section.metricUnit
          }))
        }
      },
      questions: {
        editorial: score(
          "How strong is this infographic as an editorial artefact, judged against the source material in `sourceText`? Judge specificity, faithfulness to the source, information hierarchy, and whether every section adds something the others do not.",
          QUALITY_RUBRIC
        )
      }
    }, { timeout: QUALITY_TIMEOUT_MS, retry: { maxRetries: 0 } });

    return verdictForQuality(answers.editorial.score, answers.editorial.confidence);
  } catch {
    return verdictForQuality(null, null);
  }
}
