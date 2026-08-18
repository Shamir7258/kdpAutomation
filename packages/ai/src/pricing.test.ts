import { describe, expect, it } from 'vitest';
import { estimateCostUsd } from './pricing.js';

describe('estimateCostUsd', () => {
  it('computes cost from published per-million-token rates', () => {
    const cost = estimateCostUsd('claude-opus-5', { inputTokens: 1_000_000, outputTokens: 1_000_000 });
    expect(cost).toBeCloseTo(5.0 + 25.0, 5);
  });

  it('returns null for an unrecognized model rather than throwing', () => {
    expect(estimateCostUsd('some-future-model', { inputTokens: 100, outputTokens: 100 })).toBeNull();
  });
});
