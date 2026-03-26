import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";

const phaseData = [
  { id: "ph-1", phase: "Unlinked", count: 3, color: "#64748B" },
  { id: "ph-2", phase: "Connected", count: 5, color: "#FCD34D" },
  { id: "ph-3", phase: "Active", count: 4, color: "#FB923C" },
  { id: "ph-4", phase: "Setup", count: 7, color: "#14B8A6" },
  { id: "ph-5", phase: "Activation", count: 8, color: "#EF4444" },
  { id: "ph-6", phase: "Engagement", count: 12, color: "#8B5CF6" },
  { id: "ph-7", phase: "Optimization", count: 9, color: "#10B981" },
  { id: "ph-8", phase: "Expantion", count: 6, color: "#F59E0B" },
  { id: "ph-9", phase: "CoCreation", count: 0, color: "#94A3B8" },
  { id: "ph-10", phase: "Strategic Partner", count: 0, color: "#CBD5E1" },
];

const recentChanges = [
  {
    id: "rc-1",
    date: "2026.03.12",
    company: "株式会社AAAA",
    transition: "Setup→Activation",
  },
  {
    id: "rc-2",
    date: "2025.12.15",
    company: "株式会社BBBB",
    transition: "Engagement→Optimization",
  },
];

export function CustomerPhaseChart() {
  const maxCount = Math.max(...phaseData.map((d) => d.count));
  const chartHeight = 200;
  const chartWidth = 600;
  const barWidth = 50;
  const gap = 10;
  const leftMargin = 40;
  const bottomMargin = 80;

  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="grid grid-cols-[1fr_300px] gap-8">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Customer Phase</h2>
          <p className="text-sm text-slate-500 mb-6">顧客のフェーズ分布を可視化します</p>
          
          <div className="h-64 overflow-x-auto">
            <svg 
              width={leftMargin + phaseData.length * (barWidth + gap)} 
              height={chartHeight + bottomMargin}
              className="text-slate-500"
            >
              {/* Y-axis labels */}
              {[0, 4, 8, 12].map((tick, i) => (
                <g key={`y-tick-${i}`}>
                  <text
                    x={leftMargin - 10}
                    y={chartHeight - (tick / maxCount) * chartHeight + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="#64748b"
                  >
                    {tick}
                  </text>
                </g>
              ))}
              
              {/* Bars */}
              {phaseData.map((item, index) => {
                const barHeight = (item.count / maxCount) * chartHeight;
                const x = leftMargin + index * (barWidth + gap);
                const y = chartHeight - barHeight;
                
                return (
                  <g key={item.id}>
                    {/* Bar */}
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      fill={item.color}
                      rx={4}
                    />
                    
                    {/* X-axis label */}
                    <text
                      x={x + barWidth / 2}
                      y={chartHeight + 15}
                      textAnchor="end"
                      fontSize="11"
                      fill="#64748b"
                      transform={`rotate(-45 ${x + barWidth / 2} ${chartHeight + 15})`}
                    >
                      {item.phase}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="border-l pl-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Recently changes</h3>
          <div className="space-y-3">
            {recentChanges.map((change) => (
              <div key={change.id} className="text-sm">
                <div className="text-xs text-slate-500 mb-1">{change.date}</div>
                <div className="text-slate-700">{change.company}</div>
                <div className="text-xs text-slate-600">{change.transition}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}