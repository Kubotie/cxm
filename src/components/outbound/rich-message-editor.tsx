'use client';

// ─── Outbound 用リッチテキストエディタ ───────────────────────────────────────
// Tiptap ベースの WYSIWYG エディタ。
// 対応書式: 太字・斜体・コード・箇条書き・番号リスト・リンク・見出し
// 変数挿入ボタン: {{company_name}} / {{name}}

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit  from '@tiptap/starter-kit';
import Link       from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useCallback } from 'react';
import {
  Bold, Italic, Code, List, ListOrdered, Link2, Minus, RotateCcw,
  Braces,
} from 'lucide-react';

// ── ツールバーボタン ──────────────────────────────────────────────────────────

function ToolbarBtn({
  active, disabled, onClick, title, children,
}: {
  active?:   boolean;
  disabled?: boolean;
  onClick:   () => void;
  title:     string;
  children:  React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      title={title}
      className={[
        'flex items-center justify-center w-7 h-7 rounded text-sm transition-colors',
        active
          ? 'bg-slate-900 text-white'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        disabled ? 'opacity-30 cursor-default' : 'cursor-pointer',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

// ── リンク挿入 ────────────────────────────────────────────────────────────────

function setLink(editor: Editor) {
  const prev = editor.getAttributes('link').href as string | undefined;
  const url  = window.prompt('URL', prev ?? 'https://');
  if (url === null) return;
  if (url === '') {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
}

// ── 変数チップ ─────────────────────────────────────────────────────────────────

const VARIABLES: { label: string; value: string }[] = [
  { label: '会社名', value: '{{company_name}}' },
  { label: '担当名', value: '{{name}}' },
];

// ── メインコンポーネント ───────────────────────────────────────────────────────

export function RichMessageEditor({
  value,
  onChange,
  placeholder = 'メッセージを入力...',
  minHeight  = 160,
}: {
  value:       string;     // HTML 文字列
  onChange:    (html: string) => void;
  placeholder?: string;
  minHeight?:  number;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // heading は h1/h2 のみ使用
        heading: { levels: [1, 2] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-blue-600 underline cursor-pointer' },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content:   value,
    onUpdate:  ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: [
          'prose prose-sm max-w-none outline-none px-3 py-2.5',
          'prose-headings:font-semibold prose-h1:text-base prose-h2:text-sm',
          'prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded prose-code:text-xs prose-code:font-mono',
          'prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-lg prose-pre:p-3',
          'prose-a:text-blue-600 prose-a:underline',
          'prose-li:my-0',
        ].join(' '),
        style: `min-height: ${minHeight}px`,
      },
    },
  });

  // 外部から value が変更された場合（初期化など）に同期
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const insertVariable = useCallback((varText: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(varText).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-slate-900/20 focus-within:border-slate-400 transition-all bg-white">
      {/* ツールバー */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 bg-slate-50 flex-wrap">

        {/* テキスト書式 */}
        <ToolbarBtn
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="太字 (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="斜体 (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="インラインコード"
        >
          <Code className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('codeBlock')}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="コードブロック"
        >
          <Braces className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <div className="w-px h-4 bg-slate-200 mx-1" />

        {/* リスト */}
        <ToolbarBtn
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="箇条書き"
        >
          <List className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="番号付きリスト"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <div className="w-px h-4 bg-slate-200 mx-1" />

        {/* リンク */}
        <ToolbarBtn
          active={editor.isActive('link')}
          onClick={() => setLink(editor)}
          title="リンクを挿入"
        >
          <Link2 className="w-3.5 h-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="区切り線"
        >
          <Minus className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <div className="w-px h-4 bg-slate-200 mx-1" />

        {/* 元に戻す */}
        <ToolbarBtn
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          title="元に戻す (Ctrl+Z)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </ToolbarBtn>

        <div className="flex-1" />

        {/* 変数挿入 */}
        <div className="flex items-center gap-1 ml-1">
          <span className="text-[9px] text-slate-400 select-none">変数:</span>
          {VARIABLES.map(v => (
            <button
              key={v.value}
              type="button"
              onMouseDown={e => { e.preventDefault(); insertVariable(v.value); }}
              title={`${v.label} (${v.value}) を挿入`}
              className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors font-mono"
            >
              {`{${v.label}}`}
            </button>
          ))}
        </div>
      </div>

      {/* エディタ本体 */}
      <EditorContent editor={editor} />
    </div>
  );
}
