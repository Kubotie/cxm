import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { ScrollArea } from "../ui/scroll-area";
import { AlertTriangle, Send, Users, FileText, MessageSquare } from "lucide-react";

interface IntercomSendModalProps {
  open: boolean;
  onClose: () => void;
  selectedUsers: string[];
}

export function IntercomSendModal({ 
  open, 
  onClose,
  selectedUsers 
}: IntercomSendModalProps) {
  
  // Mock send data
  const sendData = {
    action_id: "act_002",
    action_title: "新機能ベータテスト依頼",
    audience_scope: "Project",
    audience_id: "proj_abc123",
    resolved_recipients_count: selectedUsers.length || 2,
    unresolved_recipients: 0,
    content_job_id: "cj_002",
    message_title: "新機能ベータテスト参加のお願い",
    message_body: `いつもご利用いただきありがとうございます。

この度、新機能「高度な分析ダッシュボード」のベータ版をリリースいたしました。

Champion Layerの皆様に優先的にお試しいただき、フィードバックをいただけますと幸いです。

【新機能の概要】
- リアルタイムでのKPI可視化
- カスタマイズ可能なダッシュボード
- CSV/PDFエクスポート機能

ご興味がございましたら、ぜひお試しください。

何かご不明点がございましたら、お気軽にご連絡ください。`,
    evidence_refs: [
      {
        id: "ev_1",
        source: "Product Usage",
        summary: "キャンペーン作成数が通常の3倍に増加",
      },
      {
        id: "ev_2",
        source: "Slack",
        summary: "新機能への期待の声",
      },
      {
        id: "ev_3",
        source: "Minutes",
        summary: "次四半期の展開計画についてディスカッション",
      },
    ],
    recipients: [
      {
        user_id: "user_001",
        user_name: "田中太郎",
        email: "tanaka@sample.co.jp",
        role: "Champion",
      },
      {
        user_id: "user_003",
        user_name: "鈴木一郎",
        email: "suzuki@sample.co.jp",
        role: "Champion",
      },
    ],
  };

  const getScopeBadge = (scope: string) => {
    const colors = {
      Company: "bg-purple-100 text-purple-700",
      Project: "bg-blue-100 text-blue-700",
      User: "bg-emerald-100 text-emerald-700",
    };
    return <Badge className={`text-xs ${colors[scope as keyof typeof colors]}`}>{scope}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[calc(100vh-4rem)] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Intercom送信確認（危険操作）
          </DialogTitle>
          <DialogDescription>
            この操作は外部送信を伴います。内容を慎重に確認してください。
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Action Info */}
            <div className="bg-slate-50 rounded-lg p-4 border">
              <h3 className="text-sm font-medium text-slate-700 mb-3">Action情報</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <span className="text-slate-600 min-w-24">Action:</span>
                  <span className="text-slate-900 font-medium">
                    {sendData.action_title}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-600 min-w-24">Scope:</span>
                  <div className="flex items-center gap-2">
                    {getScopeBadge(sendData.audience_scope)}
                    <span className="text-slate-600 text-xs">
                      {sendData.audience_id}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-slate-600 min-w-24">送信チャネル:</span>
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-purple-600" />
                    <span className="text-slate-900 font-medium">Intercom</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recipients */}
            <div className="bg-slate-50 rounded-lg p-4 border">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-medium text-slate-700">送信対象</h3>
              </div>
              
              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-slate-600">解決済み:</span>
                  <Badge className="bg-emerald-100 text-emerald-700">
                    {sendData.resolved_recipients_count}名
                  </Badge>
                </div>
                {sendData.unresolved_recipients > 0 && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-slate-600">未解決:</span>
                    <Badge className="bg-orange-100 text-orange-700">
                      {sendData.unresolved_recipients}名
                    </Badge>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {sendData.recipients.map((recipient) => (
                  <div 
                    key={recipient.user_id}
                    className="bg-white border rounded p-2 flex items-center gap-2"
                  >
                    <span className="text-sm text-slate-900 font-medium">
                      {recipient.user_name}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {recipient.role}
                    </Badge>
                    <span className="text-xs text-slate-600 ml-auto">
                      {recipient.email}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Message Content */}
            <div className="bg-slate-50 rounded-lg p-4 border">
              <h3 className="text-sm font-medium text-slate-700 mb-3">送信メッセージ</h3>
              <div className="bg-white border rounded-lg p-4">
                <h4 className="font-medium text-slate-900 mb-3">
                  {sendData.message_title}
                </h4>
                <div className="text-sm text-slate-900 whitespace-pre-line leading-relaxed">
                  {sendData.message_body}
                </div>
              </div>
            </div>

            {/* Evidence */}
            <div className="bg-slate-50 rounded-lg p-4 border">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-medium text-slate-700">Evidence</h3>
                <Badge variant="outline" className="text-xs">
                  {sendData.evidence_refs.length}件
                </Badge>
              </div>

              <div className="space-y-2">
                {sendData.evidence_refs.map((evidence) => (
                  <div 
                    key={evidence.id}
                    className="bg-white border rounded p-2"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {evidence.source}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-900">{evidence.summary}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Warning */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-orange-900 mb-1">
                    外部送信の確認
                  </h3>
                  <p className="text-sm text-orange-800">
                    この操作により、Intercomを通じて実際のユーザーにメッセージが送信されます。
                    送信内容、対象者、Evidence を確認の上、実行してください。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button 
            className="bg-purple-600 hover:bg-purple-700"
            onClick={() => {
              // Send logic here
              alert("Intercom送信が完了しました");
              onClose();
            }}
          >
            <Send className="w-4 h-4 mr-2" />
            送信する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}