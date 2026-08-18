import { useEffect } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { Markdown, type MarkdownStorage } from 'tiptap-markdown';
import { EditorToolbar } from './editor-toolbar';

declare module '@tiptap/core' {
  interface Storage {
    markdown: MarkdownStorage;
  }
}

/**
 * Content is stored and exchanged as Markdown throughout the app (AI
 * generation produces plain/markdown-ish text; Phase 7's document engine
 * will read Markdown to produce PDF/EPUB/DOCX). tiptap-markdown handles
 * both directions: `content` accepts a markdown string directly, and
 * `editor.storage.markdown.getMarkdown()` reads it back out.
 */
export interface EditorSelection {
  text: string;
  from: number;
  to: number;
}

export function TiptapEditor({
  content,
  onChange,
  onSelectionChange,
  onEditorReady,
}: {
  content: string;
  onChange: (markdown: string) => void;
  onSelectionChange: (selection: EditorSelection) => void;
  onEditorReady: (editor: Editor) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing this section…' }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Markdown.configure({ html: false, tightLists: true }),
    ],
    content,
    onUpdate: ({ editor: e }) => {
      onChange(e.storage.markdown.getMarkdown());
    },
    onSelectionUpdate: ({ editor: e }) => {
      const { from, to } = e.state.selection;
      onSelectionChange({ text: from === to ? '' : e.state.doc.textBetween(from, to, ' '), from, to });
    },
  });

  useEffect(() => {
    if (editor) onEditorReady(editor);
  }, [editor]);

  // Re-sync when the loaded section changes (navigating to a different section, or content
  // arriving after the editor already mounted with empty content). emitUpdate: false keeps this
  // programmatic sync from firing onUpdate and marking the section dirty before any user edit.
  useEffect(() => {
    if (editor && content !== editor.storage.markdown.getMarkdown()) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border">
      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-y-auto bg-background px-6 py-4">
        <EditorContent editor={editor} className="prose prose-sm max-w-none focus:outline-none dark:prose-invert" />
      </div>
    </div>
  );
}
