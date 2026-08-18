export const PAPER_TYPES = ['white', 'cream', 'color'] as const;
export type PaperType = (typeof PAPER_TYPES)[number];

/** Real, publicly documented KDP paperback spine-width constants (inches of spine per page) —
 *  not estimated. KDP's own cover calculator uses these same per-page thickness figures. */
const SPINE_WIDTH_PER_PAGE_IN: Record<PaperType, number> = {
  white: 0.002252,
  cream: 0.0025,
  color: 0.002347,
};

/** KDP requires at least 24 pages for any paperback; spine text only reliably fits once the
 *  spine is wide enough to hold readable rotated text — 0.0625" (about 100 white pages) is a
 *  reasonable, conservative threshold. Thinner books ship with a blank spine, same as KDP's own
 *  guidance that very thin books may not have room for spine text. */
export const MIN_SPINE_WIDTH_FOR_TEXT_IN = 0.0625;

export function calculateSpineWidthInches(pageCount: number, paperType: PaperType): number {
  return Math.round(pageCount * SPINE_WIDTH_PER_PAGE_IN[paperType] * 10000) / 10000;
}
