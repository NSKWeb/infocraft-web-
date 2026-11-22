export type TemplateType = "KPI_STACK" | "PROCESS_FLOW" | "COMPARISON" | "DIGEST";
export type PaletteId = "SWISS_VERMILION" | "COBALT_BLUEPRINT" | "CHARCOAL_PRESS" | "FOREST_OCHRE";
export type GenerationMode = "FAST" | "HIGH_THINKING" | "PHOTO_SCAN";

export interface InfographicSection {
  indexLabel: string;
  heading: string;
  summary: string;
  metricValue: string;
  metricUnit: string;
  barRatio: number;
}

export interface InfographicProject {
  id: string;
  userId?: string;
  title: string;
  subtitle: string;
  kickerTag: string;
  sourceText: string;
  templateType: TemplateType;
  paletteId: PaletteId;
  generationMode: GenerationMode;
  searchGrounded: boolean;
  heroStatValue: string;
  heroStatLabel: string;
  heroStatDelta: string;
  takeawayQuote: string;
  sections: InfographicSection[];
  citations: Array<{ title: string; uri: string }>;
  createdAt: number;
  updatedAt: number;
}

export const TEMPLATE_LABELS: Record<TemplateType, string> = {
  KPI_STACK: "KPI Stack",
  PROCESS_FLOW: "Process Flow",
  COMPARISON: "Comparison",
  DIGEST: "Editorial Digest"
};

export const PALETTE_LABELS: Record<PaletteId, string> = {
  SWISS_VERMILION: "Swiss Vermilion",
  COBALT_BLUEPRINT: "Cobalt Blueprint",
  CHARCOAL_PRESS: "Charcoal Press",
  FOREST_OCHRE: "Forest Ochre"
};
