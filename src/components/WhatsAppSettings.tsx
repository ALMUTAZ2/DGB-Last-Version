import { useEffect, useState } from "react";
import { Send, CheckCircle, AlertTriangle, Key, Phone, Clock, FileText, Eye, EyeOff } from "lucide-react";
import { motion } from "motion/react";

interface WhatsAppLog {
  id: number;
  recipient_phone: string;
  message_content: string;
  status: string;
  error_message?: string;
  sent_at: string;
}

export default function WhatsAppSettings() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handleVerifyPassword = () => {
    if (passwordInput === "100889*") {
      setIsUnlocked(true);
      setPasswordError("");
    } else {
      setPasswordError("كلمة السر خاطئة، ليس لديك صلاحيات التعديل");
    }
  };

  const [activeRoleTab, setActiveRoleTab] = useState<"manager" | "contributor" | "meeting" | "meeting_1h">("manager");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [cronTime, setCronTime] = useState("12:15");
  const [fixedTime, setFixedTime] = useState("12:19");

  const [contributorRecipientPhone, setContributorRecipientPhone] = useState("");
  const [contributorPhoneNumberId, setContributorPhoneNumberId] = useState("");
  const [contributorAccessToken, setContributorAccessToken] = useState("");
  const [contributorCronTime, setContributorCronTime] = useState("12:20");
  const [contributorFixedTime, setContributorFixedTime] = useState("12:25");

  const [meetingRecipientPhone, setMeetingRecipientPhone] = useState("");
  const [meetingPhoneNumberId, setMeetingPhoneNumberId] = useState("");
  const [meetingAccessToken, setMeetingAccessToken] = useState("");
  const [meetingFixedTime, setMeetingFixedTime] = useState("21:00");

  const [showToken, setShowToken] = useState(false);
  const [showContributorToken, setShowContributorToken] = useState(false);
  const [showMeetingToken, setShowMeetingToken] = useState(false);

  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testLog, setTestLog] = useState<{ success: boolean; data?: any; error?: any; content?: string } | null>(null);

  const fetchConfig = () => {
    fetch("/api/whatsapp-config")
      .then((res) => res.json())
      .then((data) => {
        const phoneId = data.phone_number_id || "";
        const token = data.access_token || "";
        const cTime = data.cron_time || "12:15";
        const fTime = data.fixed_time || "12:19";

        setRecipientPhone(data.recipient_phone || "");
        setPhoneNumberId(phoneId);
        setAccessToken(token);
        setCronTime(cTime);
        setFixedTime(fTime);

        setContributorRecipientPhone(data.contributor_recipient_phone || "");
        setContributorPhoneNumberId(phoneId); // Force exact sync
        setContributorAccessToken(token);     // Force exact sync
        setContributorCronTime(data.contributor_cron_time || cTime);
        setContributorFixedTime(data.contributor_fixed_time || fTime);

        setMeetingRecipientPhone(data.meeting_recipient_phone || data.recipient_phone || "");
        setMeetingPhoneNumberId(data.meeting_phone_number_id || phoneId);
        setMeetingAccessToken(data.meeting_access_token || token);
        setMeetingFixedTime(data.meeting_fixed_time || "21:00");

        setLogs(data.logs || []);
        setLoading(false);
      })
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/whatsapp-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_phone: recipientPhone,
          phone_number_id: phoneNumberId,
          access_token: accessToken,
          cron_time: cronTime,
          fixed_time: fixedTime,
          contributor_recipient_phone: contributorRecipientPhone,
          contributor_phone_number_id: phoneNumberId, // Synced
          contributor_access_token: accessToken,       // Synced
          meeting_recipient_phone: meetingRecipientPhone,
          meeting_phone_number_id: meetingPhoneNumberId,
          meeting_access_token: meetingAccessToken,
          meeting_fixed_time: meetingFixedTime,
          base_url: window.location.origin,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        fetchConfig();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async (role: "manager" | "contributor" | "meeting" | "meeting_1h") => {
    setTesting(true);
    setTestLog(null);
    const targetPhone = role === "manager" ? recipientPhone : ((role === "meeting" || role === "meeting_1h") ? meetingRecipientPhone : contributorRecipientPhone);
    try {
      const res = await fetch("/api/send-whatsapp-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_phone: targetPhone, role }),
      });
      const result = await res.json();
      
      setTestLog({
        success: res.ok,
        data: result.data || null,
        error: result.error || null,
        content: result.message_content || ""
      });
      fetchConfig();
    } catch (err: any) {
      setTestLog({
        success: false,
        error: err.message
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20 font-sans">
      <span className="text-slate-500 font-medium">جاري المزامنة مع خوادم الربط...</span>
    </div>
  );

  if (!isUnlocked) {
    return (
      <div className="space-y-8 font-sans pb-12 flex flex-col items-center justify-center min-h-[70vh]" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6 mx-auto animate-pulse">
            <Key size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">ربط وتنبيهات WhatsApp</h3>
          <p className="text-xs text-slate-400 mb-8">الرجاء إدخال الرقم السري المكون من 6 رموز للوصول والتعديل</p>
          
          <div className="space-y-4">
            <input 
              type="password"
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setPasswordError("");
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleVerifyPassword();
              }}
              placeholder="أدخل الرقم السري هنا..."
              className="w-full text-center px-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 font-sans tracking-widest text-lg focus:outline-none"
              dir="ltr"
            />
            
            {passwordError && (
              <motion.p 
                initial={{ opacity: 0, y: -5 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="text-red-500 text-sm font-bold bg-red-50 py-2.5 px-4 rounded-xl border border-red-100"
              >
                {passwordError}
              </motion.p>
            )}

            <button 
              onClick={handleVerifyPassword}
              className="w-full bg-slate-900 text-white py-3 rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 mt-2"
            >
              تأكيد الرقم السري
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans pb-12" dir="rtl">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">ربط وتنبيهات WhatsApp</h2>
        <p className="text-sm text-slate-400 font-medium mt-1">مدير الربط التلقائي واليدوي مع WhatsApp Cloud API للتقارير الموحدة</p>
      </div>

      {/* شريط تبديل الصلاحية للمطوّر */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 max-w-2xl">
        <button
          type="button"
          onClick={() => {
            setActiveRoleTab("manager");
            setTestLog(null);
          }}
          className={`flex-1 py-3 rounded-xl text-center text-xs font-bold transition-all cursor-pointer ${
            activeRoleTab === "manager"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          💼 إعدادات المدير العام (الخطابات المصعدة والمتأخرة)
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveRoleTab("contributor");
            setTestLog(null);
          }}
          className={`flex-1 py-3 rounded-xl text-center text-xs font-bold transition-all cursor-pointer ${
            activeRoleTab === "contributor"
              ? "bg-white text-emerald-800 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          🤝 إعدادات المساهم (الخطابات غير المصعدة)
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveRoleTab("meeting");
            setTestLog(null);
          }}
          className={`flex-1 py-3 rounded-xl text-center text-xs font-bold transition-all cursor-pointer ${
            activeRoleTab === "meeting"
              ? "bg-white text-blue-800 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          📅 إعدادات الاجتماعات (رسائل الغد)
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveRoleTab("meeting_1h");
            setTestLog(null);
          }}
          className={`flex-1 py-3 rounded-xl text-center text-xs font-bold transition-all cursor-pointer ${
            activeRoleTab === "meeting_1h"
              ? "bg-white text-blue-800 shadow-sm"
              : "text-slate-500 hover:text-slate-900"
          }`}
        >
          📅 إعدادات الاجتماعات (قبل ساعة)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* نموذج الإعدادات والتحقق */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Phone size={20} className="text-emerald-600" />
              <span>
                معطيات منصة Meta Developer والربط الدائم -{" "}
                {activeRoleTab === "manager" ? "المدير العام" : (activeRoleTab === "meeting" ? "الاجتماعات" : "المساهم")}
              </span>
            </h3>

            {activeRoleTab === "manager" ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">رقم الهاتف المستلم المعتمد لـ Meta (التلقائي والتجريبي للمدير)</label>
                  <div className="relative">
                    <Phone size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="مثال: +966500000000"
                      className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">الرقم الافتراضي المعتمد والمبرمج للإرسال التلقائي للمدير هو <span className="font-bold text-slate-700 bg-slate-100 px-1 rounded font-mono text-xs">+966507668366</span></p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-xs font-bold text-slate-500">معرف رقم الهاتف المرسل (Phone Number ID)</label>
                    <input
                      type="text"
                      value={phoneNumberId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPhoneNumberId(val);
                        setContributorPhoneNumberId(val);
                      }}
                      placeholder="مثال: 1148865668308769"
                      className="w-full px-4 py-3 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                      <span>توقيت الإساب التلقائي الأساسي</span>
                      <span>📌</span>
                    </label>
                    <div className="flex items-center gap-2 relative">
                      <Clock size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-600" />
                      <input
                        type="time"
                        value={fixedTime}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFixedTime(val);
                          setContributorFixedTime(val);
                        }}
                        className="w-full pr-11 pl-4 py-3 bg-emerald-50/40 border border-emerald-100/60 rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono text-center font-bold text-emerald-950"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                      <span>توقيت التنبيه الاختياري الآخر</span>
                      <span>⚙️</span>
                    </label>
                    <div className="flex items-center gap-2 relative">
                      <Clock size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-450" />
                      <input
                        type="time"
                        value={cronTime}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCronTime(val);
                          setContributorCronTime(val);
                        }}
                        className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono text-center font-bold text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">الرمز الدائم المعتمد للمدير (Access Token)</label>
                  <div className="relative">
                    <Key size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showToken ? "text" : "password"}
                      value={accessToken}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAccessToken(val);
                        setContributorAccessToken(val);
                      }}
                      placeholder="EAAOZASL5..."
                      className="w-full pr-11 pl-12 py-3 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            ) : activeRoleTab === "contributor" ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">رقم الهاتف المستلم المعتمد لـ Meta (التلقائي والتجريبي للمساهم)</label>
                  <div className="relative">
                    <Phone size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={contributorRecipientPhone}
                      onChange={(e) => setContributorRecipientPhone(e.target.value)}
                      placeholder="مثال: +966566889475"
                      className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono font-bold text-slate-800"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">الرقم المعتمد للمساهم الذي توصل له إشعارات الخطابات غير المصعدة هو <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono text-xs">+966566889475</span></p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5 md:col-span-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-500">معرف رقم الهاتف المرسل للمساهم (Phone Number ID)</label>
                      <span className="text-[10px] bg-emerald-50 text-emerald-800 px-1 py-0.5 rounded font-bold">🔄 متزامن</span>
                    </div>
                    <input
                      type="text"
                      value={contributorPhoneNumberId}
                      readOnly
                      placeholder="مثال: 1148865668308769"
                      className="w-full px-4 py-3 bg-slate-100 border border-transparent rounded-2xl text-slate-500 font-mono text-xs cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                        <span>توقيت الإرسال التلقائي الأساسي</span>
                        <span>📌</span>
                      </label>
                      <span className="text-[10px] bg-emerald-50 text-emerald-800 px-1 py-0.5 rounded font-bold">⏱️ + دقيقتين</span>
                    </div>
                    <div className="flex items-center gap-2 relative">
                      <Clock size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="time"
                        value={contributorFixedTime}
                        readOnly
                        className="w-full pr-11 pl-4 py-3 bg-slate-100 border border-transparent rounded-2xl text-slate-500 font-mono text-center font-bold cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 md:col-span-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
                        <span>توقيت التنبيه الاختياري الآخر</span>
                        <span>⚙️</span>
                      </label>
                      <span className="text-[10px] bg-emerald-50 text-emerald-800 px-1 py-0.5 rounded font-bold">⏱️ + دقيقتين</span>
                    </div>
                    <div className="flex items-center gap-2 relative">
                      <Clock size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="time"
                        value={contributorCronTime}
                        readOnly
                        className="w-full pr-11 pl-4 py-3 bg-slate-100 border border-transparent rounded-2xl text-slate-500 font-mono text-center font-bold cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-500">الرمز الدائم المعتمد للمساهم (Access Token)</label>
                    <span className="text-[10px] bg-emerald-50 text-emerald-800 px-1 py-0.5 rounded font-bold">🔄 متزامن</span>
                  </div>
                  <div className="relative">
                    <Key size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showContributorToken ? "text" : "password"}
                      value={contributorAccessToken}
                      readOnly
                      placeholder="EAAOZASL5..."
                      className="w-full pr-11 pl-12 py-3 bg-slate-100 border border-transparent rounded-2xl text-slate-500 font-mono text-xs cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => setShowContributorToken(!showContributorToken)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showContributorToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            ) : (activeRoleTab === "meeting" || activeRoleTab === "meeting_1h") ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">رقم الهاتف المستلم لتنبيهات الاجتماعات</label>
                  <div className="relative">
                    <Phone size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={meetingRecipientPhone}
                      onChange={(e) => setMeetingRecipientPhone(e.target.value)}
                      placeholder="مثال: +966500000000"
                      className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-mono font-bold text-slate-800"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">هذا هو الرقم الذي ستصله تنبيهات الاجتماعات (رسائل الغد وقبل ساعة)</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-xs font-bold text-slate-500">معرف رقم الهاتف (Phone Number ID)</label>
                    <input
                      type="text"
                      value={meetingPhoneNumberId}
                      onChange={(e) => setMeetingPhoneNumberId(e.target.value)}
                      placeholder="اتركه فارغاً لاستخدام رقم المدير"
                      className="w-full px-4 py-3 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all font-mono text-xs"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-xs font-bold text-slate-500">الرمز الدائم المعتمد للاجتماعات (Access Token)</label>
                    <div className="relative">
                      <Key size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showMeetingToken ? "text" : "password"}
                        value={meetingAccessToken}
                        onChange={(e) => setMeetingAccessToken(e.target.value)}
                        placeholder="اتركه فارغاً لاستخدام رمز المدير"
                        className="w-full pr-11 pl-12 py-3 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowMeetingToken(!showMeetingToken)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showMeetingToken ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {activeRoleTab === "meeting" && (
                    <div className="space-y-1.5 md:col-span-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                          <span>توقيت الإرسال لاجتماعات الغد</span>
                          <span>📌</span>
                        </label>
                      </div>
                      <div className="flex items-center gap-2 relative">
                        <Clock size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="time"
                          value={meetingFixedTime}
                          onChange={(e) => setMeetingFixedTime(e.target.value)}
                          className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-emerald-500 font-mono text-center font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between border-t border-slate-100 pb-2 pt-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{saving ? "جاري الحفظ..." : "حفظ الإعدادات"}</span>
                </button>
                {saved && (
                  <span className="text-emerald-600 text-xs font-bold animate-pulse">تم الحفظ بنجاح</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleTestSend(activeRoleTab)}
                disabled={
                  testing ||
                  (activeRoleTab === "manager" ? !recipientPhone : (activeRoleTab === "meeting" ? !meetingRecipientPhone : !contributorRecipientPhone))
                }
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/10"
              >
                <Send size={14} />
                <span>
                  {testing ? "جاري الإرسال للتجربة..." : `إرسال تجريبي ${activeRoleTab === "manager" ? "المدير" : (activeRoleTab === "meeting" ? "الاجتماعات" : "المساهم")} فوراً`}
                </span>
              </button>
            </div>
          </div>

          {/* لوحة نتائج الفحص */}
          {testLog && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-6 rounded-3xl border shadow-sm space-y-4 ${
                testLog.success
                  ? "bg-emerald-50/50 border-emerald-100"
                  : "bg-rose-50/50 border-rose-100"
              }`}
            >
              <div className="flex items-center gap-3">
                {testLog.success ? (
                  <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
                    <CheckCircle size={18} />
                  </div>
                ) : (
                  <div className="p-1.5 bg-rose-100 text-rose-800 rounded-lg">
                    <AlertTriangle size={18} />
                  </div>
                )}
                <div>
                  <h4 className={`text-sm font-bold ${testLog.success ? "text-emerald-900" : "text-rose-900"}`}>
                    {testLog.success ? "نجحت عملية الإرسال" : "فشلت عملية الإرسال"}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">تفريغ خوادم فحص الـ WhatsApp API في الوقت الفعلي</p>
                </div>
              </div>

              {!testLog.success && testLog.error && (
                <div className="space-y-4">
                  <div className="bg-white/80 border border-rose-200/50 p-4 rounded-2xl text-xs font-mono text-rose-700 space-y-1.5 overflow-x-auto text-left" dir="ltr">
                    <div className="font-bold border-b border-rose-100 pb-1 flex justify-between">
                      <span>Axios Meta API Traceback:</span>
                      <span className="text-[10px] bg-rose-100 px-1.5 py-0.5 rounded text-rose-800 uppercase">Error Details</span>
                    </div>
                    <div>{JSON.stringify(testLog.error, null, 2)}</div>
                  </div>

                  {/* دليل حل مشكلة الـ Sandbox وتفادي رمز 131030 */}
                  {((testLog.error?.error?.code === 131030) || JSON.stringify(testLog.error).includes("131030") || JSON.stringify(testLog.error).includes("allowed list")) && (
                    <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl text-slate-800 space-y-3 font-sans" dir="rtl">
                      <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                        <AlertTriangle size={18} />
                        <span>💡 سبب المشكلة وحلها الفوري (رقم المستلم غير مضاف للقائمة):</span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-600">
                        أنت تستخدم معرف هاتف تجريبي (واتساب التجريبي للمطورين). في هذا الوضع، تمنع شركة Meta إرسال الرسائل لأي رقم بشكل تلقائي إلا بعد تسجيله بنجاح وتفعيله كـ <strong>"مستلم مصرح به"</strong> داخل حساب المطورين الخاص بك.
                      </p>
                      
                      <div className="text-xs space-y-2 text-slate-700 bg-white/75 p-3.5 rounded-xl border border-amber-100 leading-relaxed">
                        <span className="font-bold text-slate-900 text-[13px] block mb-1">خطوات حل المشكلة في دقيقة واحدة:</span>
                        <p><strong>1.</strong> اذهب إلى موقع <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">Meta Developers Portal</a> وافتح لوحة تحكم تطبيقك.</p>
                        <p><strong>2.</strong> من القائمة الجانبية اليسرى، اختر <strong>WhatsApp</strong> ثم <strong>API Setup</strong> (أو بدء العمل).</p>
                        <p><strong>3.</strong> انزل إلى أسفل الصفحة حتى تجد خطوة رقم 5 أو حقل <strong>To (إلى)</strong> الخاص بالهاتف المستلم.</p>
                        <p><strong>4.</strong> اضغط على قائمة الأرقام المنسدلة واختر <strong>Manage phone number list</strong> ثم أضف رقم الهواتف المعتمد للتجربة: <span className="font-mono bg-amber-100 px-1.5 py-0.5 rounded font-bold text-amber-900">{activeRoleTab === "manager" ? recipientPhone : contributorRecipientPhone}</span>.</p>
                        <p><strong>5.</strong> ستصلك رسالة تحكم برمز التحقق (OTP) على جوالك لتأكيد الملكية. بمجرد تأكيد الرمز، اضغط على زر <strong>"إرسال التقرير فوراً"</strong> مجدداً وستصلك الرسالة المنسقة فوراً وبنجاح تام!</p>
                      </div>
                    </div>
                  )}

                  {/* دليل حل مشكلة صلاحية الرمز أو انتهاء المدة رمز 131005 */}
                  {((testLog.error?.error?.code === 131005) || JSON.stringify(testLog.error).toLowerCase().includes("131005") || JSON.stringify(testLog.error).toLowerCase().includes("access denied") || JSON.stringify(testLog.error).toLowerCase().includes("oauthexception") || JSON.stringify(testLog.error).toLowerCase().includes("token")) && (
                    <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl text-slate-800 space-y-3 font-sans" dir="rtl">
                      <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                        <AlertTriangle size={18} />
                        <span>💡 سبب المشكلة وحلها الفوري (رمز الوصول غير صالح أو منتهي الصلاحية):</span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-600">
                        الـ <strong>Access Token (رمز الوصول الخاص بـ Meta)</strong> المستخدم حالياً منتهي الصلاحية (حيث ينتهي الرمز المؤقت تلقائياً بعد 24 ساعة)، أو لا يمتلك الصلاحيات المطلوبة لإجراء مكالمات الإرسال لمنتج الواتساب.
                      </p>
                      
                      <div className="text-xs space-y-2 text-slate-700 bg-white/75 p-3.5 rounded-xl border border-rose-100 leading-relaxed">
                        <span className="font-bold text-slate-900 text-[13px] block mb-1">خطوات توليد رمز وصول جديد وتفعيله في ثوانٍ:</span>
                        <p><strong>1.</strong> اذهب إلى موقع <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">بوابة مطوري فيسبوك Meta Developers</a> وسجل دخولك.</p>
                        <p><strong>2.</strong> افتح لوحة تحكم تطبيقك المربوط بالواتساب، واختر من الجانب الأيمن <strong>WhatsApp</strong> ثم اضغط على <strong>API Setup</strong>.</p>
                        <p><strong>3.</strong> تحت قسم <strong>"Temporary access token"</strong> في الأعلى، ستجد رمز الوصول الـ Token الجديد. قم بنسخه بالكامل.</p>
                        <p><strong>4.</strong> عُد إلى هذه الصفحة، وحدد تبويب التفعيل النشط، ثم الصق الرمز الجديد ليكون بدلاً من المنتهي في حقل <strong>"الرمز الدائم المعتمد (Access Token)"</strong> بالنموذج أعلاه.</p>
                        <p><strong>5.</strong> اضغط على زر <strong>"حفظ الإعدادات"</strong> لتثبيت التحديث الدائم بنجاح، ثم أعد الضغط على <strong>"إرسال التقرير فوراً"</strong> لتجربته بنجاح تام!</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {testLog.success && testLog.data && (
                <div className="bg-white/80 border border-emerald-200/50 p-4 rounded-2xl text-xs font-mono text-emerald-800 space-y-1.5 overflow-x-auto text-left" dir="ltr">
                  <div className="font-bold border-b border-emerald-100 pb-1">Meta API Server Response:</div>
                  <div>{JSON.stringify(testLog.data, null, 2)}</div>
                </div>
              )}

              {testLog.content && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-500 block">نص الرسالة التي تم إرسالها:</span>
                  <div className="bg-white border border-slate-100 p-4 rounded-2xl text-xs text-slate-700 whitespace-pre-wrap leading-relaxed shadow-sm">
                    {testLog.content}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* سجل الإرسال التاريخي */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">تاريخ الإرسال (Logs)</h3>
              <p className="text-xs text-slate-400 font-medium">سجل المراقبة اللحظية لرسائل التقرير الصادرة</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-500 bg-slate-50/50 rounded-xl">
                    <th className="py-3 px-3 rounded-r-xl">رقم المستلم</th>
                    <th className="py-3 px-3">محتوى الإرسال</th>
                    <th className="py-3 px-3 text-center">الحالة</th>
                    <th className="py-3 px-3 text-left rounded-l-xl">تاريخ الإرسال</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-xs">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">لا توجد سجلات حالية لإرسال التنبيهات</td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-3 font-mono font-bold text-slate-800">{log.recipient_phone}</td>
                        <td className="py-4 px-3 text-slate-600 max-w-sm truncate" title={log.message_content}>
                          {log.message_content}
                        </td>
                        <td className="py-4 px-3 text-center">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            log.status === "نجاح"
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-red-50 text-red-600"
                          }`} title={log.error_message}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-4 px-3 text-left font-mono text-slate-500 font-medium whitespace-nowrap" dir="ltr">
                          {(() => {
                            if (!log.sent_at) return "";
                            let dateObj: Date;
                            if (log.sent_at.includes("T") || log.sent_at.endsWith("Z")) {
                              dateObj = new Date(log.sent_at);
                            } else {
                              dateObj = new Date(log.sent_at + " Z");
                            }
                            return dateObj.toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" });
                          })()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* جانبياً: معاينة الرسالة والجدولة */}
        <div className="space-y-6">
          
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-white space-y-4">
              <h3 className="text-sm font-bold text-emerald-400 tracking-wider">مخطط وجدول الرسالة الموحد</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-normal">
              تظهر الرسالة بالشكل التالي:
            </p>

            <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-xs space-y-3 relative overflow-hidden" dir="rtl">
              <div className="absolute top-0 right-0 left-0 h-1.5 bg-emerald-500" />
              <p className="text-emerald-400/90 font-bold mb-1">
                معاينة قالب {activeRoleTab === "manager" ? "المدير" : (activeRoleTab === "meeting" ? "الاجتماعات" : "المساهم")}:
              </p>
              
              <p className="text-slate-100 font-bold leading-relaxed whitespace-pre-wrap">
                {activeRoleTab === "manager" ? (
`سعادة مدير الإدارة

نود إشعاركم بوجود خطابات *متأخرة وذات أولوية عالية و مصعدة* ⚠️
تستلزم المتابعة واتخاذ الإجراء اللازم:

📌 *رقم الخطاب:* 100245
🏢 *الجهة الوارد منها:* أمانة منطقة الرياض
📝 *الموضوع:* اعتماد خطة شبكة الجهد المتوسط بحي اليرموك
👥 *الجهة المسؤولة:* قسم تخطيط الجهد المتوسط
⏳ *مدة الانتظار:* 4 أيام
━━━━━━━━━━━━━━━━━━
📌 *رقم الخطاب:* 100289
🏢 *الجهة الوارد منها:* هيئة تطوير بوابة الدرعية
📝 *الموضوع:* طلب موافقة فنية لربط محطة تحويل فرعية
👥 *الجهة المسؤولة:* إدارة المخططات الفنية
⏳ *مدة الانتظار:* 3 أيام`
                ) : activeRoleTab === "meeting" ? (
`سعادة مدير الإدارة، نود تذكير وإحاطة سعادتكم بتفاصيل الإجراءات الرسمية المجدولة في المنظومة بعدد 2:
━━
📌 نوع الإجراء: إجتماع
📝 الموضوع: اجتماع مجلس الإدارة
📅 التاريخ: 2026-06-24
⏱️ الوقت: 10:00
📍 المكان: قاعة الرياض
📅 إضافة للتقويم: https://calendar...
━━
📌 نوع الإجراء: زيارة
📝 الموضوع: جولة تفقدية
📅 التاريخ: 2026-06-24
⏱️ الوقت: 12:00
📍 المكان: فرع الوزارة
📅 إضافة للتقويم: https://calendar...
━━
📌 نوع الإجراء: -
📝 الموضوع: -
📅 التاريخ: -
⏱️ الوقت: -
📍 المكان: -
📅 إضافة للتقويم: -
━━
📌 نوع الإجراء: -
📝 الموضوع: -
📅 التاريخ: -
⏱️ الوقت: -
📍 المكان: -
📅 إضافة للتقويم: -
━━
🤖 تم إرسال هذا الإشعار وتنسيقه آلياً عبر منظومة DGP.`
                ) : (
`سعادة المساهم

نود إشعاركم بتقرير خطابات المنصة *غير المصعّدة* 📌
تستلزم المراقبة المستمرة واتخاذ الإجراء اللازم:

📌 *رقم الخطاب:* 100311
🏢 *الجهة الوارد منها:* رئاسة بلدية الروضة
📝 *الموضوع:* شكوى من انقطاع الخدمة الكهربائية بإنارة الشوارع
👥 *الجهة المسؤولة:* دائرة التشغيل والصيانة – الشرق
⏳ *مدة الانتظار:* يومان
🟢 *حالة التصعيد:* غير مصعب`
                )}
              </p>
            </div>

            <div className="bg-slate-800/40 p-4 rounded-2xl text-[11px] text-slate-350 space-y-1.5">
              <span className="font-bold text-white block">ملاحظات التحقق والفلترة:</span>
              {activeRoleTab === "manager" ? (
                <>
                  <p>• يتم إرفاق الخطابات المتأخرة والخطابات عالية الأهمية المفتوحة حالياً فقط.</p>
                  <p>• إذا كان النظام شاغراً من الخطابات، يتم استخدام المثال الافتراضي المذكور أعلاه تلقائياً بغرض تشغيل التجربة المبدئية بنجاح.</p>
                </>
              ) : (
                <>
                  <p>• يتم إرفاق كافة الخطابات غير المصعدة (التي لم يُذكر لها أي تبرير أو خطط تصعيد في حقل التصعيد) والتي ما زالت مفتوحة.</p>
                  <p>• يستهدف هذا التقرير تتبع العمليات التشغيلية والخطابات الروتينية مباشرة بواسطة المساهم.</p>
                </>
              )}
            </div>
          </div>

          <div className="bg-emerald-50/30 border border-emerald-100/50 p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-900 font-extrabold text-sm">
              <Clock size={18} />
              <span>نظام الجدولة الذكية للـ WhatsApp (الرياض GMT+3)</span>
            </div>
            <div className="text-xs text-slate-600 leading-relaxed space-y-3 font-medium bg-transparent">
              <div className="bg-white/80 p-3 rounded-2xl border border-emerald-100/60 shadow-sm">
                <p className="font-bold text-emerald-800 mb-1">
                  📌 التقرير التلقائي لـ {activeRoleTab === "manager" ? "المدير العام" : (activeRoleTab === "meeting" ? "الاجتماعات" : "المساهم")}:
                </p>
                <p className="mr-3">• الإرسال يومياً (الأحد - الخميس) بتوقيت الرياض في تمام الساعة{" "}
                  <span className="font-mono font-bold bg-emerald-100/60 px-1.5 py-0.5 rounded text-emerald-800 text-[13px]">
                    {activeRoleTab === "manager" ? fixedTime : (activeRoleTab === "meeting" ? meetingFixedTime : contributorFixedTime)}
                  </span> بالضبط.</p>
                <p className="mr-3">• رقم المستلم المعتمد للتلقائي:{" "}
                  <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-1 rounded">
                    {activeRoleTab === "manager" ? "+966507668366" : (activeRoleTab === "meeting" ? "+966xxxxxxxx" : "+966566889475")}
                  </span>.</p>
              </div>

              {activeRoleTab !== "meeting" && (
                <div className="bg-white/40 p-3 rounded-2xl border border-emerald-100/30">
                  <p className="font-bold text-slate-700 mb-1">⚙️ التنبيه الاختياري اليدوي:</p>
                  <p className="mr-3">• موعد تشغيل التنبيه المخصص الآخر هو{" "}
                    <span className="font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">
                      {activeRoleTab === "manager" ? cronTime : contributorCronTime}
                    </span>.</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
