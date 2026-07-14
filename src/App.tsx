import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import LetterList from "./components/LetterList";
import Meetings from "./components/Meetings";
import GovernanceSummarizer from "./components/meetings/governance/GovernanceSummarizer";
import Reports from "./components/Reports";
import WhatsAppSettings from "./components/WhatsAppSettings";
import { User } from "./types";
import { getUserInitials } from "./lib/utils";
import { 
  UserCircle, 
  Bell, 
  Search, 
  Menu, 
  X, 
  LogOut, 
  Key, 
  Fingerprint, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [user, setUser] = useState<User | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Login states
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [employeeIdInput, setEmployeeIdInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginSuccessName, setLoginSuccessName] = useState("");

  useEffect(() => {
    const empId = localStorage.getItem("loggedInEmployeeId");
    const headers: Record<string, string> = {};
    if (empId) {
      headers["x-user-employee-id"] = empId;
    }

    fetch("/api/auth/me", { headers })
      .then((res) => res.json())
      .then((data) => {
        setUser(data);
        if (empId && data && data.id) {
          setIsLoggedIn(true);
        } else {
          setIsLoggedIn(false);
        }
      })
      .catch((err) => {
        console.error("Auth me error:", err);
        setIsLoggedIn(false);
      });

    // Pre-fetch WhatsApp and API keys config to cache them in localStorage
    fetch("/api/whatsapp-config")
      .then((res) => res.json())
      .then((data) => {
        if (data.groq_api_key) {
          localStorage.setItem("GROQ_API_KEY", data.groq_api_key);
        }
        if (data.gemini_api_key) {
          localStorage.setItem("GEMINI_API_KEY", data.gemini_api_key);
        }
      })
      .catch((err) => console.log("Error caching config:", err));

    // Active polling block for Cloud Run scheduler ticks
    const interval = setInterval(() => {
      fetch("/api/scheduler-tick", { method: "POST" })
        .then((res) => res.json())
        .catch((e) => console.log("Tick ping error", e));
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!employeeIdInput) {
      setLoginError("الرجاء إدخال الرقم الوظيفي أولاً");
      return;
    }
    setLoginError("");
    setIsLoggingIn(true);

    fetch("/api/auth/login-by-id", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ employeeId: employeeIdInput })
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((err) => {
            throw new Error(err.error || "فشل تسجيل الدخول");
          });
        }
        return res.json();
      })
      .then((data) => {
        localStorage.setItem("loggedInEmployeeId", String(data.user.id));
        setLoginSuccessName(data.user.name);
        
        // Beautiful success animation transition
        setTimeout(() => {
          setUser(data.user);
          setIsLoggedIn(true);
          setLoginSuccessName("");
          setIsLoggingIn(false);
          setEmployeeIdInput("");
        }, 1800);
      })
      .catch((err) => {
        setLoginError(err.message || "الرقم الوظيفي غير مسجل في المنصة أو حدث خطأ");
        setIsLoggingIn(false);
      });
  };

  const handleLogout = () => {
    localStorage.removeItem("loggedInEmployeeId");
    setIsLoggedIn(false);
    setUser(null);
    
    // Fetch default guest/manager profile to keep underlying render functional
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setUser(data));
  };

  const switchRole = () => {
    if (!user) return;
    const newRole = user.role === "manager" ? "staff" : "manager";
    
    // Update local state first
    setUser({ ...user, role: newRole });
    
    // Persist in backend
    if (user.id) {
      fetch("/api/auth/update-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ employeeId: user.id, role: newRole })
      }).catch(err => console.error("Error updating role:", err));
    } else {
      const newEmail = newRole === "manager" ? "manager@example.com" : "staff@example.com";
      fetch("/api/auth/me", {
        headers: { "x-user-email": newEmail }
      })
        .then((res) => res.json())
        .then((data) => setUser(data));
    }
  };

  if (!user) return <div className="h-screen flex items-center justify-center font-bold text-slate-400">جاري التحميل...</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
      
      {/* Frosted Glass Overlay Welcome Modal */}
      <AnimatePresence>
        {!isLoggedIn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xl overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: -20, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 180 }}
              className="relative max-w-md w-full bg-slate-900/90 border border-slate-800/85 rounded-3xl p-8 shadow-[0_0_50px_rgba(16,185,129,0.15)] text-center text-white overflow-hidden"
              dir="rtl"
            >
              {/* Decorative backgrounds */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
              
              {/* Saudi Vision 2030 Badge */}
              <div className="mx-auto mb-6 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold tracking-wider uppercase">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span>
                منصة الحكومة الرقمية
              </div>

              {loginSuccessName ? (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="py-8 flex flex-col items-center gap-4"
                >
                  <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-bounce">
                    <CheckCircle2 size={44} />
                  </div>
                  <h3 className="text-xl font-bold text-white mt-4">تم التحقق والدخول بنجاح!</h3>
                  <p className="text-lg text-emerald-300 font-semibold">أهلاً بك، {loginSuccessName}</p>
                  <p className="text-xs text-slate-400 mt-1 animate-pulse">جاري فتح لوحة التحكم الموحدة...</p>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center">
                  {/* Platform Branding Logo Icon */}
                  <div className="w-16 h-16 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-900/30 mb-4 border border-emerald-400/20">
                    <Fingerprint size={32} className="animate-pulse" />
                  </div>

                  <h2 className="text-2xl font-black text-white tracking-tight mb-2">منصة الحوكمة الرقمية</h2>
                  <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-6">
                   بوابة متكاملة لإدارة الاجتماعات، ومتابعة المعاملات، وقياس مؤشرات الأداء، وتعزيز مبادرات التحول الرقمي بكفاءة عالية.
                  </p>

                  <form onSubmit={handleLogin} className="w-full text-right">
                    <label className="block text-xs font-bold text-slate-300 mb-2 mr-1">
                      الرقم الوظيفي الخاص بك
                    </label>
                    <div className="relative mb-4">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={employeeIdInput}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, ""); // Allow numbers only
                          setEmployeeIdInput(val);
                          setLoginError("");
                        }}
                        placeholder="e.g., 100889"
                        className="w-full px-5 py-4 bg-slate-800/80 border border-slate-700 text-center text-lg font-mono font-bold rounded-2xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all placeholder:text-slate-500 tracking-widest text-slate-100"
                        disabled={isLoggingIn}
                      />
                    </div>

                    {loginError && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl mb-4 text-right animate-shake"
                      >
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <span>{loginError}</span>
                      </motion.div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoggingIn || !employeeIdInput}
                      className={`w-full py-4 rounded-2xl font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                        isLoggingIn || !employeeIdInput
                          ? "bg-slate-800 text-slate-500 cursor-not-allowed shadow-none border border-slate-700/30"
                          : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] shadow-emerald-950/40 hover:shadow-xl hover:shadow-emerald-500/10"
                      }`}
                    >
                      {isLoggingIn ? "جاري التحقق والدخول..." : "تسجيل الدخول"}
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={user} 
      />

      <main className="mr-64 p-8 transition-all duration-300">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4 text-right" dir="rtl">
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center font-bold text-emerald-600 text-sm select-none">
              {getUserInitials(user.name)}
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">أهلاً بك، {user.name}</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {user.id === 76657 || String(user.id) === "76657"
                  ? "لديك صلاحية مدير العام"
                  : `لديك صلاحيات ${user.role === "manager" ? "المدير" : "الموظف"}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={switchRole}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
            >
              تبديل الصلاحية (للتجربة)
            </button>
            
            {isLoggedIn && (
              <button 
                onClick={handleLogout}
                className="px-4 py-2 bg-rose-50 border border-rose-100 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-100/70 transition-all flex items-center gap-1.5 shadow-sm"
                title="تسجيل الخروج"
              >
                <LogOut size={14} />
                <span>تسجيل الخروج</span>
              </button>
            )}

            <button className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100 text-slate-400 hover:text-emerald-600 transition-all relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "dashboard" && <Dashboard />}
            {activeTab === "letters" && <LetterList userRole={user.role} />}
            {activeTab === "meetings" && <Meetings />}
            {activeTab === "meeting_summary" && <GovernanceSummarizer />}
            {activeTab === "reports" && user.role === "manager" && <Reports />}
            {activeTab === "whatsapp" && <WhatsAppSettings />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
