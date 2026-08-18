import PDFDocument from 'pdfkit';
import { parseMarkdownBlocks, type MarkdownBlock } from './markdown-blocks.js';
import { getTrimSizeInches, inchesToPoints, MARGIN_IN } from './trim-sizes.js';
import type { BookManuscript, GeneratedInterior, InteriorOptions } from './types.js';

function renderBlocks(doc: PDFKit.PDFDocument, blocks: MarkdownBlock[]): void {
  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        doc
          .font('Times-Bold')
          .fontSize(Math.max(20 - block.level * 2, 11))
          .text(block.text);
        doc.moveDown(0.5);
        break;
      case 'paragraph':
        doc.font('Times-Roman').fontSize(11).text(block.text, { align: 'justify' });
        doc.moveDown(0.5);
        break;
      case 'bullet_list':
        doc.font('Times-Roman').fontSize(11).list(block.items, { listType: 'bullet', bulletRadius: 2 });
        doc.moveDown(0.5);
        break;
      case 'ordered_list':
        doc.font('Times-Roman').fontSize(11).list(block.items, { listType: 'numbered' });
        doc.moveDown(0.5);
        break;
      case 'blockquote':
        doc.font('Times-Italic').fontSize(11).text(block.text, { indent: 20 });
        doc.moveDown(0.5);
        break;
      case 'hr':
        doc.moveDown();
        break;
    }
  }
}

/** Renders a print-ready interior PDF sized to the project's KDP trim size, using pdfkit
 *  (pure JS, no headless-browser dependency). One page per title/TOC, one new page per chapter. */
export async function generatePdf(manuscript: BookManuscript, options: InteriorOptions): Promise<GeneratedInterior> {
  const { widthIn, heightIn } = getTrimSizeInches(options.trimSizeId);
  const margin = inchesToPoints(MARGIN_IN);

  const doc = new PDFDocument({
    size: [inchesToPoints(widthIn), inchesToPoints(heightIn)],
    margins: { top: margin, bottom: margin, left: margin, right: margin },
    bufferPages: true,
    info: { Title: manuscript.title, Author: manuscript.authorName ?? '' },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolvePromise) => doc.on('end', () => resolvePromise(Buffer.concat(chunks))));

  doc.font('Times-Bold').fontSize(28).text(manuscript.title, { align: 'center' });
  if (manuscript.subtitle) {
    doc.moveDown(0.5);
    doc.font('Times-Roman').fontSize(16).text(manuscript.subtitle, { align: 'center' });
  }
  if (manuscript.authorName) {
    doc.moveDown(4);
    doc.font('Times-Roman').fontSize(14).text(manuscript.authorName, { align: 'center' });
  }

  if (options.includeTableOfContents && manuscript.chapters.length > 0) {
    doc.addPage();
    doc.font('Times-Bold').fontSize(20).text('Table of Contents');
    doc.moveDown();
    for (const chapter of manuscript.chapters) {
      doc.font('Times-Roman').fontSize(12).text(chapter.title);
      doc.moveDown(0.25);
    }
  }

  for (const chapter of manuscript.chapters) {
    doc.addPage();
    doc.font('Times-Bold').fontSize(22).text(chapter.title);
    doc.moveDown();
    for (const section of chapter.sections) {
      if (section.title && section.title !== chapter.title) {
        doc.font('Times-Bold').fontSize(16).text(section.title);
        doc.moveDown(0.5);
      }
      renderBlocks(doc, parseMarkdownBlocks(section.content));
      doc.moveDown();
    }
  }

  const { count: pageCount } = doc.bufferedPageRange();
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc
      .font('Times-Roman')
      .fontSize(9)
      .text(String(i + 1), 0, doc.page.height - margin / 2, { align: 'center', width: doc.page.width });
  }

  doc.end();
  const data = await finished;
  return { data, contentType: 'application/pdf', fileExtension: 'pdf', pageCount };
}
