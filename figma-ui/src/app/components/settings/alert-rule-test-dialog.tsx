import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Play, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { useState } from "react";

interface AlertRuleTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleName: string;
}

export function AlertRuleTestDialog({
  open,
  onOpenChange,
  ruleName,
}: AlertRuleTestDialogProps) {
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState<"idle" | "testing" | "success" | "no-match">("idle");

  const handleTest = () => {
    setTestResult("testing");
    // Simulate test execution
    setTimeout(() => {
      setTestResult(Math.random() > 0.5 ? "success" : "no-match");
    }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>アラートルールをテスト：{ruleName}</DialogTitle>
          <DialogDescription>
            サンプルデータを入力して、このルールが正しくアラートを生成するか確認します。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Test Input */}
          <div className="space-y-2">
            <Label htmlFor="testInput">テスト用サンプルデータ</Label>
            <Textarea
              id="testInput"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="例: CSE Ticket #1234 が 52h 待機中"
              rows={4}
              className="font-mono text-sm"
            />
            <p className="text-sm text-slate-600">
              このルールの条件に一致するかテストしたいデータを入力してください。
            </p>
          </div>

          {/* Test Button */}
          <div>
            <Button onClick={handleTest} disabled={!testInput || testResult === "testing"}>
              <Play className="w-4 h-4 mr-2" />
              {testResult === "testing" ? "テスト実行中..." : "テスト実行"}
            </Button>
          </div>

          {/* Test Result */}
          {testResult === "testing" && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-slate-600 animate-spin" />
                <div>
                  <p className="font-semibold text-slate-900">テスト実行中...</p>
                  <p className="text-sm text-slate-600 mt-1">
                    ルール条件との一致を確認しています。
                  </p>
                </div>
              </div>
            </div>
          )}

          {testResult === "success" && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-green-900">✅ ルールに一致しました</p>
                  <p className="text-sm text-green-800 mt-1">
                    このデータは条件に一致し、Alert Feed にアラートが生成されます。
                  </p>

                  {/* Preview of the alert that would be generated */}
                  <div className="mt-4 bg-white border border-green-200 rounded-lg p-4">
                    <p className="text-xs font-semibold text-green-700 mb-3">生成されるアラートのプレビュー：</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-slate-600 w-24">Created At:</span>
                        <span className="font-medium">2024-03-17 10:15</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-slate-600 w-24">Alert Type:</span>
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          Urgent
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-slate-600 w-24">Priority:</span>
                        <Badge className="bg-red-600 text-white">Critical</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-slate-600 w-24">Title:</span>
                        <span className="font-medium">CSE Ticket waiting over 48h detected</span>
                      </div>
                      <div className="flex items-start gap-3 text-sm">
                        <span className="text-slate-600 w-24">Summary:</span>
                        <span className="text-slate-700">
                          CSE Ticket #1234 が 52h 待機中。顧客対応の遅延リスクが高まっています。
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {testResult === "no-match" && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-orange-900">❌ ルールに一致しませんでした</p>
                  <p className="text-sm text-orange-800 mt-1">
                    このデータは条件に一致せず、アラートは生成されません。
                  </p>
                  <div className="mt-3 text-sm text-orange-800">
                    <p className="font-semibold mb-1">確認ポイント：</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Source Scope が一致しているか</li>
                      <li>Trigger Condition の閾値を満たしているか</li>
                      <li>サンプルデータの形式が正しいか</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Matches */}
          {testResult !== "idle" && (
            <div className="border-t pt-6">
              <h4 className="font-semibold text-slate-900 mb-3">最近の一致例（直近24時間）</h4>
              <div className="space-y-2">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">
                        CSE Ticket #1256 が 72h 待機中
                      </p>
                      <p className="text-slate-600 text-xs mt-1">
                        Company: テクノロジーイノベーション株式会社
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                      Urgent
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">2024-03-17 08:30 にアラート生成</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">
                        CSE Ticket #1245 が 55h 待機中
                      </p>
                      <p className="text-slate-600 text-xs mt-1">
                        Company: グローバルソリューションズ
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                      Urgent
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">2024-03-16 22:15 にアラート生成</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
