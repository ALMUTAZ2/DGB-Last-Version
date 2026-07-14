import { LayoutDashboard, Mail, BarChart3, Settings, LogOut, PlusCircle, Users, FileText } from "lucide-react";
import { cn, getUserInitials } from "../lib/utils";
import { User } from "../types";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: User;
}

export default function Sidebar({ activeTab, setActiveTab, user }: SidebarProps) {
  const userRole = user.role;
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "letters", label: "الخطابات", icon: Mail },
    { id: "meetings", label: "الإجتماعات", icon: Users },
    { id: "meeting_summary", label: "تلخيص الاجتماعات", icon: FileText },
    { id: "reports", label: "التقارير", icon: BarChart3, managerOnly: true },
    { id: "whatsapp", label: "إعدادات الواتساب", icon: Settings },
  ];

  const isGeneralManager = user.id === 76657 || String(user.id) === "76657";
  const initials = getUserInitials(user.name);

  let subtitle = "";
  if (isGeneralManager) {
    subtitle = "المدير العام";
  } else if (userRole === "manager") {
    subtitle = "المدير العام";
  } else {
    subtitle = "موظف المتابعة";
  }

  return (
    <div className="w-64 bg-slate-900 text-white h-screen flex flex-col fixed right-0 top-0">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-emerald-400">منصة الحكومة الرقمية</h1>
        <p className="text-xs text-slate-400 mt-1">نظام المتابعة الإدارية</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          if (item.managerOnly && userRole !== "manager") return null;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                activeTab === item.id
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-4 py-3 text-slate-400">
          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-emerald-400 select-none">
            {initials}
          </div>
          <div className="flex-1 overflow-hidden text-right" dir="rtl">
            <p className="text-sm font-bold text-white truncate" title={user.name}>
              {user.name}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
