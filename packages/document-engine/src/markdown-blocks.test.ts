import { describe, expect, it } from 'vitest';
import { parseMarkdownBlocks } from './markdown-blocks.js';

describe('parseMarkdownBlocks', () => {
  it('parses headings, paragraphs, lists, blockquotes, and hr into a flat block model', () => {
    const markdown = [
      '## A Heading',
      '',
      'A paragraph with **bold** and *italic* text.',
      '',
      '- one',
      '- two',
      '',
      '1. first',
      '2. second',
      '',
      '> a quote',
      '',
      '---',
    ].join('\n');

    const blocks = parseMarkdownBlocks(markdown);

    expect(blocks).toEqual([
      { type: 'heading', level: 2, text: 'A Heading' },
      { type: 'paragraph', text: 'A paragraph with bold and italic text.' },
      { type: 'bullet_list', items: ['one', 'two'] },
      { type: 'ordered_list', items: ['first', 'second'] },
      { type: 'blockquote', text: 'a quote' },
      { type: 'hr' },
    ]);
  });

  it('returns an empty array for empty content', () => {
    expect(parseMarkdownBlocks('')).toEqual([]);
  });

  it('strips inline formatting markers, keeping only plain text', () => {
    const blocks = parseMarkdownBlocks('Some `code` and a [link](https://example.com) here.');
    expect(blocks).toEqual([{ type: 'paragraph', text: 'Some code and a link here.' }]);
  });
});
