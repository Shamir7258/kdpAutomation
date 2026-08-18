export const EDIT_PASS_TYPES = [
  'grammar',
  'clarity',
  'consistency',
  'structure',
  'fact_checking',
  'ai_detection_risk',
  'final_review',
] as const;
export type EditPassType = (typeof EDIT_PASS_TYPES)[number];

export interface EditPassFindingDto {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  location?: string;
}

export interface EditPassDto {
  id: string;
  sectionId: string;
  passType: EditPassType;
  batchId: string;
  summary: string;
  findings: EditPassFindingDto[];
  createdAt: string;
}
