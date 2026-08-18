import epub, { type Chapter, type Options } from 'epub-gen-memory';
import MarkdownIt from 'markdown-it';
import type { BookManuscript, GeneratedInterior, InteriorOptions } from './types.js';

const md = new MarkdownIt({ html: false });

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Renders a reflowable EPUB via epub-gen-memory (in-memory, no temp-file I/O). Trim size is a
 *  paperback-print-only concept — EPUB readers reflow to the device, so `options.trimSizeId` is
 *  intentionally unused here. Each section becomes its own EPUB chapter entry (finer-grained
 *  navigation than one entry per book chapter); the book chapter title is rendered as a heading
 *  above that chapter's first section. */
export async function generateEpub(manuscript: BookManuscript, _options: InteriorOptions): Promise<GeneratedInterior> {
  const chapters: Chapter[] = manuscript.chapters.flatMap((chapter) =>
    chapter.sections.map((section, idx) => ({
      title: section.title || chapter.title,
      content: (idx === 0 ? `<h1>${escapeHtml(chapter.title)}</h1>` : '') + md.render(section.content),
    })),
  );

  if (chapters.length === 0) {
    chapters.push({ title: manuscript.title, content: '<p></p>' });
  }

  const options: Options = {
    title: manuscript.title,
    author: manuscript.authorName ? [manuscript.authorName] : ['Unknown'],
    tocTitle: 'Table of Contents',
    ...(manuscript.subtitle ? { description: manuscript.subtitle } : {}),
  };

  const data = await epub(options, chapters);
  return { data, contentType: 'application/epub+zip', fileExtension: 'epub' };
}
