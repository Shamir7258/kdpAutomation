import { registerRule } from '../registry.js';

/** Real KDP limits, matching the same constants enforced at save time by
 *  packages/shared/src/metadata.schemas.ts — this rule re-checks the *current* saved values,
 *  which is the point of a preflight check (metadata can drift after being saved once). */
const MAX_KEYWORDS = 7;
const MAX_DESCRIPTION_CHARS = 4000;

registerRule({
  id: 'metadata-exists',
  label: 'Metadata generated',
  category: 'metadata',
  check(ctx) {
    if (ctx.metadata) return [];
    return [
      {
        ruleId: 'metadata-exists',
        category: 'metadata',
        severity: 'error',
        message: 'No metadata has been generated yet. Generate and finalize title/description/keywords/categories before publishing.',
      },
    ];
  },
});

registerRule({
  id: 'metadata-title-present',
  label: 'Title is set',
  category: 'metadata',
  check(ctx) {
    if (!ctx.metadata || ctx.metadata.title.trim()) return [];
    return [{ ruleId: 'metadata-title-present', category: 'metadata', severity: 'error', message: 'Title is empty.' }];
  },
});

registerRule({
  id: 'metadata-description',
  label: 'Description is present and within the KDP length limit',
  category: 'metadata',
  check(ctx) {
    if (!ctx.metadata) return [];
    const len = ctx.metadata.description.trim().length;
    if (len === 0) {
      return [{ ruleId: 'metadata-description', category: 'metadata', severity: 'error', message: 'Description is empty.' }];
    }
    if (len > MAX_DESCRIPTION_CHARS) {
      return [
        {
          ruleId: 'metadata-description',
          category: 'metadata',
          severity: 'error',
          message: `Description is ${len} characters, over KDP's ${MAX_DESCRIPTION_CHARS}-character limit.`,
        },
      ];
    }
    return [];
  },
});

registerRule({
  id: 'metadata-keywords',
  label: 'Keywords are set',
  category: 'metadata',
  check(ctx) {
    if (!ctx.metadata) return [];
    const count = ctx.metadata.keywords.length;
    if (count === 0) {
      return [
        {
          ruleId: 'metadata-keywords',
          category: 'metadata',
          severity: 'warning',
          message: 'No keywords set — KDP allows up to 7 keyword phrases and they meaningfully affect discoverability.',
        },
      ];
    }
    if (count > MAX_KEYWORDS) {
      return [
        {
          ruleId: 'metadata-keywords',
          category: 'metadata',
          severity: 'error',
          message: `${count} keywords set, over KDP's limit of ${MAX_KEYWORDS}.`,
        },
      ];
    }
    if (count < MAX_KEYWORDS) {
      return [
        {
          ruleId: 'metadata-keywords',
          category: 'metadata',
          severity: 'warning',
          message: `Only ${count} of ${MAX_KEYWORDS} keyword slots used — consider filling the rest.`,
        },
      ];
    }
    return [];
  },
});

registerRule({
  id: 'metadata-categories',
  label: 'At least one category selected',
  category: 'metadata',
  check(ctx) {
    if (!ctx.metadata || ctx.metadata.categories.length > 0) return [];
    return [
      {
        ruleId: 'metadata-categories',
        category: 'metadata',
        severity: 'error',
        message: 'No categories selected. KDP requires at least one category for the listing.',
      },
    ];
  },
});

registerRule({
  id: 'metadata-author',
  label: 'Author name is set',
  category: 'metadata',
  check(ctx) {
    if (!ctx.metadata || ctx.metadata.authorName.trim()) return [];
    return [{ ruleId: 'metadata-author', category: 'metadata', severity: 'warning', message: 'Author name is empty.' }];
  },
});
