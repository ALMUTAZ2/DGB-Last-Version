import { Letter, User, DashboardStats, Priority, Status } from "../types";
import { db, auth } from "./firebase";
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import axios from "axios";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function isPermissionError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes("permission") || msg.includes("insufficient");
  }
  return false;
}

const MOCK_USERS: User[] = [
  { id: 1, email: "manager@example.com", name: "المدير العام", role: "manager" },
  { id: 2, email: "staff@example.com", name: "موظف المتابعة", role: "staff" }
];

async function ensureFirestoreSeeded(): Promise<void> {
  try {
    const seededIds = ["1", "2", "3", "4"];
    for (const id of seededIds) {
      const docRef = doc(db, "letters", id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data && (data.entity_source === "أمانة منطقة الرياض" || data.entity_source === "هيئة تطوير بوابة الدرعية" || data.entity_source === "رئاسة بلدية الروضة" || data.entity_source === "وزارة الاستثمار")) {
          await deleteDoc(docRef);
          console.log("Deleted default template letter matching ID: " + id);
        }
      }
    }
    
    const localS = localStorage.getItem("mock_letters");
    if (localS) {
      const parsedS = JSON.parse(localS) as any[];
      const filteredS = parsedS.filter(l => l.id !== 1 && l.id !== 2 && l.id !== 3 && l.id !== 4);
      if (filteredS.length !== parsedS.length) {
        localStorage.setItem("mock_letters", JSON.stringify(filteredS));
      }
    }
  } catch (err) {
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.WRITE, "letters");
    }
    console.warn("Could not clean up template letters:", err);
  }

  try {
    const settingsSnap = await getDoc(doc(db, "settings", "global"));
    if (!settingsSnap.exists()) {
      const defaultSettings = {
        recipient_phone: "+966507668366",
        phone_number_id: "1148865668308769",
        access_token: "EAAOZASL5k18gBRiMDPF0ttY0PJXYxRl88FwPLdZBGuZAZBGeOLOMJmB6ZBlswxSiPOmxqxE4LhFXKAgsgHfcPLGOMgh9wdbBZAiuXde0OuC1kS9SQ7e6fyLTc8Uc8bp6ZC5UYyAFBEP2LdziTSZBsMa9HYZA8ZBfO80VMiYssz1fRtaWXYzNeQMZCgLIYCTShh7zwZDZD",
        cron_time: "12:15",
        fixed_time: "12:19",
        contributor_recipient_phone: "+966566889475",
        contributor_phone_number_id: "1148865668308769",
        contributor_access_token: "EAAOZASL5k18gBRiMDPF0ttY0PJXYxRl88FwPLdZBGuZAZBGeOLOMJmB6ZBlswxSiPOmxqxE4LhFXKAgsgHfcPLGOMgh9wdbBZAiuXde0OuC1kS9SQ7e6fyLTc8Uc8bp6ZC5UYyAFBEP2LdziTSZBsMa9HYZA8ZBfO80VMiYssz1fRtaWXYzNeQMZCgLIYCTShh7zwZDZD",
        contributor_cron_time: "12:20",
        contributor_fixed_time: "12:25"
      };
      await setDoc(doc(db, "settings", "global"), defaultSettings);
    }
  } catch (err) {
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.WRITE, "settings/global");
    }
    console.warn("Could not seed settings:", err);
  }
}

async function getFirestoreLetters(): Promise<Letter[]> {
  await ensureFirestoreSeeded();
  try {
    const snapshot = await getDocs(collection(db, "letters"));
    const letters: Letter[] = [];
    snapshot.forEach((d) => { letters.push(d.data() as Letter); });
    return letters.sort((a,b) => b.id - a.id);
  } catch (err) {
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.GET, "letters");
    }
    const lettersStr = localStorage.getItem("mock_letters") || "[]";
    return JSON.parse(lettersStr);
  }
}

async function saveFirestoreLetter(letter: Letter): Promise<void> {
  try {
    await setDoc(doc(db, "letters", String(letter.id)), letter);
  } catch (err) {
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.WRITE, "letters/" + letter.id);
    }
    const fallbackLetters = localStorage.getItem("mock_letters") ? JSON.parse(localStorage.getItem("mock_letters")!) : [];
    const filtered = (fallbackLetters as Letter[]).filter(l => l.id !== letter.id);
    filtered.push(letter);
    localStorage.setItem("mock_letters", JSON.stringify(filtered));
  }
}

async function deleteFirestoreLetter(id: number): Promise<void> {
  try {
    await deleteDoc(doc(db, "letters", String(id)));
  } catch (err) {
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.DELETE, "letters/" + id);
    }
    const fallbackLetters = localStorage.getItem("mock_letters") ? JSON.parse(localStorage.getItem("mock_letters")!) : [];
    const filtered = (fallbackLetters as Letter[]).filter(l => l.id !== id);
    localStorage.setItem("mock_letters", JSON.stringify(filtered));
  }
}

