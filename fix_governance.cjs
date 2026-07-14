const fs = require('fs');

const code = `
export const getGroqApiKey = () => {
  return localStorage.getItem("GROQ_API_KEY") || "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";
};

export const getGeminiApiKey = () => {
  return localStorage.getItem("GEMINI_API_KEY") || "";
};

export const updateGroqClient = () => {
  // Not needed since we fetch directly
};

export interface GovernanceStep {
  id: number;
  label: string;
  status: 'pending' | 'loading' | 'success' | 'error';
}

export const initialSteps: GovernanceStep[] = [
  { id: 1, label: "تنظيف النص وترتيبه (AI)", status: 'pending' },
  { id: 2, label: "تحليل النص وإنتاج التقرير التنفيذي (AI)", status: 'pending' }
];

const CLEAN_PROMPT = \`You are an AI Meeting Transcript Cleaner.

Your ONLY responsibility is to clean and normalize raw meeting transcripts.

You are NOT allowed to summarize, analyze, interpret, infer, evaluate or remove meaningful information.

Your output will be used by another AI model for executive analysis.

Your objective is to maximize transcript quality while preserving every meaningful detail.

Rules

1. Preserve the original chronological order.
2. Preserve every meaningful statement.
3. Preserve speaker names exactly as provided.
4. Merge consecutive utterances from the same speaker into one coherent paragraph.
5. Remove timestamps.
6. Remove filler words only when they do not change meaning.
7. Remove duplicated words and duplicated sentences caused by speech recognition.
8. Correct obvious ASR transcription errors only when the intended wording is obvious.
9. Never guess missing words.
10. Never complete unfinished sentences.
11. Preserve every question.
12. Preserve every answer.
13. Preserve every discussion point.
14. Preserve every decision.
15. Preserve every action item.
16. Preserve every responsibility.
17. Preserve every deadline.
18. Preserve every risk.
19. Preserve every disagreement.
20. Preserve all numbers exactly.
21. Preserve all dates.
22. Preserve all percentages.
23. Preserve all project names.
24. Preserve all locations.
25. Preserve all technical terminology.
26. Preserve mixed Arabic and English exactly.
27. Preserve abbreviations exactly.
28. Preserve IDs, codes and ticket numbers.
29. Keep natural readable paragraphs.
30. Never summarize.
31. Never shorten.
32. Never omit meaningful information.
33. Never add information.
34. Optimize readability for downstream LLM analysis.

Output Requirements:
Output ONLY the cleaned transcript. 
Format: 
Speaker Name: Paragraph
[Single Line Break]
Speaker Name: Paragraph

Strict Formatting Rules:
- Separate different speakers using standard line breaks (\\\\n).
- Do NOT use markdown bold (no **), headers (no #), or bullet points.
- No JSON. 
- No explanations. 
- No notes.\`;

const REPORT_PROMPT = \`You are an Executive Meeting Intelligence Analyst.

You receive a cleaned meeting transcript.

Your responsibility is to produce an executive briefing suitable for CEOs, Vice Presidents and Directors.

Your report must allow a senior executive to understand the meeting in under two minutes.

Accurately comprehend corporate dialects, professional slang, or mixed Arabic/English phrases and express their intended business meaning in formal Modern Standard Arabic.

Never rewrite the transcript.
Never invent information.
Never assume facts.
Never create tasks, decisions or deadlines that were not explicitly discussed.

If information does not exist, explicitly state that it was not discussed.

Write in professional Modern Standard Arabic.
Maximum length: one page.

Prioritize executive value over conversation details.
Ignore greetings and casual conversation.
Merge related discussions.
Eliminate repetition.

Focus on:
• Decisions
• Business impact
• Progress
• Risks
• Delays
• Responsibilities
• Follow-up items
• Executive attention

Generate EXACTLY the following report in pure Markdown format.
CRITICAL: DO NOT OUTPUT JSON.

Formatting Rules (STRICT):
- Each bullet point MUST be on its own separate line.
- ALWAYS insert a line break after every bullet point.
- NEVER place multiple bullet points in the same line.
- Leave one empty line after each section.

================================================

وصف الاجتماع

اكتب وصفًا مختصرًا وواضحًا عما دار في الاجتماع كنص واحد (بدون نقاط).

================================================

تصنيف الاجتماع

Identify the closest meeting type:

• اجتماع إداري
• اجتماع تشغيلي
• مراجعة أداء
• متابعة مشروع
• اجتماع فني
• اجتماع مع عميل
• ورشة عمل
• عصف ذهني
• مناقشة مشكلة
• اتخاذ قرار
• أخرى

================================================

أهم المؤشرات

List only metrics explicitly mentioned.

Formatting:
- Each item MUST be on a new line starting with "•"

Examples:

• KPIs  
• Percentages  
• Progress  
• Budgets  
• Financial values  
• Project status  

If none exist:

لم يتم مناقشة مؤشرات أداء.

================================================

القرارات المتخذة

Formatting:
- Each decision MUST be on a new line starting with "•"

Otherwise:

لا توجد قرارات صريحة.

================================================

المهام المطلوبة

Create a standard Markdown table with the following columns:

| المهمة | المسؤول | الموعد النهائي | الحالة |
|---|---|---|---|

If any value is missing:

غير محدد

If no tasks exist:

لا توجد مهام محددة.

================================================

المخاطر والمعوقات

Formatting:
- Each risk MUST be on a new line starting with "•"

If none:

لم يتم مناقشة مخاطر أو معوقات.

================================================

النقاط التي تحتاج متابعة

Formatting:
- Each item MUST be on a new line starting with "•"

If none:

لا توجد عناصر متابعة.

================================================

ما يحتاج انتباه الإدارة

Formatting:
- Each item MUST be on a new line starting with "•"

If none:

لا يتطلب أي إجراء من الإدارة حالياً.

================================================

الخلاصة التنفيذية

Write ONE short paragraph (maximum 4 lines).

Answer one question:

"If an executive reads only this paragraph, what must they know?"

================================================

Output ONLY the report in pure text/markdown.\`;

const CLEAN_MODELS = [
  { provider: "gemini", model: "gemini-3.1-flash-lite" },
  { provider: "groq", model: "qwen/qwen3-32b" },
  { provider: "groq", model: "allam-2-7b" },
  { provider: "gemini", model: "gemini-flash-lite-latest" },
  { provider: "gemini", model: "gemini-2.5-flash" }
];

const REPORT_MODELS = [
  { provider: "gemini", model: "gemini-3.1-flash-lite" },
  { provider: "groq", model: "qwen/qwen3-32b" },
  { provider: "groq", model: "allam-2-7b" },
  { provider: "gemini", model: "gemini-flash-lite-latest" },
  { provider: "gemini", model: "gemini-2.5-pro" }
];

async function callGroq(model: string, system: string, user: string) {
  const apiKey = getGroqApiKey();
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${apiKey}\`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.2
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    const error = new Error(\`Groq Error: \${res.status} \${errorText}\`);
    (error as any).status = res.status;
    throw error;
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

async function callGemini(model: string, system: string, user: string) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing from settings");
  }
  
  const body = {
    contents: [{ role: "user", parts: [{ text: user }] }],
    systemInstruction: { parts: [{ text: system }] },
    generationConfig: {
      temperature: 0.2
    }
  };

  const res = await fetch(\`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent?key=\${apiKey}\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errorText = await res.text();
    const error = new Error(\`Gemini Error: \${res.status} \${errorText}\`);
    (error as any).status = res.status;
    throw error;
  }

  const data = await res.json();
  if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts.length > 0) {
      return data.candidates[0].content.parts[0].text;
  }
  return "";
}

async function runWithFallback(stepName: string, models: any[], system: string, input: string) {
  let lastError: any = null;

  for (const m of models) {
    try {
      console.log(\`🔄 \${stepName}: Trying \${m.model}\`);

      let result;
      if (m.provider === "groq") {
        result = await callGroq(m.model, system, input);
      } else {
        result = await callGemini(m.model, system, input);
      }

      if (result) {
        result = result.replace(/<think>[\\s\\S]*?<\\/think>\\n*/g, '');
        result = result.replace(/<think>[\\s\\S]*$/g, '');
        result = result.trim();
      }

      if (!result) {
        throw new Error(\`Model \${m.model} returned empty response after stripping tags.\`);
      }

      console.log(\`✅ \${stepName}: SUCCESS with \${m.model}\`);
      return result;

    } catch (err: any) {
      console.log(\`⚠️ \${stepName}: Model \${m.model} skipped (\${err.message || 'unknown error'})\`);
      lastError = err;
      // Continue to next model
    }
  }

  throw new Error(\`All models failed in \${stepName}. Last error: \${lastError?.message}\`);
}


export const governanceService = {
  transcribeAudio: async (file: File): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", "whisper-large-v3");
      formData.append("language", "ar");

      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          "Authorization": \`Bearer \${getGroqApiKey()}\`
        },
        body: formData
      });

      if (!response.ok) {
        const errBody = await response.text();
        if (response.status === 401 || errBody.includes("invalid_api_key")) {
          throw new Error("مفتاح API غير صالح أو منتهي الصلاحية.");
        }
        throw new Error(\`خطأ من الخادم (\${response.status}): \${errBody}\`);
      }

      const data = await response.json();
      return data.text;
    } catch (e: any) {
      throw new Error(\`فشل تحويل الصوت إلى نص: \${e.message || "خطأ غير معروف"}\`);
    }
  },

  processTranscript: async (
    rawTranscript: string, 
    updateStep: (id: number, status: GovernanceStep['status']) => void
  ): Promise<string> => {
    try {
      // ===== STEP 1 CLEAN =====
      updateStep(1, 'loading');
      
      const cleanTranscript = await runWithFallback(
        "CLEAN",
        CLEAN_MODELS,
        CLEAN_PROMPT,
        rawTranscript
      );
      
      updateStep(1, 'success');

      // ===== STEP 2 REPORT =====
      updateStep(2, 'loading');
      
      const report = await runWithFallback(
        "REPORT",
        REPORT_MODELS,
        REPORT_PROMPT,
        cleanTranscript
      );
      
      updateStep(2, 'success');
      return report;
      
    } catch (err: any) {
      console.error("Governance Error:", err);
      updateStep(1, 'error');
      updateStep(2, 'error');
      
      let errorMessage = err.message || "حدث خطأ غير متوقع.";
      if (err.status === 429 || errorMessage.includes("429") || errorMessage.includes("Quota exceeded")) {
        errorMessage = "عذراً، لقد استنفدت الحد المسموح به للاستخدام المجاني (Quota Exceeded). يرجى التحقق من خطة الفوترة أو المحاولة لاحقاً.";
      } else if (err.status === 503 || errorMessage.includes("503") || errorMessage.includes("high demand")) {
        errorMessage = "النموذج يواجه ضغطاً عالياً حالياً نظراً للطلب المرتفع. يرجى المحاولة مرة أخرى بعد قليل.";
      }
      
      throw new Error(errorMessage);
    }
  }
};
`;

fs.writeFileSync('src/components/meetings/governance/governanceService.ts', code);
console.log("Written governanceService.ts successfully");
