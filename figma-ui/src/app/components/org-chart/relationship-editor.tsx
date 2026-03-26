import { useState } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { 
  ArrowRight, 
  Users, 
  MessageSquare, 
  Briefcase, 
  Heart,
  Trash2,
  Plus,
  Sparkles,
  FileText
} from "lucide-react";

export interface Relationship {
  id: string;
  fromPersonId: string;
  toPersonId: string;
  type: "reports_to" | "influences" | "collaborates" | "mentor" | "custom";
  strength: "strong" | "medium" | "weak";
  direction: "one-way" | "two-way";
  description?: string;
  evidenceIds?: string[];
  status: "confirmed" | "proposed" | "unverified";
}

interface RelationshipEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relationship: Relationship | null;
  people: Array<{ id: string; name: string; role: string }>;
  onSave: (relationship: Relationship) => void;
  onDelete?: (relationshipId: string) => void;
}

const relationshipTypes = [
  { value: "reports_to", label: "Reports To", icon: Briefcase, color: "text-purple-600" },
  { value: "influences", label: "Influences", icon: ArrowRight, color: "text-blue-600" },
  { value: "collaborates", label: "Collaborates With", icon: Users, color: "text-emerald-600" },
  { value: "mentor", label: "Mentor/Mentee", icon: Heart, color: "text-rose-600" },
  { value: "custom", label: "Custom Relationship", icon: MessageSquare, color: "text-slate-600" },
];

export function RelationshipEditor({
  open,
  onOpenChange,
  relationship,
  people,
  onSave,
  onDelete,
}: RelationshipEditorProps) {
  const [formData, setFormData] = useState<Relationship>(
    relationship || {
      id: `rel-${Date.now()}`,
      fromPersonId: "",
      toPersonId: "",
      type: "collaborates",
      strength: "medium",
      direction: "two-way",
      status: "proposed",
      description: "",
      evidenceIds: [],
    }
  );

  const handleSave = () => {
    if (formData.fromPersonId && formData.toPersonId && formData.fromPersonId !== formData.toPersonId) {
      onSave(formData);
      onOpenChange(false);
    }
  };

  const handleDelete = () => {
    if (relationship && onDelete) {
      onDelete(relationship.id);
      onOpenChange(false);
    }
  };

  const selectedType = relationshipTypes.find(t => t.value === formData.type);
  const TypeIcon = selectedType?.icon || MessageSquare;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto p-6">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            <TypeIcon className={`w-5 h-5 ${selectedType?.color}`} />
            {relationship ? "関係性を編集" : "新しい関係性を追加"}
          </SheetTitle>
          <SheetDescription>
            人物間の関係性を定義して組織構造を可視化します
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          {/* From Person */}
          <div>
            <Label htmlFor="fromPerson" className="text-xs font-semibold text-slate-700 mb-1.5 block">
              From (起点)
            </Label>
            <Select
              value={formData.fromPersonId}
              onValueChange={(value) => setFormData({ ...formData, fromPersonId: value })}
            >
              <SelectTrigger id="fromPerson">
                <SelectValue placeholder="人物を選択..." />
              </SelectTrigger>
              <SelectContent>
                {people.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name} - {person.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Relationship Type */}
          <div>
            <Label htmlFor="relationType" className="text-xs font-semibold text-slate-700 mb-1.5 block">
              関係性タイプ
            </Label>
            <Select
              value={formData.type}
              onValueChange={(value: any) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger id="relationType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {relationshipTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${type.color}`} />
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* To Person */}
          <div>
            <Label htmlFor="toPerson" className="text-xs font-semibold text-slate-700 mb-1.5 block">
              To (終点)
            </Label>
            <Select
              value={formData.toPersonId}
              onValueChange={(value) => setFormData({ ...formData, toPersonId: value })}
            >
              <SelectTrigger id="toPerson">
                <SelectValue placeholder="人物を選択..." />
              </SelectTrigger>
              <SelectContent>
                {people.map((person) => (
                  <SelectItem key={person.id} value={person.id} disabled={person.id === formData.fromPersonId}>
                    {person.name} - {person.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Direction */}
          <div>
            <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
              方向性
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={formData.direction === "one-way" ? "default" : "outline"}
                size="sm"
                className="justify-start"
                onClick={() => setFormData({ ...formData, direction: "one-way" })}
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                一方向
              </Button>
              <Button
                type="button"
                variant={formData.direction === "two-way" ? "default" : "outline"}
                size="sm"
                className="justify-start"
                onClick={() => setFormData({ ...formData, direction: "two-way" })}
              >
                <ArrowRight className="w-4 h-4 mr-2 transform rotate-180" />
                <ArrowRight className="w-4 h-4 mr-2 -ml-3" />
                双方向
              </Button>
            </div>
          </div>

          {/* Strength */}
          <div>
            <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
              関係の強さ
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={formData.strength === "strong" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormData({ ...formData, strength: "strong" })}
              >
                強い
              </Button>
              <Button
                type="button"
                variant={formData.strength === "medium" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormData({ ...formData, strength: "medium" })}
              >
                中程度
              </Button>
              <Button
                type="button"
                variant={formData.strength === "weak" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormData({ ...formData, strength: "weak" })}
              >
                弱い
              </Button>
            </div>
          </div>

          {/* Status */}
          <div>
            <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">
              ステータス
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={formData.status === "confirmed" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormData({ ...formData, status: "confirmed" })}
              >
                確認済み
              </Button>
              <Button
                type="button"
                variant={formData.status === "proposed" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormData({ ...formData, status: "proposed" })}
              >
                提案
              </Button>
              <Button
                type="button"
                variant={formData.status === "unverified" ? "default" : "outline"}
                size="sm"
                onClick={() => setFormData({ ...formData, status: "unverified" })}
              >
                未検証
              </Button>
            </div>
          </div>

          <Separator />

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-xs font-semibold text-slate-700 mb-1.5 block">
              詳細説明 (任意)
            </Label>
            <Textarea
              id="description"
              placeholder="この関係性についての詳細情報..."
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="text-sm"
            />
          </div>

          {/* Evidence */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold text-slate-700">
                Evidence ({formData.evidenceIds?.length || 0})
              </Label>
              <Button size="sm" variant="outline" className="h-7 text-xs">
                <FileText className="w-3 h-3 mr-1" />
                追加
              </Button>
            </div>
            <div className="border rounded-md p-3 bg-slate-50 text-xs text-slate-600 min-h-[60px]">
              {formData.evidenceIds && formData.evidenceIds.length > 0 ? (
                <div className="space-y-1">
                  {formData.evidenceIds.map((evidenceId) => (
                    <div key={evidenceId} className="flex items-center gap-2">
                      <FileText className="w-3 h-3" />
                      <span>Evidence #{evidenceId}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-slate-400 py-2">
                  Evidenceが紐付けられていません
                </div>
              )}
            </div>
          </div>

          {/* AI Suggestion */}
          <div className="border border-blue-200 rounded-lg p-3 bg-blue-50">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-blue-900 mb-1">AI提案</div>
                <div className="text-xs text-blue-700">
                  Evidenceから類似の関係性を検出できます。AIによる関連性の提案を確認しますか？
                </div>
                <Button size="sm" variant="outline" className="mt-2 h-7 text-xs border-blue-300 hover:bg-blue-100">
                  提案を確認
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-2">
          <Button onClick={handleSave} className="flex-1" disabled={!formData.fromPersonId || !formData.toPersonId}>
            {relationship ? "更新" : "追加"}
          </Button>
          {relationship && onDelete && (
            <Button onClick={handleDelete} variant="destructive" size="icon">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}