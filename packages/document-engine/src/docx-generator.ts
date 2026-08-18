import { AlignmentType, Document, Footer, HeadingLevel, PageNumber, Packer, Paragraph, TextRun } from 'docx';
import { parseMarkdownBlocks, type MarkdownBlock } from './markdown-blocks.js';
import { getTrimSizeInches, inchesToTwips, MARGIN_IN } from './trim-sizes.js';
import type { BookManuscript, GeneratedInterior, InteriorOptions } from './types.js';

const HEADING_LEVEL_MAP = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
} as const;

function blocksToParagraphs(blocks: MarkdownBlock[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        paragraphs.push(new Paragraph({ text: block.text, heading: HEADING_LEVEL_MAP[block.level] }));
        break;
      case 'paragraph':
        paragraphs.push(new Paragraph({ text: block.text, alignment: AlignmentType.BOTH }));
        break;
      case 'bullet_list':
        for (const item of block.items) paragraphs.push(new Paragraph({ text: item, bullet: { level: 0 } }));
        break;
      case 'ordered_list':
        block.items.forEach((item, idx) => paragraphs.push(new Paragraph({ text: `${idx + 1}. ${item}` })));
        break;
      case 'blockquote':
        paragraphs.push(
          new Paragraph({ indent: { left: 720 }, children: [new TextRun({ text: block.text, italics: true })] }),
        );
        break;
      case 'hr':
        paragraphs.push(new Paragraph({ text: '' }));
        break;
    }
  }
  return paragraphs;
}

/** Renders a print-ready interior DOCX sized to the project's KDP trim size, using docx.js. */
export async function generateDocx(manuscript: BookManuscript, options: InteriorOptions): Promise<GeneratedInterior> {
  const { widthIn, heightIn } = getTrimSizeInches(options.trimSizeId);
  const marginTwips = inchesToTwips(MARGIN_IN);

  const body: Paragraph[] = [
    new Paragraph({ text: manuscript.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
  ];
  if (manuscript.subtitle) {
    body.push(new Paragraph({ text: manuscript.subtitle, alignment: AlignmentType.CENTER }));
  }
  if (manuscript.authorName) {
    body.push(new Paragraph({ text: manuscript.authorName, alignment: AlignmentType.CENTER, spacing: { before: 400 } }));
  }

  if (options.includeTableOfContents && manuscript.chapters.length > 0) {
    body.push(new Paragraph({ text: 'Table of Contents', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
    for (const chapter of manuscript.chapters) {
      body.push(new Paragraph({ text: chapter.title }));
    }
  }

  for (const chapter of manuscript.chapters) {
    body.push(new Paragraph({ text: chapter.title, heading: HeadingLevel.HEADING_1, pageBreakBefore: true }));
    for (const section of chapter.sections) {
      if (section.title && section.title !== chapter.title) {
        body.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_2 }));
      }
      body.push(...blocksToParagraphs(parseMarkdownBlocks(section.content)));
    }
  }

  const doc = new Document({
    title: manuscript.title,
    creator: manuscript.authorName,
    sections: [
      {
        properties: {
          page: {
            size: { width: inchesToTwips(widthIn), height: inchesToTwips(heightIn) },
            margin: { top: marginTwips, bottom: marginTwips, left: marginTwips, right: marginTwips },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ children: [PageNumber.CURRENT] })],
              }),
            ],
          }),
        },
        children: body,
      },
    ],
  });

  const data = await Packer.toBuffer(doc);
  return {
    data,
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileExtension: 'docx',
  };
}
