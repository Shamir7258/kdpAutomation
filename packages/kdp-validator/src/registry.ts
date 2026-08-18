import type { ValidationContext, ValidationFinding, ValidationRule } from './types.js';

const rules: ValidationRule[] = [];

export function registerRule(rule: ValidationRule): void {
  if (rules.some((r) => r.id === rule.id)) {
    throw new Error(`Duplicate validation rule id: ${rule.id}`);
  }
  rules.push(rule);
}

export function listRules(): ValidationRule[] {
  return [...rules];
}

export function runValidation(context: ValidationContext): ValidationFinding[] {
  return rules.flatMap((rule) => rule.check(context));
}
