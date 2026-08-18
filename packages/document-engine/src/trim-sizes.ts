/**
 * Real KDP paperback trim sizes (inches), matching `TRIM_SIZE_IDS` in
 * `packages/shared/src/enums.ts` — duplicated here rather than imported so
 * `@kdp/document-engine` stays decoupled from `@kdp/shared` (same
 * philosophy as `@kdp/ai`, which only depends on `@kdp/config`). Falls back
 * to 6x9 (the most common KDP trim size) for any unrecognized id.
 *
 * KDP's exact required margins vary by page count (the gutter/inside margin
 * grows with the book's thickness) — that page-count-dependent preflight
 * check belongs to Phase 9's KDP validator, not here. This module uses a
 * single conservative fixed margin sized for the deepest common KDP
 * requirement, so books generated here pass the common case; Phase 9 is
 * where exact compliance is verified before export.
 */
export interface TrimSizeInches {
  widthIn: number;
  heightIn: number;
}

const TRIM_SIZES_IN: Record<string, TrimSizeInches> = {
  '5x8': { widthIn: 5, heightIn: 8 },
  '5.25x8': { widthIn: 5.25, heightIn: 8 },
  '5.5x8.5': { widthIn: 5.5, heightIn: 8.5 },
  '6x9': { widthIn: 6, heightIn: 9 },
  '7x10': { widthIn: 7, heightIn: 10 },
  '8x10': { widthIn: 8, heightIn: 10 },
  '8.5x11': { widthIn: 8.5, heightIn: 11 },
};

const DEFAULT_TRIM_SIZE_ID = '6x9';

/** Conservative fixed margin (inches) that satisfies KDP's minimum for books up to ~150 pages
 *  on every side. Thicker books need a larger inside/gutter margin — Phase 9 flags that. */
export const MARGIN_IN = 0.75;

export function getTrimSizeInches(trimSizeId: string): TrimSizeInches {
  return TRIM_SIZES_IN[trimSizeId] ?? TRIM_SIZES_IN[DEFAULT_TRIM_SIZE_ID]!;
}

export function inchesToPoints(inches: number): number {
  return inches * 72;
}

export function inchesToTwips(inches: number): number {
  return Math.round(inches * 1440);
}
