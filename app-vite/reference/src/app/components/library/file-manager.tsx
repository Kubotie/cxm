import { useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Upload,
  X,
  FileText,
  Image,
  File as FileIcon,
  Paperclip,
  Check,
  Search,
} from "lucide-react";
import { Checkbox } from "../ui/checkbox";

// モック：アップロード済みファイル一覧
const existingFiles = [
  {
    id: "file_1",
    name: "製品紹介スライド.pptx",
    type: "presentation",
    size: 2456789,
    uploadedAt: "2026-03-10",
    uploadedBy: "田中 花子",
    tags: ["product", "introduction"],
  },
  {
    id: "file_2",
    name: "導入事例.pdf",
    type: "document",
    size: 1234567,
    uploadedAt: "2026-03-08",
    uploadedBy: "佐藤 太郎",
    tags: ["case_study"],
  },
  {
    id: "file_3",
    name: "価格表.xlsx",
    type: "spreadsheet",
    size: 89012,
    uploadedAt: "2026-03-05",
    uploadedBy: "田中 花子",
    tags: ["pricing"],
  },
  {
    id: "file_4",
    name: "ロゴ画像.png",
    type: "image",
    size: 45678,
    uploadedAt: "2026-03-01",
    uploadedBy: "佐藤 太郎",
    tags: ["branding", "logo"],
  },
  {
    id: "file_5",
    name: "利用規約.pdf",
    type: "document",
    size: 234567,
    uploadedAt: "2026-02-28",
    uploadedBy: "田中 花子",
    tags: ["legal", "terms"],
  },
];

interface FileManagerProps {
  selectedFiles: string[];
  onFilesChange: (fileIds: string[]) => void;
  newFiles: File[];
  onNewFilesChange: (files: File[]) => void;
}

export function FileManager({
  selectedFiles,
  onFilesChange,
  newFiles,
  onNewFilesChange,
}: FileManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      onNewFilesChange([...newFiles, ...Array.from(files)]);
    }
  };

  const handleRemoveNewFile = (index: number) => {
    onNewFilesChange(newFiles.filter((_, i) => i !== index));
  };

  const toggleExistingFile = (fileId: string) => {
    if (selectedFiles.includes(fileId)) {
      onFilesChange(selectedFiles.filter((id) => id !== fileId));
    } else {
      onFilesChange([...selectedFiles, fileId]);
    }
  };

  const getFileIcon = (file: File | { type: string }) => {
    // File オブジェクトかどうかを安全にチェック（name プロパティの存在で判定）
    const isNativeFile = 'name' in file && 'size' in file && 'lastModified' in file;
    const fileType = isNativeFile ? (file as File).type : file.type;
    
    if (fileType === "image" || fileType.startsWith("image/")) {
      return <Image className="w-4 h-4 text-blue-500" />;
    } else if (fileType === "document" || fileType === "application/pdf") {
      return <FileText className="w-4 h-4 text-red-500" />;
    } else if (fileType === "presentation") {
      return <FileText className="w-4 h-4 text-orange-500" />;
    } else if (fileType === "spreadsheet") {
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

  const filteredExistingFiles = existingFiles.filter((file) =>
    searchQuery ? file.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  return (
    <div className="space-y-4">
      <Label className="text-xs font-semibold text-slate-700 flex items-center gap-2">
        <Paperclip className="w-3.5 h-3.5" />
        添付ファイル
      </Label>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" className="text-xs">新規アップロード</TabsTrigger>
          <TabsTrigger value="existing" className="text-xs">
            既ファイル選択
            {selectedFiles.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                {selectedFiles.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-3 mt-3">
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
            <input
              type="file"
              id="file-upload-manager"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
            <label htmlFor="file-upload-manager" className="cursor-pointer">
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600 mb-1">
                クリックしてファイルを選択、またはドラッグ&ドロップ
              </p>
              <p className="text-xs text-slate-500">
                PDF, PPTX, DOCX, 画像ファイルなど（送信時に添付されます）
              </p>
            </label>
          </div>

          {newFiles.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">
                新規アップロードファイル（{newFiles.length}件）
              </Label>
              {newFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 border rounded-lg bg-slate-50"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getFileIcon(file)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-900 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveNewFile(index)}
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="existing" className="space-y-3 mt-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              placeholder="ファイル名で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <div className="space-y-1.5 max-h-[300px] overflow-y-auto border rounded-lg p-2">
            {filteredExistingFiles.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 text-center">
                該当するファイルが見つかりませんでした
              </div>
            ) : (
              filteredExistingFiles.map((file) => (
                <button
                  key={file.id}
                  onClick={() => toggleExistingFile(file.id)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg border transition-colors text-left ${
                    selectedFiles.includes(file.id)
                      ? "bg-blue-50 border-blue-300"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center ${
                      selectedFiles.includes(file.id)
                        ? "bg-blue-500 border-blue-500"
                        : "border-slate-300"
                    }`}
                  >
                    {selectedFiles.includes(file.id) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  {getFileIcon(file)}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">{file.name}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span>{file.uploadedAt}</span>
                      <span>•</span>
                      <span>{file.uploadedBy}</span>
                    </div>
                  </div>
                  {file.tags.length > 0 && (
                    <div className="flex gap-1">
                      {file.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>

          {selectedFiles.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-slate-600">
                {selectedFiles.length}件のファイルを選択中
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}