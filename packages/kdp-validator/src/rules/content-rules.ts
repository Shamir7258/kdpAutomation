import { registerRule } from '../registry.js';

registerRule({
  id: 'outline-exists',
  label: 'Outline generated',
  category: 'content',
  check(ctx) {
    if (!ctx.bookType.supportsOutline) return [];
    if (ctx.outline.totalSections > 0) return [];
    return [
      { ruleId: 'outline-exists', category: 'content', severity: 'error', message: 'No outline has been generated yet.' },
    ];
  },
});

registerRule({
  id: 'content-complete',
  label: 'Every section has generated content',
  category: 'content',
  check(ctx) {
    if (ctx.outline.totalSections === 0) return [];
    const missing = ctx.outline.totalSections - ctx.outline.sectionsWithContent;
    if (missing <= 0) return [];
    return [
      {
        ruleId: 'content-complete',
        category: 'content',
        severity: 'error',
        message: `${missing} of ${ctx.outline.totalSections} section${ctx.outline.totalSections === 1 ? '' : 's'} still ${missing === 1 ? 'has' : 'have'} no generated content.`,
      },
    ];
  },
});
