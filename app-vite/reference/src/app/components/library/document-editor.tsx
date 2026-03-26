import { useState, useRef } from "react";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link as LinkIcon,
  List,
  ListOrdered,
  Code,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  CheckSquare,
  Minus,
  Table,
  Image as ImageIcon,
  AlertCircle,
} from "lucide-react";

interface DocumentEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  rows?: number;
}

type FormatType = 
  | "bold" | "italic" | "underline" | "strikethrough" 
  | "h1" | "h2" | "h3" 
  | "ul" | "ol" | "checklist"
  | "link" | "code" | "quote" | "hr";

export function DocumentEditor({ 
  value, 
  onChange, 
  placeholder = "内容を入力してください...",
  label = "内容",
  rows = 20 
}: DocumentEditorProps) {
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const applyFormat = (format: FormatType) => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const beforeText = value.substring(0, start);
    const afterText = value.substring(end);

    let newText = "";
    let cursorOffset = 0;

    switch (format) {
      case "bold":
        newText = `${beforeText}**${selectedText || "太字テキスト"}**${afterText}`;
        cursorOffset = selectedText ? 0 : -2;
        break;
      case "italic":
        newText = `${beforeText}_${selectedText || "イタリック"}_ ${afterText}`;
        cursorOffset = selectedText ? 0 : -1;
        break;
      case "underline":
        newText = `${beforeText}<u>${selectedText || "下線テキスト"}</u>${afterText}`;
        cursorOffset = selectedText ? 0 : -4;
        break;
      case "strikethrough":
        newText = `${beforeText}~~${selectedText || "取り消し線"}~~${afterText}`;
        cursorOffset = selectedText ? 0 : -2;
        break;
      case "h1":
        newText = `${beforeText}# ${selectedText || "見出し1"}\n${afterText}`;
        cursorOffset = selectedText ? 1 : -1;
        break;
      case "h2":
        newText = `${beforeText}## ${selectedText || "見出し2"}\n${afterText}`;
        cursorOffset = selectedText ? 1 : -1;
        break;
      case "h3":
        newText = `${beforeText}### ${selectedText || "見出し3"}\n${afterText}`;
        cursorOffset = selectedText ? 1 : -1;
        break;
      case "ul":
        newText = `${beforeText}- ${selectedText || "リスト項目"}\n${afterText}`;
        cursorOffset = selectedText ? 1 : -1;
        break;
      case "ol":
        newText = `${beforeText}1. ${selectedText || "リスト項目"}\n${afterText}`;
        cursorOffset = selectedText ? 1 : -1;
        break;
      case "checklist":
        newText = `${beforeText}- [ ] ${selectedText || "チェックリスト項目"}\n${afterText}`;
        cursorOffset = selectedText ? 1 : -1;
        break;
      case "link":
        const url = selectedText || "https://example.com";
        const linkText = selectedText || "リンクテキスト";
        newText = `${beforeText}[${linkText}](${url})${afterText}`;
        cursorOffset = selectedText ? 0 : -url.length - 3;
        break;
      case "code":
        if (selectedText.includes("\n")) {
          // Multiple lines: code block
          newText = `${beforeText}\`\`\`\n${selectedText || "コード"}\n\`\`\`\n${afterText}`;
          cursorOffset = selectedText ? 4 : -5;
        } else {
          // Single line: inline code
          newText = `${beforeText}\`${selectedText || "コード"}\`${afterText}`;
          cursorOffset = selectedText ? 0 : -1;
        }
        break;
      case "quote":
        newText = `${beforeText}> ${selectedText || "引用テキスト"}\n${afterText}`;
        cursorOffset = selectedText ? 1 : -1;
        break;
      case "hr":
        newText = `${beforeText}\n---\n${afterText}`;
        cursorOffset = 0;
        break;
    }

    onChange(newText);

    // Set cursor position after format is applied
    setTimeout(() => {
      const newCursorPos = end + (newText.length - value.length) + cursorOffset;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  const renderPreview = (markdown: string) => {
    // Simple markdown to HTML converter
    let html = markdown;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-slate-900 mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-slate-900 mt-5 mb-3">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-slate-900 mt-6 mb-3">$1</h1>');

    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>');

    // Italic
    html = html.replace(/_(.*?)_/g, '<em class="italic">$1</em>');

    // Strikethrough
    html = html.replace(/~~(.*?)~~/g, '<del class="line-through text-slate-500">$1</del>');

    // Underline
    html = html.replace(/<u>(.*?)<\/u>/g, '<u class="underline">$1</u>');

    // Links
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');

    // Inline code
    html = html.replace(/`([^`\n]+)`/g, '<code class="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');

    // Code blocks
    html = html.replace(/```\n?([\s\S]*?)\n?```/g, '<pre class="bg-slate-900 text-slate-100 p-3 rounded my-2 overflow-x-auto"><code class="text-sm font-mono">$1</code></pre>');

    // Checklists
    html = html.replace(/^- \[ \] (.*$)/gim, '<div class="flex items-start gap-2 my-1"><input type="checkbox" class="mt-1" disabled /> <span class="text-slate-700">$1</span></div>');
    html = html.replace(/^- \[x\] (.*$)/gim, '<div class="flex items-start gap-2 my-1"><input type="checkbox" class="mt-1" checked disabled /> <span class="text-slate-700 line-through">$1</span></div>');

    // Unordered lists
    html = html.replace(/^\- (.*$)/gim, '<li class="ml-6 text-slate-700 list-disc">$1</li>');
    html = html.replace(/(<li class="ml-6 text-slate-700 list-disc">.*<\/li>)/s, '<ul class="my-2">$1</ul>');

    // Ordered lists
    html = html.replace(/^\d+\. (.*$)/gim, '<li class="ml-6 text-slate-700 list-decimal">$1</li>');

    // Blockquotes
    html = html.replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-slate-300 pl-4 italic text-slate-600 my-2">$1</blockquote>');

    // Horizontal rules
    html = html.replace(/^---$/gim, '<hr class="my-4 border-slate-200" />');

    // Line breaks
    html = html.replace(/\n/g, '<br />');

    return html;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-xs font-semibold text-slate-700">{label}</Label>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={activeTab === "edit" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("edit")}
            className="text-xs h-7"
          >
            編集
          </Button>
          <Button
            type="button"
            variant={activeTab === "preview" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("preview")}
            className="text-xs h-7"
          >
            プレビュー
          </Button>
        </div>
      </div>

      {activeTab === "edit" && (
        <>
          {/* Toolbar */}
          <div className="border rounded-t-lg bg-slate-50 p-2 flex flex-wrap gap-1">
            {/* Text Formatting */}
            <div className="flex gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyFormat("bold")}
                className="h-7 w-7 p-0"
                title="太字 (Ctrl+B)"
              >
                <Bold className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyFormat("italic")}
                className="h-7 w-7 p-0"
                title="イタリック (Ctrl+I)"
              >
                <Italic className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyFormat("underline")}
                className="h-7 w-7 p-0"
                title="下線 (Ctrl+U)"
              >
                <Underline className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyFormat("strikethrough")}
                className="h-7 w-7 p-0"
                title="取り消し線"
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-7" />

            {/* Headings */}
            <div className="flex gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyFormat("h1")}
                className="h-7 w-7 p-0"
                title="見出し1"
              >
                <Heading1 className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyFormat("h2")}
                className="h-7 w-7 p-0"
                title="見出し2"
              >
                <Heading2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyFormat("h3")}
                className="h-7 w-7 p-0"
                title="見出し3"
              >
                <Heading3 className="w-3.5 h-3.5" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-7" />

            {/* Lists */}
            <div className="flex gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyFormat("ul")}
                className="h-7 w-7 p-0"
                title="箇条書きリスト"
              >
                <List className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyFormat("ol")}
                className="h-7 w-7 p-0"
                title="番号付きリスト"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyFormat("checklist")}
                className="h-7 w-7 p-0"
                title="チェックリスト"
              >
                <CheckSquare className="w-3.5 h-3.5" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-7" />

            {/* Other */}
            <div className="flex gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyFormat("link")}
                className="h-7 w-7 p-0"
                title="リンク (Ctrl+K)"
              >
                <LinkIcon className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyFormat("code")}
                className="h-7 w-7 p-0"
                title="コード"
              >
                <Code className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyFormat("quote")}
                className="h-7 w-7 p-0"
                title="引用"
              >
                <Quote className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => applyFormat("hr")}
                className="h-7 w-7 p-0"
                title="区切り線"
              >
                <Minus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full border border-t-0 rounded-b-lg p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={rows}
          />

          {/* Help Text */}
          <div className="mt-2 flex items-start gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-200">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Markdown記法をサポート:</strong> 見出し (#, ##, ###)、太字 (**text**)、イタリック (_text_)、リスト (-, 1.)、
              チェックリスト (- [ ])、リンク ([text](url))、コード (`code`、```block```)、引用 (&gt;)、区切り線 (---)
            </div>
          </div>
        </>
      )}

      {activeTab === "preview" && (
        <div 
          className="border rounded-lg p-4 text-sm text-slate-700 bg-white min-h-[400px]"
          dangerouslySetInnerHTML={{ __html: renderPreview(value) }}
        />
      )}
    </div>
  );
}