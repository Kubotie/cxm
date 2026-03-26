#!/usr/bin/env python3
import re

# Read the file
with open('/tmp/sandbox/src/app/pages/settings.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern for standard action buttons (Alert/Suggestion Rules) - with "テスト"
pattern_standard = r'''<TooltipProvider>
\s+<div className="flex gap-1">
\s+<Tooltip>
\s+<TooltipTrigger asChild>
\s+<Button variant="ghost" size="sm">
\s+<Edit3 className="w-4 h-4" />
\s+</Button>
\s+</TooltipTrigger>
\s+<TooltipContent>編集</TooltipContent>
\s+</Tooltip>
\s+<Tooltip>
\s+<TooltipTrigger asChild>
\s+<Button variant="ghost" size="sm">
\s+<Play className="w-4 h-4" />
\s+</Button>
\s+</TooltipTrigger>
\s+<TooltipContent>テスト</TooltipContent>
\s+</Tooltip>
\s+<Tooltip>
\s+<TooltipTrigger asChild>
\s+<Button variant="ghost" size="sm">
\s+<Copy className="w-4 h-4" />
\s+</Button>
\s+</TooltipTrigger>
\s+<TooltipContent>複製</TooltipContent>
\s+</Tooltip>
\s+<DropdownMenu>
\s+<DropdownMenuTrigger asChild>
\s+<Button variant="ghost" size="sm">
\s+<MoreVertical className="w-4 h-4" />
\s+</Button>
\s+</DropdownMenuTrigger>
\s+<DropdownMenuContent align="end">
\s+<DropdownMenuItem>
\s+<History className="w-4 h-4 mr-2" />
\s+変更履歴
\s+</DropdownMenuItem>
\s+</DropdownMenuContent>
\s+</DropdownMenu>
\s+</div>
\s+</TooltipProvider>'''

# Pattern for Summary Rules - with "出力例を生成"
pattern_summary = r'''<TooltipProvider>
\s+<div className="flex gap-1">
\s+<Tooltip>
\s+<TooltipTrigger asChild>
\s+<Button variant="ghost" size="sm">
\s+<Edit3 className="w-4 h-4" />
\s+</Button>
\s+</TooltipTrigger>
\s+<TooltipContent>編集</TooltipContent>
\s+</Tooltip>
\s+<Tooltip>
\s+<TooltipTrigger asChild>
\s+<Button variant="ghost" size="sm">
\s+<Play className="w-4 h-4" />
\s+</Button>
\s+</TooltipTrigger>
\s+<TooltipContent>出力例を生成</TooltipContent>
\s+</Tooltip>
\s+<Tooltip>
\s+<TooltipTrigger asChild>
\s+<Button variant="ghost" size="sm">
\s+<Copy className="w-4 h-4" />
\s+</Button>
\s+</TooltipTrigger>
\s+<TooltipContent>複製</TooltipContent>
\s+</Tooltip>
\s+<DropdownMenu>
\s+<DropdownMenuTrigger asChild>
\s+<Button variant="ghost" size="sm">
\s+<MoreVertical className="w-4 h-4" />
\s+</Button>
\s+</DropdownMenuTrigger>
\s+<DropdownMenuContent align="end">
\s+<DropdownMenuItem>
\s+<History className="w-4 h-4 mr-2" />
\s+変更履歴
\s+</DropdownMenuItem>
\s+</DropdownMenuContent>
\s+</DropdownMenu>
\s+</div>
\s+</TooltipProvider>'''

# Pattern for Feed Display Rules - with "表示プレビュー"
pattern_feed = r'''<TooltipProvider>
\s+<div className="flex gap-1">
\s+<Tooltip>
\s+<TooltipTrigger asChild>
\s+<Button variant="ghost" size="sm">
\s+<Edit3 className="w-4 h-4" />
\s+</Button>
\s+</TooltipTrigger>
\s+<TooltipContent>編集</TooltipContent>
\s+</Tooltip>
\s+<Tooltip>
\s+<TooltipTrigger asChild>
\s+<Button variant="ghost" size="sm">
\s+<Play className="w-4 h-4" />
\s+</Button>
\s+</TooltipTrigger>
\s+<TooltipContent>表示プレビュー</TooltipContent>
\s+</Tooltip>
\s+<Tooltip>
\s+<TooltipTrigger asChild>
\s+<Button variant="ghost" size="sm">
\s+<Copy className="w-4 h-4" />
\s+</Button>
\s+</TooltipTrigger>
\s+<TooltipContent>複製</TooltipContent>
\s+</Tooltip>
\s+<DropdownMenu>
\s+<DropdownMenuTrigger asChild>
\s+<Button variant="ghost" size="sm">
\s+<MoreVertical className="w-4 h-4" />
\s+</Button>
\s+</DropdownMenuTrigger>
\s+<DropdownMenuContent align="end">
\s+<DropdownMenuItem>
\s+<History className="w-4 h-4 mr-2" />
\s+変更履歴
\s+</DropdownMenuItem>
\s+</DropdownMenuContent>
\s+</DropdownMenu>
\s+</div>
\s+</TooltipProvider>'''

# Pattern for Threshold Presets - with ExternalLink and "適用中のルールを見る"
pattern_threshold = r'''<TooltipProvider>
\s+<div className="flex gap-1">
\s+<Tooltip>
\s+<TooltipTrigger asChild>
\s+<Button variant="ghost" size="sm">
\s+<Edit3 className="w-4 h-4" />
\s+</Button>
\s+</TooltipTrigger>
\s+<TooltipContent>編集</TooltipContent>
\s+</Tooltip>
\s+<Tooltip>
\s+<TooltipTrigger asChild>
\s+<Button variant="ghost" size="sm">
\s+<Copy className="w-4 h-4" />
\s+</Button>
\s+</TooltipTrigger>
\s+<TooltipContent>複製</TooltipContent>
\s+</Tooltip>
\s+<DropdownMenu>
\s+<DropdownMenuTrigger asChild>
\s+<Button variant="ghost" size="sm">
\s+<MoreVertical className="w-4 h-4" />
\s+</Button>
\s+</DropdownMenuTrigger>
\s+<DropdownMenuContent align="end">
\s+<DropdownMenuItem>
\s+<ExternalLink className="w-4 h-4 mr-2" />
\s+適用中のルールを見る
\s+</DropdownMenuItem>
\s+</DropdownMenuContent>
\s+</DropdownMenu>
\s+</div>
\s+</TooltipProvider>'''

# Replace patterns
content = re.sub(pattern_standard, '<RuleActionButtons />', content, flags=re.MULTILINE)
content = re.sub(pattern_summary, '<RuleActionButtons testLabel="出力例を生成" />', content, flags=re.MULTILINE)
content = re.sub(pattern_feed, '<RuleActionButtons testLabel="表示プレビュー" />', content, flags=re.MULTILINE)
content = re.sub(pattern_threshold, '<RuleActionButtons showTest={false} menuItems={[{ icon: ExternalLink, label: "適用中のルールを見る" }]} />', content, flags=re.MULTILINE)

# Write the file
with open('/tmp/sandbox/src/app/pages/settings.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Refactoring complete!")
