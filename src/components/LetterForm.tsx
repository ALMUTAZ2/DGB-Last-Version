import { useState, useEffect, FormEvent } from "react";
import { X, Save, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { Letter, Priority, Status } from "../types";

interface LetterFormProps {
  letter?: Letter | null;
  readOnly?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function addWorkingDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    // 0: Sunday, 1: Monday, 2: Tuesday, 3: Wednesday, 4: Thursday, 5: Friday, 6: Saturday
    if (day !== 5 && day !== 6) {
      added++;
    }
  }
  return result;
}

export default function LetterForm({ letter, readOnly = false, onClose, onSuccess }: LetterFormProps) {
  const [formData, setFormData] = useState<Partial<Letter>>({
    entity_source: "",
    letter_number: "",
    letter_date: new Date().toISOString().split("T")[0],
    category: "",
    responsible_department: "دائرة التشغيل و الصيانة - الشرق",
    priority: "متوسطة",
    due_date: "",
    status: "جديد",
    action_taken: "بانتظار الرد",
    close_date: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (letter) {
      setFormData(letter);
    }
  }, [letter]);

  useEffect(() => {
    if (!formData.letter_date || !formData.priority) return;
    
    const date = new Date(formData.letter_date);
    if (isNaN(date.getTime())) return;

    let daysToAdd = 3;
    if (formData.priority === "عالية") daysToAdd = 1;
    else if (formData.priority === "متوسطة") daysToAdd = 3;
    else if (formData.priority === "منخفضة") daysToAdd = 5;

    const dueDate = addWorkingDays(date, daysToAdd);
    const dueDateString = dueDate.toISOString().split("T")[0];
    
    if (formData.due_date !== dueDateString) {
      setFormData((prev) => ({ ...prev, due_date: dueDateString }));
    }
  }, [formData.letter_date, formData.priority, formData.due_date]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    // Strict validation check for all fields
    if (
      !formData.entity_source?.trim() ||
      !formData.letter_number?.trim() ||
      !formData.letter_date?.trim() ||
      !formData.category?.trim() ||
      !formData.responsible_department?.trim() ||
      !formData.priority?.trim() ||
      !formData.status?.trim()
    ) {
      setError("يرجى تعبئة جميع الحقول الأساسية المطلوبة (الجهة، رقم الخطاب، تاريخ الخطاب، الموضوع، الجهة المسؤولة، والأولوية).");
      return;
    }

    if (formData.status === "مغلق") {
      if (
        !formData.outgoing_letter_number?.trim() ||
        !formData.outgoing_letter_date?.trim() ||
        !formData.close_date?.trim()
      ) {
        setError("يرجى تعبئة جميع تفاصيل الإغلاق والرد (رقم الخطاب الصادر، تاريخ الرد، وتاريخ الإغلاق الفعلي) لإغلاق هذا الخطاب.");
        return;
      }
    }

    setLoading(true);

    const url = letter ? `/api/letters/${letter.id}` : "/api/letters";
    const method = letter ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "حدث خطأ أثناء الحفظ");
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xl font-bold text-slate-900">
            {letter ? (readOnly ? "تفاصيل الخطاب (معاينة)" : "تعديل بيانات الخطاب") : "إضافة خطاب جديد"}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto space-y-8">
          <fieldset disabled={readOnly} className="space-y-8">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">الجهة الوارد منها الخطاب</label>
              <input
                required
                type="text"
                value={formData.entity_source}
                onChange={(e) => setFormData({ ...formData, entity_source: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all"
                placeholder="مثال: وزارة التجارة"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">رقم الخطاب</label>
              <input
                required
                type="text"
                value={formData.letter_number}
                onChange={(e) => setFormData({ ...formData, letter_number: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all"
                placeholder="رقم الخطاب المرجعي"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">تاريخ الخطاب</label>
              <input
                required
                type="date"
                value={formData.letter_date}
                onChange={(e) => setFormData({ ...formData, letter_date: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">تاريخ استحقاق الرد</label>
              <input
                required
                readOnly
                tabIndex={-1}
                type="date"
                value={formData.due_date}
                className="w-full px-4 py-3 bg-slate-200 text-slate-500 border border-slate-300 rounded-2xl cursor-not-allowed select-none focus:outline-none pointer-events-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">الموضوع</label>
              <input
                required
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all"
                placeholder="موضوع الخطاب..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">الجهة المسؤولة</label>
              <select
                value={formData.responsible_department}
                onChange={(e) => setFormData({ ...formData, responsible_department: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all"
              >
                <option value="دائرة التشغيل و الصيانة - الشرق">دائرة التشغيل و الصيانة - الشرق</option>
                <option value="دائرة التشغيل و الصيانة - الغرب">دائرة التشغيل و الصيانة - الغرب</option>
                <option value="دائرة دعم التشغيل و الصيانة">دائرة دعم التشغيل و الصيانة</option>
                <option value="دائرة تخطيط الشبكات">دائرة تخطيط الشبكات</option>
                <option value="دائرة الانشاءات">دائرة الانشاءات</option>
                <option value="دائرة خدمات العملاء">دائرة خدمات العملاء</option>
                <option value="دائرة العدادات الذكية">دائرة العدادات الذكية</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">الأولوية</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all mr-2"
              >
                <option value="عالية">عالية</option>
                <option value="متوسطة">متوسطة</option>
                <option value="منخفضة">منخفضة</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">الحالة</label>
              <select
                value={formData.status}
                onChange={(e) => {
                  const newStatus = e.target.value as Status;
                  const isClosed = newStatus === "مغلق";
                  setFormData((prev) => ({
                    ...prev,
                    status: newStatus,
                    action_taken: isClosed ? "تم الرد" : "بانتظار الرد",
                    close_date: isClosed ? (prev.close_date || new Date().toISOString().split("T")[0]) : ""
                  }));
                }}
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all"
              >
                <option value="جديد">جديد</option>
                <option value="الحاقي">الحاقي</option>
                <option value="مغلق">مغلق</option>
              </select>
            </div>
          </div>

          {formData.status === "مغلق" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">رقم الخطاب الصادر</label>
                <input
                  required
                  type="text"
                  placeholder="رقم الخطاب الصادر للرد..."
                  value={formData.outgoing_letter_number || ""}
                  onChange={(e) => setFormData({ ...formData, outgoing_letter_number: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl focus:ring-2 focus:ring-emerald-500/10 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">تاريخ الخطاب (الرد)</label>
                <input
                  required
                  type="date"
                  value={formData.outgoing_letter_date || formData.close_date || ""}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    outgoing_letter_date: e.target.value,
                    close_date: e.target.value // Keep close_date synced for stats calculation
                  })}
                  className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl focus:ring-2 focus:ring-emerald-500/10 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">تاريخ الإغلاق الفعلي</label>
                <input
                  required
                  type="date"
                  value={formData.close_date}
                  onChange={(e) => setFormData({ ...formData, close_date: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl focus:ring-2 focus:ring-emerald-500/10 transition-all"
                />
              </div>
            </div>
          )}

          </fieldset>

          <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-2xl transition-all"
            >
              {readOnly ? "إغلاق المعاينة" : "إلغاء"}
            </button>
            {!readOnly && (
              <button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
              >
                <Save size={20} />
                <span>{loading ? "جاري الحفظ..." : "حفظ البيانات"}</span>
              </button>
            )}
            {readOnly && (
              <span className="text-xs font-bold px-4 py-2.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl">
                ⚠️ وضع الاطلاع فقط
              </span>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
}
