import { describe, expect, it } from 'vitest';
import { runValidation, listRules } from './index.js';
import type { ValidationContext } from './types.js';

const readyContext: ValidationContext = {
  bookType: { supportsOutline: true },
  specification: { trimSizeId: '6x9', estimatedPageCount: 180 },
  outline: { totalSections: 5, sectionsWithContent: 5 },
  metadata: {
    title: 'Deep Work for Remote Workers',
    description: 'A practical guide to staying focused while working from anywhere.',
    keywords: ['remote work', 'productivity', 'focus', 'deep work', 'time management', 'home office', 'wfh'],
    categories: ['Business & Money > Skills'],
    authorName: 'Jane Publisher',
  },
  interiors: [{ format: 'pdf', trimSizeId: '6x9', pageCount: 180 }],
  covers: [{ paperType: 'white', pageCount: 180 }],
};

describe('kdp-validator', () => {
  it('registers a non-trivial, deduplicated rule set', () => {
    const rules = listRules();
    expect(rules.length).toBeGreaterThanOrEqual(10);
    expect(new Set(rules.map((r) => r.id)).size).toBe(rules.length);
  });

  it('reports no findings for a fully ready project', () => {
    expect(runValidation(readyContext)).toEqual([]);
  });

  it('flags a completely empty project with the expected error rules', () => {
    const emptyContext: ValidationContext = {
      bookType: { supportsOutline: true },
      specification: null,
      outline: { totalSections: 0, sectionsWithContent: 0 },
      metadata: null,
      interiors: [],
      covers: [],
    };
    const findings = runValidation(emptyContext);
    const ruleIds = findings.map((f) => f.ruleId);
    expect(ruleIds).toContain('outline-exists');
    expect(ruleIds).toContain('metadata-exists');
    expect(ruleIds).toContain('interior-exists');
    expect(ruleIds).toContain('cover-exists');
    expect(findings.every((f) => f.severity === 'error')).toBe(true);
  });

  it('flags incomplete content generation with a count', () => {
    const findings = runValidation({ ...readyContext, outline: { totalSections: 5, sectionsWithContent: 3 } });
    const finding = findings.find((f) => f.ruleId === 'content-complete');
    expect(finding?.message).toContain('2 of 5');
  });

  it('flags more than 7 keywords as an error and fewer than 7 as a warning', () => {
    const tooMany = runValidation({
      ...readyContext,
      metadata: { ...readyContext.metadata!, keywords: Array(8).fill('x') },
    });
    expect(tooMany.find((f) => f.ruleId === 'metadata-keywords')?.severity).toBe('error');

    const tooFew = runValidation({ ...readyContext, metadata: { ...readyContext.metadata!, keywords: ['x'] } });
    expect(tooFew.find((f) => f.ruleId === 'metadata-keywords')?.severity).toBe('warning');
  });

  it('flags a description over the 4000-character KDP limit', () => {
    const findings = runValidation({
      ...readyContext,
      metadata: { ...readyContext.metadata!, description: 'x'.repeat(4001) },
    });
    expect(findings.find((f) => f.ruleId === 'metadata-description')?.severity).toBe('error');
  });

  it('warns when a PDF interior exceeds the long-book margin threshold', () => {
    const findings = runValidation({
      ...readyContext,
      interiors: [{ format: 'pdf', trimSizeId: '6x9', pageCount: 750 }],
    });
    expect(findings.find((f) => f.ruleId === 'interior-margin-for-page-count')?.severity).toBe('warning');
  });

  it('does not warn about margin for an EPUB with no page count', () => {
    const findings = runValidation({
      ...readyContext,
      interiors: [{ format: 'epub', trimSizeId: '6x9' }],
    });
    expect(findings.find((f) => f.ruleId === 'interior-margin-for-page-count')).toBeUndefined();
  });

  it('warns when the latest cover was sized for a different page count than the current spec', () => {
    const findings = runValidation({
      ...readyContext,
      specification: { trimSizeId: '6x9', estimatedPageCount: 220 },
      covers: [{ paperType: 'white', pageCount: 180 }],
    });
    expect(findings.find((f) => f.ruleId === 'cover-page-count-drift')?.severity).toBe('warning');
  });

  it('skips the outline-exists rule for book types that do not support outlines', () => {
    const findings = runValidation({
      ...readyContext,
      bookType: { supportsOutline: false },
      outline: { totalSections: 0, sectionsWithContent: 0 },
    });
    expect(findings.find((f) => f.ruleId === 'outline-exists')).toBeUndefined();
  });
});
