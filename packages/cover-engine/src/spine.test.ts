import { describe, expect, it } from 'vitest';
import { calculateSpineWidthInches } from './spine.js';

describe('calculateSpineWidthInches', () => {
  it('matches the real KDP per-page thickness constants', () => {
    expect(calculateSpineWidthInches(100, 'white')).toBeCloseTo(0.2252, 4);
    expect(calculateSpineWidthInches(100, 'cream')).toBeCloseTo(0.25, 4);
    expect(calculateSpineWidthInches(100, 'color')).toBeCloseTo(0.2347, 4);
  });

  it('scales linearly with page count', () => {
    const oneHundred = calculateSpineWidthInches(100, 'white');
    const twoHundred = calculateSpineWidthInches(200, 'white');
    expect(twoHundred).toBeCloseTo(oneHundred * 2, 4);
  });
});
