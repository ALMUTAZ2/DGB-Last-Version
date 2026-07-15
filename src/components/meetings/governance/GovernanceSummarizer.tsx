import React, { useState, useEffect } from 'react';
import { FileText, Upload, Play, CheckCircle2, Circle, Loader2, Copy, FileDown, Mic, Activity, Settings, X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { governanceService, initialSteps, GovernanceStep, updateGroqClient, getGroqApiKey, getArabicDayName } from './governanceService';

export default function GovernanceSummarizer() {
  const [activeTab, setActiveTab] = useState<'text' | 'audio'>('text');
  const [transcript, setTranscript] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [steps, setSteps] = useState<GovernanceStep[]>(initialSteps);
  const [finalReport, setFinalReport] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [showSettings, setShowSettings] = useState(false);
  const [isSettingsUnlocked, setIsSettingsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  
  const [isCopied, setIsCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [isSavingKeys, setIsSavingKeys] = useState(false);

  useEffect(() => {
    // Local storage quick read
    setApiKeyInput(localStorage.getItem("GROQ_API_KEY") || getGroqApiKey());
    setGeminiKeyInput(localStorage.getItem("GEMINI_API_KEY") || "");

    // Fetch from Firestore
    fetch("/api/whatsapp-config")
      .then(res => res.json())
      .then(data => {
        if (data.groq_api_key) {
          setApiKeyInput(data.groq_api_key);
          localStorage.setItem("GROQ_API_KEY", data.groq_api_key);
        }
        if (data.gemini_api_key) {
          setGeminiKeyInput(data.gemini_api_key);
          localStorage.setItem("GEMINI_API_KEY", data.gemini_api_key);
        }
      })
      .catch(err => console.error("Error loading keys from Firestore:", err));
  }, []);

  const handleVerifyPin = () => {
    if (pinInput === "100889*") {
      setIsSettingsUnlocked(true);
      setPinError("");
    } else {
      setPinError("كلمة السر خاطئة، ليس لديك صلاحيات التعديل");
    }
  };

  const saveApiKey = async () => {
    setIsSavingKeys(true);
    try {
      localStorage.setItem("GROQ_API_KEY", apiKeyInput);
      localStorage.setItem("GEMINI_API_KEY", geminiKeyInput);
      updateGroqClient();

      const response = await fetch("/api/whatsapp-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groq_api_key: apiKeyInput,
          gemini_api_key: geminiKeyInput
        })
      });

      if (!response.ok) {
        throw new Error("فشل الحفظ في قاعدة البيانات");
      }

      setShowSettings(false);
      setIsSettingsUnlocked(false);
      setPinInput('');
      alert('تم حفظ مفاتيح API بنجاح في قاعدة البيانات.');
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ الإعدادات: ' + err.message);
    } finally {
      setIsSavingKeys(false);
    }
  };

  const updateStep = (id: number, status: GovernanceStep['status']) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  const setTodayDate = () => {
    setMeetingDate(new Date().toISOString().split('T')[0]);
  };

  const handleStart = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      setFinalReport(null);
      setSteps(initialSteps);

      let currentTranscript = transcript;

      // If audio is selected, transcribe first
      if (activeTab === 'audio') {
        if (!audioFile) throw new Error("الرجاء إرفاق ملف صوتي");
        updateStep(1, 'loading'); // Re-using step 1 or treating transcription as pre-step
        currentTranscript = await governanceService.transcribeAudio(audioFile);
      } else {
        if (!currentTranscript.trim()) throw new Error("الرجاء إدخال نص الاجتماع");
      }

      // Process using new chunking pipeline
      const finalReportText = await governanceService.processTranscript(currentTranscript, updateStep, meetingTitle, meetingDate, getArabicDayName(meetingDate));
      
      setFinalReport(finalReportText);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "حدث خطأ أثناء المعالجة");
      // Mark current loading step as error
      setSteps(prev => prev.map(s => s.status === 'loading' ? { ...s, status: 'error' } : s));
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = async () => {
    if (finalReport) {
      try {
        await navigator.clipboard.writeText(finalReport);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy", err);
      }
    }
  };

  const exportWord = async () => {
    if (!finalReport || isExportingWord) return;

    setIsExportingWord(true);

    try {
      const reportElement = document.getElementById("report-content");
      if (!reportElement) {
        throw new Error("لم يتم العثور على محتوى التقرير.");
      }

      /*
       * إنشاء نسخة من محتوى التقرير لتجنب التأثير على العرض الأصلي.
       */
      const reportClone = reportElement.cloneNode(true) as HTMLElement;

      /*
       * إزالة أي عناصر غير مرغوب فيها مثل الفواصل الأفقية.
       */
      reportClone.querySelectorAll("hr").forEach(hr => hr.remove());

      /*
       * تهيئة وتنسيق الجداول لتظهر بشكل احترافي ومنسق في Word.
       */
      reportClone.querySelectorAll("table").forEach((table: any) => {
        table.setAttribute("border", "1");
        table.setAttribute("cellspacing", "0");
        table.setAttribute("cellpadding", "8");
        table.style.borderCollapse = "collapse";
        table.style.width = "100%";
        table.style.direction = "rtl";
        table.style.textAlign = "right";
        table.style.marginTop = "15px";
        table.style.marginBottom = "15px";
        table.style.fontFamily = "Arial, Tahoma, sans-serif";
      });

      reportClone.querySelectorAll("th").forEach((th: any) => {
        th.style.backgroundColor = "#f1f5f9";
        th.style.color = "#0f172a";
        th.style.fontWeight = "bold";
        th.style.border = "1px solid #cbd5e1";
        th.style.textAlign = "right";
        th.style.padding = "10px";
        th.style.fontSize = "11pt";
      });

      reportClone.querySelectorAll("td").forEach((td: any) => {
        td.style.border = "1px solid #cbd5e1";
        td.style.textAlign = "right";
        td.style.padding = "10px";
        td.style.fontSize = "11.5pt";
      });

      /*
       * تنسيق القوائم لتدعم اتجاه اليمين إلى اليسار (RTL) بشكل مثالي.
       */
      reportClone.querySelectorAll("ul, ol").forEach((list: any) => {
        list.style.direction = "rtl";
        list.style.textAlign = "right";
        list.style.marginRight = "24px";
        list.style.paddingRight = "10px";
        list.style.marginTop = "5px";
        list.style.marginBottom = "15px";
      });

      reportClone.querySelectorAll("li").forEach((li: any) => {
        li.style.direction = "rtl";
        li.style.textAlign = "right";
        li.style.marginBottom = "8px";
        li.style.fontSize = "12pt";
        li.style.lineHeight = "1.6";
      });

      /*
       * تنسيق الفقرات والنصوص العادية.
       */
      reportClone.querySelectorAll("p").forEach((p: any) => {
        p.style.direction = "rtl";
        p.style.textAlign = "right";
        p.style.lineHeight = "1.7";
        p.style.marginBottom = "12px";
        p.style.marginTop = "0px";
        p.style.fontSize = "12pt";
        p.style.color = "#1e293b";
      });

      /*
       * تنسيق العناوين الرئيسية والفرعية بلمسة جمالية.
       */
      reportClone.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((heading: any) => {
        heading.style.direction = "rtl";
        heading.style.textAlign = "right";
        heading.style.color = "#0f172a";
        heading.style.fontWeight = "bold";
        heading.style.marginTop = "24px";
        heading.style.marginBottom = "12px";
        heading.style.fontFamily = "Arial, Tahoma, sans-serif";
      });

      reportClone.querySelectorAll("h1").forEach((h1: any) => {
        h1.style.fontSize = "22pt";
        h1.style.borderBottom = "2px solid #334155";
        h1.style.paddingBottom = "8px";
        h1.style.color = "#0f172a";
      });

      reportClone.querySelectorAll("h2").forEach((h2: any) => {
        h2.style.fontSize = "16pt";
        h2.style.borderRight = "5px solid #0284c7";
        h2.style.paddingRight = "12px";
        h2.style.backgroundColor = "#f8fafc";
        h2.style.paddingTop = "8px";
        h2.style.paddingBottom = "8px";
        h2.style.color = "#0f172a";
      });

      reportClone.querySelectorAll("h3").forEach((h3: any) => {
        h3.style.fontSize = "13.5pt";
        h3.style.color = "#0369a1";
      });

      const contentHtml = reportClone.innerHTML;

      /*
       * تغليف المحتوى بترميز HTML و XML لـ MS Word لضمان RTL السليم.
       * نستخدم UTF-8 BOM (\ufeff) لكي يعرض Word الحروف العربية بشكل صحيح.
       */
      const wordDocumentHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <title>${meetingTitle}</title>
          <!--[if gte mso 9]>
          <xml>
            <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>100</w:Zoom>
              <w:DoNotOptimizeForBrowser/>
            </w:WordDocument>
          </xml>
          <![endif]-->
          <style>
            body {
              font-family: "Arial", "Tahoma", "Segoe UI", sans-serif;
              direction: rtl;
              text-align: right;
              line-height: 1.6;
              font-size: 12pt;
              background-color: #ffffff;
              color: #1e293b;
            }
            .WordSection1 {
              direction: rtl; 
              unicode-bidi: embed;
            }
          </style>
        </head>
        <body lang="AR-SA" style="tab-interval:.5in; margin: 1in;">
          <div class="WordSection1">
            ${contentHtml}
          </div>
        </body>
        </html>
      `;

      const blob = new Blob(['\ufeff' + wordDocumentHtml], {
        type: "application/msword;charset=utf-8"
      });

      const meetingDay = getArabicDayName(meetingDate);
      const safeTitle = (meetingTitle.trim() || "تقرير الاجتماع")
        .replace(/[\\/:*?"<>|]/g, "-")
        .trim();

      const filenameParts = [
        safeTitle,
        meetingDate,
        meetingDay
      ].filter(Boolean);

      const wordFileName = `${filenameParts.join(" - ")}.doc`;

      // تحميل الملف برمجياً للمستخدم
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = wordFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

    } catch (error: any) {
      console.error(error);
      const message = error instanceof Error ? error.message : "خطأ غير معروف";
      alert(`حدث خطأ أثناء تصدير ملف Word:\n${message}`);
    } finally {
      setIsExportingWord(false);
    }
  };

 const exportPDF = async () => {
  if (!finalReport || isExporting) return;

  setIsExporting(true);

  let exportContainer: HTMLDivElement | null = null;
  let exportStyle: HTMLStyleElement | null = null;

  try {
    const reportElement =
      document.getElementById("report-content");

    if (!reportElement) {
      throw new Error(
        "لم يتم العثور على محتوى التقرير."
      );
    }

    /*
     * إنشاء نسخة من محتوى التقرير.
     */
    const reportClone =
      reportElement.cloneNode(true) as HTMLElement;

    reportClone.removeAttribute("id");
    reportClone.removeAttribute("class");
    reportClone.setAttribute("dir", "rtl");

    /*
     * إزالة الفواصل الأفقية الناتجة من Markdown.
     */
    reportClone
      .querySelectorAll("hr")
      .forEach(hr => hr.remove());

    /*
     * إزالة تنسيقات Tailwind من نسخة PDF فقط.
     */
    reportClone
      .querySelectorAll<HTMLElement>("*")
      .forEach(node => {
        node.removeAttribute("class");
        node.removeAttribute("style");
      });

    /*
     * نعتمد على الهيكل الطبيعي للمستند المستخرج من الـ Markdown مباشرة، 
     * والذي يحتوي على العناوين والفقرات والجداول مرتبة بشكل ممتاز.
     */

    /*
     * حاوية مؤقتة داخل الصفحة.
     * لا نستخدم iframe لتفادي توقف التصدير.
     */
    exportContainer =
      document.createElement("div");

    exportContainer.id =
      "pdf-export-container";

    exportContainer.setAttribute(
      "dir",
      "rtl"
    );

    exportContainer.style.position =
      "fixed";

    exportContainer.style.left =
      "-10000px";

    exportContainer.style.top =
      "0";

    exportContainer.style.width =
      "210mm";

    exportContainer.style.minHeight =
      "297mm";

    exportContainer.style.backgroundColor =
      "#ffffff";

    exportContainer.style.visibility =
      "visible";

    exportContainer.style.opacity =
      "1";

    exportContainer.style.pointerEvents =
      "none";

    exportContainer.style.zIndex =
      "-9999";

    /*
     * الغلاف الداخلي بحجم مناسب لورقة A4.
     */
    const pdfWrapper =
      document.createElement("main");

    pdfWrapper.className =
      "pdf-wrapper";

    pdfWrapper.appendChild(reportClone);

    const endSpacer =
      document.createElement("div");

    endSpacer.className =
      "pdf-end-spacer";

    pdfWrapper.appendChild(endSpacer);

    exportContainer.appendChild(pdfWrapper);

    /*
     * CSS خاص بالـPDF فقط.
     */
    exportStyle =
      document.createElement("style");

    exportStyle.id =
      "pdf-export-styles";

    exportStyle.textContent = `
      #pdf-export-container,
      #pdf-export-container * {
        box-sizing: border-box;
      }

      #pdf-export-container {
        direction: rtl;
        text-align: right;
        background: #ffffff;
        color: #1e293b;
        font-family: Arial, Tahoma, "Segoe UI", sans-serif;
      }

      #pdf-export-container .pdf-wrapper {
        width: 182mm;
        margin: 0 auto;
        padding: 8mm 4mm 16mm;
        direction: rtl;
        text-align: right;
        overflow: visible;
        background: #ffffff;
      }

      /* تنسيق العنوان الرئيسي للاجتماع (H1) */
      #pdf-export-container h1 {
        font-size: 24px;
        color: #0f172a;
        font-weight: 700;
        margin-top: 0;
        margin-bottom: 5mm;
        padding-bottom: 3mm;
        border-bottom: 2.5px solid #cbd5e1;
        line-height: 1.45;
      }

      /* تنسيق تفاصيل تاريخ ويوم الاجتماع أسفل العنوان مباشرة */
      #pdf-export-container h1 + p {
        font-size: 13.5px;
        color: #475569;
        margin-top: 0;
        margin-bottom: 8mm;
        border-bottom: 1px dashed #e2e8f0;
        padding-bottom: 4mm;
        font-weight: 500;
      }

      /* تنسيق العناوين والمحاور الرئيسية للاجتماع (H2) */
      #pdf-export-container h2 {
        display: block;
        width: 100%;
        font-size: 18px;
        color: #0f172a;
        font-weight: 700;
        margin-top: 11mm; /* مسافة علوية ممتازة وواضحة جداً تفصل المحور عن المحور السابق */
        margin-bottom: 4.5mm; /* مسافة مناسبة تحت المحور مباشرة قبل المحتوى الخاص به */
        padding-bottom: 2mm;
        border-bottom: 1.5px solid #cbd5e1; /* خط تجميلي يفصل المحور */
        page-break-after: avoid;
        break-after: avoid-page;
      }

      /* المحور الأول بعد كتلة العنوان والتاريخ يجب أن لا يبتعد كثيراً من الأعلى */
      #pdf-export-container h1 + p + h2,
      #pdf-export-container .pdf-wrapper > h2:first-of-type {
        margin-top: 2mm;
      }

      /* تنسيق العناوين الفرعية (H3) */
      #pdf-export-container h3 {
        font-size: 14.5px;
        color: #0369a1;
        font-weight: 700;
        margin-top: 5mm;
        margin-bottom: 2.5mm;
        page-break-after: avoid;
        break-after: avoid-page;
      }

      /* تنسيق الفقرات والنصوص العادية */
      #pdf-export-container p {
        font-size: 12.5px;
        line-height: 1.85;
        color: #334155;
        margin-top: 0;
        margin-bottom: 4mm;
        text-align: justify;
      }

      /* جعل النصوص العريضة واضحة */
      #pdf-export-container strong,
      #pdf-export-container b {
        font-weight: 700;
        color: #0f172a;
      }

      /* تنسيق القوائم النقطية والرقمية بمسافات هوامش مريحة للعين */
      #pdf-export-container ul,
      #pdf-export-container ol {
        margin-top: 1mm;
        margin-bottom: 5mm;
        padding-right: 6mm;
        padding-left: 0;
        direction: rtl;
        text-align: right;
      }

      #pdf-export-container li {
        font-size: 12.5px;
        line-height: 1.8;
        color: #334155;
        margin-bottom: 2.5mm;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      #pdf-export-container li::marker {
        color: #0284c7;
      }

      /* تنسيق الجداول والمهام المطلوبة لتظهر بشكل احترافي */
      #pdf-export-container table {
        width: 100%;
        max-width: 100%;
        margin-top: 4mm;
        margin-bottom: 6mm;
        border-collapse: collapse;
        border-spacing: 0;
        table-layout: fixed;
        direction: rtl;
        text-align: right;
        font-size: 11px;
        page-break-inside: auto;
        break-inside: auto;
      }

      #pdf-export-container thead {
        display: table-header-group;
      }

      #pdf-export-container tbody {
        display: table-row-group;
      }

      #pdf-export-container tr {
        page-break-inside: avoid !important;
        break-inside: avoid-page !important;
      }

      #pdf-export-container th,
      #pdf-export-container td {
        border: 1px solid #cbd5e1;
        padding: 2.5mm 3mm;
        vertical-align: middle;
        direction: rtl;
        text-align: right;
        white-space: normal;
        overflow-wrap: anywhere;
        line-height: 1.6;
      }

      #pdf-export-container th {
        background: #f1f5f9;
        color: #0f172a;
        font-weight: 700;
        text-align: center;
      }

      /* توزيع عرض أعمدة جدول المهام بشكل متناسق (المهمة | المسؤول | الموعد النهائي | الحالة) */
      #pdf-export-container th:nth-child(1),
      #pdf-export-container td:nth-child(1) {
        width: 52%;
      }

      #pdf-export-container th:nth-child(2),
      #pdf-export-container td:nth-child(2) {
        width: 18%;
      }

      #pdf-export-container th:nth-child(3),
      #pdf-export-container td:nth-child(3) {
        width: 18%;
        text-align: center;
      }

      #pdf-export-container th:nth-child(4),
      #pdf-export-container td:nth-child(4) {
        width: 12%;
        text-align: center;
      }

      #pdf-export-container a {
        color: inherit;
        text-decoration: none;
      }

      #pdf-export-container code,
      #pdf-export-container pre {
        font-family: "Courier New", monospace;
        white-space: pre-wrap;
      }

      .pdf-end-spacer {
        display: block;
        width: 100%;
        height: 15mm;
        min-height: 15mm;
        clear: both;
      }
    `;

    document.head.appendChild(exportStyle);
    document.body.appendChild(exportContainer);

    /*
     * انتظار تطبيق CSS واحتساب ارتفاع العناصر.
     */
    await new Promise<void>(resolve =>
      window.setTimeout(resolve, 500)
    );

    /*
     * انتظار تحميل الخطوط الموجودة في الصفحة.
     */
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    await new Promise<void>(resolve =>
      window.setTimeout(resolve, 200)
    );

    const contentHeight =
      Math.ceil(
        Math.max(
          pdfWrapper.scrollHeight,
          pdfWrapper.getBoundingClientRect().height
        )
      );

    /*
     * تثبيت ارتفاع الحاوية ليشمل آخر سطر.
     */
    exportContainer.style.height =
      `${contentHeight + 200}px`;

    await new Promise<void>(resolve =>
      window.setTimeout(resolve, 200)
    );

    const meetingDay =
      getArabicDayName(meetingDate);

    const safeTitle =
      (
        meetingTitle.trim() ||
        "تقرير الاجتماع"
      )
        .replace(/[\\/:*?"<>|]/g, "-")
        .trim();

    const filenameParts = [
      safeTitle,
      meetingDate,
      meetingDay
    ].filter(Boolean);

    const pdfFileName =
      `${filenameParts.join(" - ")}.pdf`;

    const html2pdfModule =
      await import("html2pdf.js");

    const html2pdf =
      html2pdfModule.default ||
      html2pdfModule;

    if (
      typeof html2pdf !==
      "function"
    ) {
      throw new Error(
        "تعذر تحميل مكتبة تصدير PDF."
      );
    }

    const options = {
      margin: [15, 12, 20, 12] as [
        number,
        number,
        number,
        number
      ],

      filename: pdfFileName,

      image: {
        type: "jpeg" as const,
        quality: 0.98
      },

      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1200,
        windowHeight:
          contentHeight + 250,
        letterRendering: true,
        foreignObjectRendering: false
      },

      jsPDF: {
        unit: "mm" as const,
        format: "a4" as const,
        orientation: "portrait" as const,
        compress: true
      },

      pagebreak: {
        mode: [
          "css",
          "legacy"
        ] as (
          | "css"
          | "legacy"
        )[],

        avoid: [
          "tr",
          "thead",
          "h1",
          "h2",
          "h3",
          "li"
        ]
      }
    };

    await html2pdf()
      .set(options)
      .from(pdfWrapper)
      .save();
  } catch (error) {
    console.error(
      "Error generating PDF:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "خطأ غير معروف";

    alert(
      `حدث خطأ أثناء تصدير ملف PDF:\n${message}`
    );
  } finally {
    exportContainer?.remove();
    exportStyle?.remove();

    setIsExporting(false);
  }
};
  return (
    <div className="space-y-6">
      <div className="flex justify-end print:hidden mb-2">
        <button 
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all text-sm"
        >
          <Settings size={16} />
          إعدادات المفتاح (API Key)
        </button>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 print:hidden mb-6"
          >
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
              <h3 className="text-xl font-bold text-slate-800">إعدادات مفاتيح الربط (API Keys)</h3>
              <button 
                onClick={() => {
                  setShowSettings(false);
                  setIsSettingsUnlocked(false);
                  setPinInput('');
                  setPinError('');
                }} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            {!isSettingsUnlocked ? (
              <div className="flex flex-col items-center justify-center py-8 max-w-sm mx-auto text-center">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-4 animate-pulse">
                  <Settings size={32} />
                </div>
                <h4 className="text-lg font-bold text-slate-800 mb-2">الدخول الآمن لإعدادات المفاتيح</h4>
                <p className="text-xs text-slate-400 mb-6">الرجاء إدخال الرقم السري المكون من 6 رموز للوصول والتعديل</p>
                
                <div className="w-full space-y-4">
                  <input 
                    type="password"
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      setPinError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleVerifyPin();
                    }}
                    placeholder="أدخل الرقم السري هنا..."
                    className="w-full text-center px-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 font-sans tracking-widest text-lg focus:outline-none"
                    dir="ltr"
                  />
                  
                  {pinError && (
                    <motion.p 
                      initial={{ opacity: 0, y: -5 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="text-red-500 text-xs font-bold"
                    >
                      {pinError}
                    </motion.p>
                  )}

                  <button 
                    onClick={handleVerifyPin}
                    className="w-full bg-slate-900 text-white py-3 rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                  >
                    تأكيد الرقم السري
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Groq API Key (لاستخراج البيانات)</label>
                    <input 
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="gsk_..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 font-mono text-left"
                      dir="ltr"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Gemini API Key (لبناء التقرير النهائي)</label>
                    <input 
                      type="password"
                      value={geminiKeyInput}
                      onChange={(e) => setGeminiKeyInput(e.target.value)}
                      placeholder="AIza..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 font-mono text-left"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button 
                    onClick={() => {
                      setIsSettingsUnlocked(false);
                      setPinInput('');
                    }}
                    className="px-6 py-3 border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                  >
                    قفل الإعدادات
                  </button>
                  <button 
                    onClick={saveApiKey}
                    disabled={isSavingKeys}
                    className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSavingKeys ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    حفظ في قاعدة البيانات
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 print:hidden">
        <h3 className="text-xl font-bold text-slate-800 mb-6">بيانات الاجتماع</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">عنوان الاجتماع</label>
            <input 
              type="text"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder="مثال: الاجتماع الأسبوعي لمراجعة الأداء"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              disabled={isProcessing}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center justify-between">
              تاريخ الاجتماع
              <button 
                onClick={setTodayDate}
                className="text-xs text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md transition-colors"
                disabled={isProcessing}
              >
                اليوم
              </button>
            </label>
            <input 
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
              disabled={isProcessing}
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">يوم الاجتماع</label>
            <input 
              type="text"
              value={getArabicDayName(meetingDate) || "جاري التحديد..."}
              className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 font-bold outline-none cursor-not-allowed"
              disabled={true}
              placeholder="سيتم تحديده تلقائياً"
            />
          </div>
        </div>

        <h3 className="text-xl font-bold text-slate-800 mb-4">إدخال محتوى الاجتماع</h3>
        
        <div className="flex gap-4 mb-6 border-b border-slate-100 pb-4">
          <button 
            onClick={() => setActiveTab('text')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${activeTab === 'text' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <FileText size={18} />
            الإدخال النصي المباشر
          </button>
          <button 
            onClick={() => setActiveTab('audio')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${activeTab === 'audio' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Mic size={18} />
            رفع ملف صوتي
          </button>
        </div>

        {activeTab === 'text' && (
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="الصق التفريغ النصي للاجتماع هنا..."
            className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
            disabled={isProcessing}
          />
        )}

        {activeTab === 'audio' && (
          <div className="w-full h-48 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer relative">
            <input 
              type="file" 
              accept="audio/*" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && file.size > 25 * 1024 * 1024) {
                  alert("حجم الملف يجب أن لا يتجاوز 25 ميجابايت (الحد الأقصى المسموح به).");
                  e.target.value = '';
                  setAudioFile(null);
                } else {
                  setAudioFile(file || null);
                }
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isProcessing}
            />
            <Upload size={32} className="text-slate-400 mb-2" />
            <p className="font-bold text-slate-600">{audioFile ? audioFile.name : 'اسحب أو انقر لرفع ملف صوتي (MP3, WAV, M4A)'}</p>
            <p className="text-xs text-slate-400 mt-1">يتم تحويل الصوت بدقة عالية عبر Whisper-Large-V3 (الحد الأقصى: 25MB)</p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={handleStart}
            disabled={isProcessing || (activeTab === 'text' && !transcript.trim()) || (activeTab === 'audio' && !audioFile)}
            className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg"
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
           
           {isProcessing ? 'جاري إعداد الملخص التنفيذي...' : 'تلخيص الاجتماع'}
          </button>
          
          {error && <p className="text-red-500 font-bold text-sm">{error}</p>}
        </div>
      </div>

      {(isProcessing || finalReport) && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 print:block print:w-full">
          {/* Progress Sidebar */}
          <div className="lg:col-span-1 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-fit print:hidden">
            <h4 className="font-bold text-slate-800 mb-6">مراحل التحليل (AI)</h4>
            <div className="space-y-6">
              {steps.map((step, idx) => (
                <div key={step.id} className="flex items-start gap-4 relative">
                  {idx !== steps.length - 1 && (
                    <div className="absolute top-6 bottom-[-24px] right-[11px] w-[2px] bg-slate-100"></div>
                  )}
                  <div className="relative z-10 bg-white">
                    {step.status === 'success' ? (
                      <CheckCircle2 size={24} className="text-emerald-500" />
                    ) : step.status === 'loading' ? (
                      <Loader2 size={24} className="text-blue-500 animate-spin" />
                    ) : step.status === 'error' ? (
                      <Circle size={24} className="text-red-500" />
                    ) : (
                      <Circle size={24} className="text-slate-200" />
                    )}
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${step.status === 'success' ? 'text-emerald-700' : step.status === 'loading' ? 'text-blue-700' : 'text-slate-500'}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {step.status === 'loading' && 'جاري العمل بواسطة الوكيل الذكي...'}
                      {step.status === 'success' && 'اكتملت المهمة بنجاح'}
                      {step.status === 'pending' && 'في انتظار التنفيذ'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Final Report Viewer */}
          <div className="lg:col-span-3">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 min-h-[500px] relative">
              {!finalReport && isProcessing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="mb-4"
                  >
                    <Activity size={48} className="text-emerald-200" />
                  </motion.div>
<p className="font-bold">يتم الآن إعداد الملخص التنفيذي للاجتماع...</p>
                  <p className="text-sm mt-2">قد يستغرق الأمر دقيقة إلى دقيقتين</p>
                </div>
              )}
              
              {finalReport && (
                <div>
                  <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100 print:hidden">
<h2 className="text-2xl font-bold text-slate-900">الملخص التنفيذي للاجتماع</h2>
                    <div className="flex gap-3">
                      <button onClick={copyToClipboard} className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-all">
                        {isCopied ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />}
                        {isCopied ? 'تم النسخ' : 'نسخ'}
                      </button>
                      <button onClick={exportPDF} disabled={isExporting} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl font-bold hover:bg-emerald-100 transition-all disabled:opacity-50">
                        {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                        {isExporting ? 'جاري التصدير...' : 'تصدير PDF'}
                      </button>
                      <button onClick={exportWord} disabled={isExportingWord} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl font-bold hover:bg-blue-100 transition-all disabled:opacity-50">
                        {isExportingWord ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                        {isExportingWord ? 'جاري التصدير...' : 'تصدير Word'}
                      </button>
                    </div>
                  </div>
                  
                  <div id="report-content" className="prose prose-slate prose-headings:font-bold prose-headings:text-slate-900 prose-a:text-emerald-600 prose-p:text-slate-700 prose-li:text-slate-700 max-w-none print:m-0 print:p-0" dir="rtl">
                    <Markdown remarkPlugins={[remarkGfm]}>{finalReport}</Markdown>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
