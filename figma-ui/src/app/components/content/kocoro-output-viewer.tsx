import { useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { 
  FileText, 
  Download, 
  Eye, 
  Play, 
  RotateCcw, 
  FileCheck,
  Clock,
  File,
  Database,
  Copy
} from "lucide-react";

interface KocoroFile {
  id: string;
  name: string;
  type: "pdf" | "pptx" | "docx" | "md" | "other";
  size: string;
  createdAt: string;
  downloadUrl: string;
}

interface KocoroOutputViewerProps {
  agentName: string;
  outputType: "text" | "markdown" | "json" | "file" | "mixed";
  textOutput?: string;
  files?: KocoroFile[];
  runInfo?: {
    executedAt: string;
    duration: string;
    status: "success" | "failed" | "running";
    cost?: string;
  };
  onExecute?: () => void;
  onReExecute?: () => void;
}

export function KocoroOutputViewer({
  agentName,
  outputType,
  textOutput,
  files = [],
  runInfo,
  onExecute,
  onReExecute,
}: KocoroOutputViewerProps) {
  const [activeTab, setActiveTab] = useState<string>("preview");

  const getFileIcon = (type: string) => {
    switch (type) {
      case "pdf":
        return <FileText className="w-4 h-4 text-red-600" />;
      case "pptx":
        return <FileText className="w-4 h-4 text-orange-600" />;
      case "docx":
        return <FileText className="w-4 h-4 text-blue-600" />;
      case "md":
        return <FileText className="w-4 h-4 text-slate-600" />;
      default:
        return <File className="w-4 h-4 text-slate-600" />;
    }
  };

  const getFileTypeBadge = (type: string) => {
    const config = {
      pdf: { label: "PDF", className: "bg-red-50 text-red-700 border-red-200" },
      pptx: { label: "PPTX", className: "bg-orange-50 text-orange-700 border-orange-200" },
      docx: { label: "DOCX", className: "bg-blue-50 text-blue-700 border-blue-200" },
      md: { label: "Markdown", className: "bg-slate-50 text-slate-700 border-slate-200" },
      other: { label: "File", className: "bg-slate-50 text-slate-700 border-slate-200" },
    };
    const { label, className } = config[type as keyof typeof config] || config.other;
    return <Badge variant="outline" className={`text-xs ${className}`}>{label}</Badge>;
  };

  return (
    <div className="border rounded-lg bg-white">
      {/* Header */}
      <div className="border-b bg-indigo-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600" />
            <div>
              <div className="text-sm font-semibold text-indigo-900">Kocoro Agent Output</div>
              <div className="text-xs text-indigo-700">{agentName}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {runInfo && (
              <div className="flex items-center gap-2 text-xs text-slate-600 mr-3">
                <Clock className="w-3 h-3" />
                <span>{runInfo.executedAt}</span>
                <span className="text-slate-400">•</span>
                <span>{runInfo.duration}</span>
                {runInfo.cost && (
                  <>
                    <span className="text-slate-400">•</span>
                    <span>{runInfo.cost}</span>
                  </>
                )}
              </div>
            )}
            {onReExecute && (
              <Button variant="outline" size="sm" onClick={onReExecute}>
                <RotateCcw className="w-3 h-3 mr-1" />
                再実行
              </Button>
            )}
            {onExecute && (
              <Button size="sm" onClick={onExecute}>
                <Play className="w-3 h-3 mr-1" />
                実行
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b px-4">
          <TabsList className="w-full justify-start border-b-0 rounded-none h-auto p-0 bg-transparent">
            <TabsTrigger 
              value="preview" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent"
            >
              <Eye className="w-3 h-3 mr-1" />
              Preview
            </TabsTrigger>
            {(outputType === "text" || outputType === "markdown" || outputType === "mixed") && textOutput && (
              <TabsTrigger 
                value="raw" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent"
              >
                <FileText className="w-3 h-3 mr-1" />
                Raw Output
              </TabsTrigger>
            )}
            {(outputType === "file" || outputType === "mixed") && files.length > 0 && (
              <TabsTrigger 
                value="files" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent"
              >
                <FileCheck className="w-3 h-3 mr-1" />
                Files ({files.length})
              </TabsTrigger>
            )}
            {runInfo && (
              <TabsTrigger 
                value="run_info" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent"
              >
                <Clock className="w-3 h-3 mr-1" />
                Run Info
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Preview Tab */}
        <TabsContent value="preview" className="p-4 m-0">
          {outputType === "markdown" || outputType === "mixed" ? (
            <div className="prose prose-sm max-w-none">
              {textOutput ? (
                <div className="text-sm text-slate-700 whitespace-pre-wrap">
                  {textOutput}
                </div>
              ) : (
                <div className="text-sm text-slate-500 italic">出力がありません</div>
              )}
            </div>
          ) : outputType === "file" && files.length > 0 ? (
            <div className="space-y-3">
              {files.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    {getFileIcon(file.type)}
                    <div>
                      <div className="text-sm font-medium text-slate-900">{file.name}</div>
                      <div className="text-xs text-slate-500">{file.size} • {file.createdAt}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getFileTypeBadge(file.type)}
                    <Button variant="outline" size="sm">
                      <Eye className="w-3 h-3 mr-1" />
                      Preview
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500 italic">プレビューがありません</div>
          )}
        </TabsContent>

        {/* Raw Output Tab */}
        {(outputType === "text" || outputType === "markdown" || outputType === "mixed") && textOutput && (
          <TabsContent value="raw" className="p-4 m-0">
            <div className="relative">
              <Button 
                variant="outline" 
                size="sm" 
                className="absolute top-2 right-2"
                onClick={() => navigator.clipboard.writeText(textOutput)}
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
              <pre className="bg-slate-50 p-4 rounded border text-xs text-slate-700 overflow-x-auto">
                {textOutput}
              </pre>
            </div>
          </TabsContent>
        )}

        {/* Files Tab */}
        {(outputType === "file" || outputType === "mixed") && files.length > 0 && (
          <TabsContent value="files" className="p-4 m-0">
            <div className="space-y-2">
              {files.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                  <div className="flex items-center gap-3 flex-1">
                    {getFileIcon(file.type)}
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-900">{file.name}</div>
                      <div className="text-xs text-slate-500">
                        {getFileTypeBadge(file.type)}
                        <span className="mx-2">•</span>
                        {file.size}
                        <span className="mx-2">•</span>
                        {file.createdAt}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Eye className="w-3 h-3 mr-1" />
                      Preview
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        )}

        {/* Run Info Tab */}
        {runInfo && (
          <TabsContent value="run_info" className="p-4 m-0">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Status</div>
                  <div>
                    {runInfo.status === "success" && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Success
                      </Badge>
                    )}
                    {runInfo.status === "failed" && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        Failed
                      </Badge>
                    )}
                    {runInfo.status === "running" && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        Running
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Duration</div>
                  <div className="text-sm text-slate-900">{runInfo.duration}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Executed At</div>
                <div className="text-sm text-slate-900">{runInfo.executedAt}</div>
              </div>
              {runInfo.cost && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">Cost</div>
                  <div className="text-sm text-slate-900">{runInfo.cost}</div>
                </div>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