async function getFirestoreConfig(): Promise<any> {
  await ensureFirestoreSeeded();
  try {
    const snap = await getDoc(doc(db, "settings", "global"));
    if (snap.exists()) {
      const data = snap.data() || {};
      const normalized: any = { ...data };
      const managerKeys = ["recipient_phone", "phone_number_id", "access_token", "cron_time", "fixed_time"];
      for (const k of managerKeys) {
        const val = data[k] !== undefined ? data[k] : data["whatsapp_" + k];
        if (val !== undefined) {
          normalized[k] = val;
          normalized["whatsapp_" + k] = val;
        }
      }
      return normalized;
    }
  } catch (err) {
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.GET, "settings/global");
    }
  }
  const configStr = localStorage.getItem("mock_config") || "{}";
  return JSON.parse(configStr);
}

async function saveFirestoreConfig(config: any): Promise<void> {
  try {
    await setDoc(doc(db, "settings", "global"), config, { merge: true });
  } catch (err) {
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.WRITE, "settings/global");
    }
  }
  localStorage.setItem("mock_config", JSON.stringify(config));
}

async function getFirestoreLogs(): Promise<any[]> {
  try {
    const snap = await getDocs(collection(db, "whatsapp_logs"));
    const logs: any[] = [];
    snap.forEach((d) => { logs.push({ id: d.id, ...d.data() }); });
    return logs.sort((a,b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()).slice(0, 50);
  } catch (err) {
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.GET, "whatsapp_logs");
    }
    const logsStr = localStorage.getItem("mock_whatsapp_logs") || "[]";
    return JSON.parse(logsStr);
  }
}

async function addFirestoreLog(logItem: any): Promise<void> {
  const logObj = { sent_at: new Date().toISOString(), ...logItem };
  try {
    await setDoc(doc(db, "whatsapp_logs", String(Date.now())), logObj);
  } catch (err) {
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.WRITE, "whatsapp_logs");
    }
  }
  const currentLogs = localStorage.getItem("mock_whatsapp_logs") ? JSON.parse(localStorage.getItem("mock_whatsapp_logs")!) : [];
  currentLogs.unshift(logObj);
  localStorage.setItem("mock_whatsapp_logs", JSON.stringify(currentLogs.slice(0, 50)));
}

