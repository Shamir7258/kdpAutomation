export const FINDING_SEVERITIES = ['error', 'warning'] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const FINDING_CATEGORIES = ['metadata', 'content', 'interior', 'cover'] as const;
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export interface ValidationFindingDto {
  ruleId: string;
  category: FindingCategory;
  severity: FindingSeverity;
  message: string;
}

export interface ValidationReportDto {
  findings: ValidationFindingDto[];
  /** True only when there are zero `error`-severity findings — `warning` findings don't block this. */
  readyToPublish: boolean;
  checkedAt: string;
}
