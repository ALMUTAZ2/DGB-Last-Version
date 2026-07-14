import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Clock, CheckCircle, AlertCircle, Download } from "lucide-react";
import { motion } from "motion/react";
import { Letter } from "../types";

export default function Reports() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  function getWorkingDaysElapsed(startDate: Date, endDate: Date): number {
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const target = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    
    if (current >= target) return 0;
    
    let workingDays = 0;
    while (current < target) {
      current.setDate(current.getDate() + 1);
      const day = current.getDay();
      if (day !== 5 && day !== 6) {
        workingDays++;
      }
    }
    return workingDays;
  }

  const isEscalated = (letter: Letter) => {
    if (letter.status === "مغلق") return false;
    const letterDate = new Date(letter.letter_date);
    const today = new Date();
    const workingDaysElapsed = getWorkingDaysElapsed(letterDate, today);
    
    let limit = 5;
    if (letter.priority === "عالية") limit = 1;
    else if (letter.priority === "متوسطة") limit = 3;
    else if (letter.priority === "منخفضة") limit = 5;
    
    return workingDaysElapsed > limit;
  };

  const handleExportLetters = async () => {
    try {
      setExporting(true);
      const res = await fetch("/api/letters");
      if (!res.ok) throw new Error("Failed to fetch letters");
      const letters: Letter[] = await res.json();

      const headers = [
        "رقم الخطاب",
        "الجهة الوارد منها الخطاب",
        "الموضوع",
        "تاريخ الخطاب",
        "تاريخ الاستحقاق",
        "الأولوية",
        "الحالة",
        "الجهة المسؤولة",
        "المستلم / المالك",
        "تاريخ الإغلاق",
        "حالة التصعيد",
        "رقم الخطاب الصادر للرد",
        "تاريخ الخطاب الصادر (الرد)",
        "الإجراء المتخذ",
        "ملاحظات"
      ];

      const escapeCSV = (val: any) => {
        if (val === undefined || val === null) return "";
        let str = String(val).trim();
        if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
          str = `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const rows = letters.map((letter) => {
        const escalatedStatus = isEscalated(letter) ? "مصعد" : "غير مصعد";
        return [
          letter.letter_number,
          letter.entity_source,
          letter.category || "—",
          letter.letter_date,
          letter.due_date,
          letter.priority,
          letter.status,
          letter.responsible_department || "—",
          letter.owner || "—",
          letter.close_date || "—",
          escalatedStatus,
          letter.outgoing_letter_number || "—",
          letter.outgoing_letter_date || "—",
          letter.action_taken || "—",
          letter.notes || "—"
        ];
      });

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(escapeCSV).join(","))
      ].join("\r\n");

      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `تقرير_إدارة_الخطابات_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error exporting letters:", err);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fetch("/api/reports")
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-20 font-sans">
      <span className="text-slate-500 font-medium">جاري تحميل التقارير والتحليلات...</span>
    </div>
  );

  const COLORS = [
    "#3b82f6", // Blue
    "#10b981", // Emerald
    "#f59e0b", // Amber
    "#8b5cf6", // Violet
    "#ec4899", // Pink
    "#06b6d4", // Cyan
    "#f97316", // Orange
    "#14b8a6", // Teal
    "#6366f1", // Indigo
    "#a855f7"  // Purple
  ];

  const deptMap: { [key: string]: { department: string; جديد: number; الحاقي: number; مغلق: number; total: number } } = {};
  
  (data.departmentStatusCounts || []).forEach((row: any) => {
    const dept = row.department;
    if (!deptMap[dept]) {
      deptMap[dept] = { department: dept, جديد: 0, الحاقي: 0, مغلق: 0, total: 0 };
    }
    const status = row.status as 'جديد' | 'الحاقي' | 'مغلق';
    if (status === 'جديد' || status === 'الحاقي' || status === 'مغلق') {
      deptMap[dept][status] = row.count;
    }
    deptMap[dept].total += row.count;
  });

  const deptData = Object.values(deptMap).sort((a, b) => b.total - a.total);
  const totalLettersCount = data.total || 0;

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">تقارير الأداء</h2>
          <p className="text-sm text-slate-400 font-medium mt-1">تتبع إحصائيات الخطابات وتصدير تقارير الإدارة بصيغة Excel/CSV</p>
        </div>
        <button
          type="button"
          onClick={handleExportLetters}
          disabled={exporting}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-75 disabled:cursor-not-allowed text-white px-5 py-3 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all shadow-md shadow-emerald-600/10 active:scale-95 cursor-pointer shrink-0"
        >
          <Download size={18} className={exporting ? "animate-bounce" : ""} />
          <span>{exporting ? "جاري التصدير..." : "تصدير تقرير الخطابات"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">متوسط وقت الاستجابة</p>
              <p className="text-2xl font-bold text-slate-900">{data.avgResponseTime} يوم</p>
            </div>
          </div>
          <p className="text-xs text-slate-400">من تاريخ الاستلام حتى تاريخ الإغلاق</p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <CheckCircle size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">إجمالي الخطابات</p>
              <p className="text-2xl font-bold text-slate-900">{data.total}</p>
            </div>
          </div>
          <p className="text-xs text-slate-400">إجمالي الخطابات المسجلة في النظام</p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">نسبة التأخير</p>
              <p className="text-2xl font-bold text-slate-900">{data.overduePercentage}%</p>
            </div>
          </div>
          <p className="text-xs text-slate-400">نسبة الخطابات التي تجاوزت موعدها</p>
        </div>
      </div>

      {/* الرسم الدائري لتوزيع الخطابات حسب الجهات المسؤولة */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-900 mb-2">توزيع الخطابات حسب الجهة المسؤولة</h3>
        <p className="text-xs text-slate-400 mb-8 font-medium">النسبة المئوية وحجم توزيع الأعمال على كل جهة مسؤولة في النظام</p>

        {deptData.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-16">لا تتوفر جهات مسؤولة حالياً لعرض الرسم البياني</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="h-80 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deptData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="total"
                    nameKey="department"
                  >
                    {deptData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} خطابات`, 'إجمالي الخطابات']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-extrabold text-slate-800">{totalLettersCount}</span>
                <span className="text-[11px] font-bold text-slate-400 mt-1">إجمالي الخطابات</span>
              </div>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-2 pl-1 font-sans">
              <span className="text-sm font-bold text-slate-700 block mb-3">حجم الأعمال ونسب التوزيع:</span>
              {deptData.map((d: any, index: number) => {
                const percentage = totalLettersCount > 0 ? ((d.total / totalLettersCount) * 100).toFixed(1) : "0";
                return (
                  <div key={d.department} className="flex items-center justify-between text-xs p-3 rounded-2xl bg-slate-50 border border-slate-100/50 hover:bg-slate-100/80 hover:shadow-sm transition-all duration-300">
                    <div className="flex items-center gap-3">
                      <div className="w-3.5 h-3.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="font-bold text-slate-800">{d.department}</span>
                    </div>
                    <div className="flex items-center gap-3 font-semibold">
                      <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg text-[10px] font-bold">{percentage}%</span>
                      <span className="text-slate-900 font-bold text-sm font-mono">{d.total} خطابات</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* تفاصيل توزيع الحالات حسب الجهة المسؤولة */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900">تفاصيل توزيع الحالات حسب الجهة المسؤولة</h3>
          <p className="text-sm text-slate-500 mt-1">جدول تفصيلي يوضح أعداد وتصنيف الخطابات المنسوبة لكل جهة لتسهيل المتابعة والتقييم</p>
        </div>

        {/* جدول التوزيع */}
        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100">
                <th className="p-4 font-bold text-slate-600 text-sm">الجهة المسؤولة</th>
                <th className="p-4 font-bold text-slate-600 text-sm text-center">جديد</th>
                <th className="p-4 font-bold text-slate-600 text-sm text-center">الحاقي</th>
                <th className="p-4 font-bold text-slate-600 text-sm text-center">مغلق</th>
                <th className="p-4 font-bold text-slate-600 text-sm text-center">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deptData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 text-sm">لا توجد بيانات للجهات المسؤولة حالياً</td>
                </tr>
              ) : (
                deptData.map((d) => (
                  <tr key={d.department} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-bold text-slate-800 text-sm">{d.department}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${
                        d.جديد > 0 ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-400"
                      }`}>
                        {d.جديد}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${
                        d.الحاقي > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-400"
                      }`}>
                        {d.الحاقي}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${
                        d.مغلق > 0 ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
                      }`}>
                        {d.مغلق}
                      </span>
                    </td>
                    <td className="p-4 text-center font-bold text-slate-700 text-sm">
                      {d.total}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
