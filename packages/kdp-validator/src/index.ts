// Registering the built-in rule set is a side effect of importing these modules — every rule
// calls registerRule() at module load time, so importing @kdp/kdp-validator's index is enough to
// populate the registry. Consumers can registerRule() their own additional rules the same way.
import './rules/metadata-rules.js';
import './rules/content-rules.js';
import './rules/interior-rules.js';
import './rules/cover-rules.js';

export type { ValidationContext, ValidationFinding, ValidationRule, FindingSeverity, FindingCategory } from './types.js';
export { registerRule, listRules, runValidation } from './registry.js';