export async function handleMockRequest(url: string, init?: RequestInit): Promise<Response> {
  const urlObj = new URL(url, window.location.origin);
  const cleanUrl = urlObj.pathname;
  const method = init?.method?.toUpperCase() || "GET";
  
  const jsonResponse = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  };

  if (cleanUrl === "/api/auth/me") {
    const emailHeader = init?.headers ? (init.headers as Record<string, string>)["x-user-email"] : undefined;
    let selectedEmail = emailHeader || localStorage.getItem("mock_current_email") || "manager@example.com";
    localStorage.setItem("mock_current_email", selectedEmail);
    const found = MOCK_USERS.find(u => u.email === selectedEmail) || MOCK_USERS[0];
    return jsonResponse(found);
  }

  if (cleanUrl === "/api/stats") {
    const letters = await getFirestoreLetters();
    const todayStr = new Date().toISOString().split("T")[0];
    const openLetters = letters.filter(l => l.status !== "مغلق");
    const totalOpen = openLetters.length;
    
    return jsonResponse({
      totalOpen,
      overdue: openLetters.filter(l => l.due_date < todayStr).length,
      dueToday: openLetters.filter(l => l.due_date === todayStr).length,
      recentLetters: [...letters].slice(0, 5),
      openLetters: [...openLetters],
      overdueLetters: openLetters.filter(l => l.due_date < todayStr),
      dueTodayLetters: openLetters.filter(l => l.due_date === todayStr),
      priorityCounts: []
    });
  }

  if (cleanUrl === "/api/letters") {
    const letters = await getFirestoreLetters();
    if (method === "GET") return jsonResponse(letters);
    if (method === "POST" && init?.body) {
      const body = JSON.parse(init.body as string);
      const newLetter = { id: Date.now(), ...body, created_at: new Date().toISOString() };
      await saveFirestoreLetter(newLetter);
      return jsonResponse({ id: newLetter.id }, 201);
    }
  }

  if (cleanUrl.startsWith("/api/letters/")) {
    const parts = cleanUrl.split("/");
    const idStr = parts[parts.length - 1];
    const id = parseInt(idStr, 10);

    if (method === "GET") {
      const letters = await getFirestoreLetters();
      const letter = letters.find(l => l.id === id);
      if (letter) {
        return jsonResponse(letter);
      } else {
        return jsonResponse({ error: "Letter not found" }, 404);
      }
    }

    if (method === "PUT" && init?.body) {
      const body = JSON.parse(init.body as string);
      const updatedLetter = { ...body, id: id || body.id };
      await saveFirestoreLetter(updatedLetter);
      return jsonResponse({ success: true });
    }

    if (method === "DELETE") {
      await deleteFirestoreLetter(id);
      return jsonResponse({ success: true });
    }
  }

  if (cleanUrl === "/api/whatsapp-config") {
    if (method === "GET") {
      const config = await getFirestoreConfig();
      const logs = await getFirestoreLogs();
      return jsonResponse({ ...config, logs });
    }
    if (method === "POST" && init?.body) {
      await saveFirestoreConfig(JSON.parse(init.body as string));
      return jsonResponse({ success: true });
    }
  }

  if (cleanUrl === "/api/send-whatsapp-test") {
    if (method === "POST" && init?.body) {
      const body = JSON.parse(init.body as string);
      const config = await getFirestoreConfig();
      const role = body.role || "manager";
      const recipient = body.to_phone || (role === "manager" ? config.recipient_phone : config.contributor_recipient_phone);
      
      const letters = await getFirestoreLetters();
      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });

      const getDaysDifference = (oldDateStr: string, newDateStr: string): number => {
        try {
          const d1 = new Date(oldDateStr + "T00:00:00");
          const d2 = new Date(newDateStr + "T00:00:00");
          return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        } catch (e) { return 0; }
      };

      const formatArabicDays = (days: number): string => {
        if (days === 0) return "أقل من يوم";
        if (days === 1) return "يوم واحد";
        if (days === 2) return "يومان";
        if (days >= 3 && days <= 10) return days + " أيام";
        return days + " يوم";
      };

      let filteredLetters = letters.filter(l => 
        l.status !== 'مغلق' && (l.due_date < todayStr || l.priority === 'عالية')
      ).sort((a,b) => b.id - a.id);

      const totalCount = filteredLetters.length;
      let success = true;
      let logStatus = "نجاح";
      let error_message = "";

      if (config.access_token && config.phone_number_id) {
        try {
          let formattedPhone = recipient.trim().replace(/\D/g, "");
          if (formattedPhone.startsWith("00")) formattedPhone = formattedPhone.substring(2);
          
          const metaUrl = `https://graph.facebook.com/v18.0/${config.phone_number_id}/messages`;

          // 🌟 مصفوفة الـ 21 متغيراً المحدثة لتتطابق بالملي مع كود السيرفر وتمنع خطأ 132000
          let templateParams: string[] = Array(21).fill("‎");
          templateParams[0] = String(totalCount);

          const CHUNK_SIZE = 4;
          for (let i = 0; i < CHUNK_SIZE; i++) {
            if (filteredLetters[i]) {
              const item = filteredLetters[i];
              const topic = (item.category || "بلا موضوع").trim();
              const source = (item.entity_source || "غير محدد").trim();
              const dept = (item.responsible_department || "غير محدد").trim();
              const waitingDays = getDaysDifference(item.letter_date || todayStr, todayStr);

              const baseIndex = 1 + (i * 5);
              templateParams[baseIndex]     = String(item.letter_number).trim();
              templateParams[baseIndex + 1] = String(source).trim();
              templateParams[baseIndex + 2] = String(topic).trim();
              templateParams[baseIndex + 3] = String(dept).trim();
              templateParams[baseIndex + 4] = formatArabicDays(waitingDays);
            } else {
              break;
            }
          }

          const parametersArray = templateParams.map(text => ({ type: "text", text: text }));

          const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,
            type: "template",
            template: {
              name: role === "manager" ? "daily_letters_report" : "daily_letters_report_contributor",
              language: { code: "ar" },
              components: [{ type: "body", parameters: parametersArray }]
            }
          };

          const headers = { "Authorization": "Bearer " + config.access_token, "Content-Type": "application/json" };
          await axios.post(metaUrl, payload, { headers });
        } catch (xhrError: any) {
          success = false;
          logStatus = "فشل";
          error_message = xhrError.response?.data ? JSON.stringify(xhrError.response.data) : xhrError.message;
        }
      }

      await addFirestoreLog({
        recipient_phone: recipient,
        message_content: `تم إرسال حزمة التقرير (21 متغير) بنجاح لعدد ${totalCount} خطابات.`,
        status: logStatus,
        error_message: error_message || null
      });
      
      return jsonResponse({ success, message_content: "تم الإرسال بنجاح" });
    }
  }

  return jsonResponse({ error: "Endpoint not found" }, 404);
}

export function setupFetchInterceptor() {
  const originalFetch = window.fetch || globalThis.fetch;
  const customFetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith("/api/")) {
      if (url.includes("/api/send-whatsapp-test") || url.includes("/api/meetings")) return originalFetch(input, init);
      return handleMockRequest(url, init);
    }
    return originalFetch(input, init);
  };

  try {
    Object.defineProperty(window, "fetch", {
      value: customFetch,
      configurable: true,
      writable: true
    });
  } catch (e) {
    try {
      Object.defineProperty(globalThis, "fetch", {
        value: customFetch,
        configurable: true,
        writable: true
      });
    } catch (e2) {
      try {
        (window as any).fetch = customFetch;
      } catch (e3) {
        try {
          (globalThis as any).fetch = customFetch;
        } catch (e4) {
          console.warn("Could not intercept fetch globally:", e4);
        }
      }
    }
  }
}