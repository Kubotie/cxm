import { useState, useRef } from "react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Code,
  Quote,
  Eye,
  FileCode,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";

type Channel = "email" | "slack" | "chatwork" | "intercom";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  channel: Channel;
  placeholder?: string;
  rows?: number;
}

interface FormattingRule {
  channel: Channel;
  supports: {
    bold: boolean;
    italic: boolean;
    link: boolean;
    bulletList: boolean;
    orderedList: boolean;
    code: boolean;
    quote: boolean;
  };
  conversion: {
    bold: (text: string) => string;
    italic: (text: string) => string;
    link: (text: string, url: string) => string;
    bulletList: (items: string[]) => string;
    orderedList: (items: string[]) => string;
    code: (text: string) => string;
    quote: (text: string) => string;
  };
}

// チャンネル別の書式設定ルール
const formattingRules: Record<Channel, FormattingRule> = {
  email: {
    channel: "email",
    supports: {
      bold: true,
      italic: true,
      link: true,
      bulletList: true,
      orderedList: true,
      code: true,
      quote: true,
    },
    conversion: {
      bold: (text) => `**${text}**`,
      italic: (text) => `*${text}*`,
      link: (text, url) => `[${text}](${url})`,
      bulletList: (items) => items.map(item => `• ${item}`).join('\n'),
      orderedList: (items) => items.map((item, i) => `${i + 1}. ${item}`).join('\n'),
      code: (text) => `\`${text}\``,
      quote: (text) => `> ${text}`,
    },
  },
  slack: {
    channel: "slack",
    supports: {
      bold: true,
      italic: true,
      link: true,
      bulletList: true,
      orderedList: false,
      code: true,
      quote: true,
    },
    conversion: {
      bold: (text) => `*${text}*`,
      italic: (text) => `_${text}_`,
      link: (text, url) => `<${url}|${text}>`,
      bulletList: (items) => items.map(item => `• ${item}`).join('\n'),
      orderedList: (items) => items.map((item, i) => `${i + 1}. ${item}`).join('\n'), // Fallback
      code: (text) => `\`${text}\``,
      quote: (text) => `> ${text}`,
    },
  },
  chatwork: {
    channel: "chatwork",
    supports: {
      bold: true,
      italic: false,
      link: false, // Chatworkはリンク付きテキストをサポートしない
      bulletList: false,
      orderedList: false,
      code: true,
      quote: true,
    },
    conversion: {
      bold: (text) => `[b]${text}[/b]`,
      italic: (text) => text, // サポートなし
      link: (text, url) => `${text} (${url})`, // URLを括弧で表示
      bulletList: (items) => items.map(item => `• ${item}`).join('\n'),
      orderedList: (items) => items.map((item, i) => `${i + 1}. ${item}`).join('\n'),
      code: (text) => `[code]${text}[/code]`,
      quote: (text) => `[qt]${text}[/qt]`,
    },
  },
  intercom: {
    channel: "intercom",
    supports: {
      bold: true,
      italic: true,
      link: true,
      bulletList: true,
      orderedList: true,
      code: true,
      quote: false,
    },
    conversion: {
      bold: (text) => `**${text}**`,
      italic: (text) => `*${text}*`,
      link: (text, url) => `[${text}](${url})`,
      bulletList: (items) => items.map(item => `• ${item}`).join('\n'),
      orderedList: (items) => items.map((item, i) => `${i + 1}. ${item}`).join('\n'),
      code: (text) => `\`${text}\``,
      quote: (text) => text,
    },
  },
};

// 書式をチャンネルに合わせて変換
function convertFormatting(text: string, fromChannel: Channel, toChannel: Channel): string {
  if (fromChannel === toChannel) return text;

  let converted = text;

  // リンク付きテキストの変換例（簡易実装）
  // Markdown形式のリンクをChatwork形式に変換
  if (toChannel === "chatwork") {
    // [テキスト](URL) -> テキスト (URL)
    converted = converted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
  }

  return converted;
}

