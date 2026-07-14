import { useEffect, useState } from "react";
import { Mail, Clock, Calendar, AlertCircle, ArrowUpRight, FileText } from "lucide-react";
import { motion } from "motion/react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { DashboardStats, Letter, Priority, Status } from "../types";

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"recent" | "open" | "overdue" | "dueToday" | "dueThisWeek">("recent");

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20 font-sans">
      <span className="text-slate-500 font-medium">جاري تحديث Dashboard...</span>
    </div>
  );

  const cards = [
    {
      id: "open",
      title: "إجمالي الخطابات المفتوحة",
      value: stats?.totalOpen || 0,
      icon: Mail,
      color: "blue",
      description: "جميع الخطابات قيد المتابعة حالياً",
    },
    {
      id: "overdue",
      title: "خطابات متأخرة",
      value: stats?.overdue || 0,
      icon: AlertCircle,
      color: "red",
      description: "تجاوزت تاريخ استحقاق الرد",
    },
    {
      id: "dueToday",
      title: "تستحق اليوم",
      value: stats?.dueToday || 0,
      icon: Clock,
      color: "amber",
      description: "يجب معالجتها قبل نهاية اليوم",
    },
    {
      id: "dueThisWeek",
      title: "تستحق هذا الأسبوع",
      value: stats?.dueThisWeek || 0,
      icon: Calendar,
      color: "emerald",
      description: "المواعيد النهائية القادمة خلال 7 أيام",
    },
  ];

  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case "عالية": return "bg-orange-50 text-orange-600 border-orange-100";
      case "متوسطة": return "bg-blue-50 text-blue-600 border-blue-100";
      case "منخفضة": return "bg-slate-50 text-slate-600 border-slate-100";
    }
  };

  const getStatusColor = (status: Status) => {
    switch (status) {
      case "جديد": return "bg-blue-50 text-blue-600";
      case "الحاقي": return "bg-amber-50 text-amber-600";
      case "مغلق": return "bg-emerald-50 text-emerald-600";
    }
  };

  const priorityData = [
    { name: "عالية", value: 0, color: "#f97316" },
    { name: "متوسطة", value: 0, color: "#3b82f6" },
    { name: "منخفضة", value: 0, color: "#64748b" }
  ];

  if (stats?.priorityCounts) {
    stats.priorityCounts.forEach(pc => {
      const match = priorityData.find(pd => pd.name === pc.priority);
      if (match) {
        match.value = pc.count;
      }
    });
  }

  const hasPriorityData = priorityData.some(d => d.value > 0);

  const getFilteredLetters = () => {
    if (!stats) return [];
    switch (activeFilter) {
      case "open":
        return stats.openLetters || [];
      case "overdue":
        return stats.overdueLetters || [];
      case "dueToday":
        return stats.dueTodayLetters || [];
      case "dueThisWeek":
        return stats.dueThisWeekLetters || [];
      case "recent":
      default:
        return stats.recentLetters || [];
    }
  };

  const filteredLetters = getFilteredLetters();

  return (
    <div className="space-y-8 font-sans">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">نظرة عامة</h2>
        <div className="text-sm text-slate-500">آخر تحديث: {new Date().toLocaleTimeString('ar-SA')}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => {
          const isSelected = activeFilter === card.id;
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => setActiveFilter(isSelected ? "recent" : card.id as any)}
              className={cn(
                "p-6 rounded-3xl shadow-sm border transition-all duration-300 cursor-pointer relative overflow-hidden select-none hover:scale-[1.02]",
                isSelected
                  ? (card.color === "blue" ? "bg-blue-50/40 border-blue-400 ring-2 ring-blue-400/50 shadow-md shadow-blue-500/5"
                     : card.color === "red" ? "bg-red-50/40 border-red-400 ring-2 ring-red-400/50 shadow-md shadow-red-500/5"
                     : card.color === "amber" ? "bg-amber-50/40 border-amber-400 ring-2 ring-amber-400/50 shadow-md shadow-amber-500/5"
                     : "bg-emerald-50/40 border-emerald-400 ring-2 ring-emerald-400/50 shadow-md shadow-emerald-500/5")
                  : "bg-white border-slate-100 hover:border-slate-300 hover:shadow-md"
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={cn(
                  "p-3 rounded-2xl transition-all duration-350",
                  card.color === "blue" && (isSelected ? "bg-blue-200/80 text-blue-700" : "bg-blue-50 text-blue-600"),
                  card.color === "red" && (isSelected ? "bg-red-200/80 text-red-700" : "bg-red-50 text-red-600"),
                  card.color === "amber" && (isSelected ? "bg-amber-200/80 text-amber-700" : "bg-amber-50 text-amber-600"),
                  card.color === "emerald" && (isSelected ? "bg-emerald-200/80 text-emerald-700" : "bg-emerald-50 text-emerald-600")
                )}>
                  <card.icon size={24} />
                </div>
                {card.value > 0 && (
                  <div className={cn(
                    "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
                    isSelected ? "bg-slate-900 text-white" : "bg-emerald-50 text-emerald-600"
                  )}>
                    <ArrowUpRight size={12} />
                    <span>{isSelected ? "محدد" : "نشط"}</span>
                  </div>
                )}
              </div>
              <h3 className="text-slate-500 text-sm font-medium mb-1">{card.title}</h3>
              <div className="text-3xl font-bold text-slate-900 mb-2">{card.value}</div>
              <p className="text-xs text-slate-400 leading-relaxed font-normal">{card.description}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* الخطابات المفلترة بناءً على الكرت المحدد */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="text-emerald-600" size={20} />
                <span>
                  {activeFilter === "recent" && "الخطابات الأخيرة"}
                  {activeFilter === "open" && "الخطابات المفتوحة المحددة"}
                  {activeFilter === "overdue" && "الخطابات المتأخرة المحددة"}
                  {activeFilter === "dueToday" && "الخطابات المستحقة اليوم"}
                  {activeFilter === "dueThisWeek" && "خطابات تستحق هذا الأسبوع"}
                </span>
              </h3>
              {activeFilter !== "recent" && (
                <button
                  onClick={() => setActiveFilter("recent")}
                  className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-full transition-all"
                >
                  إعادة تعيين (عرض الأخيرة)
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-6 font-medium">
              {activeFilter === "recent" ? "قائمة بأحدث الخطابات التي تم تسجيلها لإمكانية الوصول السريع" : "قائمة الخطابات المفلترة بناءً على الإحصائية المحددة أعلاه"}
            </p>
          </div>
          
          <div className="overflow-x-auto">
            {filteredLetters.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-12">لا توجد خطابات مطابقة حالياً</p>
            ) : (
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 text-xs font-bold bg-slate-50/50 rounded-xl">
                    <th className="py-3 px-2">رقم الخطاب</th>
                    <th className="py-3 px-2">الجهة المصدرة</th>
                    <th className="py-3 px-2">موضوع الخطاب</th>
                    <th className="py-3 px-2 text-center">الأولوية</th>
                    <th className="py-3 px-2 text-center">الحالة</th>
                    <th className="py-3 px-2 text-left">تاريخ الاستحقاق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredLetters.map((letter: Letter) => (
                    <tr key={letter.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="py-3.5 px-2 text-sm font-bold text-slate-800 font-mono">{letter.letter_number}</td>
                      <td className="py-3.5 px-2 text-sm text-slate-600 font-medium max-w-[120px] truncate" title={letter.entity_source}>
                        {letter.entity_source}
                      </td>
                      <td className="py-3.5 px-2 text-sm text-slate-500 font-normal max-w-[180px] truncate" title={letter.category || "بلا موضوع"}>
                        {letter.category || "بلا موضوع"}
                      </td>
                      <td className="py-3.5 px-2 text-center">
                        <span className={cn(
                          "inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold border",
                          getPriorityColor(letter.priority)
                        )}>
                          {letter.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-center">
                        <span className={cn(
                          "inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold",
                          getStatusColor(letter.status)
                        )}>
                          {letter.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-left text-xs font-bold text-slate-500 font-mono">{letter.due_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* توزيع الأولوية الفعلي */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">توزيع الأولوية</h3>
            <p className="text-xs text-slate-400 font-medium font-sans">تصنيف الخطابات الحالية حسب درجة الأهمية</p>
          </div>
          
          <div className="h-48 flex items-center justify-center my-4">
            {!hasPriorityData ? (
              <span className="text-slate-400 text-sm">لا تتوفر تفاصيل للرسم البياني</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityData.filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {priorityData.filter(d => d.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} خطابات`, 'العدد']} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="space-y-2 mt-2">
            {priorityData.map((pd) => (
              <div key={pd.name} className="flex items-center justify-between text-xs p-1.5 rounded-xl hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pd.color }} />
                  <span className="font-semibold text-slate-600">{pd.name}</span>
                </div>
                <span className="font-bold text-slate-800">{pd.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
