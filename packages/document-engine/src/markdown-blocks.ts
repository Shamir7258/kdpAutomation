import MarkdownIt, { type Token } from 'markdown-it';

export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet_list'; items: string[] }
  | { type: 'ordered_list'; items: string[] }
  | { type: 'blockquote'; text: string }
  | { type: 'hr' };

const md = new MarkdownIt({ html: false });

function extractPlainText(inlineToken: Token | undefined): string {
  if (!inlineToken) return '';
  if (!inlineToken.children) return inlineToken.content;
  let text = '';
  for (const child of inlineToken.children) {
    if (child.type === 'text' || child.type === 'code_inline') text += child.content;
    else if (child.type === 'softbreak' || child.type === 'hardbreak') text += ' ';
  }
  return text;
}

/**
 * Walks markdown-it's flat token stream into a simplified block model that
 * pdf-generator.ts and docx-generator.ts can render without each needing
 * their own markdown parsing. Inline formatting (bold/italic/links) is
 * flattened to plain text — full inline styling in the rendered PDF/DOCX is
 * a reasonable future enhancement, not required for a correct interior.
 * Tables aren't handled specially (rare in book manuscript content) and are
 * skipped rather than mis-rendered.
 */
export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const tokens = md.parse(markdown, {});
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i]!;

    if (token.type === 'heading_open') {
      const level = Number(token.tag.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ type: 'heading', level, text: extractPlainText(tokens[i + 1]) });
      i += 3;
      continue;
    }

    if (token.type === 'paragraph_open') {
      blocks.push({ type: 'paragraph', text: extractPlainText(tokens[i + 1]) });
      i += 3;
      continue;
    }

    if (token.type === 'bullet_list_open' || token.type === 'ordered_list_open') {
      const isOrdered = token.type === 'ordered_list_open';
      const closeType = isOrdered ? 'ordered_list_close' : 'bullet_list_close';
      const items: string[] = [];
      i += 1;
      while (i < tokens.length && tokens[i]!.type !== closeType) {
        if (tokens[i]!.type === 'inline') items.push(extractPlainText(tokens[i]));
        i += 1;
      }
      i += 1; // consume the close token
      blocks.push(isOrdered ? { type: 'ordered_list', items } : { type: 'bullet_list', items });
      continue;
    }

    if (token.type === 'blockquote_open') {
      const parts: string[] = [];
      i += 1;
      while (i < tokens.length && tokens[i]!.type !== 'blockquote_close') {
        if (tokens[i]!.type === 'inline') parts.push(extractPlainText(tokens[i]));
        i += 1;
      }
      i += 1;
      blocks.push({ type: 'blockquote', text: parts.join(' ') });
      continue;
    }

    if (token.type === 'hr') {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    if (token.type === 'fence' || token.type === 'code_block') {
      blocks.push({ type: 'paragraph', text: token.content.trim() });
      i += 1;
      continue;
    }

    i += 1;
  }

  return blocks;
}
