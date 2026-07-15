import { useEffect, useState } from "react";
import { Search, Filter, Plus, MoreVertical, Edit2, Trash2, CheckCircle2, AlertCircle, Clock, ExternalLink, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Letter, Priority, Status, User } from "../types";
import { cn } from "../lib/utils";
import LetterForm from "./LetterForm";

function getWorkingDaysElapsed(startDate: Date, endDate: Date): number {
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const target = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  
  if (current >= target) return 0;
  
  let workingDays = 0;
  while (current < target) {
    current.setDate(current.getDate() + 1);
    const day = current.getDay();
    // 0: Sunday, 1: Monday, 2: Tuesday, 3: Wednesday, 4: Thursday, 5: Friday, 6: Saturday
    if (day !== 5 && day !== 6) {
      workingDays++;
    }
  }
  return workingDays;
}

export default function LetterList({ userRole, currentUser }: { userRole: string; currentUser?: User }) {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "">("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "">("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLetter, setEditingLetter] = useState<Letter | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // State for the response date confirmation modal
  const [responseModalData, setResponseModalData] = useState<{
    letter: Letter;
    actionValue: string;
    closeDate: string;
    outgoingLetterNumber: string;
    outgoingLetterDate: string;
  } | null>(null);

  // State for the close details viewing modal
  const [viewingCloseInfoLetter, setViewingCloseInfoLetter] = useState<Letter | null>(null);

  const fetchLetters = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (statusFilter) params.append("status", statusFilter);
    if (priorityFilter) params.append("priority", priorityFilter);

    const res = await fetch(`/api/letters?${params.toString()}`);
    const data = await res.json();
    setLetters(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchLetters();
  }, [search, statusFilter, priorityFilter]);

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/letters/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDeletingId(null);
        fetchLetters();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleActionChange = async (letter: Letter, value: string) => {
    const isClosed = value === "تم الرد" || value === "لا يتطلب رد";
    if (isClosed) {
      const today = new Date().toISOString().split("T")[0];
      // open the modal to pick response date
      setResponseModalData({
        letter,
        actionValue: value,
        closeDate: letter.close_date || today,
        outgoingLetterNumber: letter.outgoing_letter_number || "",
        outgoingLetterDate: letter.outgoing_letter_date || letter.close_date || today
      });
    } else {
      const updatedLetter = {
        ...letter,
        action_taken: value,
        status: "جديد" as Status,
        close_date: "",
        outgoing_letter_number: "",
        outgoing_letter_date: "",
      };

      try {
        const res = await fetch(`/api/letters/${letter.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedLetter),
        });
        if (res.ok) {
          fetchLetters();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const confirmResponseAction = async () => {
    if (!responseModalData) return;
    const { letter, actionValue, closeDate, outgoingLetterNumber, outgoingLetterDate } = responseModalData;

    const updatedLetter = {
      ...letter,
      action_taken: actionValue,
      status: "مغلق" as Status,
      close_date: closeDate,
      outgoing_letter_number: outgoingLetterNumber,
      outgoing_letter_date: outgoingLetterDate,
    };

    try {
      const res = await fetch(`/api/letters/${letter.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedLetter),
      });
      if (res.ok) {
        setResponseModalData(null);
        fetchLetters();
      }
    } catch (err) {
      console.error(err);
    }
  };

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900">إدارة الخطابات</h2>
        {currentUser?.permission === "read" ? (
          <div
            className="bg-slate-100 text-slate-400 border border-slate-200 px-5 py-2.5 rounded-2xl flex items-center gap-2 font-bold cursor-not-allowed text-xs"
            title="حسابك يملك صلاحية الاطلاع فقط. لا يمكنك إضافة خطابات."
          >
            <Plus size={18} />
            <span>إضافة خطاب جديد (اطلاع فقط)</span>
          </div>
        ) : (
          <button
            onClick={() => {
              setEditingLetter(null);
              setIsFormOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-emerald-600/20 text-xs"
          >
            <Plus size={20} />
            <span>إضافة خطاب جديد</span>
          </button>
        )}
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="البحث برقم الخطاب، الجهة الوارد منها، أو الموضوع..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-12 pl-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as Status)}
              className="px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
            >
              <option value="">كل الحالات</option>
              <option value="جديد">جديد</option>
              <option value="الحاقي">الحاقي</option>
              <option value="مغلق">مغلق</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as Priority)}
              className="px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
            >
              <option value="">كل الأولويات</option>
              <option value="عالية">عالية</option>
              <option value="متوسطة">متوسطة</option>
              <option value="منخفضة">منخفضة</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-4 font-bold text-slate-500 text-sm">رقم الخطاب</th>
                <th className="pb-4 font-bold text-slate-500 text-sm">الجهة الوارد منها الخطاب</th>
                <th className="pb-4 font-bold text-slate-500 text-sm">الموضوع</th>
                <th className="pb-4 font-bold text-slate-500 text-sm">تاريخ الخطاب</th>
                <th className="pb-4 font-bold text-slate-500 text-sm">تاريخ الاستحقاق</th>
                <th className="pb-4 font-bold text-slate-500 text-sm">الأولوية</th>
                <th className="pb-4 font-bold text-slate-500 text-sm">الحالة</th>
                <th className="pb-4 font-bold text-slate-500 text-sm">الجهة المسؤولة</th>
                <th className="pb-4 font-bold text-slate-500 text-sm">تاريخ الإغلاق</th>
                <th className="pb-4 font-bold text-slate-500 text-sm">حالة التصعيد</th>
                <th className="pb-4 font-bold text-slate-500 text-sm">الإجراءات</th>
                <th className="pb-4 font-bold text-slate-500 text-sm">التحكم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">جاري التحميل...</td>
                </tr>
              ) : letters.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">لا توجد خطابات مطابقة للبحث</td>
                </tr>
              ) : (
                letters.map((letter) => (
                  <motion.tr
                    key={letter.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="group hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="py-4 font-bold text-slate-900">{letter.letter_number}</td>
                    <td className="py-4 text-slate-600">{letter.entity_source}</td>
                    <td className="py-4 text-slate-600">{letter.category || "—"}</td>
                    <td className="py-4 text-slate-600">{letter.letter_date}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock size={14} className="text-slate-400" />
                        <span>{letter.due_date}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold border",
                        getPriorityColor(letter.priority)
                      )}>
                        {letter.priority}
                      </span>
                    </td>
                    <td className="py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold",
                        getStatusColor(letter.status)
                      )}>
                        {letter.status}
                      </span>
                    </td>
                    <td className="py-4 text-slate-600">{letter.responsible_department || "—"}</td>
                    <td className="py-4">
                      {letter.close_date ? (
                        <button
                          type="button"
                          onClick={() => setViewingCloseInfoLetter(letter)}
                          className="flex items-center gap-1.5 text-slate-700 hover:text-emerald-700 font-medium hover:bg-emerald-50/50 p-1.5 rounded-xl transition-all border border-transparent hover:border-emerald-100 cursor-pointer active:scale-95 group/btn"
                          title="انقر لعرض تفاصيل الصادر والرد"
                        >
                          <CheckCircle2 size={14} className="text-emerald-500 shrink-0 group-hover/btn:scale-110 transition-transform" />
                          <span className="border-b border-dashed border-slate-400 group-hover/btn:border-emerald-500">{letter.close_date}</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-4">
                      {isEscalated(letter) ? (
                        <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold border border-red-200">
                          مصعد
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium border border-emerald-100">
                          غير مصعد
                        </span>
                      )}
                    </td>
                    <td className="py-4">
                      <select
                        value={letter.action_taken || "بانتظار الرد"}
                        onChange={(e) => handleActionChange(letter, e.target.value)}
                        className="px-3 py-1.5 bg-slate-100 border-none rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 transition-all font-sans"
                      >
                        <option value="بانتظار الرد">بانتظار الرد</option>
                        <option value="تم الرد">تم الرد</option>
                        <option value="لا يتطلب رد">لا يتطلب رد</option>
                      </select>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        {currentUser?.permission === "read" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLetter(letter);
                              setIsFormOpen(true);
                            }}
                            className="px-3 py-1.5 text-slate-500 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold"
                            title="عرض تفاصيل الخطاب (اطلاع فقط)"
                          >
                            <ExternalLink size={14} />
                            <span>عرض</span>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLetter(letter);
                                setIsFormOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                              title="تعديل"
                            >
                              <Edit2 size={18} />
                            </button>
                            {currentUser?.permission !== "read" && (
                              <button
                                type="button"
                                onClick={() => setDeletingId(letter.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                title="حذف"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isFormOpen && (
          <LetterForm
            letter={editingLetter}
            readOnly={currentUser?.permission === "read"}
            onClose={() => setIsFormOpen(false)}
            onSuccess={() => {
              setIsFormOpen(false);
              fetchLetters();
            }}
          />
        )}
      </AnimatePresence>

      {/* نافذة تحديد تاريخ الرد المنبثقة */}
      <AnimatePresence>
        {responseModalData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm font-sans" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
            >
              <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Clock size={20} className="text-emerald-600" />
                  <span>تحديد تاريخ الرد الفعلي</span>
                </h3>
                <button 
                  type="button"
                  onClick={() => setResponseModalData(null)} 
                  className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-full transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-emerald-50/40 border border-emerald-100/50 p-4 rounded-2xl text-xs space-y-1.5 text-slate-700">
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-500">رقم الخطاب:</span>
                    <span className="font-bold text-slate-900">{responseModalData.letter.letter_number}</span>
                  </div>
                  <div className="flex justify-between text-right">
                    <span className="font-medium text-slate-500 shrink-0">الموضوع:</span>
                    <span className="font-bold text-slate-950 truncate max-w-[200px]" title={responseModalData.letter.category}>
                      {responseModalData.letter.category || "بلا موضوع"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-500">تاريخ الخطاب:</span>
                    <span className="font-semibold text-slate-800">{responseModalData.letter.letter_date}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 block">رقم الخطاب الصادر</label>
                    <input
                      type="text"
                      placeholder="أدخل رقم الخطاب الصادر..."
                      value={responseModalData.outgoingLetterNumber}
                      onChange={(e) => setResponseModalData(prev => prev ? { ...prev, outgoingLetterNumber: e.target.value } : null)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 transition-all font-sans"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 block">تاريخ الخطاب الصادر (الرد)</label>
                    <input
                      type="date"
                      value={responseModalData.outgoingLetterDate}
                      onChange={(e) => setResponseModalData(prev => prev ? { 
                        ...prev, 
                        outgoingLetterDate: e.target.value,
                        closeDate: e.target.value // Keep closeDate synced for reporting
                      } : null)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono"
                    />
                    <p className="text-[11px] text-slate-400 font-medium pb-1.5">سيتم استخدام هذا التاريخ لحساب متوسط وقت الاستجابة بدقة في تقارير النظام.</p>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/30 flex items-center justify-end gap-3 font-sans">
                <button
                  type="button"
                  onClick={() => setResponseModalData(null)}
                  className="px-5 py-2.5 hover:bg-slate-100 text-slate-600 font-bold rounded-2xl text-sm transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={confirmResponseAction}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-md shadow-emerald-600/10"
                >
                  تأكيد وحفظ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* نافذة عرض تفاصيل إغلاق الخطاب المنبثقة */}
      <AnimatePresence>
        {viewingCloseInfoLetter && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm font-sans" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
            >
              <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 size={20} className="text-emerald-600 animate-pulse" />
                  <span>تفاصيل إغلاق الخطاب</span>
                </h3>
                <button 
                  type="button"
                  onClick={() => setViewingCloseInfoLetter(null)} 
                  className="p-1.5 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-full transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-5 text-right">
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3">
                  <div className="flex justify-between border-b border-slate-150 pb-2">
                    <span className="text-xs text-slate-500 font-bold">رقم الخطاب الوارد:</span>
                    <span className="text-sm font-extrabold text-slate-900 font-mono">{viewingCloseInfoLetter.letter_number}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-150 pb-2">
                    <span className="text-xs text-slate-500 font-bold">تاريخ الخطاب الوارد:</span>
                    <span className="text-sm font-semibold text-slate-800 font-mono">{viewingCloseInfoLetter.letter_date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-500 font-bold">الموضوع:</span>
                    <span className="text-sm font-semibold text-slate-800 truncate max-w-[200px]" title={viewingCloseInfoLetter.category}>
                      {viewingCloseInfoLetter.category || "بلا موضوع"}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  <h4 className="text-xs font-bold text-slate-400 tracking-wider">بيانات الرد الصادر</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50/30 border border-emerald-100/40 p-4 rounded-2xl space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold block">رقم وتصدير الخطاب</span>
                      <span className="text-sm font-extrabold text-emerald-950 font-mono block truncate" title={viewingCloseInfoLetter.outgoing_letter_number}>
                        {viewingCloseInfoLetter.outgoing_letter_number || "—"}
                      </span>
                    </div>
                    
                    <div className="bg-emerald-50/30 border border-emerald-100/40 p-4 rounded-2xl space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold block">تاريخ الخطاب الصادر</span>
                      <span className="text-sm font-extrabold text-emerald-950 font-mono block">
                        {viewingCloseInfoLetter.outgoing_letter_date || viewingCloseInfoLetter.close_date || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-bold">تاريخ الإغلاق الفعلي بالنظام:</span>
                    <span className="font-bold text-emerald-700 font-mono">{viewingCloseInfoLetter.close_date || "—"}</span>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/30 flex items-center justify-end font-sans">
                <button
                  type="button"
                  onClick={() => setViewingCloseInfoLetter(null)}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-md shadow-slate-950/10"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* نافذة تأكيد حذف الخطاب */}
      <AnimatePresence>
        {deletingId !== null && (() => {
          const letterToDelete = letters.find(l => l.id === deletingId);
          if (!letterToDelete) return null;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm font-sans" dir="rtl">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden"
              >
                <div className="p-6 bg-red-50 border-b border-red-100 flex items-center gap-3">
                  <div className="p-2.5 bg-red-100 text-red-600 rounded-full">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-950">تأكيد حذف الخطاب</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">تحذير: لا يمكن التراجع عن هذا الإجراء</p>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl text-xs space-y-2 text-slate-700 border border-slate-100">
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-500">رقم الخطاب:</span>
                      <span className="font-bold text-slate-900 font-mono">{letterToDelete.letter_number}</span>
                    </div>
                    <div className="flex justify-between text-right">
                      <span className="font-medium text-slate-500 shrink-0">الموضوع:</span>
                      <span className="font-bold text-slate-950 truncate max-w-[200px]" title={letterToDelete.category}>
                        {letterToDelete.category || "بلا موضوع"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-500">الجهة الوارد منها:</span>
                      <span className="font-semibold text-slate-800">{letterToDelete.entity_source}</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 text-center font-medium leading-relaxed">
                    هل أنت متأكد من رغبتك في حذف هذا الخطاب نهائياً من النظام؟
                  </p>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDeletingId(null)}
                    className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(deletingId)}
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-red-600/25 cursor-pointer active:scale-95"
                  >
                    تأكيد الحذف
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
