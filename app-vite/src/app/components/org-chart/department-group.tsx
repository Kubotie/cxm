import { ReactNode } from "react";
import { Building } from "lucide-react";

interface DepartmentGroupProps {
  departmentName: string;
  children: ReactNode;
  color?: string;
}

const departmentColors: Record<string, string> = {
  "Sales": "border-blue-200 bg-blue-50/50",
  "Engineering": "border-purple-200 bg-purple-50/50",
  "Product": "border-emerald-200 bg-emerald-50/50",
  "Marketing": "border-rose-200 bg-rose-50/50",
  "Customer Success": "border-cyan-200 bg-cyan-50/50",
  "Finance": "border-amber-200 bg-amber-50/50",
  "Operations": "border-slate-200 bg-slate-50/50",
  "Other": "border-slate-200 bg-slate-50/50",
  "All": "border-transparent bg-transparent",
  "Missing Roles": "border-amber-200 bg-amber-50/50",
};

export function DepartmentGroup({ departmentName, children, color }: DepartmentGroupProps) {
  const groupColor = color || departmentColors[departmentName] || departmentColors["Other"];
  
  // Don't render a visible group for "All"
  if (departmentName === "All") {
    return <div className="flex justify-center gap-12 flex-wrap">{children}</div>;
  }

  return (
    <div className={`relative border-2 rounded-xl p-6 min-w-[280px] ${groupColor}`}>
      {/* Department Label */}
      <div className="absolute -top-3 left-4 px-2 bg-white rounded border-2 border-inherit flex items-center gap-1.5">
        <Building className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-xs font-semibold text-slate-700">{departmentName}</span>
      </div>
      
      {/* Department Content - Stack vertically within department */}
      <div className="flex flex-col gap-4 mt-2">
        {children}
      </div>
    </div>
  );
}