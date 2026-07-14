import { useEffect, useState } from "react";
import { UserPlus, Search, Shield, ShieldAlert, Check, CheckCircle2, AlertCircle, RefreshCw, Eye, Edit3, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface PermissionUser {
  id: number;
  name: string;
  email: string;
  role: string;
  permission: "read" | "write";
}

export default function PermissionsManager() {
  const [users, setUsers] = useState<PermissionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newPermission, setNewPermission] = useState<"read" | "write">("read");
  const [addError, setAddError] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [deletingUser, setDeletingUser] = useState<{ id: number; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/permissions");
      if (!res.ok) throw new Error("فشل تحميل قائمة الصلاحيات");
      const data = await res.json();
      setUsers(data);
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "فشل الاتصال بالخادم" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const handleUpdatePermission = async (employeeId: number, permission: "read" | "write") => {
    // Optimistic update
    const previousUsers = [...users];
    setUsers(users.map(u => u.id === employeeId ? { ...u, permission } : u));

    try {
      const res = await fetch("/api/permissions/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, permission })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "فشل تحديث الصلاحية");
      }

      setFeedback({
        type: "success",
        message: `تم تحديث صلاحية الموظف بنجاح إلى: ${permission === "write" ? "اطلاع وتحرير" : "اطلاع فقط"}`
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (e: any) {
      setUsers(previousUsers); // Revert on failure
      setFeedback({ type: "error", message: e.message || "حدث خطأ أثناء حفظ التغييرات" });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const confirmDeleteUser = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      const res = await fetch("/api/permissions/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: deletingUser.id })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "فشل حذف الموظف");
      }

      setFeedback({
        type: "success",
        message: `تم حذف الموظف ${deletingUser.name} وإلغاء صلاحية دخوله بنجاح.`
      });
      setDeletingUser(null);
      fetchPermissions();
      setTimeout(() => setFeedback(null), 3000);
    } catch (e: any) {
      setFeedback({ type: "error", message: e.message || "حدث خطأ أثناء محاولة حذف الموظف" });
      setDeletingUser(null);
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    if (!newEmployeeId.trim()) {
      setAddError("يرجى إدخال الرقم الوظيفي");
      return;
    }
    if (!newEmployeeName.trim()) {
      setAddError("يرجى إدخال اسم الموظف ثنائياً على الأقل");
      return;
    }

    const parsedId = Number(newEmployeeId);
    if (isNaN(parsedId)) {
      setAddError("الرقم الوظيفي يجب أن يحتوي على أرقام فقط");
      return;
    }

    setIsAdding(true);
    try {
      const res = await fetch("/api/permissions/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: parsedId,
          name: newEmployeeName.trim(),
          permission: newPermission
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "فشل إضافة الموظف");
      }

      setFeedback({ type: "success", message: `تم إضافة الموظف ${newEmployeeName} بنجاح` });
      setShowAddModal(false);
      setNewEmployeeId("");
      setNewEmployeeName("");
      setNewPermission("read");
      fetchPermissions();
      setTimeout(() => setFeedback(null), 3500);
    } catch (e: any) {
      setAddError(e.message || "فشل الاتصال بالخادم لإضافة الموظف");
    } finally {
      setIsAdding(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return String(user.id).includes(q) || user.name.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-3">
            <Shield className="text-emerald-500 w-7 h-7" />
            إدارة الصلاحيات والوصول للمنصة
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            من هنا يمكنك تنظيم مستويات الوصول للموظفين والتحكم في إمكانية الاطلاع أو التعديل على البيانات والخطابات والاجتماعات.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPermissions}
            className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all border border-slate-200"
            title="تحديث البيانات"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
          
          <button
            onClick={() => {
              setAddError("");
              setShowAddModal(true);
            }}
            className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-600/15 flex items-center gap-2 transition-all active:scale-95"
          >
            <UserPlus size={16} />
            إضافة موظف جديد
          </button>
        </div>
      </div>

      {/* Global Feedback Toasts */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`p-4 rounded-2xl shadow-xl flex items-center gap-3 border ${
              feedback.type === "success" 
                ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                : "bg-rose-50 border-rose-100 text-rose-800"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle size={20} className="text-rose-500 shrink-0" />
            )}
            <span className="text-xs font-bold leading-relaxed">{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-2">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="البحث برقم الموظف أو الاسم الكريم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-12 pl-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
          />
        </div>
        <div className="bg-slate-100/50 border border-slate-200/60 p-4 rounded-2xl flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">إجمالي الموظفين المسجلين:</span>
          <span className="font-bold text-slate-800 px-3 py-1 bg-white border border-slate-200 rounded-full">{users.length} موظف</span>
        </div>
      </div>

      {/* Employees Grid/Table Card */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading && users.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-4">
            <RefreshCw size={36} className="animate-spin text-emerald-500" />
            <p className="text-sm font-medium">جاري تحميل مستويات الصلاحيات من قاعدة البيانات...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-3">
            <ShieldAlert size={42} className="text-slate-300" />
            <p className="text-sm font-bold text-slate-600">لا يوجد موظفين يطابقون معايير البحث</p>
            <p className="text-xs text-slate-400">تأكد من كتابة الرقم الوظيفي أو الاسم بشكل صحيح.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-bold text-slate-500">
                  <th className="p-4 pr-6">الرقم الوظيفي</th>
                  <th className="p-4">اسم الموظف</th>
                  <th className="p-4">البريد الإلكتروني</th>
                  <th className="p-4">الصفة الإدارية</th>
                  <th className="p-4 text-center">نوع الصلاحية بالمنصة</th>
                  <th className="p-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {filteredUsers.map((user) => {
                  const isSelf = user.id === 100889;
                  return (
                    <tr 
                      key={user.id} 
                      className={`hover:bg-slate-50/50 transition-all ${isSelf ? "bg-emerald-50/10" : ""}`}
                    >
                      <td className="p-4 pr-6 font-mono font-bold text-slate-700">
                        {user.id}
                      </td>
                      <td className="p-4 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          {user.name}
                          {isSelf && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] rounded-full font-bold">
                              أنت (المسؤول)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-xs font-mono text-slate-400">
                        {user.email}
                      </td>
                      <td className="p-4 text-xs">
                        <span className={`px-2.5 py-1 rounded-lg font-bold ${
                          isSelf 
                            ? "bg-purple-100 text-purple-800 border border-purple-200"
                            : user.role === "manager" 
                            ? "bg-slate-100 text-slate-800 border border-slate-200" 
                            : "bg-blue-50 text-blue-800 border border-blue-100"
                        }`}>
                          {isSelf ? "Admin" : user.role === "manager" ? "مدير عام" : "موظف المتابعة"}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {isSelf ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-100">
                            <Check size={14} />
                            إطلاع وتحرير كامل (دائم)
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <select
                               value={user.permission || "read"}
                              onChange={(e) => handleUpdatePermission(user.id, e.target.value as "read" | "write")}
                              className={`text-xs font-bold px-3 py-2 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                                user.permission === "write"
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                  : "bg-amber-50 border-amber-200 text-amber-800"
                              }`}
                            >
                              <option value="read">👁️ اطلاع فقط (لا تملك صلاحية تحرير)</option>
                              <option value="write">✍️ اطلاع وتحرير (كامل الصلاحيات)</option>
                            </select>
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {isSelf ? (
                          <span className="text-xs text-slate-400 font-bold">-</span>
                        ) : (
                          <button
                            onClick={() => setDeletingUser({ id: user.id, name: user.name })}
                            className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 hover:border-rose-200 rounded-xl transition-all"
                            title="حذف الموظف وإلغاء تفعيل صلاحيته"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Permissions Context Help Message */}
      <div className="bg-slate-900 text-slate-300 p-5 rounded-3xl border border-slate-800 shadow-md">
        <h4 className="font-bold text-sm text-white mb-2 flex items-center gap-2">
          💡 معلومات هامة حول صلاحية الموظفين:
        </h4>
        <ul className="list-disc list-inside text-xs space-y-2 leading-relaxed text-slate-300 mr-2">
          <li>
            <strong className="text-amber-400">صلاحية اطلاع فقط:</strong> تتيح للموظف تصفح المنصة بالكامل، ومشاهدة الخطابات والاجتماعات والتقارير ولكن <span className="text-white font-bold underline">يتم حظر وإخفاء أي عملية إضافة، تعديل، أو حذف</span>.
          </li>
          <li>
            <strong className="text-emerald-400">صلاحية اطلاع وتحرير:</strong> تمنح الموظف القدرة الكاملة على تشغيل جميع أدوات المنصة، والرد على الخطابات والاجتماعات، وتعديل حالة المتابعة وحفظها بشكل فوري في قاعدة البيانات.
          </li>
          <li>
            كإجراء أمان افتراضي، يُسجل أي موظف جديد يتم إضافته أو يسجل الدخول لأول مرة في وضع <strong className="text-amber-400">الاطلاع فقط</strong>، ولا يمكن ترقيته إلا من خلال هذه الشاشة بواسطة حساب المسؤول العام.
          </li>
        </ul>
      </div>

      {/* Add Employee Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="text-emerald-500" size={18} />
                  إضافة موظف جديد وتحديد صلاحياته
                </h3>
              </div>

              <form onSubmit={handleAddEmployee} className="p-6 space-y-4">
                {addError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                    <AlertCircle size={16} className="text-rose-500 shrink-0" />
                    <span>{addError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    الرقم الوظيفي للموظف
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="مثال: 100889"
                    value={newEmployeeId}
                    onChange={(e) => setNewEmployeeId(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono text-center font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    اسم الموظف الكريم
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: معتز محمد"
                    value={newEmployeeName}
                    onChange={(e) => setNewEmployeeName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    الصلاحية الممنوحة له بالمنصة
                  </label>
                  <select
                    value={newPermission}
                    onChange={(e) => setNewPermission(e.target.value as "read" | "write")}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-bold"
                  >
                    <option value="read">👁️ اطلاع فقط (لا يملك صلاحية تحرير)</option>
                    <option value="write">✍️ اطلاع وتحرير (كامل الصلاحيات)</option>
                  </select>
                </div>

                <div className="pt-4 flex items-center gap-2 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={isAdding}
                    className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {isAdding ? "جاري الإضافة لقاعدة البيانات..." : "تأكيد وإضافة الموظف"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden text-right font-sans"
              dir="rtl"
            >
              <div className="p-6 border-b border-rose-50 flex items-center justify-between bg-rose-50/20">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="text-rose-600 animate-pulse" size={20} />
                  إلغاء صلاحيات وحذف موظف
                </h3>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-600 leading-relaxed">
                  هل أنت متأكد من رغبتك في إلغاء صلاحية الموظف <strong className="text-rose-600 font-extrabold">{deletingUser.name}</strong> (الرقم الوظيفي: <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg">{deletingUser.id}</span>) وحذفه نهائياً من قاعدة البيانات والمنصة؟
                </p>
                <div className="p-3.5 bg-amber-50/50 border border-amber-100 rounded-2xl text-xs text-amber-800 leading-relaxed">
                  ⚠️ <strong>تنبيه هام جداً:</strong> لن يتمكن هذا الموظف من تسجيل الدخول إلى المنصة بعد إتمام الحذف، وسيتم تعليق وصوله بشكل كامل ودائم من خوادم قاعدة البيانات فوراً.
                </div>
              </div>

              <div className="p-6 pt-4 flex items-center gap-2 border-t border-slate-100 bg-slate-50/50">
                <button
                  onClick={confirmDeleteUser}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-rose-500/10 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isDeleting ? "جاري الحذف والإلغاء..." : "نعم، إلغاء الصلاحية والحذف فوراً"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingUser(null)}
                  disabled={isDeleting}
                  className="px-5 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-all"
                >
                  تراجع وإلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
