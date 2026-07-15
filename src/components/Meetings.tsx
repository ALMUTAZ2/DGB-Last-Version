import React, { useEffect, useState } from "react";
import { Plus, Search, MapPin, Clock, Calendar as CalendarIcon, X, Tag, Trash2, Activity, Edit2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Meeting, User } from "../types";

export default function Meetings({ currentUser }: { currentUser?: User }) {
  const isReadOnly = currentUser?.permission === "read";
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [deletingMeetingId, setDeletingMeetingId] = useState<number | null>(null);

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/meetings");
      const data = await res.json();
      setMeetings(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const updateMeetingStatus = async (id: number, newStatus: string) => {
    try {
      await fetch(`/api/meetings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchMeetings();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteMeeting = async (id: number) => {
    try {
      await fetch(`/api/meetings/${id}`, { method: 'DELETE' });
      fetchMeetings();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const filteredMeetings = meetings.filter(m => 
    m.topic.toLowerCase().includes(search.toLowerCase()) ||
    m.actionType.includes(search) ||
    m.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900">الاجتماعات والمواعيد</h2>
        {isReadOnly ? (
          <div
            className="bg-slate-100 text-slate-400 border border-slate-200 px-5 py-2.5 rounded-2xl flex items-center gap-2 font-bold cursor-not-allowed text-xs animate-none"
            title="حسابك يملك صلاحية الاطلاع فقط. لا يمكنك إضافة مواعيد."
          >
            <Plus size={18} />
            <span>إضافة جديد (اطلاع فقط)</span>
          </div>
        ) : (
          <button
            onClick={() => setIsFormOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-emerald-600/20 text-xs"
          >
            <Plus size={20} />
            <span>إضافة جديد</span>
          </button>
        )}
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="البحث بالموضوع أو المكان أو نوع الإجراء..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-12 pl-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-slate-800"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-4 font-bold text-slate-500 text-sm">نوع الإجراء</th>
                <th className="pb-4 font-bold text-slate-500 text-sm">الموضوع</th>
                <th className="pb-4 font-bold text-slate-500 text-sm">التاريخ</th>
                <th className="pb-4 font-bold text-slate-500 text-sm">الوقت</th>
                <th className="pb-4 font-bold text-slate-500 text-sm">المكان</th>
                <th className="pb-4 font-bold text-slate-500 text-sm">الموقف</th>
                <th className="pb-4 font-bold text-slate-500 text-sm"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">جاري التحميل...</td>
                </tr>
              ) : filteredMeetings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">لا توجد سجلات</td>
                </tr>
              ) : (
                filteredMeetings.map((meeting) => (
                  <motion.tr
                    key={meeting.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="py-4">
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                        meeting.actionType === 'إجتماع' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        meeting.actionType === 'زيارة' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                        'bg-purple-50 text-purple-700 border-purple-100'
                      }`}>
                        {meeting.actionType}
                      </span>
                    </td>
                    <td className="py-4 font-bold text-slate-900">{meeting.topic}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-2 text-slate-600 font-medium">
                        <CalendarIcon size={14} className="text-slate-400" />
                        <span dir="ltr" className="text-right">{meeting.date}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2 text-slate-600 font-mono text-sm">
                        <Clock size={14} className="text-slate-400" />
                        <span>{meeting.time}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2 text-slate-700 font-medium">
                        <MapPin size={14} className="text-rose-400" />
                        <span>{meeting.location}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <select
                        disabled={isReadOnly}
                        value={meeting.status || 'تحت الاجراء'}
                        onChange={(e) => updateMeetingStatus(meeting.id, e.target.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border outline-none cursor-pointer appearance-none ${
                          meeting.status === 'منتهي' 
                            ? 'bg-green-50 text-green-700 border-green-100 hover:bg-green-100' 
                            : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100'
                        } ${isReadOnly ? "cursor-not-allowed opacity-80" : ""}`}
                      >
                        <option value="تحت الاجراء">تحت الاجراء</option>
                        <option value="منتهي">منتهي</option>
                      </select>
                    </td>
                    <td className="py-4 text-left flex items-center justify-end gap-2">
                      {isReadOnly ? (
                        <button 
                          onClick={() => {
                            setEditingMeeting(meeting);
                            setIsFormOpen(true);
                          }}
                          className="px-3 py-1.5 text-slate-500 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold"
                          title="عرض التفاصيل (اطلاع فقط)"
                        >
                          عرض
                        </button>
                      ) : (
                        <>
                          <button 
                            onClick={() => {
                              setEditingMeeting(meeting);
                              setIsFormOpen(true);
                            }}
                            className="p-2 text-slate-400 hover:bg-slate-100 hover:text-emerald-600 rounded-full transition-colors"
                            title="تعديل"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => setDeletingMeetingId(meeting.id)}
                            className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors"
                            title="حذف"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
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
          <MeetingFormModal 
            meetingToEdit={editingMeeting}
            isReadOnly={isReadOnly}
            onClose={() => {
              setIsFormOpen(false);
              setEditingMeeting(null);
            }} 
            onSuccess={() => {
              setIsFormOpen(false);
              setEditingMeeting(null);
              fetchMeetings();
            }} 
          />
        )}
      </AnimatePresence>

      {/* نافذة تأكيد حذف الموعد/الاجتماع */}
      <AnimatePresence>
        {deletingMeetingId !== null && (() => {
          const meetingToDelete = meetings.find(m => m.id === deletingMeetingId);
          if (!meetingToDelete) return null;
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
                    <h3 className="text-lg font-bold text-slate-950">تأكيد حذف الموعد/الاجتماع</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">تحذير: لا يمكن التراجع عن هذا الإجراء</p>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl text-xs space-y-2 text-slate-700 border border-slate-100">
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-500">نوع الإجراء:</span>
                      <span className="font-bold text-slate-900">{meetingToDelete.actionType}</span>
                    </div>
                    <div className="flex justify-between text-right">
                      <span className="font-medium text-slate-500 shrink-0">الموضوع:</span>
                      <span className="font-bold text-slate-950 truncate max-w-[200px]" title={meetingToDelete.topic}>
                        {meetingToDelete.topic || "بلا موضوع"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-500">التاريخ والوقت:</span>
                      <span className="font-semibold text-slate-800">{meetingToDelete.date} - {meetingToDelete.time}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-500">المكان:</span>
                      <span className="font-semibold text-slate-800">{meetingToDelete.location}</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 text-center font-medium leading-relaxed">
                    هل أنت متأكد من رغبتك في حذف هذا الموعد/الاجتماع نهائياً؟
                  </p>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDeletingMeetingId(null)}
                    className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteMeeting(deletingMeetingId);
                      setDeletingMeetingId(null);
                    }}
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

function MeetingFormModal({ meetingToEdit, isReadOnly = false, onClose, onSuccess }: { meetingToEdit?: Meeting | null, isReadOnly?: boolean, onClose: () => void, onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    actionType: meetingToEdit?.actionType || "إجتماع",
    topic: meetingToEdit?.topic || "",
    date: meetingToEdit?.date || "",
    time: meetingToEdit?.time || "",
    location: meetingToEdit?.location || "",
    status: meetingToEdit?.status || "تحت الاجراء",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = meetingToEdit ? `/api/meetings/${meetingToEdit.id}` : "/api/meetings";
      const method = meetingToEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        onSuccess();
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden font-sans border border-slate-100"
      >
        <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">
            {meetingToEdit ? (isReadOnly ? "تفاصيل الإجراء (معاينة)" : "تعديل الإجراء") : "إضافة إجراء جديد"}
          </h3>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-full transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <fieldset disabled={isReadOnly} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700 block">نوع الإجراء</label>
            <div className="relative">
              <Tag size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={formData.actionType}
                onChange={(e) => setFormData({ ...formData, actionType: e.target.value as any })}
                className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 font-bold text-slate-900 transition-all appearance-none"
                required
              >
                <option value="إجتماع">إجتماع</option>
                <option value="زيارة">زيارة</option>
                <option value="لجنة">لجنة</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700 block">الموضوع</label>
            <input
              type="text"
              required
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              placeholder="اكتب الموضوع هنا..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 font-medium transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 block">التاريخ</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 font-mono transition-all text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 block">الوقت</label>
              <div className="relative">
                <input
                  type="time"
                  required
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 font-mono transition-all text-sm"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 block">المكان</label>
              <div className="relative">
                <MapPin size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="مثال: قاعة الاجتماعات..."
                  className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-emerald-500 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 font-medium transition-all"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 block">الموقف</label>
              <div className="relative">
                <Activity size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 font-bold text-slate-900 transition-all appearance-none"
                  required
                >
                  <option value="تحت الاجراء">تحت الاجراء</option>
                  <option value="منتهي">منتهي</option>
                </select>
              </div>
            </div>
          </div>

          </fieldset>

          <div className="pt-4 flex items-center justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-2xl transition-all"
            >
              {isReadOnly ? "إغلاق المعاينة" : "إلغاء"}
            </button>
            {!isReadOnly && (
              <button
                type="submit"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl font-bold transition-all shadow-md shadow-emerald-600/10 disabled:opacity-50"
              >
                {saving ? "جاري الحفظ..." : "حفظ"}
              </button>
            )}
            {isReadOnly && (
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
