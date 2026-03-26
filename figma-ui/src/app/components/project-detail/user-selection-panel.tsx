import { useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { 
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "../ui/drawer";
import { ScrollArea } from "../ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Users, CheckCircle2, XCircle } from "lucide-react";

interface UserSelectionPanelProps {
  open: boolean;
  onClose: () => void;
  selectedUsers: string[];
  onSelectUsers: (users: string[]) => void;
}

export function UserSelectionPanel({ 
  open, 
  onClose, 
  selectedUsers,
  onSelectUsers 
}: UserSelectionPanelProps) {
  const [localSelected, setLocalSelected] = useState<string[]>(selectedUsers);

  // Mock user data
  const projectUsers = [
    {
      user_id: "user_001",
      user_name: "田中太郎",
      email: "tanaka@sample.co.jp",
      role: "Champion",
      permission: "Admin",
      active: true,
      last_active: "2024-03-12 15:30",
      l7_events: 145,
      segment: "High Engagement Champion",
    },
    {
      user_id: "user_002",
      user_name: "佐藤花子",
      email: "sato@sample.co.jp",
      role: "User",
      permission: "Member",
      active: true,
      last_active: "2024-03-12 14:00",
      l7_events: 67,
      segment: "Active User",
    },
    {
      user_id: "user_003",
      user_name: "鈴木一郎",
      email: "suzuki@sample.co.jp",
      role: "Champion",
      permission: "Admin",
      active: true,
      last_active: "2024-03-12 16:00",
      l7_events: 98,
      segment: "High Engagement Champion",
    },
    {
      user_id: "user_004",
      user_name: "高橋美咲",
      email: "takahashi@sample.co.jp",
      role: "User",
      permission: "Member",
      active: false,
      last_active: "2024-02-28 10:00",
      l7_events: 2,
      segment: "At-Risk User",
    },
    {
      user_id: "user_005",
      user_name: "伊藤健",
      email: "ito@sample.co.jp",
      role: "User",
      permission: "Member",
      active: true,
      last_active: "2024-03-12 11:30",
      l7_events: 34,
      segment: "Active User",
    },
  ];

  const segmentSuggestions = [
    {
      segment_name: "High Engagement Champions",
      user_ids: ["user_001", "user_003"],
    },
    {
      segment_name: "Active Users",
      user_ids: ["user_002", "user_005"],
    },
    {
      segment_name: "At-Risk Users",
      user_ids: ["user_004"],
    },
  ];

  const handleToggleUser = (userId: string) => {
    setLocalSelected(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectSegment = (userIds: string[]) => {
    setLocalSelected(userIds);
  };

  const handleConfirm = () => {
    onSelectUsers(localSelected);
    onClose();
  };

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent className="h-[85vh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            送付対象ユーザー選択
          </DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="segments" className="flex flex-col h-full px-6">
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="segments">セグメント候補</TabsTrigger>
              <TabsTrigger value="users">個別選択</TabsTrigger>
            </TabsList>

            {/* Segments Tab */}
            <TabsContent value="segments" className="flex-1 mt-0">
              <ScrollArea className="h-[calc(85vh-200px)]">
                <div className="space-y-3 pr-4">
                  {segmentSuggestions.map((segment) => {
                    const segmentUsers = projectUsers.filter(u => 
                      segment.user_ids.includes(u.user_id)
                    );
                    const isSelected = segment.user_ids.every(id => 
                      localSelected.includes(id)
                    );

                    return (
                      <div 
                        key={segment.segment_name}
                        className={`border rounded-lg p-4 transition-colors ${
                          isSelected ? "ring-2 ring-blue-500 bg-blue-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-sm font-medium text-slate-900">
                                {segment.segment_name}
                              </h3>
                              <Badge variant="secondary" className="text-xs">
                                {segment.user_ids.length}名
                              </Badge>
                              {isSelected && (
                                <Badge className="text-xs bg-blue-100 text-blue-700">
                                  選択中
                                </Badge>
                              )}
                            </div>

                            <div className="space-y-2 mb-3">
                              {segmentUsers.map((user) => (
                                <div 
                                  key={user.user_id}
                                  className="flex items-center gap-2 text-sm"
                                >
                                  <span className="text-slate-900">{user.user_name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {user.role}
                                  </Badge>
                                  {user.active ? (
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <XCircle className="w-3 h-3 text-red-600" />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <Button 
                          variant={isSelected ? "secondary" : "outline"}
                          size="sm"
                          className="w-full"
                          onClick={() => handleSelectSegment(segment.user_ids)}
                        >
                          {isSelected ? "選択解除" : "このセグメントを選択"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Individual Users Tab */}
            <TabsContent value="users" className="flex-1 mt-0">
              <ScrollArea className="h-[calc(85vh-200px)]">
                <div className="space-y-2 pr-4">
                  {projectUsers.map((user) => {
                    const isChecked = localSelected.includes(user.user_id);

                    return (
                      <div 
                        key={user.user_id}
                        className={`border rounded-lg p-3 transition-colors ${
                          isChecked ? "bg-blue-50 border-blue-200" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox 
                            checked={isChecked}
                            onCheckedChange={() => handleToggleUser(user.user_id)}
                            className="mt-1"
                          />
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-medium text-slate-900">
                                {user.user_name}
                              </h3>
                              <Badge variant="outline" className="text-xs">
                                {user.role}
                              </Badge>
                              {user.active ? (
                                <Badge className="text-xs bg-emerald-100 text-emerald-700">
                                  Active
                                </Badge>
                              ) : (
                                <Badge className="text-xs bg-red-100 text-red-700">
                                  Inactive
                                </Badge>
                              )}
                            </div>

                            <p className="text-xs text-slate-600 mb-2">{user.email}</p>

                            <div className="flex items-center gap-3 text-xs text-slate-600">
                              <span>Permission: {user.permission}</span>
                              <span className="text-slate-400">•</span>
                              <span>L7: {user.l7_events}</span>
                              <span className="text-slate-400">•</span>
                              <span>Last: {user.last_active}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <DrawerFooter className="border-t">
          <div className="flex items-center justify-between w-full mb-3">
            <div className="text-sm text-slate-600">
              選択中: <span className="font-medium text-slate-900">{localSelected.length}名</span>
            </div>
          </div>
          <div className="flex gap-3 w-full">
            <Button variant="outline" onClick={onClose} className="flex-1">
              キャンセル
            </Button>
            <Button 
              onClick={handleConfirm}
              className="flex-1"
              disabled={localSelected.length === 0}
            >
              選択して送付対象化
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
