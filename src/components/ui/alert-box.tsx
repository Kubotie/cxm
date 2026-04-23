// ─── AlertBox — 統一警告・通知ボックス ─────────────────────────────────────────
//
// ad hoc な bg-{color}-50 / border / text div を統一するための共通コンポーネント。
// variant でセマンティック色を指定し、アイコンは自動割り当て（上書き可能）。
//
// 使い方:
//   <AlertBox variant="error">エラーメッセージ</AlertBox>
//   <AlertBox variant="warning" size="sm">軽微な注意</AlertBox>
//   <AlertBox variant="policy" icon={<Sparkles className="w-4 h-4" />}>AI ポリシー情報</AlertBox>

import { AlertTriangle, Info, CheckCircle, XCircle, Sparkles } from "lucide-react";
import { cn } from "@/components/ui/utils";

export type AlertBoxVariant = 'error' | 'warning' | 'info' | 'success' | 'policy' | 'neutral';

interface VariantConfig {
  container: string;
  Icon:      React.ElementType;
  iconCls:   string;
}

const VARIANT: Record<AlertBoxVariant, VariantConfig> = {
  error:   { container: 'bg-red-50 border-red-200 text-red-700',         Icon: XCircle,       iconCls: 'text-red-500'    },
  warning: { container: 'bg-amber-50 border-amber-200 text-amber-700',   Icon: AlertTriangle, iconCls: 'text-amber-500'  },
  info:    { container: 'bg-sky-50 border-sky-200 text-sky-700',          Icon: Info,          iconCls: 'text-sky-500'    },
  success: { container: 'bg-green-50 border-green-200 text-green-700',   Icon: CheckCircle,   iconCls: 'text-green-500'  },
  policy:  { container: 'bg-violet-50 border-violet-200 text-violet-700', Icon: Sparkles,      iconCls: 'text-violet-500' },
  neutral: { container: 'bg-slate-50 border-slate-200 text-slate-600',   Icon: Info,          iconCls: 'text-slate-400'  },
};

interface AlertBoxProps {
  variant?:  AlertBoxVariant;
  /** アイコンを上書きしたいとき（null で非表示） */
  icon?:     React.ReactNode | null;
  size?:     'sm' | 'md';
  className?: string;
  children:  React.ReactNode;
}

export function AlertBox({
  variant   = 'info',
  icon,
  size      = 'md',
  className,
  children,
}: AlertBoxProps) {
  const { container, Icon, iconCls } = VARIANT[variant];
  const padCls    = size === 'sm' ? 'p-2.5 text-xs' : 'p-3 text-sm';
  const iconSzCls = size === 'sm' ? 'w-3.5 h-3.5'  : 'w-4 h-4';

  const iconNode = icon === null
    ? null
    : icon !== undefined
      ? icon
      : <Icon className={`${iconSzCls} flex-shrink-0 mt-px ${iconCls}`} />;

  return (
    <div className={cn(`flex items-start gap-2 rounded-lg border ${padCls} ${container}`, className)}>
      {iconNode}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
