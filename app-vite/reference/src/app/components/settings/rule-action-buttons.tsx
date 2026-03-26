import { Button } from "../ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Edit3, Play, Copy, MoreVertical, History, ExternalLink } from "lucide-react";

interface RuleActionButtonsProps {
  showTest?: boolean;
  testLabel?: string;
  showCopy?: boolean;
  showMenu?: boolean;
  menuItems?: Array<{
    icon: typeof History | typeof ExternalLink;
    label: string;
    onClick?: () => void;
  }>;
  onEdit?: () => void;
  onTest?: () => void;
  onCopy?: () => void;
  onHistory?: () => void;
}

export function RuleActionButtons({
  showTest = true,
  testLabel = "テスト",
  showCopy = true,
  showMenu = true,
  menuItems = [{ icon: History, label: "変更履歴" }],
  onEdit,
  onTest,
  onCopy,
  onHistory,
}: RuleActionButtonsProps) {
  return (
    <TooltipProvider>
      <div className="flex gap-1">
        {/* 編集ボタン */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Edit3 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>編集</TooltipContent>
        </Tooltip>

        {/* テストボタン（オプション） */}
        {showTest && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={onTest}>
                <Play className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{testLabel}</TooltipContent>
          </Tooltip>
        )}

        {/* 複製ボタン（オプション） */}
        {showCopy && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={onCopy}>
                <Copy className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>複製</TooltipContent>
          </Tooltip>
        )}

        {/* メニュー（オプション） */}
        {showMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem 
                    key={index} 
                    onClick={item.onClick || (index === 0 ? onHistory : undefined)}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </TooltipProvider>
  );
}