# Refactoring Plan

## Pattern to Replace

All instances of this long pattern:
```tsx
<TooltipProvider>
  <div className="flex gap-1">
    <Tooltip>...</Tooltip>
    <Tooltip>...</Tooltip>
    <Tooltip>...</Tooltip>
    <DropdownMenu>...</DropdownMenu>
  </div>
</TooltipProvider>
```

Should be replaced with:
- `<RuleActionButtons />` - for Alert/Suggestion Rules (default: test="テスト")
- `<RuleActionButtons testLabel="出力例を生成" />` - for Summary Rules  
- `<RuleActionButtons showTest={false} menuItems={[{ icon: ExternalLink, label: "適用中のルールを見る" }]} />` - for Threshold Presets
- `<RuleActionButtons testLabel="表示プレビュー" />` - for Feed Display Rules

## Files to Update
- `/src/app/pages/settings.tsx` - Main file (currently >500KB)

## Strategy
Since the file is large, we need to replace all instances systematically by searching for unique identifiers in each TableRow.