export function RichTextEditor({
  value,
  onChange,
  channel,
  placeholder = "本文を入力...",
  rows = 20,
}: RichTextEditorProps) {
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const rules = formattingRules[channel];

  const insertFormatting = (
    formatType: keyof FormattingRule["conversion"],
    defaultText?: string
  ) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end) || defaultText || "";

    let formatted = "";
    switch (formatType) {
      case "bold":
        formatted = rules.conversion.bold(selectedText);
        break;
      case "italic":
        formatted = rules.conversion.italic(selectedText);
        break;
      case "code":
        formatted = rules.conversion.code(selectedText);
        break;
      case "quote":
        formatted = rules.conversion.quote(selectedText);
        break;
      default:
        return;
    }

    const newValue = value.substring(0, start) + formatted + value.substring(end);
    onChange(newValue);

    // カーソル位置を調整
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + formatted.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const insertLink = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    if (selectedText) {
      setLinkText(selectedText);
    }
    setShowLinkDialog(true);
  };

  const confirmLink = () => {
    if (!linkText || !linkUrl) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const formatted = rules.conversion.link(linkText, linkUrl);
    const newValue = value.substring(0, start) + formatted + value.substring(end);
    onChange(newValue);

    setShowLinkDialog(false);
    setLinkText("");
    setLinkUrl("");

    setTimeout(() => {
      textarea.focus();
    }, 0);
  };

  const insertList = (ordered: boolean = false) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    const items = selectedText ? selectedText.split('\n').filter(line => line.trim()) : ["アイテム1", "アイテム2", "アイテム3"];
    const formatted = ordered 
      ? rules.conversion.orderedList(items)
      : rules.conversion.bulletList(items);

    const newValue = value.substring(0, start) + formatted + value.substring(end);
    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
    }, 0);
  };

  // プレビュー用のレンダリング（簡易実装）
  const renderPreview = () => {
    let preview = value;

    // Markdown形式のプレビュー（簡易）
    preview = preview.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    preview = preview.replace(/\*(.+?)\*/g, '<em>$1</em>');
    preview = preview.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-blue-600 underline">$1</a>');
    preview = preview.replace(/`(.+?)`/g, '<code class="bg-slate-100 px-1 rounded text-sm">$1</code>');
    
    // Slack形式
    if (channel === "slack") {
      preview = preview.replace(/<([^|>]+)\|([^>]+)>/g, '<a href="$1" target="_blank" class="text-blue-600 underline">$2</a>');
    }

    // Chatwork形式
    if (channel === "chatwork") {
      preview = preview.replace(/\[b\](.+?)\[\/b\]/g, '<strong>$1</strong>');
      preview = preview.replace(/\[code\](.+?)\[\/code\]/g, '<code class="bg-slate-100 px-1 rounded text-sm">$1</code>');
      preview = preview.replace(/\[qt\](.+?)\[\/qt\]/g, '<blockquote class="border-l-4 border-slate-300 pl-3 text-slate-600">$1</blockquote>');
    }

    return preview.split('\n').map((line, i) => (
      <div key={i} dangerouslySetInnerHTML={{ __html: line || '&nbsp;' }} />
    ));
  };

  const getUnsupportedWarnings = () => {
    const warnings: string[] = [];
    
    if (!rules.supports.italic && value.includes('*') && value.includes('_')) {
      warnings.push('イタリック体はサポートされていません');
    }
    
    if (!rules.supports.link && (value.includes('[') || value.includes('](')) && channel === 'chatwork') {
      warnings.push('リンク付きテキストは「テキスト (URL)」形式に変換されます');
    }

    return warnings;
  };

  const warnings = getUnsupportedWarnings();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>本文</Label>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs capitalize">
            {channel}
          </Badge>
        </div>
      </div>

      {/* Formatting Toolbar */}
      <div className="border rounded-t-lg bg-slate-50 p-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertFormatting("bold", "太字")}
            disabled={!rules.supports.bold}
            className="h-8 w-8 p-0"
            title="太字"
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertFormatting("italic", "イタリック")}
            disabled={!rules.supports.italic}
            className="h-8 w-8 p-0"
            title="イタリック"
          >
            <Italic className="w-4 h-4" />
          </Button>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={insertLink}
            className="h-8 w-8 p-0"
            title="リンク"
          >
            <LinkIcon className="w-4 h-4" />
          </Button>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertList(false)}
            disabled={!rules.supports.bulletList}
            className="h-8 w-8 p-0"
            title="箇条書きリスト"
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertList(true)}
            disabled={!rules.supports.orderedList}
            className="h-8 w-8 p-0"
            title="番号付きリスト"
          >
            <ListOrdered className="w-4 h-4" />
          </Button>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertFormatting("code", "コード")}
            disabled={!rules.supports.code}
            className="h-8 w-8 p-0"
            title="コード"
          >
            <Code className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertFormatting("quote", "引用")}
            disabled={!rules.supports.quote}
            className="h-8 w-8 p-0"
            title="引用"
          >
            <Quote className="w-4 h-4" />
          </Button>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <div className="flex-1" />
          <Button
            type="button"
            variant={activeTab === "preview" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(activeTab === "edit" ? "preview" : "edit")}
            className="h-8 text-xs"
          >
            {activeTab === "edit" ? (
              <>
                <Eye className="w-3 h-3 mr-1" />
                プレビュー
              </>
            ) : (
              <>
                <FileCode className="w-3 h-3 mr-1" />
                編集
              </>
            )}
          </Button>
        </div>

        {warnings.length > 0 && (
          <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
            {warnings.map((warning, i) => (
              <div key={i} className="flex items-start gap-1.5 text-amber-700">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor / Preview */}
      {activeTab === "edit" ? (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="font-mono text-sm rounded-t-none border-t-0"
        />
      ) : (
        <div className="border rounded-b-lg border-t-0 p-4 min-h-[400px] bg-white text-sm">
          <div className="space-y-2">
            {renderPreview()}
          </div>
        </div>
      )}

      {/* Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>リンクを挿入</DialogTitle>
            <DialogDescription>
              {channel === "chatwork" 
                ? "Chatworkでは「テキスト (URL)」形式で表示されます"
                : "リンクテキストとURLを入力してください"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="link-text">テキスト</Label>
              <Input
                id="link-text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="リンクテキスト"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="mt-1"
              />
            </div>
            {channel === "chatwork" && linkText && linkUrl && (
              <div className="p-3 bg-slate-50 rounded text-sm">
                <div className="text-xs text-slate-500 mb-1">プレビュー:</div>
                <div className="text-slate-900">{linkText} ({linkUrl})</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              キャンセル
            </Button>
            <Button onClick={confirmLink}>挿入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
