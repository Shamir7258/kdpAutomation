import { registerRule } from '../registry.js';

/** The page count above which KDP's published inside-margin (gutter) guidance recommends more
 *  than the flat 0.75" margin @kdp/document-engine renders with (see ARCHITECTURE.md §5 — the
 *  renderer intentionally uses one conservative fixed margin rather than the full page-count-
 *  dependent table, and this check is where that deferred verification happens). This is
 *  guidance based on KDP's publicly documented formatting guidelines, not a live API check —
 *  always verify against KDP's current official specification before publishing. */
const LONG_BOOK_PAGE_THRESHOLD = 700;

registerRule({
  id: 'interior-exists',
  label: 'Interior file generated',
  category: 'interior',
  check(ctx) {
    if (ctx.interiors.length > 0) return [];
    return [
      { ruleId: 'interior-exists', category: 'interior', severity: 'error', message: 'No interior file has been generated yet.' },
    ];
  },
});

registerRule({
  id: 'interior-trim-size-matches-spec',
  label: 'Interior trim size matches the book specification',
  category: 'interior',
  check(ctx) {
    if (!ctx.specification || ctx.interiors.length === 0) return [];
    const mismatched = ctx.interiors.some((i) => i.trimSizeId !== ctx.specification!.trimSizeId);
    if (!mismatched) return [];
    return [
      {
        ruleId: 'interior-trim-size-matches-spec',
        category: 'interior',
        severity: 'warning',
        message: `The most recent interior was generated at a different trim size than the current specification (${ctx.specification.trimSizeId}). Regenerate if the specification's trim size changed since.`,
      },
    ];
  },
});

registerRule({
  id: 'interior-margin-for-page-count',
  label: 'Margin is adequate for the rendered page count',
  category: 'interior',
  check(ctx) {
    const longPdf = ctx.interiors.find((i) => i.format === 'pdf' && (i.pageCount ?? 0) > LONG_BOOK_PAGE_THRESHOLD);
    if (!longPdf) return [];
    return [
      {
        ruleId: 'interior-margin-for-page-count',
        category: 'interior',
        severity: 'warning',
        message: `This interior rendered at ${longPdf.pageCount} pages. KDP's published inside-margin guidance recommends a wider gutter margin than this platform's fixed default for books over ${LONG_BOOK_PAGE_THRESHOLD} pages — verify against KDP's current official margin requirements before publishing.`,
      },
    ];
  },
});
