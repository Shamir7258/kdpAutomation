import { registerRule } from '../registry.js';

registerRule({
  id: 'cover-exists',
  label: 'Cover generated',
  category: 'cover',
  check(ctx) {
    if (ctx.covers.length > 0) return [];
    return [{ ruleId: 'cover-exists', category: 'cover', severity: 'error', message: 'No cover has been generated yet.' }];
  },
});

registerRule({
  id: 'cover-page-count-drift',
  label: 'Cover spine width matches the current estimated page count',
  category: 'cover',
  check(ctx) {
    if (!ctx.specification || ctx.covers.length === 0) return [];
    const latest = ctx.covers[0]!;
    if (latest.pageCount === ctx.specification.estimatedPageCount) return [];
    return [
      {
        ruleId: 'cover-page-count-drift',
        category: 'cover',
        severity: 'warning',
        message: `The most recent cover's spine was sized for ${latest.pageCount} pages, but the specification now estimates ${ctx.specification.estimatedPageCount}. Regenerate the cover for an accurate spine width before publishing.`,
      },
    ];
  },
});
