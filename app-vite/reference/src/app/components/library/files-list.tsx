import { useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import {
  Search,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Download,
  Eye,
  Trash2,
  Upload,
} from "lucide-react";

// モック：アップロード済みファイル一覧
const existingFiles = [
  {
    id: "file_1",
    name: "製品紹介スライド.pptx",
    type: "presentation",
    fileType: "application/vnd.ms-powerpoint",
    size: 2456789,
    uploadedAt: "2026-03-10",
    uploadedBy: "田中 花子",
    usageCount: 15,
    tags: ["product", "introduction"],
    linkedTo: ["tmpl_1", "tmpl_2"],
  },
  {
    id: "file_2",
    name: "導入事例.pdf",
    type: "document",
    fileType: "application/pdf",
    size: 1234567,
    uploadedAt: "2026-03-08",
    uploadedBy: "佐藤 太郎",
    usageCount: 23,
    tags: ["case_study"],
    linkedTo: ["tmpl_1", "tmpl_3"],
  },
  {
    id: "file_3",
    name: "価格表.xlsx",
    type: "spreadsheet",
    fileType: "application/vnd.ms-excel",
    size: 89012,
    uploadedAt: "2026-03-05",
    uploadedBy: "田中 花子",
    usageCount: 8,
    tags: ["pricing"],
    linkedTo: ["tmpl_4"],
  },
  {
    id: "file_4",
    name: "ロゴ画像.png",
    type: "image",
    fileType: "image/png",
    size: 45678,
    uploadedAt: "2026-03-01",
    uploadedBy: "佐藤 太郎",
    usageCount: 34,
    tags: ["branding", "logo"],
    linkedTo: ["tmpl_1", "tmpl_2", "tmpl_3"],
  },
  {
    id: "file_5",
    name: "利用規約.pdf",
    type: "document",
    fileType: "application/pdf",
    size: 234567,
    uploadedAt: "2026-02-28",
    uploadedBy: "田中 花子",
    usageCount: 12,
    tags: ["legal", "terms"],
    linkedTo: ["tmpl_5"],
  },
  {
    id: "file_6",
    name: "QBR資料テンプレート.pptx",
    type: "presentation",
    fileType: "application/vnd.ms-powerpoint",
    size: 3456789,
    uploadedAt: "2026-02-25",
    uploadedBy: "佐藤 太郎",
    usageCount: 6,
    tags: ["qbr", "template"],
    linkedTo: ["tmpl_4"],
  },
  {
    id: "file_7",
    name: "オンボーディングガイド.pdf",
    type: "document",
    fileType: "application/pdf",
    size: 1567890,
    uploadedAt: "2026-02-20",
    uploadedBy: "田中 花子",
    usageCount: 19,
    tags: ["onboarding", "guide"],
    linkedTo: ["tmpl_2"],
  },
  {
    id: "file_8",
    name: "製品デモ動画サムネイル.jpg",
    type: "image",
    fileType: "image/jpeg",
    size: 234567,
    uploadedAt: "2026-02-15",
    uploadedBy: "佐藤 太郎",
    usageCount: 7,
    tags: ["demo", "video"],
    linkedTo: ["tmpl_3"],
  },
];

interface FilesListProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function FilesList({ searchQuery, onSearchChange }: FilesListProps) {
  const [typeFilter, setTypeFilter] = useState("all");

  const getFileIcon = (type: string) => {
    if (type === "image") {
      return <ImageIcon className="w-4 h-4 text-blue-500" />;
    } else if (type === "document" || type === "presentation") {
      return <FileText className="w-4 h-4 text-red-500" />;
    } else if (type === "spreadsheet") {
      return <FileText className="w-4 h-4 text-green-500" />;
    } else {
      return <FileIcon className="w-4 h-4 text-slate-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const filteredFiles = existingFiles.filter((file) => {
    if (typeFilter !== "all" && file.type !== typeFilter) return false;
    if (searchQuery && !file.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            placeholder="ファイル名で検索..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={typeFilter === "all" ? "default" : "outline"}
            onClick={() => setTypeFilter("all")}
            className="h-8 text-xs"
          >
            すべて
          </Button>
          <Button
            size="sm"
            variant={typeFilter === "document" ? "default" : "outline"}
            onClick={() => setTypeFilter("document")}
            className="h-8 text-xs"
          >
            Document
          </Button>
          <Button
            size="sm"
            variant={typeFilter === "presentation" ? "default" : "outline"}
            onClick={() => setTypeFilter("presentation")}
            className="h-8 text-xs"
          >
            Presentation
          </Button>
          <Button
            size="sm"
            variant={typeFilter === "image" ? "default" : "outline"}
            onClick={() => setTypeFilter("image")}
            className="h-8 text-xs"
          >
            Image
          </Button>
        </div>
      </div>

      {/* Files Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>ファイル名</TableHead>
              <TableHead className="w-[100px]">種類</TableHead>
              <TableHead className="w-[100px]">サイズ</TableHead>
              <TableHead className="w-[100px]">利用回数</TableHead>
              <TableHead className="w-[120px]">アップロード日</TableHead>
              <TableHead className="w-[100px]">Owner</TableHead>
              <TableHead className="w-[200px]">Tags</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFiles.map((file) => (
              <TableRow key={file.id} className="hover:bg-slate-50">
                <TableCell>{getFileIcon(file.type)}</TableCell>
                <TableCell className="font-medium text-sm">
                  <div className="flex items-center gap-2">
                    {file.name}
                    {file.linkedTo.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {file.linkedTo.length}件で使用中
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {file.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  {formatFileSize(file.size)}
                </TableCell>
                <TableCell className="text-sm">{file.usageCount}回</TableCell>
                <TableCell className="text-sm text-slate-600">{file.uploadedAt}</TableCell>
                <TableCell className="text-sm text-slate-600">{file.uploadedBy}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {file.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {file.tags.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{file.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <Eye className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <Download className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="p-3 border rounded-lg text-center bg-slate-50">
        <p className="text-sm text-slate-500">{filteredFiles.length}件のファイルを表示中</p>
      </div>
    </div>
  );
}
