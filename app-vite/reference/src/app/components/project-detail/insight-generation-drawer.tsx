import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { 
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "../ui/drawer";
import { ScrollArea } from "../ui/scroll-area";
import { Sparkles, RefreshCw, Target, Users, FileText } from "lucide-react";

interface InsightGenerationDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function InsightGenerationDrawer({ open, onClose }: InsightGenerationDrawerProps) {
  // Mock input context
  const inputContext = {
    project_id: "proj_abc123",
    project_name: "株式会社サンプル - マーケティングチーム",
    a_phase: "Champion Layer",
    healthy_score: 78,
    user_count: 28,
    l30_active: 24,
    recent_logs_count: 45,
  };

  // Mock generated insight
  const generatedInsight = {
    project_summary: "マーケティングチームでは、Champion Layerの2名が積極的に新機能を活用しており、キャンペーン作成数が通常の3倍に増加しています。一方で、API連携エラーが頻発しており業務効率に影響が出ている可能性があります。また、1名のユーザーが30日以上非アクティブとなっており、離脱リスクがあります。",
    user_segments: [
      {
        name: "High Engagement Champions",
        count: 2,
        characteristics: "Champion Layerで高頻度利用中のユーザー。新機能採用率85%",
      },
      {
        name: "Active Users",
        count: 2,
        characteristics: "定期的にアクティブなUser Layer。週3-4回ログイン",
      },
      {
        name: "At-Risk Users",
        count: 1,
        characteristics: "30日以上非アクティブ。最終ログイン2024-02-28",
      },
    ],
    recommended_communication: [
      {
        segment: "High Engagement Champions",
        message: "API連携エラーの解消支援と新機能ベータテスト依頼を実施",
        channel: "1on1ミーティング or Intercom",
        priority: "高",
      },
      {
        segment: "Active Users",
        message: "活用事例のヒアリングを実施し、成功パターンを収集",
        channel: "Intercom",
        priority: "中",
      },
      {
        segment: "At-Risk Users",
        message: "リエンゲージメントメールで状況確認と支援提案",
        channel: "Email",
        priority: "高",
      },
    ],
    recommended_actions: [
      "Champion向け：API連携エラーの解消支援（優先度：高）",
      "Champion向け：新機能ベータテスト依頼",
      "Active User向け：活用事例のヒアリング実施",
      "At-Risk User向け：リエンゲージメントメール送信",
    ],
  };

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent className="h-[90vh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            AI Insight生成
          </DrawerTitle>
        </DrawerHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 pb-6">
            {/* Input Context */}
            <div className="bg-slate-50 rounded-lg p-4 border">
              <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                入力文脈
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-600">Project:</span>
                  <span className="ml-2 text-slate-900 font-medium">
                    {inputContext.project_name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600">A-Phase:</span>
                  <span className="ml-2 text-slate-900 font-medium">
                    {inputContext.a_phase}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600">Health Score:</span>
                  <span className="ml-2 text-slate-900 font-medium">
                    {inputContext.healthy_score}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600">L30 Active:</span>
                  <span className="ml-2 text-slate-900 font-medium">
                    {inputContext.l30_active} / {inputContext.user_count}名
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-600">直近ログ:</span>
                  <span className="ml-2 text-slate-900 font-medium">
                    {inputContext.recent_logs_count}件
                  </span>
                </div>
              </div>
            </div>

            {/* Generated Insight */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3">Project Summary</h3>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-slate-900 leading-relaxed">
                  {generatedInsight.project_summary}
                </p>
              </div>
            </div>

            {/* User Segments */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                ユーザーセグメント
              </h3>
              <div className="space-y-3">
                {generatedInsight.user_segments.map((segment) => (
                  <div 
                    key={segment.name}
                    className="border rounded-lg p-3 bg-white"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-sm font-medium text-slate-900">
                        {segment.name}
                      </h4>
                      <Badge variant="secondary" className="text-xs">
                        {segment.count}名
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600">
                      {segment.characteristics}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended Communication */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3">推奨コミュニケーション</h3>
              <div className="space-y-3">
                {generatedInsight.recommended_communication.map((comm, idx) => (
                  <div 
                    key={idx}
                    className="border rounded-lg p-3 bg-white"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-sm font-medium text-slate-900">
                        {comm.segment}
                      </h4>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          comm.priority === "高" 
                            ? "bg-red-50 text-red-700 border-red-200" 
                            : "bg-yellow-50 text-yellow-700 border-yellow-200"
                        }`}
                      >
                        優先度: {comm.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-900 mb-2">{comm.message}</p>
                    <p className="text-xs text-slate-600">
                      推奨チャネル: {comm.channel}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended Actions */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <Target className="w-4 h-4" />
                推奨アクション
              </h3>
              <div className="space-y-2">
                {generatedInsight.recommended_actions.map((action, idx) => (
                  <div 
                    key={idx}
                    className="flex items-start gap-2 bg-white border rounded-lg p-3"
                  >
                    <Target className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-900">{action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DrawerFooter className="border-t">
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              再生成
            </Button>
            <Button className="flex-1">
              レビューへ
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
