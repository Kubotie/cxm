import { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

export interface NodeConfigSheetProps {
  isOpen: boolean;
  onClose: () => void;
  nodeType: string;
  nodeName: string;
  validationStatus: "valid" | "warning" | "error";
  lastEdited?: string;
  children: ReactNode;
  onSave: () => void;
  onTest?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}

export function NodeConfigSheet({
  isOpen,
  onClose,
  nodeType,
  nodeName,
  validationStatus,
  lastEdited,
  children,
  onSave,
  onTest,
  onDelete,
  onDuplicate,
}: NodeConfigSheetProps) {
  if (!isOpen) return null;

  const getValidationBadge = () => {
    switch (validationStatus) {
      case "valid":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            ✅ Valid
          </Badge>
        );
      case "warning":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            ⚠️ Warning
          </Badge>
        );
      case "error":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            ❌ Error
          </Badge>
        );
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed right-0 top-0 bottom-0 w-[600px] bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-slate-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
              <h2 className="text-lg font-bold text-slate-900">{nodeType} Node Settings</h2>
            </div>
            {getValidationBadge()}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600 ml-12">
            <span className="font-medium">{nodeName}</span>
            {lastEdited && (
              <>
                <span>•</span>
                <span>Last edited: {lastEdited}</span>
              </>
            )}
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              キャンセル
            </Button>
            {onTest && (
              <Button variant="outline" size="sm" onClick={onTest}>
                テスト
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="default" size="sm" onClick={onSave}>
              保存
            </Button>
            <div className="relative group">
              <Button variant="outline" size="sm" className="w-8 h-8 p-0">
                ▼
              </Button>
              {/* Dropdown Menu */}
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                {onDuplicate && (
                  <button
                    onClick={onDuplicate}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    複製
                  </button>
                )}
                <button
                  onClick={() => {}}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  下に追加
                </button>
                <button
                  onClick={() => {}}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  Branch を追加
                </button>
                {onDelete && (
                  <>
                    <div className="border-t border-slate-200 my-1" />
                    <button
                      onClick={onDelete}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      削除
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

interface ConfigSectionProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function ConfigSection({ title, icon, children }: ConfigSectionProps) {
  return (
    <div className="px-6 py-4 border-b border-slate-200">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

interface ConfigFieldProps {
  label: string;
  required?: boolean;
  description?: string;
  children: ReactNode;
  error?: string;
  warning?: string;
}

export function ConfigField({
  label,
  required,
  description,
  children,
  error,
  warning,
}: ConfigFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
      </label>
      {description && (
        <p className="text-xs text-slate-600">{description}</p>
      )}
      {children}
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          ❌ {error}
        </p>
      )}
      {warning && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          ⚠️ {warning}
        </p>
      )}
    </div>
  );
}