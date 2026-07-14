import express from "express";
import path from "path";
import cron from "node-cron";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Resend } from "resend";
import dotenv from "dotenv";
import axios from "axios";
import puppeteer from "puppeteer";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };
import { EMPLOYEES } from "./src/data/employees";

// Firebase Server SDK Setup
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDocs, getDoc, setDoc, deleteDoc, addDoc, writeBatch } from "firebase/firestore";

dotenv.config();

const firebaseApp = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
console.log("[Server] Firebase configuration loaded statically.");

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const TIMEZONE = "Asia/Riyadh";

async function ensureSeedAndSetup() {
  try {
    const usersSnap = await getDocs(collection(firestoreDb, "users"));
    
    // Create a set of existing user/employee IDs already stored in Firestore
    const existingIds = new Set<string>();
    usersSnap.forEach(d => {
      existingIds.add(String(d.id));
      const data = d.data();
      if (data && data.id) {
        existingIds.add(String(data.id));
      }
    });

    console.log(`[Server Init] Found ${existingIds.size} existing user entries in Firestore.`);

    // If empty, set the default special test users "1" and "2"
    if (usersSnap.empty) {
      console.log("[Server Init] Seeding special default users...");
      await setDoc(doc(firestoreDb, "users", "1"), { id: 1, email: "manager@example.com", name: "المدير العام", role: "manager", permission: "write" });
      await setDoc(doc(firestoreDb, "users", "2"), { id: 2, email: "staff@example.com", name: "موظف المتابعة", role: "staff", permission: "read" });
      existingIds.add("1");
      existingIds.add("2");
    }

    // Filter employees from src/data/employees.ts who aren't currently seeded in Firestore
    const missingEmployees = EMPLOYEES.filter(emp => !existingIds.has(String(emp.id)));

    if (missingEmployees.length > 0) {
      console.log(`[Server Init] Seeding ${missingEmployees.length} missing employees to Firestore...`);
      
      const chunkSize = 200;
      for (let i = 0; i < missingEmployees.length; i += chunkSize) {
        const chunk = missingEmployees.slice(i, i + chunkSize);
        const batch = writeBatch(firestoreDb);
        
        for (const emp of chunk) {
          const userDocRef = doc(firestoreDb, "users", String(emp.id));
          batch.set(userDocRef, {
            id: emp.id,
            name: emp.name,
            email: `${emp.id}@governance.gov.sa`,
            role: "staff",
            permission: emp.id === 100889 ? "write" : "read"
          });
        }
        
        await batch.commit();
        console.log(`[Server Init] Committed batch of ${chunk.length} employees.`);
      }
      console.log("[Server Init] Seeding of all employees completed successfully!");
    }
  } catch (err) {
    console.error("[Server Init] Users seeding failed:", err);
  }

  try {
    const settingsSnap = await getDoc(doc(firestoreDb, "settings", "global"));
    const newToken = "EAAOZASL5k18gBRiMDPF0ttY0PJXYxRl88FwPLdZBGuZAZBGeOLOMJmB6ZBlswxSiPOmxqxE4LhFXKAgsgHfcPLGOMgh9wdbBZAiuXde0OuC1kS9SQ7e6fyLTc8Uc8bp6ZC5UYyAFBEP2LdziTSZBsMa9HYZA8ZBfO80VMiYssz1fRtaWXYzNeQMZCgLIYCTShh7zwZDZD";
    const oldTokens = [
      "EAAOZASL5k18gBRgxcQrOPMZCLIqwZC9zdJdnRiSXiKcIs6EKhe2AiSwzrFrx9HkEb5APXZAVQ3DDOQqqcWxAlE8CzQZCuCZAiwlPWKyo2RfnpaeYvuqnmlZC4X3hT7nDOJ4IVGzitWmdIfBID3VXr3JAdSSjEdBZBfAAvBgOI9OygbmD78pGmmbaZAKiQCRgVtQZDZD",
      "EAAOZASL5k18gBRkPFCnEzJOs1yxklW16txxkX3dOtxz8lLGZC8wNRmMlZAoEbNlhpCIOGDt2cvh16TWdbRxyOSiA1FNPBonyyj3oGQCIimcIpNexQT0pVx0N0hsZBO3GtvaDAXDiTEtDeqVE4fJPu1EzPE5RwyxejsLrEmtK1dyDWli1s13Ecpp3Gd384XSbpQZDZD"
    ];

    if (!settingsSnap.exists()) {
      console.log("[Server Init] Seeding Firestore default configurations...");
      const initialSettings = {
        whatsapp_recipient_phone: "+966507668366",
        whatsapp_phone_number_id: "1148865668308769",
        whatsapp_access_token: newToken,
        whatsapp_cron_time: "12:15",
        whatsapp_fixed_time: "12:19",
        contributor_recipient_phone: "+966566889475",
        contributor_phone_number_id: "1148865668308769",
        contributor_access_token: newToken,
        contributor_cron_time: "12:20",
        contributor_fixed_time: "12:25"
      };
      await setDoc(doc(firestoreDb, "settings", "global"), initialSettings);
    } else {
      const currentData = settingsSnap.data() || {};
      const updates: any = {};
      let needsUpdate = false;

      // Migrate ONLY if the actual token stored matches one of the old/expired tokens
      const fieldsToCheck = [
        "whatsapp_access_token",
        "contributor_access_token",
        "access_token"
      ];

      for (const field of fieldsToCheck) {
        const val = currentData[field];
        if (val && oldTokens.includes(val.trim())) {
          updates[field] = newToken;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        console.log("[Server Init] Overwriting expired old token in Firestore settings...");
        await setDoc(doc(firestoreDb, "settings", "global"), updates, { merge: true });
      }
    }
  } catch (err) {
    console.error("[Server Init] Settings seeding failed:", err);
  }
}

async function getLettersFromFirestore(): Promise<any[]> {
  await ensureSeedAndSetup();
  try {
    const snapshot = await getDocs(collection(firestoreDb, "letters"));
    const list: any[] = [];
    snapshot.forEach((d) => {
      list.push(d.data());
    });
    return list;
  } catch (err) {
    console.error("Error reading from Firestore:", err);
    return [];
  }
}

async function getMeetingsFromFirestore(): Promise<any[]> {
  await ensureSeedAndSetup();
  try {
    const snapshot = await getDocs(collection(firestoreDb, "reports"));
    const list: any[] = [];
    snapshot.forEach((d) => {
      const data = d.data();
      if (data.type === 'meeting') {
        list.push(data);
      }
    });
    return list;
  } catch (err) {
    console.error("Error reading meetings from Firestore:", err);
    return [];
  }
}

async function getSettingsFromFirestore(): Promise<any> {
  await ensureSeedAndSetup();
  try {
    const docSnap = await getDoc(doc(firestoreDb, "settings", "global"));
    if (docSnap.exists()) {
      const data = docSnap.data() || {};
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
    console.error("Error reading global settings from Firestore:", err);
  }
  return {
    whatsapp_recipient_phone: "+966507668366",
    whatsapp_phone_number_id: "1148865668308769",
    whatsapp_access_token: "EAAOZASL5k18gBRiMDPF0ttY0PJXYxRl88FwPLdZBGuZAZBGeOLOMJmB6ZBlswxSiPOmxqxE4LhFXKAgsgHfcPLGOMgh9wdbBZAiuXde0OuC1kS9SQ7e6fyLTc8Uc8bp6ZC5UYyAFBEP2LdziTSZBsMa9HYZA8ZBfO80VMiYssz1fRtaWXYzNeQMZCgLIYCTShh7zwZDZD",
    whatsapp_cron_time: "12:15",
    whatsapp_fixed_time: "12:19",
    contributor_recipient_phone: "+966566889475",
    contributor_phone_number_id: "1148865668308769",
    contributor_access_token: "EAAOZASL5k18gBRiMDPF0ttY0PJXYxRl88FwPLdZBGuZAZBGeOLOMJmB6ZBlswxSiPOmxqxE4LhFXKAgsgHfcPLGOMgh9wdbBZAiuXde0OuC1kS9SQ7e6fyLTc8Uc8bp6ZC5UYyAFBEP2LdziTSZBsMa9HYZA8ZBfO80VMiYssz1fRtaWXYzNeQMZCgLIYCTShh7zwZDZD",
    contributor_cron_time: "12:17",
    contributor_fixed_time: "12:21"
  };
}

async function getLogsFromFirestore(): Promise<any[]> {
  try {
    const snapshot = await getDocs(collection(firestoreDb, "whatsapp_logs"));
    const logs: any[] = [];
    snapshot.forEach(d => {
      logs.push({ id: d.id, ...d.data() });
    });
    return logs.sort((a,b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()).slice(0, 50);
  } catch (err) {
    console.error("Error reading logs from Firestore:", err);
    return [];
  }
}

async function addLogToFirestore(recipient: string, content: string, status: string, isFailure = false, errorMsg?: string): Promise<void> {
  try {
    const logId = String(Date.now());
    await setDoc(doc(firestoreDb, "whatsapp_logs", logId), {
      recipient_phone: recipient,
      message_content: content,
      status,
      error_message: errorMsg || null,
      sent_at: new Date().toISOString()
    });
  } catch (err) {
    console.error("Error writing log to Firestore:", err);
  }
}

function getWorkingDaysElapsed(startDateStr: string, endDateStr: string): number {
  try {
    const current = new Date(startDateStr + "T00:00:00");
    const target = new Date(endDateStr + "T00:00:00");
    if (isNaN(current.getTime()) || isNaN(target.getTime())) return 0;
    if (current >= target) return 0;

    let workingDays = 0;
    const date = new Date(current);
    while (date < target) {
      date.setDate(date.getDate() + 1);
      const day = date.getDay();
      if (day !== 5 && day !== 6) {
        workingDays++;
      }
    }
    return workingDays;
  } catch (e) {
    return 0;
  }
}

function generateGoogleCalendarLink(actionType: string, topic: string, date: string, time: string, location: string): string {
  if (!date) return "";
  const cleanDate = date.replace(/-/g, '');
  let startHour = 9;
  let startMin = 0;
  if (time) {
    const parts = time.split(':');
    startHour = parseInt(parts[0], 10) || 9;
    startMin = parseInt(parts[1], 10) || 0;
  }
  let endHour = startHour + 1;
  let endMin = startMin;
  
  const cleanStartTime = `${String(startHour).padStart(2,'0')}${String(startMin).padStart(2,'0')}00`;
  const cleanEndTime = `${String(endHour).padStart(2,'0')}${String(endMin).padStart(2,'0')}00`;
  
  const dates = `${cleanDate}T${cleanStartTime}/${cleanDate}T${cleanEndTime}`;
  const shortTopic = topic.length > 25 ? topic.substring(0, 25) + "..." : topic;
  const encText = encodeURIComponent(`[${actionType}] ${shortTopic}`);
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encText}&dates=${dates}`;
}

function isEscalatedByFormula(letter: any, todayStr: string): boolean {
  if (letter.status === "مغلق") return false;
  const elapsed = getWorkingDaysElapsed(letter.letter_date, todayStr);
  let limit = 5;
  if (letter.priority === "عالية") limit = 1;
  else if (letter.priority === "متوسطة") limit = 3;
  else if (letter.priority === "منخفضة") limit = 5;

  return elapsed > limit;
}

export async function sendWhatsAppReport(role: "manager" | "contributor" | "meeting" | "meeting_1h" = "manager", toPhone?: string, targetDate?: string, targetTime?: string) {
  const globalConfig = await getSettingsFromFirestore();

  let recipientPhone = "";
  let phoneNumberId = "";
  let accessToken = "";

  const managerPhoneId = globalConfig.whatsapp_phone_number_id || globalConfig.phone_number_id || "1148865668308769";
  const managerToken = (globalConfig.whatsapp_access_token || globalConfig.access_token || "EAAOZASL5k18gBRiMDPF0ttY0PJXYxRl88FwPLdZBGuZAZBGeOLOMJmB6ZBlswxSiPOmxqxE4LhFXKAgsgHfcPLGOMgh9wdbBZAiuXde0OuC1kS9SQ7e6fyLTc8Uc8bp6ZC5UYyAFBEP2LdziTSZBsMa9HYZA8ZBfO80VMiYssz1fRtaWXYzNeQMZCgLIYCTShh7zwZDZD").trim();

  if (role === "manager") {
    recipientPhone = toPhone || globalConfig.whatsapp_recipient_phone || globalConfig.recipient_phone || "+966507668366";
    phoneNumberId = managerPhoneId;
    accessToken = managerToken;
  } else if (role === "meeting" || role === "meeting_1h") {
    // Meetings role uses manager's meta IDs but its own phone
    recipientPhone = toPhone || globalConfig.meeting_recipient_phone || globalConfig.whatsapp_recipient_phone || globalConfig.recipient_phone || "+966507668366";
    phoneNumberId = (globalConfig.meeting_phone_number_id || "").trim() || managerPhoneId;
    accessToken = (globalConfig.meeting_access_token || "").trim() || managerToken;
  } else {
    // Contributor role
    recipientPhone = toPhone || globalConfig.contributor_recipient_phone || "+966566889475";
    phoneNumberId = (globalConfig.contributor_phone_number_id || "").trim() || managerPhoneId;
    accessToken = (globalConfig.contributor_access_token || "").trim() || managerToken;
  }

  console.log(`[Meta API] Starting report process for role: ${role} to: ${recipientPhone}`);

  const now = toZonedTime(new Date(), TIMEZONE);
  const todayStr = format(now, "yyyy-MM-dd");

  const getDaysDifference = (oldDateStr: string, newDateStr: string) => {
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
    if (days >= 3 && days <= 10) return `${days} أيام`;
    return `${days} يوم`;
  };

  let items: any[] = [];
  let totalCount = 0;

  if (role === "meeting") {
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = format(tomorrowDate, "yyyy-MM-dd");

    const allMeetings = await getMeetingsFromFirestore();
    
    // Fetch only tomorrow's meetings
    items = allMeetings.filter(m => m.status === "تحت الاجراء" && m.date === tomorrowStr);
    
    // Sort logic for meetings if needed, e.g. by time
    items = items.sort((a,b) => (a.date || "").localeCompare(b.date || "") || (a.time || "").localeCompare(b.time || ""));
    totalCount = items.length;
  } else if (role === "meeting_1h") {
    const allMeetings = await getMeetingsFromFirestore();
    
    items = allMeetings.filter(m => 
      m.status === "تحت الاجراء" && 
      m.date === targetDate && 
      (m.time || "").startsWith(targetTime || "")
    );
    
    items = items.sort((a,b) => (a.date || "").localeCompare(b.date || "") || (a.time || "").localeCompare(b.time || ""));
    totalCount = items.length;
  } else {
    const allLetters = await getLettersFromFirestore();
    if (role === "manager") {
      items = allLetters.filter(l =>
        l.status !== 'مغلق' && (l.due_date < todayStr || l.priority === 'عالية')
      );
    } else {
      items = allLetters.filter(l =>
        l.status !== 'مغلق' && !isEscalatedByFormula(l, todayStr)
      );
    }
    items = items.sort((a, b) => b.id - a.id);
    totalCount = items.length;
  }

  if (totalCount === 0) {
    if (!toPhone && (role === "meeting" || role === "meeting_1h")) {
      return { success: true, message: "No items to report." };
    }
    // Provide a mock item so the template doesn't fail, but keep count at 0
    if (role === "meeting" || role === "meeting_1h") {
      items = [{
        actionType: "إجتماع",
        topic: toPhone ? "اختبار تجريبي" : "لا توجد اجتماعات مستحقة",
        date: todayStr,
        time: "10:00",
        location: "-"
      }];
    } else {
      items = [{
        letter_number: toPhone ? "TEST-123" : "-",
        entity_source: toPhone ? "تجريبي" : "-",
        category: toPhone ? "خطاب تجريبي" : "لا يوجد خطابات تستدعي المتابعة",
        responsible_department: toPhone ? "الإدارة" : "-",
        letter_date: todayStr,
        due_date: todayStr
      }];
    }
    totalCount = toPhone ? items.length : 0;
  }

  let overallSuccess = true;
  let lastError = "";

  if (accessToken && phoneNumberId) {
    let formattedPhone = recipientPhone.trim().replace(/\D/g, "");
    if (formattedPhone.startsWith("00")) formattedPhone = formattedPhone.substring(2);

    const metaUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const headers = { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" };

    if (role === "contributor") {
      let verticalText = `عزيزي المساهم\n`;
      verticalText += `نود إشعاركم بوجود خطابات *غير مصعدة بعدد ( ${items.length} ) خطابات* ⚠️\n`;
      verticalText += `تستلزم المتابعة المستمرة واتخاذ الإجراء اللازم\n\n`;
      verticalText += `تفاصيل الخطابات:\n`;

      items.forEach((item, idx) => {
        const topic = (item.category || "بلا موضوع").trim();
        const source = (item.entity_source || "غير محدد").trim();
        const dept = (item.responsible_department || "غير محدد").trim();
        const waitingDays = getDaysDifference(item.letter_date || todayStr, todayStr);
        let durationStr = formatArabicDays(waitingDays);
        if (waitingDays < 0) durationStr = `${waitingDays} يوم`;

        verticalText += `📌 *رقم الخطاب:* ${item.letter_number}\n🏢 *الجهة:* ${source}\n📝 *الموضوع:* ${topic}\n👥 *المسؤول:* ${dept}\n⏳ *المدة:* ${durationStr}\n🟢 *التصعيد:* غير مصعد`;
        
        if (idx < items.length - 1) {
          verticalText += `\n\n`;
        }
      });
      
      verticalText += `\n\n🤖 _تم إعداد هذا التقرير آلياً لغرض المتابعة اليومية._`;

      let reportDocId = "report_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
      try {
        const reportDocRef = doc(firestoreDb, "settings", reportDocId);
        await setDoc(reportDocRef, {
          text: verticalText,
          createdAt: new Date().toISOString()
        });
      } catch (err: any) {
        console.error("Firestore Reports Error:", err);
        reportDocId = "";
      }

      const appUrl = globalConfig.app_url || "https://ais-pre-7e7ueomjufef2e4zagaeqs-415170015555.europe-west2.run.app";
      const link = reportDocId ? `${appUrl}/share-report?id=${reportDocId}` : "";

      const CHUNK_SIZE = items.length > 0 ? items.length : 1;
      for (let chunkIndex = 0; chunkIndex < items.length; chunkIndex += CHUNK_SIZE) {
        const currentChunk = items.slice(chunkIndex, chunkIndex + CHUNK_SIZE);

        let horizontalText = "";
        currentChunk.forEach((item, idx) => {
          const topic = (item.category || "بلا موضوع").trim();
          const source = (item.entity_source || "غير محدد").trim();
          const dept = (item.responsible_department || "غير محدد").trim();
          const waitingDays = getDaysDifference(item.letter_date || todayStr, todayStr);
          let durationStr = formatArabicDays(waitingDays);
          if (waitingDays < 0) durationStr = `${waitingDays} يوم`;

          horizontalText += `📌${item.letter_number}|🏢${source}|📝${topic}|👥${dept}|⏳${durationStr}|🟢غير مصعد`;
          
          if (idx < currentChunk.length - 1) {
            horizontalText += ` ーーーー `;
          }
        });

        let chunkCountStr = String(totalCount);

        let whatsappParam2 = horizontalText;
        if (link) {
            whatsappParam2 += ` ーーーー 🔗 لنسخ التقرير، افتح الرابط: ${link}`;
        }

        // WhatsApp templates cannot contain newlines or multiple consecutive spaces in parameters
        whatsappParam2 = whatsappParam2.replace(/[\n\r\t]/g, " ").replace(/ {2,}/g, " ").trim();
        chunkCountStr = chunkCountStr.replace(/[\n\r\t]/g, " ").replace(/ {2,}/g, " ").trim();

        const parametersPayload = [
          { type: "text", text: chunkCountStr.substring(0, 1024) },
          { type: "text", text: whatsappParam2.substring(0, 1024) }
        ];

        const payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "template",
          template: {
            name: "daily_letters_report_contributor",
            language: { code: "ar" },
            components: [
              { 
                type: "body", 
                parameters: parametersPayload 
              }
            ]
          }
        };

        try {
          await axios.post(metaUrl, payload, { headers });
          console.log(`[Meta API] Contributor Pack sent successfully.`);
          
          await addLogToFirestore(
            recipientPhone,
            `تم إرسال تقرير المساهم بنجاح. يحتوي على ${currentChunk.length} خطاب.`,
            "نجاح",
            false
          );
        } catch (xhrError: any) {
          overallSuccess = false;
          const errMessage = xhrError.response?.data ? JSON.stringify(xhrError.response.data) : xhrError.message;
          lastError = errMessage;
          console.error("Meta API Contributor Error:", errMessage);

          await addLogToFirestore(
            recipientPhone,
            `فشل إرسال تقرير المساهم.`,
            "فشل",
            true,
            errMessage
          );
        }
      }
    } else if (role === "meeting") {
      // Meeting template has 21 parameters total:
      // {{1}} count
      // For each meeting (up to 4 in template): action_type, topic, date, time, location => 5 vars per meeting
      // 1 + (4 * 5) = 21 vars
      const CHUNK_SIZE = 4;

      for (let chunkIndex = 0; chunkIndex < items.length; chunkIndex += CHUNK_SIZE) {
        const currentChunk = items.slice(chunkIndex, chunkIndex + CHUNK_SIZE);

        let templateParams: string[] = Array(21).fill("‎"); // Invisible Unicode character for empty fields

        if (totalCount > CHUNK_SIZE) {
          templateParams[0] = `(${chunkIndex + 1} إلى ${Math.min(chunkIndex + CHUNK_SIZE, totalCount)}) من أصل ${totalCount}`;
        } else {
          templateParams[0] = String(totalCount);
        }

        for (let i = 0; i < 4; i++) {
          const baseIndex = 1 + (i * 5);
          if (currentChunk[i]) {
            const item = currentChunk[i];
            const actionType = (item.actionType || "إجتماع").trim();
            let topic = (item.topic || "").trim() || "-";
            const date = (item.date || "-").trim();
            const time = (item.time || "-").trim();
            let location = (item.location || "-").trim();
            
            // Trim topic and location to save length in WhatsApp template
            if (topic.length > 35) topic = topic.substring(0, 35) + "...";
            if (location.length > 25) location = location.substring(0, 25) + "...";
            
            templateParams[baseIndex]     = actionType;
            templateParams[baseIndex + 1] = topic;
            templateParams[baseIndex + 2] = date;
            templateParams[baseIndex + 3] = time;
            templateParams[baseIndex + 4] = location;
          } else {
            templateParams[baseIndex]     = "-";
            templateParams[baseIndex + 1] = "-";
            templateParams[baseIndex + 2] = "-";
            templateParams[baseIndex + 3] = "-";
            templateParams[baseIndex + 4] = "-";
          }
        }

        const parametersPayload = templateParams.map(text => ({ type: "text", text: String(text).substring(0, 1024) }));

        const payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "template",
          template: {
            name: "executive_meetings_schedule1",
            language: { code: "ar" },
            components: [{ type: "body", parameters: parametersPayload }]
          }
        };

        try {
          await axios.post(metaUrl, payload, { headers });
          console.log(`[Meta API] Executive Meeting Pack ${chunkIndex / CHUNK_SIZE + 1} sent successfully.`);

          await addLogToFirestore(
            recipientPhone,
            `تم إرسال إشعار الاجتماعات بنجاح للدفعة ${chunkIndex / CHUNK_SIZE + 1} (عدد ${currentChunk.length} اجتماع).`,
            "نجاح",
            false
          );
        } catch (xhrError: any) {
          overallSuccess = false;
          const errMessage = xhrError.response?.data ? JSON.stringify(xhrError.response.data) : xhrError.message;
          lastError = errMessage;
          console.error("Meta API Meeting Error:", errMessage);

          await addLogToFirestore(
            recipientPhone,
            `فشل إرسال إشعار الاجتماعات للدفعة ${chunkIndex / CHUNK_SIZE + 1}`,
            "فشل",
            true,
            errMessage
          );
        }
      }
    } else if (role === "meeting_1h") {
      // 1 hour before meeting alert
      // Template: executive_meetings_schedule
      // {{1}} count, {{2}} type, {{3}} topic, {{4}} date, {{5}} time, {{6}} location
      // Total 6 parameters per meeting message. We will send 1 message per meeting.
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        let templateParams: string[] = Array(6).fill("‎");
        
        templateParams[0] = String(i + 1) + " من " + String(totalCount);
        
        const actionType = (item.actionType || "إجتماع").trim();
        let topic = (item.topic || "").trim() || "-";
        const date = (item.date || "-").trim();
        const time = (item.time || "-").trim();
        let location = (item.location || "-").trim();
        
        if (topic.length > 35) topic = topic.substring(0, 35) + "...";
        if (location.length > 25) location = location.substring(0, 25) + "...";
        
        templateParams[1] = actionType;
        templateParams[2] = topic;
        templateParams[3] = date;
        templateParams[4] = time;
        templateParams[5] = location;
        
        const parametersPayload = templateParams.map(text => ({ type: "text", text: String(text).substring(0, 1024) }));

        const payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "template",
          template: {
            name: "executive_meetings_schedule",
            language: { code: "ar" },
            components: [{ type: "body", parameters: parametersPayload }]
          }
        };

        try {
          await axios.post(metaUrl, payload, { headers });
          console.log(`[Meta API] 1 Hour Alert for meeting ${i+1} sent successfully.`);

          await addLogToFirestore(
            recipientPhone,
            `تم إرسال تذكير الاجتماع (قبل ساعة) ${i+1} من ${totalCount} بنجاح.`,
            "نجاح",
            false
          );
        } catch (xhrError: any) {
          overallSuccess = false;
          const errMessage = xhrError.response?.data ? JSON.stringify(xhrError.response.data) : xhrError.message;
          lastError = errMessage;
          console.error("Meta API Meeting 1h Error:", errMessage);

          await addLogToFirestore(
            recipientPhone,
            `فشل إرسال تذكير الاجتماع (قبل ساعة) ${i+1} من ${totalCount}`,
            "فشل",
            true,
            errMessage
          );
        }
      }
    } else {
      const CHUNK_SIZE = 4;

      for (let chunkIndex = 0; chunkIndex < items.length; chunkIndex += CHUNK_SIZE) {
        const currentChunk = items.slice(chunkIndex, chunkIndex + CHUNK_SIZE);

        let templateParams: string[] = Array(21).fill("‎");

        if (totalCount > CHUNK_SIZE) {
          templateParams[0] = `(${chunkIndex + 1} إلى ${Math.min(chunkIndex + CHUNK_SIZE, totalCount)}) من أصل ${totalCount}`;
        } else {
          templateParams[0] = String(totalCount);
        }

        for (let i = 0; i < CHUNK_SIZE; i++) {
          if (currentChunk[i]) {
            const item = currentChunk[i];
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

        const parametersPayload = templateParams.map(text => ({ type: "text", text: text }));

        const payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "template",
          template: {
            name: "daily_letters_report",
            language: { code: "ar" },
            components: [{ type: "body", parameters: parametersPayload }]
          }
        };

        try {
          await axios.post(metaUrl, payload, { headers });
          console.log(`[Meta API] Clean Pack ${chunkIndex / CHUNK_SIZE + 1} sent successfully.`);

          await addLogToFirestore(
            recipientPhone,
            `تم إرسال حزمة التقرير (21 متغير) بنجاح للدفعة ${chunkIndex / CHUNK_SIZE + 1} لعدد ${currentChunk.length} خطابات من المنصة.`,
            "نجاح",
            false
          );
        } catch (xhrError: any) {
          overallSuccess = false;
          const errMessage = xhrError.response?.data ? JSON.stringify(xhrError.response.data) : xhrError.message;
          lastError = errMessage;
          console.error("Meta API Pure Parameter Error:", errMessage);

          await addLogToFirestore(
            recipientPhone,
            `فشل إرسال حزمة التقرير (21 متغير) للدفعة ${chunkIndex / CHUNK_SIZE + 1}`,
            "فشل",
            true,
            errMessage
          );
        }
      }
    }
  } else {
    overallSuccess = false;
    lastError = "Missing access token or phone number ID in WhatsApp configuration.";
  }

  return { success: overallSuccess, error: lastError, message_content: overallSuccess ? "تم الإرسال بنجاح" : "فشل" };
}

let masterTickTask: any = null;

export async function runSchedulerCheck() {
  try {
    const nowRiyadh = toZonedTime(new Date(), TIMEZONE);
    const currentHour = nowRiyadh.getHours();
    const currentMinute = nowRiyadh.getMinutes();
    
    const rtfDay = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, weekday: 'long' });
    const weekdayStr = rtfDay.format(nowRiyadh);
    const isWorkingDay = weekdayStr !== "Friday" && weekdayStr !== "Saturday";

    const currentDateStr = format(nowRiyadh, "yyyy-MM-dd");
    const timeStr = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
    const uniqueMinuteKey = `${currentDateStr} ${timeStr}`;

    const config = await getSettingsFromFirestore();

    const managerFixedTime = config.whatsapp_fixed_time || "12:19";
    const managerCronTime = config.whatsapp_cron_time || "12:15";
    const contributorFixedTime = addMinutesToTime(managerFixedTime, 2);
    const contributorCronTime = addMinutesToTime(managerCronTime, 2);
    const meetingFixedTime = config.meeting_fixed_time || "21:00";

    const isAlreadySent = (key: string): boolean => {
      return config[key] === uniqueMinuteKey;
    };

    const markAsSent = async (key: string) => {
      try {
        await setDoc(doc(firestoreDb, "settings", "global"), { [key]: uniqueMinuteKey }, { merge: true });
      } catch (e) {
        console.error(`Failed to mark sent for settings key ${key}:`, e);
      }
    };

    console.log(`[Scheduler Tick] Riyadh Local: ${timeStr}, Day: ${weekdayStr} (Working: ${isWorkingDay})`);

    // We can run report dispatches on scheduled minutes (independent of weekday checking if desired, or skip on Fri/Sat if strictly requested)
    if (isWorkingDay) {
      if (timeStr === managerFixedTime && !isAlreadySent("last_sent_manager_fixed")) {
        await markAsSent("last_sent_manager_fixed");
        console.log(`[Scheduler] Triggering Manager Fixed Report at ${timeStr}`);
        await sendWhatsAppReport("manager");
      }
      
      if (timeStr === managerCronTime && !isAlreadySent("last_sent_manager_cron")) {
        await markAsSent("last_sent_manager_cron");
        console.log(`[Scheduler] Triggering Manager Alert at ${timeStr}`);
        await sendWhatsAppReport("manager");
      }

      if (timeStr === contributorFixedTime && !isAlreadySent("last_sent_contributor_fixed")) {
        await markAsSent("last_sent_contributor_fixed");
        console.log(`[Scheduler] Triggering Contributor Fixed Report at ${timeStr}`);
        await sendWhatsAppReport("contributor");
      }

      if (timeStr === contributorCronTime && !isAlreadySent("last_sent_contributor_cron")) {
        await markAsSent("last_sent_contributor_cron");
        console.log(`[Scheduler] Triggering Contributor Alert at ${timeStr}`);
        await sendWhatsAppReport("contributor");
      }

      if (timeStr === meetingFixedTime && !isAlreadySent("last_sent_meeting_fixed")) {
        await markAsSent("last_sent_meeting_fixed");
        console.log(`[Scheduler] Triggering Meeting Notification at ${timeStr}`);
        await sendWhatsAppReport("meeting");
      }
      
      if (!isAlreadySent("last_sent_meeting_1h")) {
        await markAsSent("last_sent_meeting_1h");
        
        const inOneHourDate = new Date(nowRiyadh.getTime() + 60 * 60 * 1000);
        const targetDateStr = format(inOneHourDate, "yyyy-MM-dd");
        const targetTimeStr = `${String(inOneHourDate.getHours()).padStart(2, "0")}:${String(inOneHourDate.getMinutes()).padStart(2, "0")}`;
        
        console.log(`[Scheduler] Checking for meetings 1 hour from now: ${targetDateStr} ${targetTimeStr}`);
        const reportResult = await sendWhatsAppReport("meeting_1h", undefined, targetDateStr, targetTimeStr);
        if (reportResult && reportResult.success && (reportResult as any).message !== "No items to report.") {
           console.log("[Scheduler] 1-hour meeting alert sent successfully");
        }
      }
    }
  } catch (err) {
    console.error("[Scheduler Error] Exception in master check:", err);
  }
}

export function startMasterSchedule() {
  if (process.env.VERCEL) {
    console.log("[Scheduler] Skipping node-cron boot on Vercel, relying on /api/scheduler-tick");
    return;
  }
  if (masterTickTask) {
    masterTickTask.stop();
    masterTickTask = null;
  }

  console.log("[Scheduler] Booting 1-Minute Master Scheduler...");
  masterTickTask = cron.schedule("* * * * *", async () => {
    await runSchedulerCheck();
  });
}

export function scheduleFixedWhatsAppJob() {}
export function scheduleWhatsAppJob() {}
export function scheduleFixedContributorJob() {}
export function scheduleContributorJob() {}

const app = express();
app.use(express.json({ limit: "20mb" }));

// Run seed asynchronously without blocking
ensureSeedAndSetup().catch(console.error);
startMasterSchedule();

// Keep everything below in app as routes, and wrap the Vite/listen logic


  app.get("/api/auth/me", async (req, res) => {
    const empId = req.headers["x-user-employee-id"];
    const email = req.headers["x-user-email"] || "manager@example.com";
    try {
      if (empId) {
        const userDocRef = doc(firestoreDb, "users", String(empId));
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (String(empId) === "76657") {
            userData.role = "manager";
          }
          userData.permission = Number(empId) === 100889 ? "write" : (userData.permission || "read");
          return res.json(userData);
        }
      }

      const snap = await getDocs(collection(firestoreDb, "users"));
      let user: any = null;
      snap.forEach(d => {
        const u = d.data();
        if (u.email === email) user = u;
      });
      if (user) {
        user.permission = Number(user.id) === 100889 ? "write" : (user.permission || "read");
      }
      res.json(user || { email, role: "staff", permission: "read" });
    } catch (e) {
      res.json({ email, role: "staff", permission: "read" });
    }
  });

  app.post("/api/auth/login-by-id", async (req, res) => {
    const { employeeId, password } = req.body;
    if (!employeeId) {
      return res.status(400).json({ success: false, error: "يرجى إدخال الرقم الوظيفي" });
    }
    if (!password) {
      return res.status(400).json({ success: false, error: "يرجى إدخال كلمة المرور" });
    }
    const parsedId = Number(employeeId);
    if (isNaN(parsedId)) {
      return res.status(400).json({ success: false, error: "الرقم الوظيفي يجب أن يحتوي على أرقام فقط" });
    }

    try {
      const userDocRef = doc(firestoreDb, "users", String(parsedId));
      const userSnap = await getDoc(userDocRef);
      let userData: any;

      if (!userSnap.exists()) {
        const emp = EMPLOYEES.find(e => e.id === parsedId);
        if (!emp) {
          return res.status(404).json({ success: false, error: "الرقم الوظيفي غير مسجل في منصة الحكومة الرقمية. يرجى التحقق من الرقم والتحول للموظفين المسجلين." });
        }

        // Verify with Default Password
        const defaultPassword = parsedId === 100889 ? "100889*" : "123";
        if (password !== defaultPassword) {
          return res.status(401).json({ success: false, error: "كلمة المرور غير صحيحة" });
        }

        userData = {
          id: parsedId,
          name: emp.name,
          email: `${parsedId}@governance.gov.sa`,
          role: parsedId === 76657 ? "manager" : "staff",
          permission: parsedId === 100889 ? "write" : "read",
          isDeleted: false,
          password: defaultPassword
        };
        await setDoc(userDocRef, userData);
        console.log(`[Server] Registered new employee user in Firestore: ${emp.name} (${parsedId})`);
      } else {
        userData = userSnap.data();
        if (userData && userData.isDeleted) {
          return res.status(404).json({ success: false, error: "الرقم الوظيفي غير مسجل في منصة الحكومة الرقمية. يرجى التحقق من الرقم والتحول للموظفين المسجلين." });
        }

        // Verify with Custom stored password or default
        const expectedPassword = userData.password || (parsedId === 100889 ? "100889*" : "123");
        if (password !== expectedPassword) {
          return res.status(401).json({ success: false, error: "كلمة المرور غير صحيحة" });
        }

        if (parsedId === 76657) {
          userData.role = "manager";
        }
      }
      userData.permission = parsedId === 100889 ? "write" : (userData.permission || "read");

      return res.json({ success: true, user: userData });
    } catch (e: any) {
      console.error("[Server] Error in login-by-id:", e);
      return res.status(500).json({ success: false, error: e.message || "حدث خطأ أثناء الاتصال بقاعدة البيانات" });
    }
  });

  app.post("/api/auth/change-password", async (req, res) => {
    const empId = req.headers["x-user-employee-id"];
    const { currentPassword, newPassword } = req.body;

    if (!empId) {
      return res.status(401).json({ success: false, error: "غير مصرح بالدخول" });
    }
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: "يرجى إدخال كلمة المرور الحالية والجديدة" });
    }

    const parsedId = Number(empId);
    try {
      const userDocRef = doc(firestoreDb, "users", String(parsedId));
      const userSnap = await getDoc(userDocRef);
      let userData: any;
      let expectedPassword = parsedId === 100889 ? "100889*" : "123";

      if (userSnap.exists()) {
        userData = userSnap.data();
        if (userData && userData.isDeleted) {
          return res.status(404).json({ success: false, error: "المستخدم غير موجود" });
        }
        if (userData.password) {
          expectedPassword = userData.password;
        }
      } else {
        const emp = EMPLOYEES.find(e => e.id === parsedId);
        if (!emp) {
          return res.status(404).json({ success: false, error: "الموظف غير مسجل" });
        }
        userData = {
          id: parsedId,
          name: emp.name,
          email: `${parsedId}@governance.gov.sa`,
          role: parsedId === 76657 ? "manager" : "staff",
          permission: parsedId === 100889 ? "write" : "read",
          isDeleted: false
        };
      }

      if (currentPassword !== expectedPassword) {
        return res.status(400).json({ success: false, error: "كلمة المرور الحالية غير صحيحة" });
      }

      userData.password = newPassword;
      await setDoc(userDocRef, userData);

      return res.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
    } catch (e: any) {
      console.error("[Server] Error in change-password:", e);
      return res.status(500).json({ success: false, error: e.message || "حدث خطأ أثناء الاتصال بقاعدة البيانات" });
    }
  });

  // Supporting updating role dynamically for a user in Firestore
  async function checkWritePermission(req: any, res: any, next: any) {
    const empId = req.headers["x-user-employee-id"];
    if (!empId) {
      return next();
    }
    try {
      const parsedId = Number(empId);
      if (parsedId === 100889) {
        return next();
      }
      const userDocRef = doc(firestoreDb, "users", String(parsedId));
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.permission === "read") {
          return res.status(403).json({
            success: false,
            error: "عذراً، لديك صلاحية الاطلاع فقط ولا يمكنك إجراء أي تعديلات أو إضافة بيانات جديدة."
          });
        }
      }
      next();
    } catch (e) {
      next();
    }
  }

  app.post("/api/auth/update-role", checkWritePermission, async (req, res) => {
    const { employeeId, role } = req.body;
    if (!employeeId || !role) {
      return res.status(400).json({ success: false, error: "البيانات ناقصة" });
    }
    try {
      const userDocRef = doc(firestoreDb, "users", String(employeeId));
      await setDoc(userDocRef, { role }, { merge: true });
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/api/permissions", async (req, res) => {
    try {
      const snap = await getDocs(collection(firestoreDb, "users"));
      const users: any[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (data && data.isDeleted) return; // Skip deleted users
        const parsedId = Number(data.id || d.id);
        if (!parsedId) return;
        const emp = EMPLOYEES.find(e => e.id === parsedId);
        users.push({
          id: parsedId,
          name: data.name || (emp ? emp.name : `موظف ${parsedId}`),
          email: data.email || `${parsedId}@governance.gov.sa`,
          role: data.role || "staff",
          permission: parsedId === 100889 ? "write" : (data.permission || "read")
        });
      });

      // Ensure 100889 is always included and has write permission
      if (!users.some(u => u.id === 100889)) {
        users.push({
          id: 100889,
          name: "المعتز محمد علي ابوطالب",
          email: "100889@governance.gov.sa",
          role: "staff",
          permission: "write"
        });
      }

      res.json(users);
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/permissions/add", checkWritePermission, async (req, res) => {
    const { employeeId, name, permission } = req.body;
    if (!employeeId || !name) {
      return res.status(400).json({ success: false, error: "الرجاء إدخال الرقم الوظيفي والاسم" });
    }
    const parsedId = Number(employeeId);
    if (isNaN(parsedId)) {
      return res.status(400).json({ success: false, error: "الرقم الوظيفي يجب أن يكون رقماً" });
    }
    try {
      const userDocRef = doc(firestoreDb, "users", String(parsedId));
      const userData = {
        id: parsedId,
        name: name,
        email: `${parsedId}@governance.gov.sa`,
        role: "staff",
        permission: parsedId === 100889 ? "write" : (permission || "read"),
        isDeleted: false // Reset isDeleted flag in case they were previously deleted
      };
      await setDoc(userDocRef, userData);
      res.json({ success: true, user: userData });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/permissions/delete", checkWritePermission, async (req, res) => {
    const { employeeId } = req.body;
    if (!employeeId) {
      return res.status(400).json({ success: false, error: "الرقم الوظيفي مطلوب" });
    }
    const parsedId = Number(employeeId);
    if (parsedId === 100889) {
      return res.status(400).json({ success: false, error: "لا يمكن حذف حساب المسؤول العام" });
    }
    try {
      const userDocRef = doc(firestoreDb, "users", String(parsedId));
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const existingData = userSnap.data();
        await setDoc(userDocRef, {
          ...existingData,
          isDeleted: true,
          id: parsedId,
          name: existingData.name || `موظف ${parsedId}`,
          email: existingData.email || `${parsedId}@governance.gov.sa`,
          role: existingData.role || "staff",
          permission: existingData.permission || "read"
        });
      } else {
        const emp = EMPLOYEES.find(e => e.id === parsedId);
        await setDoc(userDocRef, {
          id: parsedId,
          name: emp ? emp.name : `موظف ${parsedId}`,
          email: `${parsedId}@governance.gov.sa`,
          role: "staff",
          permission: "read",
          isDeleted: true
        });
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.post("/api/permissions/update", checkWritePermission, async (req, res) => {
    const { employeeId, permission } = req.body;
    if (!employeeId || !permission) {
      return res.status(400).json({ success: false, error: "البيانات غير مكتملة" });
    }
    const parsedId = Number(employeeId);
    try {
      const userDocRef = doc(firestoreDb, "users", String(parsedId));
      await setDoc(userDocRef, { permission: parsedId === 100889 ? "write" : permission }, { merge: true });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/api/meetings", async (req, res) => {
    try {
      const allMeetings = await getMeetingsFromFirestore();
      res.json(allMeetings.sort((a,b) => b.id - a.id));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/meetings", checkWritePermission, async (req, res) => {
    const { actionType, topic, date, time, location, status } = req.body;
    try {
      const meetings = await getMeetingsFromFirestore();
      const newId = meetings.length > 0 ? Math.max(...meetings.map(m => m.id)) + 1 : 1;
      const newMeeting = {
        id: newId,
        type: 'meeting',
        actionType,
        topic,
        date,
        time,
        location,
        status: status || 'تحت الاجراء',
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(firestoreDb, "reports", String(newId)), newMeeting);
      res.json(newMeeting);
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.put("/api/meetings/:id", checkWritePermission, async (req, res) => {
    try {
      const idToFind = String(req.params.id);
      const snapshot = await getDocs(collection(firestoreDb, "reports"));
      let docIdToUpdate = "";
      snapshot.forEach(d => {
        if (String(d.data().id) === idToFind && d.data().type === 'meeting') {
          docIdToUpdate = d.id;
        }
      });
      if (!docIdToUpdate) {
        return res.status(404).json({ error: "Not found" });
      }
      
      const { actionType, topic, date, time, location, status } = req.body;
      const updateData: any = {};
      if (actionType !== undefined) updateData.actionType = actionType;
      if (topic !== undefined) updateData.topic = topic;
      if (date !== undefined) updateData.date = date;
      if (time !== undefined) updateData.time = time;
      if (location !== undefined) updateData.location = location;
      if (status !== undefined) updateData.status = status;
      
      await setDoc(doc(firestoreDb, "reports", docIdToUpdate), updateData, { merge: true });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.delete("/api/meetings/:id", checkWritePermission, async (req, res) => {
    try {
      const idToFind = String(req.params.id);
      console.log(`Deleting meeting with id: ${idToFind}`);
      const snapshot = await getDocs(collection(firestoreDb, "reports"));
      let docIdToDelete = idToFind;
      let found = false;
      snapshot.forEach(d => {
        if (String(d.data().id) === idToFind && d.data().type === 'meeting') {
          docIdToDelete = d.id;
          found = true;
          console.log(`Found firestore doc to delete: ${docIdToDelete}`);
        }
      });
      if (!found) {
        console.log(`Meeting not found for id ${idToFind}, attempting to delete by docId directly`);
      }
      await deleteDoc(doc(firestoreDb, "reports", docIdToDelete));
      res.json({ success: true });
    } catch (e: any) {
      console.error('Delete error:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/api/reports/:id", async (req, res) => {
    try {
      const docRef = doc(firestoreDb, "settings", req.params.id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        res.json({ success: true, text: snap.data().text });
      } else {
        res.status(404).json({ success: false, error: "Report not found" });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/api/letters", async (req, res) => {
    const { status, priority, department, search, startDate, endDate } = req.query;
    try {
      let filtered = await getLettersFromFirestore();

      if (status) filtered = filtered.filter(l => l.status === status);
      if (priority) filtered = filtered.filter(l => l.priority === priority);
      if (department) filtered = filtered.filter(l => l.responsible_department === department);
      if (search) {
        const q = String(search).toLowerCase();
        filtered = filtered.filter(l => 
          l.letter_number.toLowerCase().includes(q) ||
          l.entity_source.toLowerCase().includes(q) ||
          (l.category && l.category.toLowerCase().includes(q)) ||
          (l.responsible_department && l.responsible_department.toLowerCase().includes(q))
        );
      }
      if (startDate && endDate) {
        filtered = filtered.filter(l => l.letter_date >= startDate && l.letter_date <= endDate);
      }

      res.json(filtered.sort((a,b) => b.id - a.id));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/letters", checkWritePermission, async (req, res) => {
    const {
      entity_source, letter_number, letter_date, category,
      responsible_department, owner, priority, due_date,
      status, escalation, notes, outgoing_letter_number, outgoing_letter_date
    } = req.body;

    try {
      const letters = await getLettersFromFirestore();
      const newId = letters.length > 0 ? Math.max(...letters.map(l => l.id)) + 1 : 1;

      const newLetter = {
        id: newId,
        entity_source,
        letter_number,
        letter_date,
        category: category || "",
        responsible_department: responsible_department || "",
        owner: owner || "",
        priority: priority || "متوسطة",
        due_date,
        status: status || "جديد",
        escalation: escalation || "لا يوجد",
        notes: notes || "",
        outgoing_letter_number: outgoing_letter_number || "",
        outgoing_letter_date: outgoing_letter_date || "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await setDoc(doc(firestoreDb, "letters", String(newId)), newLetter);
      res.status(201).json({ id: newId });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/letters/:id", checkWritePermission, async (req, res) => {
    const { id } = req.params;
    const body = req.body;

    try {
      const docRef = doc(firestoreDb, "letters", String(id));
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const updated = {
          ...docSnap.data(),
          ...body,
          updated_at: new Date().toISOString()
        };
        await setDoc(docRef, updated);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Letter not found" });
      }
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/letters/:id", checkWritePermission, async (req, res) => {
    const { id } = req.params;
    try {
      await deleteDoc(doc(firestoreDb, "letters", String(id)));
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/stats", async (req, res) => {
    try {
      const letters = await getLettersFromFirestore();
      const now = toZonedTime(new Date(), TIMEZONE);
      const todayStr = format(now, "yyyy-MM-dd");
      const weekStart = format(startOfWeek(now), "yyyy-MM-dd");
      const weekEnd = format(endOfWeek(now), "yyyy-MM-dd");

      const openLetters = letters.filter(l => l.status !== "مغلق");
      const overdueLetters = openLetters.filter(l => l.due_date < todayStr);
      const dueTodayLetters = openLetters.filter(l => l.due_date === todayStr);
      
      const isDueThisWeekHelper = (dStr: string) => {
        return dStr >= weekStart && dStr <= weekEnd;
      };
      
      const dueThisWeekLetters = openLetters.filter(l => isDueThisWeekHelper(l.due_date));

      const priorityMap = openLetters.reduce((acc, curr) => {
        acc[curr.priority] = (acc[curr.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const priorityCounts = Object.entries(priorityMap).map(([priority, count]) => ({
        priority,
        count
      }));

      res.json({
        totalOpen: openLetters.length,
        overdue: overdueLetters.length,
        dueToday: dueTodayLetters.length,
        dueThisWeek: dueThisWeekLetters.length,
        recentLetters: [...letters].sort((a,b) => b.id - a.id).slice(0, 5),
        openLetters: [...openLetters].sort((a,b) => b.id - a.id),
        overdueLetters: [...overdueLetters].sort((a,b) => b.id - a.id),
        dueTodayLetters: [...dueTodayLetters].sort((a,b) => b.id - a.id),
        dueThisWeekLetters: [...dueThisWeekLetters].sort((a,b) => b.id - a.id),
        priorityCounts
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/reports", async (req, res) => {
    try {
      const letters = await getLettersFromFirestore();
      const closedLetters = letters.filter(l => l.status === "مغلق" && l.close_date);

      let totalResponseTime = 0;
      closedLetters.forEach(l => {
        const start = new Date(l.letter_date);
        const end = new Date(l.close_date);
        
        const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const target = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        
        let workingDays = 0;
        if (current < target) {
          const temp = new Date(current);
          while (temp < target) {
            temp.setDate(temp.getDate() + 1);
            const day = temp.getDay();
            if (day !== 5 && day !== 6) { // Exclude Friday (5) and Saturday (6)
              workingDays++;
            }
          }
        }
        totalResponseTime += workingDays;
      });

      const avgResponseTime = closedLetters.length > 0 ? (totalResponseTime / closedLetters.length).toFixed(1) : 0;
      
      const statusMap = letters.reduce((acc, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const statusCounts = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

      const now = toZonedTime(new Date(), TIMEZONE);
      const todayStr = format(now, "yyyy-MM-dd");
      const overdueCount = letters.filter(l => l.status !== "مغلق" && l.due_date < todayStr).length;

      const deptMap: Record<string, Record<string, number>> = {};
      letters.forEach(l => {
        const d = l.responsible_department || "غير محدد";
        if (!deptMap[d]) deptMap[d] = {};
        deptMap[d][l.status] = (deptMap[d][l.status] || 0) + 1;
      });

      const departmentStatusCounts: any[] = [];
      Object.entries(deptMap).forEach(([department, statuses]) => {
        Object.entries(statuses).forEach(([status, count]) => {
          departmentStatusCounts.push({ department, status, count });
        });
      });

      res.json({
        avgResponseTime,
        statusCounts,
        total: letters.length,
        overduePercentage: letters.length > 0 ? ((overdueCount / letters.length) * 100).toFixed(1) : 0,
        departmentStatusCounts
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/whatsapp-config", async (req, res) => {
    try {
      const config = await getSettingsFromFirestore();
      const logs = await getLogsFromFirestore();

      res.json({
        recipient_phone: config.whatsapp_recipient_phone || "+966507668366",
        phone_number_id: config.whatsapp_phone_number_id || "1148865668308769",
        access_token: config.whatsapp_access_token || "",
        cron_time: config.whatsapp_cron_time || "12:15",
        fixed_time: config.whatsapp_fixed_time || "12:19",
        contributor_recipient_phone: config.contributor_recipient_phone || "+966566889475",
        phone_number_id_contributor: config.contributor_phone_number_id || "1148865668308769",
        access_token_contributor: config.contributor_access_token || "",
        contributor_cron_time: addMinutesToTime(config.whatsapp_cron_time || "12:15", 2),
        contributor_fixed_time: addMinutesToTime(config.whatsapp_fixed_time || "12:19", 2),
        meeting_recipient_phone: config.meeting_recipient_phone || "",
        meeting_phone_number_id: config.meeting_phone_number_id || "",
        meeting_access_token: config.meeting_access_token || "",
        meeting_fixed_time: config.meeting_fixed_time || "21:00",
        groq_api_key: config.groq_api_key || "",
        gemini_api_key: config.gemini_api_key || "",
        logs
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  if (!timeStr) return timeStr;
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  
  let totalMinutes = h * 60 + m + minutesToAdd;
  totalMinutes = (totalMinutes + 1440) % 1440; // handle negative or over 24h just in case
  const newH = Math.floor(totalMinutes / 60);
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

  app.post("/api/whatsapp-config", checkWritePermission, async (req, res) => {
    try {
      const body = req.body;
      const updates: any = {};

      for (const [key, val] of Object.entries(body)) {
        if (val !== undefined) {
          updates[key] = val;
        }
      }

      // Sync prefixed versions of the configurations as well for compatibility and back-checking
      if (updates.access_token !== undefined) {
        updates.whatsapp_access_token = updates.access_token;
        updates.contributor_access_token = updates.access_token;
      }
      if (updates.phone_number_id !== undefined) {
        updates.whatsapp_phone_number_id = updates.phone_number_id;
        updates.contributor_phone_number_id = updates.phone_number_id;
      }
      if (updates.recipient_phone !== undefined) {
        updates.whatsapp_recipient_phone = updates.recipient_phone;
      }
      if (updates.cron_time !== undefined) {
        updates.whatsapp_cron_time = updates.cron_time;
        updates.contributor_cron_time = addMinutesToTime(updates.cron_time, 2);
      }
      if (updates.fixed_time !== undefined) {
        updates.whatsapp_fixed_time = updates.fixed_time;
        updates.contributor_fixed_time = addMinutesToTime(updates.fixed_time, 2);
      }

      await setDoc(doc(firestoreDb, "settings", "global"), updates, { merge: true });
      
      await runSchedulerCheck();
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.all("/api/scheduler-tick", async (req, res) => {
    try {
      await runSchedulerCheck();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/governance/chat", async (req, res) => {
    try {
      const { provider, model, system, user, options } = req.body;
      const config = await getSettingsFromFirestore();
      
      let apiKey = "";
      if (provider === "groq") {
        apiKey = config.groq_api_key || process.env.GROQ_API_KEY || "";
        if (!apiKey) {
          return res.status(400).json({ error: "مفتاح Groq API Key غير مكون في الإعدادات." });
        }
      } else if (provider === "gemini") {
        apiKey = config.gemini_api_key || process.env.GEMINI_API_KEY || "";
        if (!apiKey) {
          return res.status(400).json({ error: "مفتاح Gemini API Key غير مكون في الإعدادات." });
        }
      } else {
        return res.status(400).json({ error: "مزود الذكاء الاصطناعي غير مدعوم." });
      }

      if (provider === "groq") {
        const body: any = {
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user }
          ],
          temperature: options?.temperature ?? 0
        };

        if (options?.maxOutputTokens) {
          body.max_completion_tokens = options.maxOutputTokens;
        }

        if (options?.jsonSchema) {
          body.response_format = {
            type: "json_schema",
            json_schema: {
              name: "meeting_review",
              strict: true,
              schema: options.jsonSchema
            }
          };
        } else if (options?.jsonMode) {
          body.response_format = {
            type: "json_object"
          };
        }

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const errText = await response.text();
          return res.status(response.status).json({ error: `Groq API Error: ${response.status} ${errText}` });
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content || "";
        return res.json({ content });

      } else {
        const generationConfig: any = {
          temperature: options?.temperature ?? 0
        };

        if (options?.maxOutputTokens) {
          generationConfig.maxOutputTokens = options.maxOutputTokens;
        }

        if (options?.jsonMode) {
          generationConfig.responseMimeType = "application/json";
        }

        const enhancedPrompt = options?.jsonMode
          ? `${user}\n\nتعليمات الإخراج:\n- أخرج JSON صالحًا فقط.\n- لا تستخدم Markdown.\n- قالب هذه المرحلة:\n${JSON.stringify(options.jsonTemplate || {})}`
          : user;

        const body = {
          contents: [
            {
              role: "user",
              parts: [{ text: enhancedPrompt }]
            }
          ],
          systemInstruction: {
            parts: [{ text: system }]
          },
          generationConfig
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const errText = await response.text();
          return res.status(response.status).json({ error: `Gemini API Error: ${response.status} ${errText}` });
        }

        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts;
        let content = "";
        if (Array.isArray(parts)) {
          content = parts.map((part: any) => part?.text || "").join("").trim();
        }
        return res.json({ content });
      }

    } catch (e: any) {
      console.error("Governance chat proxy error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/governance/transcribe", async (req, res) => {
    try {
      const { fileBase64, fileName, fileType } = req.body;
      if (!fileBase64) {
        return res.status(400).json({ error: "محتوى الملف الصوتي غير موجود." });
      }

      const config = await getSettingsFromFirestore();
      const apiKey = config.groq_api_key || process.env.GROQ_API_KEY || "";
      if (!apiKey) {
        return res.status(400).json({ error: "مفتاح Groq API Key غير مكون في الإعدادات." });
      }

      const buffer = Buffer.from(fileBase64, "base64");
      const blob = new Blob([buffer], { type: fileType || "audio/wav" });
      
      const formData = new FormData();
      formData.append("file", blob, fileName || "audio.wav");
      formData.append("model", "whisper-large-v3");
      formData.append("language", "ar");
      formData.append("response_format", "json");
      formData.append("temperature", "0");

      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: `Whisper Transcription Error: ${response.status} ${errText}` });
      }

      const data = await response.json();
      return res.json({ text: data?.text || "" });

    } catch (e: any) {
      console.error("Governance transcribe proxy error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/send-whatsapp-test", async (req, res) => {
    try {
      const { to_phone, role } = req.body;
      const result = await sendWhatsAppReport(role || "manager", to_phone);
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (e: any) {
      console.error("Unhandled Exception in sendWhatsAppReport:", e);
      res.status(500).json({ success: false, error: e.message, stack: e.stack });
    }
  });

  app.post("/api/export-pdf", async (req, res) => {
    let browser: any = null;
    try {
      const { html, css, fileName } = req.body;

      if (!html || typeof html !== "string") {
        return res.status(400).json({
          error: "محتوى التقرير غير موجود."
        });
      }

      const appOrigin = process.env.APP_ORIGIN || `${req.protocol}://${req.get("host")}`;

      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage"
        ]
      });

      const page = await browser.newPage();

      await page.setViewport({
        width: 1200,
        height: 1600,
        deviceScaleFactor: 1
      });

      const printHtml = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
          <head>
            <meta charset="UTF-8" />
            <style>
              @font-face {
                font-family: "IBM Plex Sans Arabic";
                src: url("${appOrigin}/fonts/IBMPlexSansArabic-Regular.woff2") format("woff2");
                font-weight: 400;
                font-style: normal;
              }
              @font-face {
                font-family: "IBM Plex Sans Arabic";
                src: url("${appOrigin}/fonts/IBMPlexSansArabic-Medium.woff2") format("woff2");
                font-weight: 500;
                font-style: normal;
              }
              @font-face {
                font-family: "IBM Plex Sans Arabic";
                src: url("${appOrigin}/fonts/IBMPlexSansArabic-SemiBold.woff2") format("woff2");
                font-weight: 600;
                font-style: normal;
              }
              @font-face {
                font-family: "IBM Plex Sans Arabic";
                src: url("${appOrigin}/fonts/IBMPlexSansArabic-Bold.woff2") format("woff2");
                font-weight: 700;
                font-style: normal;
              }

              @page {
                size: A4 portrait;
                margin: 14mm 13mm 16mm 13mm;
              }
              html, body {
                margin: 0;
                padding: 0;
                width: 100%;
                direction: rtl;
                text-align: right;
                background: #ffffff;
                color: #172033;
                font-family: "IBM Plex Sans Arabic", Arial, Tahoma, sans-serif;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              body {
                font-size: 13px;
                line-height: 1.8;
              }
              /* تنسيق التطبيق الحالي */
              ${css}
              /* تنسيقات PDF الإضافية */
              #report-content,
              #report-content * {
                font-family: "IBM Plex Sans Arabic", Arial, Tahoma, sans-serif !important;
                letter-spacing: normal !important;
                letter-spacing: 0 !important;
                word-spacing: normal !important;
              }
              #report-content {
                width: 100%;
                max-width: none;
                margin: 0;
                padding: 0;
                direction: rtl;
                text-align: right;
              }
              #report-content h1 {
                margin-top: 0;
                margin-bottom: 18px;
              }
              #report-content h2 {
                margin-top: 34px !important;
                margin-bottom: 16px !important;
                padding: 10px 14px;
                background: #f1f5f9;
                border-right: 4px solid #334155;
                page-break-after: avoid;
                break-after: avoid-page;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              #report-content h2:first-of-type {
                margin-top: 20px !important;
              }
              #report-content p {
                margin-top: 0;
                margin-bottom: 14px;
                line-height: 1.85;
              }
              #report-content ul, #report-content ol {
                margin-top: 8px;
                margin-bottom: 20px;
                padding-right: 24px;
              }
              #report-content li {
                margin-bottom: 9px;
                line-height: 1.75;
              }
              #report-content table {
                width: 100%;
                table-layout: fixed;
                border-collapse: collapse;
                margin-top: 12px;
                margin-bottom: 24px;
                font-size: 10px;
              }
              #report-content thead {
                display: table-header-group;
              }
              #report-content tr {
                page-break-inside: avoid;
                break-inside: avoid-page;
              }
              #report-content th, #report-content td {
                border: 1px solid #94a3b8;
                padding: 8px 6px;
                direction: rtl;
                text-align: right;
                vertical-align: middle;
                overflow-wrap: anywhere;
              }
              #report-content th {
                background: #e2e8f0;
                font-weight: 700;
                text-align: center;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              #report-content th:nth-child(1), #report-content td:nth-child(1) {
                width: 52%;
              }
              #report-content th:nth-child(2), #report-content td:nth-child(2) {
                width: 18%;
              }
              #report-content th:nth-child(3), #report-content td:nth-child(3) {
                width: 18%;
                text-align: center;
              }
              #report-content th:nth-child(4), #report-content td:nth-child(4) {
                width: 12%;
                text-align: center;
              }
              #report-content hr {
                display: none;
              }
              /* منع قص نهاية التقرير */
              #report-content::after {
                content: "";
                display: block;
                height: 20mm;
              }
            </style>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `;

      await page.setContent(printHtml, {
        waitUntil: ["load", "networkidle0"]
      });

      /* انتظار تحميل الخطوط */
      await page.evaluate(async () => {
        if ("fonts" in document) {
          await document.fonts.ready;
          try {
            await Promise.all([
              document.fonts.load('400 13px "IBM Plex Sans Arabic"'),
              document.fonts.load('500 13px "IBM Plex Sans Arabic"'),
              document.fonts.load('600 13px "IBM Plex Sans Arabic"'),
              document.fonts.load('700 18px "IBM Plex Sans Arabic"')
            ]);
          } catch (e) {
            console.warn("Error waiting for fonts load:", e);
          }
        }
      });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        margin: {
          top: "14mm",
          right: "13mm",
          bottom: "18mm",
          left: "13mm"
        }
      });

      const safeName = (fileName || "تقرير الاجتماع.pdf")
        .replace(/[\\/:*?"<>|]/g, "-");

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`
      );
      res.setHeader("Content-Length", pdfBuffer.length.toString());

      return res.send(Buffer.from(pdfBuffer));
    } catch (error: any) {
      console.error("Puppeteer PDF Error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "فشل تصدير ملف PDF."
      });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  });

  async function startDevServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server executing natively on http://0.0.0.0:${PORT}`);
    });
  }
}

if (!process.env.VERCEL) {
  startDevServer();
} else {
  // On Vercel, serve static files (Vite build output) as fallback for unmatched routes
  app.use(express.static(path.join(process.cwd(), "dist")));
}

export default app;
