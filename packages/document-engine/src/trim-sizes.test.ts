import { describe, expect, it } from 'vitest';
import { getTrimSizeInches, inchesToPoints, inchesToTwips } from './trim-sizes.js';

describe('trim-sizes', () => {
  it('returns the correct dimensions for a known KDP trim size', () => {
    expect(getTrimSizeInches('6x9')).toEqual({ widthIn: 6, heightIn: 9 });
    expect(getTrimSizeInches('8.5x11')).toEqual({ widthIn: 8.5, heightIn: 11 });
  });

  it('falls back to 6x9 for an unrecognized trim size id', () => {
    expect(getTrimSizeInches('not-a-real-size')).toEqual({ widthIn: 6, heightIn: 9 });
  });

  it('converts inches to points and twips correctly', () => {
    expect(inchesToPoints(1)).toBe(72);
    expect(inchesToTwips(1)).toBe(1440);
    expect(inchesToPoints(6)).toBe(432);
  });
});
