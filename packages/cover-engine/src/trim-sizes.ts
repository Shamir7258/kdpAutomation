/** Duplicated from @kdp/document-engine's trim-sizes.ts (which duplicates it from
 *  @kdp/shared) — same "stay decoupled from @kdp/shared" reasoning as @kdp/ai only
 *  depending on @kdp/config. */
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

export function getTrimSizeInches(trimSizeId: string): TrimSizeInches {
  return TRIM_SIZES_IN[trimSizeId] ?? TRIM_SIZES_IN[DEFAULT_TRIM_SIZE_ID]!;
}

export function inchesToPoints(inches: number): number {
  return inches * 72;
}
