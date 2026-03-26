import { useState } from "react";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { GlobalHeader } from "../components/layout/global-header";
import { SignalsEvidenceTimeline } from "../components/project-detail/signals-evidence-timeline";
import { ProjectSummaryHeader } from "../components/project-detail/project-summary-header";
import { UsersSegmentsInsight } from "../components/project-detail/users-segments-insight";
import { ActionContentSent } from "../components/project-detail/action-content-sent";
import { InsightGenerationDrawer } from "../components/project-detail/insight-generation-drawer";
import { UserSelectionPanel } from "../components/project-detail/user-selection-panel";
import { PushConfirmModal } from "../components/project-detail/push-confirm-modal";
import { SyncConfirmModal } from "../components/project-detail/sync-confirm-modal";

export function ProjectDetail() {
  const [insightDrawerOpen, setInsightDrawerOpen] = useState(false);
  const [userSelectionOpen, setUserSelectionOpen] = useState(false);
  const [pushConfirmOpen, setPushConfirmOpen] = useState(false);
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <GlobalHeader currentView="Project" />
      
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Project Summary Header */}
          <ProjectSummaryHeader />
          
          {/* Three-column layout */}
          <div className="flex-1 overflow-hidden p-4">
            <div className="flex gap-4 h-full" style={{ minWidth: '1280px', overflowX: 'auto' }}>
              {/* Left: Signals / Evidence / Timeline - Fixed 480px */}
              <div className="w-[480px] flex-shrink-0 overflow-y-auto h-full">
                <SignalsEvidenceTimeline 
                  onGenerateInsight={() => setInsightDrawerOpen(true)}
                />
              </div>
              
              {/* Center: Users / Segments / Insight - Flexible, min 450px */}
              <div className="flex-1 min-w-[450px] overflow-y-auto h-full">
                <UsersSegmentsInsight 
                  onSelectUsers={() => setUserSelectionOpen(true)}
                  onGenerateInsight={() => setInsightDrawerOpen(true)}
                  selectedUsers={selectedUsers}
                />
              </div>
              
              {/* Right: Action / Content / Sent - Fixed 380px */}
              <div className="w-[380px] flex-shrink-0 overflow-y-auto h-full">
                <ActionContentSent 
                  onPush={() => setPushConfirmOpen(true)}
                  onSync={() => setSyncConfirmOpen(true)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals & Drawers */}
      <InsightGenerationDrawer 
        open={insightDrawerOpen}
        onClose={() => setInsightDrawerOpen(false)}
      />
      
      <UserSelectionPanel 
        open={userSelectionOpen}
        onClose={() => setUserSelectionOpen(false)}
        selectedUsers={selectedUsers}
        onSelectUsers={setSelectedUsers}
      />
      
      <PushConfirmModal 
        open={pushConfirmOpen}
        onClose={() => setPushConfirmOpen(false)}
      />
      
      <SyncConfirmModal 
        open={syncConfirmOpen}
        onClose={() => setSyncConfirmOpen(false)}
      />
    </div>
  );
}