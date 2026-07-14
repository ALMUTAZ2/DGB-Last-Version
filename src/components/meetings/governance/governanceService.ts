/* ============================================================================
   governanceService.ts

   Pipeline:
   1. تنظيف محافظ للنص.
   2. تحليل شامل إلى JSON.
   3. تدقيق المؤشرات المفقودة.
   4. تدقيق القرارات والمهام والمخاطر.
   5. مراجعة العناصر الضعيفة باستخدام النص الكامل.
   6. إزالة التكرار والتعارض.
   7. إنتاج تقرير تنفيذي مختصر.

   التقرير النهائي:
   - وصف الاجتماع وتصنيفه
   - الخلاصة التنفيذية
   - أهم المؤشرات
   - القرارات والتوجيهات
   - المهام المطلوبة
   - المخاطر والمعوقات
   - المتابعات
============================================================================ */

/* ============================================================================
   API KEYS
============================================================================ */

export const getGroqApiKey = (): string =>
  localStorage.getItem("GROQ_API_KEY") || "";

export const getGeminiApiKey = (): string =>
  localStorage.getItem("GEMINI_API_KEY") || "";

export const updateGroqClient = () => {
  // الاستدعاءات تتم مباشرة عبر fetch.
};

/* ============================================================================
   DATE
============================================================================ */

export const getArabicDayName = (
  dateStr: string
): string => {
  if (!dateStr) return "";

  const parts = dateStr
    .split("-")
    .map(Number);

  if (
    parts.length !== 3 ||
    parts.some(
      value =>
        !Number.isFinite(value)
    )
  ) {
    return "";
  }

  const [
    year,
    month,
    day
  ] = parts;

  const date = new Date(
    year,
    month - 1,
    day
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return [
    "الأحد",
    "الإثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت"
  ][date.getDay()];
};

/* ============================================================================
   STEPS
============================================================================ */

export type GovernanceStepStatus =
  | "pending"
  | "loading"
  | "success"
  | "error";

export interface GovernanceStep {
  id: number;
  label: string;
  status: GovernanceStepStatus;
  model?: string;
}

export const initialSteps: GovernanceStep[] = [
  {
    id: 1,
    label: "📝 تنقية النص",
    status: "pending"
  },
  {
    id: 2,
    label: "🧠 تحليل الاجتماع",
    status: "pending"
  },
  {
    id: 3,
    label: "📊 استخراج المؤشرات",
    status: "pending"
  },
  {
    id: 4,
    label: "✅ استخراج المهام والقرارات",
    status: "pending"
  },
  {
    id: 5,
    label: "🔍 مراجعة الجودة",
    status: "pending"
  },
  {
    id: 6,
    label: "📄 إعداد التقرير التنفيذي",
    status: "pending"
  }
];

/* ============================================================================
   MODELS
============================================================================ */

type Provider =
  | "gemini"
  | "groq";

interface ModelConfig {
  provider: Provider;
  model: string;
}

const CLEAN_MODELS: ModelConfig[] = [
  {
    provider: "gemini",
    model: "gemini-3.1-flash-lite"
  },
  {
    provider: "gemini",
    model: "gemini-2.5-flash-lite"
  },
  {
    provider: "groq",
    model:
      "meta-llama/llama-4-scout-17b-16e-instruct"
  }
];

const ANALYSIS_MODELS: ModelConfig[] = [
  {
    provider: "gemini",
    model: "gemini-3.5-flash"
  },
  {
    provider: "gemini",
    model: "gemini-3-flash"
  },
  {
    provider: "gemini",
    model: "gemini-2.5-flash"
  }
];

const KPI_AUDIT_MODELS: ModelConfig[] = [
  {
    provider: "gemini",
    model: "gemini-3.1-flash-lite"
  },
  {
    provider: "gemini",
    model: "gemini-2.5-flash-lite"
  },
  {
    provider: "groq",
    model: "qwen/qwen3-32b"
  }
];

const EXECUTIVE_AUDIT_MODELS:
  ModelConfig[] = [
    {
      provider: "gemini",
      model: "gemini-3.1-flash-lite"
    },
    {
      provider: "gemini",
      model: "gemini-2.5-flash-lite"
    },
    {
      provider: "groq",
      model: "openai/gpt-oss-120b"
    }
  ];

const REVIEW_MODELS: ModelConfig[] = [
  {
    provider: "groq",
    model: "openai/gpt-oss-120b"
  },
  {
    provider: "groq",
    model: "qwen/qwen3-32b"
  },
  {
    provider: "groq",
    model: "llama-3.3-70b-versatile"
  }
];

const REVIEW_CONFIDENCE_THRESHOLD =
  0.82;

const MIN_AUDIT_CONFIDENCE =
  0.76;

const MAX_REVIEW_ITEMS =
  50;

const MAX_AUDIT_ITEMS =
  30;

/*
 * حدود التقرير التنفيذي.
 * تستطيع تعديلها لاحقًا بسهولة.
 */
const REPORT_LIMITS = {
  executiveSummarySentences: 4,
  maxKpis: 8,
  maxDecisionsAndDirectives: 6,
  maxTasks: 7,
  maxRisks: 4,
  maxFollowUps: 5
} as const;

/* ============================================================================
   TYPES
============================================================================ */

export type MeetingClassification =
  | "اجتماع إداري"
  | "اجتماع تشغيلي"
  | "مراجعة أداء"
  | "متابعة مشروع"
  | "اجتماع فني"
  | "اجتماع مع عميل"
  | "ورشة عمل"
  | "عصف ذهني"
  | "مناقشة مشكلة"
  | "اتخاذ قرار"
  | "أخرى";

export type MeetingItemType =
  | "decision"
  | "directive"
  | "new_task"
  | "ongoing_action"
  | "status_update"
  | "proposal"
  | "follow_up"
  | "open_question";

export type OwnerSource =
  | "explicit"
  | "accepted"
  | "role_based"
  | "unknown";

export type DeadlineSource =
  | "explicit"
  | "derived_from_meeting_date"
  | "unclear"
  | "not_mentioned";

export type DataFreshness =
  | "current"
  | "previous_period"
  | "historical"
  | "unclear";

export type DataQualityStatus =
  | "confirmed"
  | "system_unavailable"
  | "manually_reported"
  | "corrected_during_meeting"
  | "unclear";

export type RiskLevel =
  | "عالٍ"
  | "متوسط"
  | "منخفض"
  | "غير محدد";

export type RiskLikelihood =
  | "عالية"
  | "متوسطة"
  | "منخفضة"
  | "غير محدد";

export type Priority =
  | "عالية"
  | "متوسطة"
  | "منخفضة"
  | "غير محدد";

export interface Evidence {
  quote: string;
  speaker: string;
  timestamp: string;
  grounding_score: number;
}

export interface BaseMeetingItem {
  id: string;
  item_type: MeetingItemType;
  text: string;
  evidence: Evidence;
  confidence: number;
  requires_review: boolean;
}

export interface MeetingKpi {
  id: string;
  name: string;
  context: string;

  reported_value: string;
  normalized_value: number | null;
  unit: string;

  period: string;
  category: string;

  data_freshness: DataFreshness;

  data_quality_status:
    DataQualityStatus;

  was_corrected: boolean;
  discarded_values: string[];

  evidence: Evidence;
  confidence: number;
  requires_review: boolean;
}

export interface MeetingDecision
  extends BaseMeetingItem {
  item_type: "decision";

  owner: string;
  owner_source: OwnerSource;
  owner_evidence: string;

  status: string;
}

export interface MeetingDirective
  extends BaseMeetingItem {
  item_type: "directive";

  owner: string;
  owner_source: OwnerSource;
  owner_evidence: string;
}

export interface MeetingActionItem
  extends BaseMeetingItem {
  item_type: "new_task";

  owner: string;
  owner_source: OwnerSource;
  owner_evidence: string;

  deadline_text: string;
  deadline_iso: string | null;
  deadline_source: DeadlineSource;
  deadline_confidence: number;

  status: string;
  priority: Priority;
}

export interface MeetingOngoingAction
  extends BaseMeetingItem {
  item_type: "ongoing_action";

  owner: string;
  owner_source: OwnerSource;
  status: string;
}

export interface MeetingStatusUpdate
  extends BaseMeetingItem {
  item_type: "status_update";
  status: string;
}

export interface MeetingProposal
  extends BaseMeetingItem {
  item_type: "proposal";
  adopted: boolean;
}

export interface MeetingFollowUp
  extends BaseMeetingItem {
  item_type: "follow_up";

  owner: string;
  owner_source: OwnerSource;
}

export interface MeetingOpenQuestion
  extends BaseMeetingItem {
  item_type: "open_question";
}

export interface MeetingRisk {
  id: string;
  text: string;

  category: string;
  level: RiskLevel;
  likelihood: RiskLikelihood;

  impact: string;
  mitigation: string;

  owner: string;
  deadline_text: string;

  unresolved: boolean;

  evidence: Evidence;
  confidence: number;
  requires_review: boolean;
}

export interface MeetingAnalysis {
  meeting: {
    description: string;

    classification:
      MeetingClassification;

    objective: string;

    completion_status:
      | "مكتمل"
      | "غير مكتمل"
      | "غير واضح";

    executive_summary: string;
  };

  topics: string[];

  kpis: MeetingKpi[];

  decisions: MeetingDecision[];

  directives: MeetingDirective[];

  action_items:
    MeetingActionItem[];

  ongoing_actions:
    MeetingOngoingAction[];

  status_updates:
    MeetingStatusUpdate[];

  proposals:
    MeetingProposal[];

  follow_ups:
    MeetingFollowUp[];

  open_questions:
    MeetingOpenQuestion[];

  risks:
    MeetingRisk[];

  management_attention:
    BaseMeetingItem[];

  quality_notes: string[];
}

export interface ProcessTranscriptResult {
  runId: string;

  report: string;

  analysis: MeetingAnalysis;

  cleanedTranscript: string;

  modelsUsed: {
    clean?: string;
    analysis?: string;
    kpiAudit?: string;
    executiveAudit?: string;
    review?: string;
  };

  processingTimeMs: number;
}

/* ============================================================================
   PROMPTS
============================================================================ */

const CLEAN_PROMPT = `
أنت متخصص في تنظيف نصوص الاجتماعات العربية الناتجة من التفريغ الصوتي.

مهمتك تحسين قابلية القراءة فقط مع الحفاظ الكامل على المضمون.

قواعد إلزامية:

1. حافظ على ترتيب الحديث وأسماء المتحدثين.
2. ادمج المقاطع المتتالية للمتحدث نفسه فقط.
3. احذف التوقيتات وتكرار التفريغ وكلمات الحشو غير المؤثرة.
4. لا تلخص ولا تختصر ولا تضف معلومات.
5. لا تخمن الكلمات الناقصة ولا تكمل الجمل غير المكتملة.
6. حافظ على الأسماء والأرقام والنسب والتواريخ والمشاريع والمواقع والمصطلحات الفنية.
7. حافظ على عبارات عدم اليقين مثل: يمكن، أتوقع، الظاهر، ما أدري.
8. حافظ على كلمات الحالة: تم، جاري، سيتم، متوقف، مكتمل، مقترح.
9. إذا تم تصحيح رقم فاحتفظ بالرقمين وترتيبهما.
10. لا تحول اقتراحًا إلى قرار.
11. لا تحول تحديث حالة إلى مهمة.
12. لا تحول عملًا بدأ سابقًا إلى مهمة جديدة.
13. حافظ على التكليفات وعبارات القبول مثل: أبشر، حاضر، تم.
14. لا تحذف أي جملة تحتوي نسبة أو عددًا أو مستهدفًا.
15. إذا لم توجد أسماء متحدثين فلا تخترع أسماء.

الإخراج:

النص المنظف فقط.
بدون Markdown.
بدون JSON.
بدون شرح.

الصيغة:

اسم المتحدث: النص
`.trim();

const ANALYSIS_PROMPT = `
أنت محلل اجتماعات تنفيذي متخصص في الاجتماعات العربية التشغيلية والفنية والإدارية.

حلل النص كاملًا وأخرج JSON فقط.

المطلوب:

- وصف وتصنيف الاجتماع.
- المؤشرات المهمة.
- القرارات والتوجيهات.
- المهام الجديدة مع المسؤول والموعد.
- الإجراءات الجارية وتحديثات الحالة.
- المخاطر والمعوقات.
- المتابعات والأسئلة المفتوحة.

قواعد المؤشرات:

1. استخرج النسب والأعداد والمستهدفات والمقارنات ذات القيمة الإدارية أو التشغيلية.
2. لا تستخرج الأرقام العابرة.
3. evidence.quote يجب أن يتضمن الرقم نفسه.
4. إذا كان الرقم تقديريًا فاستخدم نحو أو تقريبًا في reported_value أو context.
5. إذا تم تصحيح رقم فاعتمد الأخير وضع السابق في discarded_values.
6. إذا كان الرقم محل شك أو يحتاج تحققًا فاذكر ذلك في context.
7. إذا كانت البيانات سابقة فاستخدم previous_period.
8. إذا كانت البيانات متأثرة بتعطل النظام فاستخدم system_unavailable.

تصنيف العناصر:

- decision: قرار تم اعتماده.
- directive: توجيه إداري صريح.
- new_task: تكليف جديد صدر أثناء الاجتماع.
- ongoing_action: عمل بدأ قبل الاجتماع وما زال جاريًا.
- status_update: تحديث حالة فقط.
- proposal: اقتراح لم يعتمد.
- follow_up: موضوع يحتاج متابعة أو تحقق.
- open_question: سؤال لم يحصل على إجابة نهائية.

قواعد المسؤول والموعد:

9. لا تعتبر من شرح المشكلة مسؤولًا تلقائيًا.
10. explicit للتكليف المباشر.
11. accepted لقبول الشخص بعبارة مثل أبشر أو حاضر.
12. role_based لتكليف جهة أو دائرة.
13. unknown عند غياب الدليل.
14. owner_evidence يجب أن يتضمن التكليف أو القبول.
15. لا تخترع موعدًا.
16. اليوم وغدًا والأسبوع القادم ونهاية الشهر مواعيد صريحة فقط عند ارتباطها بالمهمة.
17. لا تحول الموعد النسبي إلى تاريخ ميلادي.

قواعد المخاطر:

18. افصل مخاطر السلامة والتشغيل والحوكمة والموثوقية والبيانات والمشاريع.
19. المعدات المتهالكة للعمل على المرتفعات = خطر عالٍ.
20. شحن الشبكة قبل إغلاق التصريح = خطر عالٍ.
21. المعدات الكهربائية المفتوحة = خطر عالٍ.
22. ضعف الإشراف وعدم الإبلاغ = متوسط على الأقل.
23. لا تستخدم "غير محدد" إذا كان أثر الخطر واضحًا.

قواعد الدليل والجودة:

24. كل مؤشر وقرار وتوجيه ومهمة وخطر يجب أن يحتوي evidence.quote من النص.
25. confidence من 0 إلى 1.
26. لا تكتب عناصر فارغة أو نصها "غير محدد".
27. استخدم مصفوفة فارغة عند عدم وجود عناصر.
28. لا تكرر الفكرة نفسها في أكثر من نوع إلا إذا كان لها قرار وتنفيذ مستقلان.
29. إذا تم اعتماد الاقتراح فلا تضعه ضمن proposals.
30. إذا تمت الإجابة عن السؤال فلا تضعه ضمن open_questions.
قواعد الأسماء:

- انسخ اسم الشخص كما ورد حرفيًا في النص.
- لا تترجم الاسم من الإنجليزية إلى العربية.
- لا تترجم الاسم من العربية إلى الإنجليزية.
- لا تغير تهجئة الاسم.
- لا تختصر الاسم.
- لا تمزج الأحرف العربية والإنجليزية داخل الاسم.
- إذا لم تستطع مطابقة الاسم كما ورد فاكتب "غير محدد".
- أسماء الجهات والأقسام تبقى كما وردت في النص.
أخرج JSON فقط دون Markdown.
`.trim();

const KPI_AUDIT_PROMPT = `
أنت مدقق مؤشرات رقمية لاجتماعات عربية.

قارن النص بالمؤشرات الحالية، وأضف المؤشرات المهمة المفقودة فقط.

القواعد:

1. راجع النسب والأعداد والمستهدفات والمقارنات والمدد.
2. لا تعد مؤشرًا موجودًا.
3. لا تضف رقمًا عابرًا.
4. evidence.quote يجب أن يتضمن الرقم.
5. وضح إن كان الرقم تقديريًا أو محل تحقق.
6. confidence لا يقل عن 0.76.
7. لا تتجاوز 25 مؤشرًا.
8. لا ترجع عناصر فارغة.
9. أخرج JSON فقط.
`.trim();

const EXECUTIVE_AUDIT_PROMPT = `
أنت مدقق تنفيذي لاجتماعات عربية.

قارن النص بالعناصر الحالية، وأضف العناصر المهمة المفقودة فقط:

- القرارات.
- التوجيهات.
- المهام الجديدة.
- الإجراءات الجارية.
- تحديثات الحالة.
- المقترحات غير المعتمدة.
- المخاطر.
- المتابعات.
- الأسئلة المفتوحة.

قواعد مهمة:

1. التكليف المباشر = new_task.
2. القبول بعبارة أبشر أو حاضر يثبت المسؤول.
3. أرسلنا أو بدأنا أو جاري أو نعمل عليه = ongoing_action.
4. مجرد عرض الحالة = status_update.
5. الاقتراح غير المعتمد = proposal.
6. لا تخمن مسؤولًا أو موعدًا.
7. لا تعيد عنصرًا موجودًا.
8. إذا تم اعتماد المقترح فلا تضعه ضمن proposals.
9. إذا تمت الإجابة عن السؤال فلا تضعه ضمن open_questions.
10. كل عنصر يجب أن يحتوي evidence.quote.
11. confidence لا يقل عن 0.76.
12. لا تتجاوز 30 عنصرًا.
13. لا ترجع عناصر فارغة.
14. أخرج JSON فقط.
- انسخ أسماء المسؤولين حرفيًا من النص.
- لا تترجم الاسم ولا تغير تهجئته.
- لا تستخدم اسمًا جزئيًا إذا كان الاسم الكامل ظاهرًا.
`.trim();

const REVIEW_PROMPT = `
أنت مراجع دقيق لمضمون اجتماع عربي.

ستستلم النص الكامل وقائمة عناصر ضعيفة الثقة.

راجع كل عنصر بالرجوع إلى النص الكامل.

القواعد:

1. لا تحذف العنصر لمجرد أن الاقتباس غير مطابق حرفيًا.
2. إذا كان المعنى مدعومًا بوضوح اجعل keep=true.
3. إذا لم يوجد دعم حقيقي اجعل keep=false.
4. صحح نوع العنصر عند الحاجة.
5. لا تضف عناصر جديدة.
6. لا تخمن مسؤولًا أو موعدًا.
7. لا تحول الاقتراح إلى قرار.
8. لا تحول العمل الجاري أو تحديث الحالة إلى مهمة جديدة.
9. استخدم explicit أو accepted أو role_based أو unknown بدقة.
10. اجعل الصياغة النهائية مختصرة وواضحة.
- corrected_owner يجب أن يكون الاسم نفسه كما ورد حرفيًا في transcript.
- ممنوع ترجمة الأسماء أو إعادة تهجئتها.
- إذا كان الاسم المستخرج لا يطابق اسمًا ظاهرًا في transcript فاستخدم "غير محدد".
أخرج JSON فقط.
`.trim();

/* ============================================================================
   JSON TEMPLATES
============================================================================ */

const EVIDENCE_TEMPLATE = {
  quote: "",
  speaker: "",
  timestamp: ""
};

const KPI_TEMPLATE = {
  id: "",
  name: "",
  context: "",
  reported_value: "",
  normalized_value: null,
  unit: "",
  period: "",
  category: "",
  data_freshness: "unclear",
  data_quality_status: "unclear",
  was_corrected: false,
  discarded_values: [],
  evidence: EVIDENCE_TEMPLATE,
  confidence: 0
};

const DECISION_TEMPLATE = {
  id: "",
  item_type: "decision",
  text: "",
  owner: "غير محدد",
  owner_source: "unknown",
  owner_evidence: "",
  status: "غير محدد",
  evidence: EVIDENCE_TEMPLATE,
  confidence: 0
};

const DIRECTIVE_TEMPLATE = {
  id: "",
  item_type: "directive",
  text: "",
  owner: "غير محدد",
  owner_source: "unknown",
  owner_evidence: "",
  evidence: EVIDENCE_TEMPLATE,
  confidence: 0
};

const TASK_TEMPLATE = {
  id: "",
  item_type: "new_task",
  text: "",
  owner: "غير محدد",
  owner_source: "unknown",
  owner_evidence: "",
  deadline_text: "غير محدد",
  deadline_iso: null,
  deadline_source: "not_mentioned",
  deadline_confidence: 0,
  status: "مفتوح",
  priority: "غير محدد",
  evidence: EVIDENCE_TEMPLATE,
  confidence: 0
};

const ONGOING_TEMPLATE = {
  id: "",
  item_type: "ongoing_action",
  text: "",
  owner: "غير محدد",
  owner_source: "unknown",
  status: "جاري",
  evidence: EVIDENCE_TEMPLATE,
  confidence: 0
};

const STATUS_TEMPLATE = {
  id: "",
  item_type: "status_update",
  text: "",
  status: "غير محدد",
  evidence: EVIDENCE_TEMPLATE,
  confidence: 0
};

const PROPOSAL_TEMPLATE = {
  id: "",
  item_type: "proposal",
  text: "",
  adopted: false,
  evidence: EVIDENCE_TEMPLATE,
  confidence: 0
};

const FOLLOW_UP_TEMPLATE = {
  id: "",
  item_type: "follow_up",
  text: "",
  owner: "غير محدد",
  owner_source: "unknown",
  evidence: EVIDENCE_TEMPLATE,
  confidence: 0
};

const QUESTION_TEMPLATE = {
  id: "",
  item_type: "open_question",
  text: "",
  evidence: EVIDENCE_TEMPLATE,
  confidence: 0
};

const RISK_TEMPLATE = {
  id: "",
  text: "",
  category: "",
  level: "غير محدد",
  likelihood: "غير محدد",
  impact: "",
  mitigation: "غير محدد",
  owner: "غير محدد",
  deadline_text: "غير محدد",
  unresolved: true,
  evidence: EVIDENCE_TEMPLATE,
  confidence: 0
};

const ANALYSIS_JSON_TEMPLATE = {
  meeting: {
    description: "",
    classification: "أخرى",
    objective: "",
    completion_status: "غير واضح",
    executive_summary: ""
  },

  topics: [],

  kpis: [
    KPI_TEMPLATE
  ],

  decisions: [
    DECISION_TEMPLATE
  ],

  directives: [
    DIRECTIVE_TEMPLATE
  ],

  action_items: [
    TASK_TEMPLATE
  ],

  ongoing_actions: [
    ONGOING_TEMPLATE
  ],

  status_updates: [
    STATUS_TEMPLATE
  ],

  proposals: [
    PROPOSAL_TEMPLATE
  ],

  follow_ups: [
    FOLLOW_UP_TEMPLATE
  ],

  open_questions: [
    QUESTION_TEMPLATE
  ],

  risks: [
    RISK_TEMPLATE
  ],

  management_attention: [
    FOLLOW_UP_TEMPLATE
  ],

  quality_notes: []
};

const KPI_AUDIT_JSON_TEMPLATE = {
  missing_kpis: [
    KPI_TEMPLATE
  ]
};

const EXECUTIVE_AUDIT_JSON_TEMPLATE = {
  missing_decisions: [
    DECISION_TEMPLATE
  ],

  missing_directives: [
    DIRECTIVE_TEMPLATE
  ],

  missing_action_items: [
    TASK_TEMPLATE
  ],

  missing_ongoing_actions: [
    ONGOING_TEMPLATE
  ],

  missing_status_updates: [
    STATUS_TEMPLATE
  ],

  missing_proposals: [
    PROPOSAL_TEMPLATE
  ],

  missing_risks: [
    RISK_TEMPLATE
  ],

  missing_follow_ups: [
    FOLLOW_UP_TEMPLATE
  ],

  missing_open_questions: [
    QUESTION_TEMPLATE
  ]
};

/* ============================================================================
   REVIEW TYPES AND SCHEMA
============================================================================ */

interface ReviewCandidate {
  id: string;

  current_type:
    MeetingItemType;

  text: string;

  owner: string;
  owner_source: OwnerSource;
  owner_evidence: string;

  deadline_text: string;

  evidence_quote: string;

  confidence: number;
}

interface ReviewResultItem {
  id: string;

  keep: boolean;

  corrected_type:
    MeetingItemType;

  corrected_text: string;

  corrected_owner: string;

  corrected_owner_source:
    OwnerSource;

  corrected_deadline: string;

  confidence: number;

  reason: string;
}

interface ReviewResponse {
  items: ReviewResultItem[];
}

const REVIEW_SCHEMA = {
  type: "object",

  additionalProperties: false,

  required: [
    "items"
  ],

  properties: {
    items: {
      type: "array",

      items: {
        type: "object",

        additionalProperties:
          false,

        required: [
          "id",
          "keep",
          "corrected_type",
          "corrected_text",
          "corrected_owner",
          "corrected_owner_source",
          "corrected_deadline",
          "confidence",
          "reason"
        ],

        properties: {
          id: {
            type: "string"
          },

          keep: {
            type: "boolean"
          },

          corrected_type: {
            type: "string"
          },

          corrected_text: {
            type: "string"
          },

          corrected_owner: {
            type: "string"
          },

          corrected_owner_source: {
            type: "string"
          },

          corrected_deadline: {
            type: "string"
          },

          confidence: {
            type: "number"
          },

          reason: {
            type: "string"
          }
        }
      }
    }
  }
} as const;

/* ============================================================================
   API OPTIONS
============================================================================ */

interface CallOptions {
  temperature?: number;

  jsonMode?: boolean;

  jsonTemplate?: object;

  jsonExtraInstructions?:
    string;

  jsonSchema?: object;

  maxOutputTokens?: number;

  signal?: AbortSignal;
}

interface ModelRunResult {
  text: string;
  model: string;
  provider: Provider;
}

/* ============================================================================
   GENERAL HELPERS
============================================================================ */

const createHttpError = (
  message: string,
  status?: number
): Error => {
  const error =
    new Error(message);

  (
    error as Error & {
      status?: number;
    }
  ).status = status;

  return error;
};

const cleanModelOutput = (
  text: string
): string => {
  return (text || "")
    .replace(
      /<think>[\s\S]*?<\/think>\s*/g,
      ""
    )
    .replace(
      /<think>[\s\S]*$/g,
      ""
    )
    .replace(
      /^```(?:json|markdown|text)?\s*/i,
      ""
    )
    .replace(
      /\s*```$/i,
      ""
    )
    .trim();
};

const repairCommonJsonProblems = (
  value: string
): string => {
  return value
    .replace(
      /^\uFEFF/,
      ""
    )
    .replace(
      /,\s*([}\]])/g,
      "$1"
    )
    .replace(
      /\}\s*\{/g,
      "},{"
    )
    .replace(
      /\]\s*\[/g,
      "],["
    )
    .trim();
};

const parseJsonSafely = <T>(
  text: string
): T => {
  let cleaned =
    repairCommonJsonProblems(
      cleanModelOutput(text)
    );

  try {
    return JSON.parse(
      cleaned
    ) as T;
  } catch {
    const start =
      cleaned.indexOf("{");

    const end =
      cleaned.lastIndexOf("}");

    if (
      start >= 0 &&
      end > start
    ) {
      cleaned =
        repairCommonJsonProblems(
          cleaned.slice(
            start,
            end + 1
          )
        );

      return JSON.parse(
        cleaned
      ) as T;
    }

    throw new Error(
      "لم يعد النموذج JSON صالحًا."
    );
  }
};

const normalizeText = (
  value: unknown,
  fallback =
    "غير محدد"
): string => {
  if (
    typeof value !==
    "string"
  ) {
    return fallback;
  }

  return (
    value.trim() ||
    fallback
  );
};

const isMeaningfulText = (
  value: unknown
): boolean => {
  if (
    typeof value !==
    "string"
  ) {
    return false;
  }

  const text =
    value.trim();

  return Boolean(
    text &&
    ![
      "غير محدد",
      "لا يوجد",
      "لا توجد",
      "غير معروف",
      "لا توجد قرارات",
      "لا توجد مهام",
      "-"
    ].includes(text)
  );
};

const safeArray = <T>(
  value: unknown
): T[] => {
  return Array.isArray(value)
    ? value as T[]
    : [];
};

const clampConfidence = (
  value: unknown
): number => {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      1,
      number
    )
  );
};

const generateId = (
  prefix: string,
  index: number
): string => {
  return `${prefix}-${index + 1}`;
};

/* ============================================================================
   ARABIC TEXT MATCHING
============================================================================ */

const normalizeArabicForMatch = (
  value: string
): string => {
  return (value || "")
    .toLowerCase()
    .replace(
      /[\u064B-\u065F\u0670]/g,
      ""
    )
    .replace(
      /[إأآٱ]/g,
      "ا"
    )
    .replace(
      /ى/g,
      "ي"
    )
    .replace(
      /ؤ/g,
      "و"
    )
    .replace(
      /ئ/g,
      "ي"
    )
    .replace(
      /ة/g,
      "ه"
    )
    .replace(
      /ـ/g,
      ""
    )
    .replace(
      /[^\u0600-\u06FFa-z0-9.%]+/gi,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
};
const escapeRegExp = (
  value: string
): string => {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
};

const extractSpeakerNames = (
  transcript: string
): string[] => {
  const names: string[] = [];

  const lines =
    transcript.split(/\n+/);

  for (
    const line
    of lines
  ) {
    const match =
      line.match(
        /^\s*([^:\n]{2,80})\s*:\s*/
      );

    if (
      match?.[1]
    ) {
      const name =
        match[1].trim();

      if (
        isMeaningfulText(
          name
        )
      ) {
        names.push(
          name
        );
      }
    }
  }

  return [
    ...new Set(names)
  ];
};

const findOriginalNameFromTranscript = (
  extractedName: string,
  transcript: string
): string => {
  if (
    !isMeaningfulText(
      extractedName
    )
  ) {
    return "غير محدد";
  }

  const normalizedExtracted =
    normalizeArabicForMatch(
      extractedName
    );

  /*
   * استخراج أسماء إنجليزية كاملة من النص.
   * أمثلة:
   * Hesham Y. Jabbari
   * Ali M. Yassin
   * Mohammad Al-Malki
   */
  const englishNames =
    transcript.match(
      /\b[A-Z][a-z]+(?:\s+[A-Z]\.)?(?:\s+[A-Z][a-z]+(?:-[A-Z][a-z]+)?)\b/g
    ) || [];

  /*
   * استخراج أسماء عربية من كلمتين إلى أربع.
   */
  const arabicNames =
    transcript.match(
      /[\u0600-\u06FF]{2,}(?:\s+[\u0600-\u06FF]{2,}){1,3}/g
    ) || [];

  const candidates = [
    ...new Set([
      ...englishNames,
      ...arabicNames
    ])
  ];

  /*
   * التطابق الحرفي أولًا.
   */
  const exact =
    candidates.find(
      name =>
        name.trim() ===
        extractedName.trim()
    );

  if (exact) {
    return exact;
  }

  /*
   * التطابق بعد التطبيع.
   */
  const normalizedExact =
    candidates.find(
      name =>
        normalizeArabicForMatch(
          name
        ) ===
        normalizedExtracted
    );

  if (
    normalizedExact
  ) {
    return normalizedExact;
  }

  /*
   * لا نقارن الاسم العربي بالإنجليزي
   * بالاعتماد على التشابه النصي؛
   * لأن الترجمة لا تتطابق حرفيًا.
   *
   * نستخدم owner_evidence لاحقًا
   * لاستخراج الاسم الأصلي من جملة التكليف.
   */
  return "غير محدد";
};

const preserveOriginalNames = (
  analysis: MeetingAnalysis,
  transcript: string
): MeetingAnalysis => {
  analysis.decisions =
    analysis.decisions.map(
      item => ({
        ...item,

        owner:
          item.owner_source === "role_based"
            ? item.owner
            : findOriginalNameFromTranscript(
                item.owner,
                transcript
              )
      })
    );

  analysis.directives =
    analysis.directives.map(
      item => ({
        ...item,

        owner:
          item.owner_source === "role_based"
            ? item.owner
            : findOriginalNameFromTranscript(
                item.owner,
                transcript
              )
      })
    );

  analysis.action_items =
    analysis.action_items.map(
      item => ({
        ...item,

        owner:
          item.owner_source === "role_based"
            ? item.owner
            : findOriginalNameFromTranscript(
                item.owner,
                transcript
              )
      })
    );

  analysis.ongoing_actions =
    analysis.ongoing_actions.map(
      item => ({
        ...item,

        owner:
          item.owner_source === "role_based"
            ? item.owner
            : findOriginalNameFromTranscript(
                item.owner,
                transcript
              )
      })
    );

  analysis.follow_ups =
    analysis.follow_ups.map(
      item => ({
        ...item,

        owner:
          item.owner_source === "role_based"
            ? item.owner
            : findOriginalNameFromTranscript(
                item.owner,
                transcript
              )
      })
    );

  return analysis;
};

const getMeaningfulTokens = (
  value: string
): string[] => {
  const stopWords =
    new Set([
      "في",
      "من",
      "على",
      "الى",
      "إلى",
      "عن",
      "هذا",
      "هذه",
      "اللي",
      "انه",
      "إنه",
      "كان",
      "يكون",
      "تم",
      "مع",
      "او",
      "أو",
      "ما",
      "لا",
      "هو",
      "هي",
      "عند",
      "بعد",
      "قبل"
    ]);

  return normalizeArabicForMatch(
    value
  )
    .split(" ")
    .filter(
      token =>
        token.length >= 3 &&
        !stopWords.has(token)
    );
};

const textSimilarity = (
  first: string,
  second: string
): number => {
  const firstTokens =
    new Set(
      getMeaningfulTokens(
        first
      )
    );

  const secondTokens =
    new Set(
      getMeaningfulTokens(
        second
      )
    );

  if (
    firstTokens.size === 0 ||
    secondTokens.size === 0
  ) {
    return 0;
  }

  const intersection =
    [...firstTokens]
      .filter(
        token =>
          secondTokens.has(
            token
          )
      )
      .length;

  const union =
    new Set([
      ...firstTokens,
      ...secondTokens
    ]).size;

  return intersection /
    union;
};

const calculateGroundingScore = (
  quote: string,
  transcript: string
): number => {
  if (
    !quote.trim()
  ) {
    return 0;
  }

  const normalizedQuote =
    normalizeArabicForMatch(
      quote
    );

  const normalizedTranscript =
    normalizeArabicForMatch(
      transcript
    );

  if (
    normalizedTranscript.includes(
      normalizedQuote
    )
  ) {
    return 1;
  }

  const quoteTokens =
    getMeaningfulTokens(
      normalizedQuote
    );

  if (
    quoteTokens.length === 0
  ) {
    return 0;
  }

  const transcriptTokens =
    new Set(
      getMeaningfulTokens(
        normalizedTranscript
      )
    );

  const matched =
    quoteTokens.filter(
      token =>
        transcriptTokens.has(
          token
        )
    ).length;

  return Math.min(
    1,
    matched /
      quoteTokens.length
  );
};

const buildEvidence = (
  raw: any,
  transcript: string
): Evidence => {
  const quote =
    normalizeText(
      raw?.quote,
      ""
    );

  return {
    quote,

    speaker:
      normalizeText(
        raw?.speaker,
        ""
      ),

    timestamp:
      normalizeText(
        raw?.timestamp,
        ""
      ),

    grounding_score:
      calculateGroundingScore(
        quote,
        transcript
      )
  };
};

/* ============================================================================
   API CALLS
============================================================================ */

async function callGroq(
  model: string,
  system: string,
  user: string,
  options:
    CallOptions = {}
): Promise<string> {
  try {
    const response = await fetch("/api/governance/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        provider: "groq",
        model,
        system,
        user,
        options
      }),
      signal: options.signal
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errText = errData.error || await response.text();
      throw new Error(errText);
    }

    const data = await response.json();
    return data.content || "";
  } catch (error: any) {
    throw createHttpError(
      `Groq Error: ${error.message}`,
      500
    );
  }
}

async function callGemini(
  model: string,
  system: string,
  user: string,
  options:
    CallOptions = {}
): Promise<string> {
  try {
    const response = await fetch("/api/governance/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        provider: "gemini",
        model,
        system,
        user,
        options
      }),
      signal: options.signal
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errText = errData.error || await response.text();
      throw new Error(errText);
    }

    const data = await response.json();
    return data.content || "";
  } catch (error: any) {
    throw createHttpError(
      `Gemini Error: ${error.message}`,
      500
    );
  }
}

async function runWithFallback(
  stepName: string,
  models:
    ModelConfig[],
  system: string,
  input: string,
  options:
    CallOptions = {}
): Promise<ModelRunResult> {
  let lastError:
    unknown = null;

  for (
    const config
    of models
  ) {
    try {
      console.log(
        `🔄 ${stepName}: ${config.provider}/${config.model}`
      );

      const raw =
        config.provider ===
        "groq"
          ? await callGroq(
              config.model,
              system,
              input,
              options
            )
          : await callGemini(
              config.model,
              system,
              input,
              options
            );

      const text =
        cleanModelOutput(raw);

      if (!text) {
        throw new Error(
          `${config.model} أعاد نتيجة فارغة.`
        );
      }

      if (options.jsonMode) {
        try {
          parseJsonSafely<any>(text);
        } catch (jsonErr: any) {
          throw new Error(
            `استجابة النموذج ليست JSON صالحة: ${jsonErr.message || jsonErr}`
          );
        }
      }

      console.log(
        `✅ ${stepName}: ${config.provider}/${config.model}`
      );

      return {
        text,

        model:
          config.model,

        provider:
          config.provider
      };
    } catch (error) {
      lastError =
        error;

      console.warn(
        `⚠️ ${stepName}/${config.model}:`,
        error instanceof Error
          ? error.message
          : error
      );

      if (
        options.signal
          ?.aborted
      ) {
        throw new Error(
          "تم إلغاء العملية."
        );
      }
    }
  }

  const message =
    lastError instanceof
      Error
      ? lastError.message
      : "خطأ غير معروف";

  throw new Error(
    `All models failed in ${stepName}. Last error: ${message}`
  );
}

/* ============================================================================
   VALUE VALIDATORS
============================================================================ */

const validClassification = (
  value: unknown
): MeetingClassification => {
  const allowed:
    MeetingClassification[] = [
      "اجتماع إداري",
      "اجتماع تشغيلي",
      "مراجعة أداء",
      "متابعة مشروع",
      "اجتماع فني",
      "اجتماع مع عميل",
      "ورشة عمل",
      "عصف ذهني",
      "مناقشة مشكلة",
      "اتخاذ قرار",
      "أخرى"
    ];

  return allowed.includes(
    value as
      MeetingClassification
  )
    ? value as
        MeetingClassification
    : "أخرى";
};

const validOwnerSource = (
  value: unknown
): OwnerSource => {
  const allowed:
    OwnerSource[] = [
      "explicit",
      "accepted",
      "role_based",
      "unknown"
    ];

  return allowed.includes(
    value as OwnerSource
  )
    ? value as OwnerSource
    : "unknown";
};

const validDeadlineSource = (
  value: unknown
): DeadlineSource => {
  const allowed:
    DeadlineSource[] = [
      "explicit",
      "derived_from_meeting_date",
      "unclear",
      "not_mentioned"
    ];

  return allowed.includes(
    value as DeadlineSource
  )
    ? value as DeadlineSource
    : "not_mentioned";
};

const validPriority = (
  value: unknown
): Priority => {
  const allowed:
    Priority[] = [
      "عالية",
      "متوسطة",
      "منخفضة",
      "غير محدد"
    ];

  return allowed.includes(
    value as Priority
  )
    ? value as Priority
    : "غير محدد";
};

const validRiskLevel = (
  value: unknown
): RiskLevel => {
  const allowed:
    RiskLevel[] = [
      "عالٍ",
      "متوسط",
      "منخفض",
      "غير محدد"
    ];

  return allowed.includes(
    value as RiskLevel
  )
    ? value as RiskLevel
    : "غير محدد";
};

const validRiskLikelihood = (
  value: unknown
): RiskLikelihood => {
  const allowed:
    RiskLikelihood[] = [
      "عالية",
      "متوسطة",
      "منخفضة",
      "غير محدد"
    ];

  return allowed.includes(
    value as RiskLikelihood
  )
    ? value as
        RiskLikelihood
    : "غير محدد";
};

/* ============================================================================
   NORMALIZATION
============================================================================ */

const normalizeBaseItem = (
  raw: any,
  type:
    MeetingItemType,
  id: string,
  transcript: string
): BaseMeetingItem => {
  const evidence =
    buildEvidence(
      raw?.evidence,
      transcript
    );

  const confidence =
    clampConfidence(
      raw?.confidence
    );

  return {
    id:
      normalizeText(
        raw?.id,
        id
      ),

    item_type:
      type,

    text:
      normalizeText(
        raw?.text
      ),

    evidence,

    confidence,

    requires_review:
      confidence <
        REVIEW_CONFIDENCE_THRESHOLD ||
      evidence
        .grounding_score <
        0.45
  };
};

const normalizeKpi = (
  raw: any,
  index: number,
  transcript: string
): MeetingKpi => {
  const evidence =
    buildEvidence(
      raw?.evidence,
      transcript
    );

  const confidence =
    clampConfidence(
      raw?.confidence
    );

  return {
    id:
      normalizeText(
        raw?.id,
        generateId(
          "kpi",
          index
        )
      ),

    name:
      normalizeText(
        raw?.name
      ),

    context:
      normalizeText(
        raw?.context,
        ""
      ),

    reported_value:
      normalizeText(
        raw?.reported_value,
        ""
      ),

    normalized_value:
      typeof raw
        ?.normalized_value ===
        "number"
        ? raw.normalized_value
        : null,

    unit:
      normalizeText(
        raw?.unit,
        ""
      ),

    period:
      normalizeText(
        raw?.period,
        ""
      ),

    category:
      normalizeText(
        raw?.category,
        ""
      ),

    data_freshness:
      [
        "current",
        "previous_period",
        "historical",
        "unclear"
      ].includes(
        raw
          ?.data_freshness
      )
        ? raw.data_freshness
        : "unclear",

    data_quality_status:
      [
        "confirmed",
        "system_unavailable",
        "manually_reported",
        "corrected_during_meeting",
        "unclear"
      ].includes(
        raw
          ?.data_quality_status
      )
        ? raw
            .data_quality_status
        : "unclear",

    was_corrected:
      Boolean(
        raw?.was_corrected
      ),

    discarded_values:
      safeArray<string>(
        raw
          ?.discarded_values
      ).map(String),

    evidence,

    confidence,

    requires_review:
      confidence <
        REVIEW_CONFIDENCE_THRESHOLD ||
      evidence
        .grounding_score <
        0.35
  };
};

const normalizeRisk = (
  raw: any,
  index: number,
  transcript: string
): MeetingRisk => {
  const evidence =
    buildEvidence(
      raw?.evidence,
      transcript
    );

  const confidence =
    clampConfidence(
      raw?.confidence
    );

  return {
    id:
      normalizeText(
        raw?.id,
        generateId(
          "risk",
          index
        )
      ),

    text:
      normalizeText(
        raw?.text
      ),

    category:
      normalizeText(
        raw?.category,
        ""
      ),

    level:
      validRiskLevel(
        raw?.level
      ),

    likelihood:
      validRiskLikelihood(
        raw?.likelihood
      ),

    impact:
      normalizeText(
        raw?.impact,
        ""
      ),

    mitigation:
      normalizeText(
        raw?.mitigation,
        ""
      ),

    owner:
      normalizeText(
        raw?.owner
      ),

    deadline_text:
      normalizeText(
        raw?.deadline_text
      ),

    unresolved:
      typeof raw
        ?.unresolved ===
        "boolean"
        ? raw.unresolved
        : true,

    evidence,

    confidence,

    requires_review:
      confidence <
        REVIEW_CONFIDENCE_THRESHOLD ||
      evidence
        .grounding_score <
        0.4
  };
};

const meaningfulItems = (
  value: unknown
): any[] => {
  return safeArray<any>(
    value
  ).filter(
    item =>
      isMeaningfulText(
        item?.text
      )
  );
};

const normalizeAnalysis = (
  raw: any,
  transcript: string
): MeetingAnalysis => {
  const decisions =
    meaningfulItems(
      raw?.decisions
    ).map(
      (
        item,
        index
      ): MeetingDecision => ({
        ...normalizeBaseItem(
          item,
          "decision",
          generateId(
            "decision",
            index
          ),
          transcript
        ),

        item_type:
          "decision",

        owner:
          normalizeText(
            item?.owner
          ),

        owner_source:
          validOwnerSource(
            item
              ?.owner_source
          ),

        owner_evidence:
          normalizeText(
            item
              ?.owner_evidence,
            ""
          ),

        status:
          normalizeText(
            item?.status
          )
      })
    );

  const directives =
    meaningfulItems(
      raw?.directives
    ).map(
      (
        item,
        index
      ): MeetingDirective => ({
        ...normalizeBaseItem(
          item,
          "directive",
          generateId(
            "directive",
            index
          ),
          transcript
        ),

        item_type:
          "directive",

        owner:
          normalizeText(
            item?.owner
          ),

        owner_source:
          validOwnerSource(
            item
              ?.owner_source
          ),

        owner_evidence:
          normalizeText(
            item
              ?.owner_evidence,
            ""
          )
      })
    );

  const actionItems =
    meaningfulItems(
      raw?.action_items
    ).map(
      (
        item,
        index
      ): MeetingActionItem => ({
        ...normalizeBaseItem(
          item,
          "new_task",
          generateId(
            "task",
            index
          ),
          transcript
        ),

        item_type:
          "new_task",

        owner:
          normalizeText(
            item?.owner
          ),

        owner_source:
          validOwnerSource(
            item
              ?.owner_source
          ),

        owner_evidence:
          normalizeText(
            item
              ?.owner_evidence,
            ""
          ),

        deadline_text:
          normalizeText(
            item
              ?.deadline_text
          ),

        deadline_iso:
          typeof item
            ?.deadline_iso ===
            "string" &&
          item.deadline_iso
            .trim()
            ? item.deadline_iso
                .trim()
            : null,

        deadline_source:
          validDeadlineSource(
            item
              ?.deadline_source
          ),

        deadline_confidence:
          clampConfidence(
            item
              ?.deadline_confidence
          ),

        status:
          normalizeText(
            item?.status,
            "مفتوح"
          ),

        priority:
          validPriority(
            item?.priority
          )
      })
    );

  const ongoingActions =
    meaningfulItems(
      raw?.ongoing_actions
    ).map(
      (
        item,
        index
      ): MeetingOngoingAction => ({
        ...normalizeBaseItem(
          item,
          "ongoing_action",
          generateId(
            "ongoing",
            index
          ),
          transcript
        ),

        item_type:
          "ongoing_action",

        owner:
          normalizeText(
            item?.owner
          ),

        owner_source:
          validOwnerSource(
            item
              ?.owner_source
          ),

        status:
          normalizeText(
            item?.status,
            "جاري"
          )
      })
    );

  const statusUpdates =
    meaningfulItems(
      raw?.status_updates
    ).map(
      (
        item,
        index
      ): MeetingStatusUpdate => ({
        ...normalizeBaseItem(
          item,
          "status_update",
          generateId(
            "status",
            index
          ),
          transcript
        ),

        item_type:
          "status_update",

        status:
          normalizeText(
            item?.status
          )
      })
    );

  const proposals =
    meaningfulItems(
      raw?.proposals
    ).map(
      (
        item,
        index
      ): MeetingProposal => ({
        ...normalizeBaseItem(
          item,
          "proposal",
          generateId(
            "proposal",
            index
          ),
          transcript
        ),

        item_type:
          "proposal",

        adopted:
          Boolean(
            item?.adopted
          )
      })
    );

  const followUps =
    meaningfulItems(
      raw?.follow_ups
    ).map(
      (
        item,
        index
      ): MeetingFollowUp => ({
        ...normalizeBaseItem(
          item,
          "follow_up",
          generateId(
            "follow-up",
            index
          ),
          transcript
        ),

        item_type:
          "follow_up",

        owner:
          normalizeText(
            item?.owner
          ),

        owner_source:
          validOwnerSource(
            item
              ?.owner_source
          )
      })
    );

  const openQuestions =
    meaningfulItems(
      raw?.open_questions
    ).map(
      (
        item,
        index
      ): MeetingOpenQuestion => ({
        ...normalizeBaseItem(
          item,
          "open_question",
          generateId(
            "question",
            index
          ),
          transcript
        ),

        item_type:
          "open_question"
      })
    );

  const managementAttention =
    meaningfulItems(
      raw
        ?.management_attention
    ).map(
      (
        item,
        index
      ): BaseMeetingItem =>
        normalizeBaseItem(
          item,
          "follow_up",
          generateId(
            "management",
            index
          ),
          transcript
        )
    );

  return {
    meeting: {
      description:
        normalizeText(
          raw?.meeting
            ?.description,
          "لم يتوفر وصف واضح للاجتماع."
        ),

      classification:
        validClassification(
          raw?.meeting
            ?.classification
        ),

      objective:
        normalizeText(
          raw?.meeting
            ?.objective,
          ""
        ),

      completion_status:
        [
          "مكتمل",
          "غير مكتمل",
          "غير واضح"
        ].includes(
          raw?.meeting
            ?.completion_status
        )
          ? raw.meeting
              .completion_status
          : "غير واضح",

      executive_summary:
        normalizeText(
          raw?.meeting
            ?.executive_summary,
          ""
        )
    },

    topics:
      safeArray<string>(
        raw?.topics
      )
        .filter(
          isMeaningfulText
        )
        .map(String),

    kpis:
      safeArray<any>(
        raw?.kpis
      )
        .filter(
          item =>
            isMeaningfulText(
              item?.name
            ) &&
            isMeaningfulText(
              item
                ?.reported_value
            )
        )
        .map(
          (
            item,
            index
          ) =>
            normalizeKpi(
              item,
              index,
              transcript
            )
        ),

    decisions,

    directives,

    action_items:
      actionItems,

    ongoing_actions:
      ongoingActions,

    status_updates:
      statusUpdates,

    proposals,

    follow_ups:
      followUps,

    open_questions:
      openQuestions,

    risks:
      safeArray<any>(
        raw?.risks
      )
        .filter(
          item =>
            isMeaningfulText(
              item?.text
            )
        )
        .map(
          (
            item,
            index
          ) =>
            normalizeRisk(
              item,
              index,
              transcript
            )
        ),

    management_attention:
      managementAttention,

    quality_notes:
      safeArray<string>(
        raw
          ?.quality_notes
      )
        .filter(
          isMeaningfulText
        )
        .map(String)
  };
};

/* ============================================================================
   DEDUPLICATION
============================================================================ */

const deduplicateByText = <
  T extends {
    text: string;
    confidence: number;
  }
>(
  items: T[],
  threshold =
    0.7
): T[] => {
  const result:
    T[] = [];

  for (
    const item
    of items
  ) {
    if (
      !isMeaningfulText(
        item.text
      )
    ) {
      continue;
    }

    const duplicateIndex =
      result.findIndex(
        existing =>
          textSimilarity(
            existing.text,
            item.text
          ) >= threshold
      );

    if (
      duplicateIndex === -1
    ) {
      result.push(item);
      continue;
    }

    if (
      item.confidence >
      result[
        duplicateIndex
      ].confidence
    ) {
      result[
        duplicateIndex
      ] = item;
    }
    const taskCompletenessScore = (
  item: MeetingActionItem
): number => {
  let score =
    item.confidence * 10;

  if (
    item.owner !==
      "غير محدد"
  ) {
    score += 3;
  }

  if (
    item.deadline_text !==
      "غير محدد"
  ) {
    score += 3;
  }

  if (
    item.owner_source !==
      "unknown"
  ) {
    score += 2;
  }

  if (
    item.text.length >
      50
  ) {
    score += 1;
  }

  return score;
};

const deduplicateTasks = (
  items: MeetingActionItem[]
): MeetingActionItem[] => {
  const result:
    MeetingActionItem[] = [];

  for (
    const item
    of items
  ) {
    const duplicateIndex =
      result.findIndex(
        existing =>
          textSimilarity(
            existing.text,
            item.text
          ) >= 0.55
      );

    if (
      duplicateIndex ===
      -1
    ) {
      result.push(item);
      continue;
    }

    if (
      taskCompletenessScore(
        item
      ) >
      taskCompletenessScore(
        result[
          duplicateIndex
        ]
      )
    ) {
      result[
        duplicateIndex
      ] = item;
    }
  }

  return result;
};
  }

  return result;
};

const deduplicateKpis = (
  items:
    MeetingKpi[]
): MeetingKpi[] => {
  const result:
    MeetingKpi[] = [];

  for (
    const item
    of items
  ) {
    if (
      !isMeaningfulText(
        item.name
      ) ||
      !isMeaningfulText(
        item.reported_value
      )
    ) {
      continue;
    }

    const duplicateIndex =
      result.findIndex(
        existing => {
          const sameName =
            textSimilarity(
              existing.name,
              item.name
            ) >= 0.62;

          const sameValue =
            normalizeArabicForMatch(
              existing
                .reported_value
            ) ===
            normalizeArabicForMatch(
              item
                .reported_value
            );

          const sameContext =
            textSimilarity(
              existing.context,
              item.context
            ) >= 0.65;

          return (
            sameName &&
            (
              sameValue ||
              sameContext
            )
          );
        }
      );

    if (
      duplicateIndex === -1
    ) {
      result.push(item);
      continue;
    }

    if (
      item.confidence >
      result[
        duplicateIndex
      ].confidence
    ) {
      result[
        duplicateIndex
      ] = item;
    }
  }

  return result;
};

const containsSimilarText = (
  text: string,
  items:
    Array<{
      text: string;
    }>,
  threshold =
    0.56
): boolean => {
  return items.some(
    item =>
      textSimilarity(
        text,
        item.text
      ) >= threshold
  );
};

/* ============================================================================
   KPI AUDIT
============================================================================ */

interface KpiAuditResponse {
  missing_kpis: any[];
}

const extractNumericLines = (
  transcript: string
): string[] => {
  return transcript
    .split(/\n+/)
    .map(
      line =>
        line.trim()
    )
    .filter(
      line =>
        /\d|[٠-٩]|%|بالمئة|في المئة/
          .test(line)
    )
    .slice(
      0,
      100
    );
};

const auditKpis = async (
  transcript: string,
  analysis:
    MeetingAnalysis,
  signal?:
    AbortSignal
): Promise<{
  analysis:
    MeetingAnalysis;

  model?: string;
}> => {
  const currentKpis =
    analysis.kpis.map(
      item => ({
        name:
          item.name,

        value:
          item
            .reported_value,

        context:
          item.context,

        quote:
          item.evidence
            .quote
      })
    );

  const result =
    await runWithFallback(
      "KPI_AUDIT",

      KPI_AUDIT_MODELS,

      KPI_AUDIT_PROMPT,

      `
نص الاجتماع الكامل:

${transcript}

المؤشرات الحالية:

${JSON.stringify(
  currentKpis,
  null,
  2
)}

الأسطر المحتوية على أرقام أو نسب:

${JSON.stringify(
  extractNumericLines(
    transcript
  ),
  null,
  2
)}
      `.trim(),

      {
        temperature: 0,

        jsonMode: true,

        jsonTemplate:
          KPI_AUDIT_JSON_TEMPLATE,

        jsonExtraInstructions:
          `
استخدم المفتاح missing_kpis فقط.
لا ترجع أي مؤشر موجود مسبقًا.
لا ترجع عناصر فارغة.
          `,

        maxOutputTokens:
          8000,

        signal
      }
    );

  const parsed =
    parseJsonSafely<KpiAuditResponse>(
      result.text
    );

  const missing =
    safeArray<any>(
      parsed
        ?.missing_kpis
    )
      .filter(
        item =>
          isMeaningfulText(
            item?.name
          ) &&
          isMeaningfulText(
            item
              ?.reported_value
          )
      )
      .map(
        (
          item,
          index
        ) =>
          normalizeKpi(
            item,
            analysis
              .kpis.length +
              index,
            transcript
          )
      )
      .filter(
        item =>
          item.confidence >=
            MIN_AUDIT_CONFIDENCE
      )
      .slice(
        0,
        MAX_AUDIT_ITEMS
      );

  analysis.kpis =
    deduplicateKpis([
      ...analysis.kpis,
      ...missing
    ]);

  return {
    analysis,

    model:
      result.model
  };
};

/* ============================================================================
   EXECUTIVE AUDIT
============================================================================ */

interface ExecutiveAuditResponse {
  missing_decisions: any[];

  missing_directives: any[];

  missing_action_items: any[];

  missing_ongoing_actions:
    any[];

  missing_status_updates:
    any[];

  missing_proposals: any[];

  missing_risks: any[];

  missing_follow_ups: any[];

  missing_open_questions:
    any[];
}

const auditExecutiveCoverage =
  async (
    transcript: string,

    analysis:
      MeetingAnalysis,

    signal?:
      AbortSignal
  ): Promise<{
    analysis:
      MeetingAnalysis;

    model?: string;
  }> => {
    const current = {
      decisions:
        analysis.decisions
          .map(
            item =>
              item.text
          ),

      directives:
        analysis.directives
          .map(
            item =>
              item.text
          ),

      action_items:
        analysis.action_items
          .map(
            item => ({
              text:
                item.text,

              owner:
                item.owner,

              deadline:
                item
                  .deadline_text
            })
          ),

      ongoing_actions:
        analysis
          .ongoing_actions
          .map(
            item =>
              item.text
          ),

      status_updates:
        analysis
          .status_updates
          .map(
            item =>
              item.text
          ),

      proposals:
        analysis.proposals
          .map(
            item =>
              item.text
          ),

      risks:
        analysis.risks
          .map(
            item => ({
              text:
                item.text,

              level:
                item.level
            })
          ),

      follow_ups:
        analysis.follow_ups
          .map(
            item =>
              item.text
          ),

      open_questions:
        analysis
          .open_questions
          .map(
            item =>
              item.text
          )
    };

    const result =
      await runWithFallback(
        "EXECUTIVE_AUDIT",

        EXECUTIVE_AUDIT_MODELS,

        EXECUTIVE_AUDIT_PROMPT,

        `
نص الاجتماع الكامل:

${transcript}

العناصر الحالية:

${JSON.stringify(
  current,
  null,
  2
)}
        `.trim(),

        {
          temperature: 0,

          jsonMode: true,

          jsonTemplate:
            EXECUTIVE_AUDIT_JSON_TEMPLATE,

          jsonExtraInstructions:
            `
استخدم المفاتيح الموجودة في القالب فقط.
لا ترجع عناصر فارغة.
لا تعد عنصرًا موجودًا.
            `,

          maxOutputTokens:
            10000,

          signal
        }
      );

    const parsed =
      parseJsonSafely<ExecutiveAuditResponse>(
        result.text
      );

    const normalized =
      normalizeAnalysis(
        {
          meeting: {
            description: "",

            classification:
              "أخرى",

            objective: "",

            completion_status:
              "غير واضح",

            executive_summary:
              ""
          },

          topics: [],

          kpis: [],

          decisions:
            parsed
              ?.missing_decisions,

          directives:
            parsed
              ?.missing_directives,

          action_items:
            parsed
              ?.missing_action_items,

          ongoing_actions:
            parsed
              ?.missing_ongoing_actions,

          status_updates:
            parsed
              ?.missing_status_updates,

          proposals:
            parsed
              ?.missing_proposals,

          risks:
            parsed
              ?.missing_risks,

          follow_ups:
            parsed
              ?.missing_follow_ups,

          open_questions:
            parsed
              ?.missing_open_questions,

          management_attention:
            [],

          quality_notes:
            []
        },

        transcript
      );

    const accept = <
      T extends {
        confidence:
          number;
      }
    >(
      items: T[]
    ): T[] => {
      return items
        .filter(
          item =>
            item.confidence >=
              MIN_AUDIT_CONFIDENCE
        )
        .slice(
          0,
          MAX_AUDIT_ITEMS
        );
    };

    analysis.decisions =
      deduplicateByText([
        ...analysis.decisions,

        ...accept(
          normalized
            .decisions
        )
      ]);

    analysis.directives =
      deduplicateByText([
        ...analysis.directives,

        ...accept(
          normalized
            .directives
        )
      ]);

    analysis.action_items =
      deduplicateByText([
        ...analysis
          .action_items,

        ...accept(
          normalized
            .action_items
        )
      ]);

    analysis.ongoing_actions =
      deduplicateByText([
        ...analysis
          .ongoing_actions,

        ...accept(
          normalized
            .ongoing_actions
        )
      ]);

    analysis.status_updates =
      deduplicateByText([
        ...analysis
          .status_updates,

        ...accept(
          normalized
            .status_updates
        )
      ]);

    analysis.proposals =
      deduplicateByText([
        ...analysis
          .proposals,

        ...accept(
          normalized
            .proposals
        )
      ]);

    analysis.risks =
      deduplicateByText([
        ...analysis.risks,

        ...accept(
          normalized.risks
        )
      ]);

    analysis.follow_ups =
      deduplicateByText([
        ...analysis.follow_ups,

        ...accept(
          normalized
            .follow_ups
        )
      ]);

    analysis.open_questions =
      deduplicateByText([
        ...analysis
          .open_questions,

        ...accept(
          normalized
            .open_questions
        )
      ]);

    return {
      analysis,

      model:
        result.model
    };
  };

/* ============================================================================
   UNIQUE IDS
============================================================================ */

const refreshIds = (
  analysis:
    MeetingAnalysis
): MeetingAnalysis => {
  analysis.decisions =
    analysis.decisions.map(
      (
        item,
        index
      ) => ({
        ...item,

        id:
          generateId(
            "decision",
            index
          )
      })
    );

  analysis.directives =
    analysis.directives.map(
      (
        item,
        index
      ) => ({
        ...item,

        id:
          generateId(
            "directive",
            index
          )
      })
    );

  analysis.action_items =
    analysis.action_items.map(
      (
        item,
        index
      ) => ({
        ...item,

        id:
          generateId(
            "task",
            index
          )
      })
    );

  analysis.ongoing_actions =
    analysis.ongoing_actions.map(
      (
        item,
        index
      ) => ({
        ...item,

        id:
          generateId(
            "ongoing",
            index
          )
      })
    );

  analysis.status_updates =
    analysis.status_updates.map(
      (
        item,
        index
      ) => ({
        ...item,

        id:
          generateId(
            "status",
            index
          )
      })
    );

  analysis.proposals =
    analysis.proposals.map(
      (
        item,
        index
      ) => ({
        ...item,

        id:
          generateId(
            "proposal",
            index
          )
      })
    );

  analysis.follow_ups =
    analysis.follow_ups.map(
      (
        item,
        index
      ) => ({
        ...item,

        id:
          generateId(
            "follow-up",
            index
          )
      })
    );

  analysis.open_questions =
    analysis.open_questions.map(
      (
        item,
        index
      ) => ({
        ...item,

        id:
          generateId(
            "question",
            index
          )
      })
    );

  analysis.risks =
    analysis.risks.map(
      (
        item,
        index
      ) => ({
        ...item,

        id:
          generateId(
            "risk",
            index
          )
      })
    );

  return analysis;
};

/* ============================================================================
   REVIEW
============================================================================ */

const collectReviewCandidates = (
  analysis:
    MeetingAnalysis
): ReviewCandidate[] => {
  const candidates:
    ReviewCandidate[] = [];

  const add = (
    item:
      BaseMeetingItem,

    owner =
      "غير محدد",

    ownerSource:
      OwnerSource =
      "unknown",

    ownerEvidence =
      "",

    deadline =
      ""
  ) => {
    if (
      !item.requires_review
    ) {
      return;
    }

    candidates.push({
      id:
        item.id,

      current_type:
        item.item_type,

      text:
        item.text,

      owner,

      owner_source:
        ownerSource,

      owner_evidence:
        ownerEvidence,

      deadline_text:
        deadline,

      evidence_quote:
        item.evidence
          .quote,

      confidence:
        item.confidence
    });
  };

  analysis.decisions
    .forEach(
      item =>
        add(
          item,
          item.owner,
          item
            .owner_source,
          item
            .owner_evidence
        )
    );

  analysis.directives
    .forEach(
      item =>
        add(
          item,
          item.owner,
          item
            .owner_source,
          item
            .owner_evidence
        )
    );

  analysis.action_items
    .forEach(
      item =>
        add(
          item,
          item.owner,
          item
            .owner_source,
          item
            .owner_evidence,
          item
            .deadline_text
        )
    );

  analysis.ongoing_actions
    .forEach(
      item =>
        add(
          item,
          item.owner,
          item
            .owner_source
        )
    );

  analysis.status_updates
    .forEach(
      item =>
        add(item)
    );

  analysis.proposals
    .forEach(
      item =>
        add(item)
    );

  analysis.follow_ups
    .forEach(
      item =>
        add(
          item,
          item.owner,
          item
            .owner_source
        )
    );

  analysis.open_questions
    .forEach(
      item =>
        add(item)
    );

  return candidates.slice(
    0,
    MAX_REVIEW_ITEMS
  );
};

const findReviewableItem = (
  analysis:
    MeetingAnalysis,
  id: string
): any => {
  return [
    ...analysis.decisions,
    ...analysis.directives,
    ...analysis.action_items,
    ...analysis.ongoing_actions,
    ...analysis.status_updates,
    ...analysis.proposals,
    ...analysis.follow_ups,
    ...analysis.open_questions
  ].find(
    item =>
      item.id === id
  );
};

const removeReviewableItem = (
  analysis:
    MeetingAnalysis,
  id: string
): void => {
  analysis.decisions =
    analysis.decisions
      .filter(
        item =>
          item.id !== id
      );

  analysis.directives =
    analysis.directives
      .filter(
        item =>
          item.id !== id
      );

  analysis.action_items =
    analysis.action_items
      .filter(
        item =>
          item.id !== id
      );

  analysis.ongoing_actions =
    analysis.ongoing_actions
      .filter(
        item =>
          item.id !== id
      );

  analysis.status_updates =
    analysis.status_updates
      .filter(
        item =>
          item.id !== id
      );

  analysis.proposals =
    analysis.proposals
      .filter(
        item =>
          item.id !== id
      );

  analysis.follow_ups =
    analysis.follow_ups
      .filter(
        item =>
          item.id !== id
      );

  analysis.open_questions =
    analysis.open_questions
      .filter(
        item =>
          item.id !== id
      );
};

const normalizeTaskStatus = (
  value: string
): string => {
  const normalized =
    normalizeArabicForMatch(
      value
    );

  if (
    normalized.includes(
      "new task"
    ) ||
    normalized.includes(
      "pending"
    ) ||
    normalized.includes(
      "open"
    ) ||
    normalized.includes(
      "مفتوح"
    )
  ) {
    return "مفتوح";
  }

  if (
    normalized.includes(
      "ongoing"
    ) ||
    normalized.includes(
      "progress"
    ) ||
    normalized.includes(
      "جاري"
    )
  ) {
    return "جاري";
  }

  if (
    normalized.includes(
      "complete"
    ) ||
    normalized.includes(
      "closed"
    ) ||
    normalized.includes(
      "مكتمل"
    ) ||
    normalized.includes(
      "مغلق"
    )
  ) {
    return "مكتمل";
  }

  return isMeaningfulText(
    value
  )
    ? value
    : "مفتوح";
};

const insertReviewedItem = (
  analysis:
    MeetingAnalysis,

  original:
    any,

  reviewed:
    ReviewResultItem
): void => {
  const base:
    BaseMeetingItem = {
    id:
      original.id,

    item_type:
      reviewed
        .corrected_type,

    text:
      normalizeText(
        reviewed
          .corrected_text,
        original.text
      ),

    evidence:
      original.evidence,

    confidence:
      clampConfidence(
        reviewed.confidence
      ),

    requires_review:
      false
  };

  const owner =
    normalizeText(
      reviewed
        .corrected_owner
    );

  const ownerSource =
    validOwnerSource(
      reviewed
        .corrected_owner_source
    );

  switch (
    reviewed.corrected_type
  ) {
    case "decision":
      analysis.decisions
        .push({
          ...base,

          item_type:
            "decision",

          owner,

          owner_source:
            ownerSource,

          owner_evidence:
            original
              .owner_evidence ||
            "",

          status:
            original.status ||
            "غير محدد"
        });

      break;

    case "directive":
      analysis.directives
        .push({
          ...base,

          item_type:
            "directive",

          owner,

          owner_source:
            ownerSource,

          owner_evidence:
            original
              .owner_evidence ||
            ""
        });

      break;

    case "new_task":
      analysis.action_items
        .push({
          ...base,

          item_type:
            "new_task",

          owner,

          owner_source:
            ownerSource,

          owner_evidence:
            original
              .owner_evidence ||
            "",

          deadline_text:
            normalizeText(
              reviewed
                .corrected_deadline,
              original
                .deadline_text ||
              "غير محدد"
            ),

          deadline_iso:
            original
              .deadline_iso ||
            null,

          deadline_source:
            original
              .deadline_source ||
            "not_mentioned",

          deadline_confidence:
            original
              .deadline_confidence ||
            0,

          status:
            normalizeTaskStatus(
              original.status ||
              "مفتوح"
            ),

          priority:
            original.priority ||
            "غير محدد"
        });

      break;

    case "ongoing_action":
      analysis
        .ongoing_actions
        .push({
          ...base,

          item_type:
            "ongoing_action",

          owner,

          owner_source:
            ownerSource,

          status:
            "جاري"
        });

      break;

    case "status_update":
      analysis
        .status_updates
        .push({
          ...base,

          item_type:
            "status_update",

          status:
            original.status ||
            "غير محدد"
        });

      break;

    case "proposal":
      analysis.proposals
        .push({
          ...base,

          item_type:
            "proposal",

          adopted:
            false
        });

      break;

    case "follow_up":
      analysis.follow_ups
        .push({
          ...base,

          item_type:
            "follow_up",

          owner,

          owner_source:
            ownerSource
        });

      break;

    case "open_question":
      analysis
        .open_questions
        .push({
          ...base,

          item_type:
            "open_question"
        });

      break;
  }
};

const applyReview = (
  analysis:
    MeetingAnalysis,

  review:
    ReviewResponse
): MeetingAnalysis => {
  for (
    const reviewed
    of safeArray<ReviewResultItem>(
      review?.items
    )
  ) {
    const original =
      findReviewableItem(
        analysis,
        reviewed.id
      );

    if (!original) {
      continue;
    }

    removeReviewableItem(
      analysis,
      reviewed.id
    );

    if (
      !reviewed.keep
    ) {
      continue;
    }

    insertReviewedItem(
      analysis,
      original,
      reviewed
    );
  }

  return analysis;
};

const reviewLowConfidenceItems =
  async (
    analysis:
      MeetingAnalysis,

    transcript: string,

    signal?:
      AbortSignal
  ): Promise<{
    analysis:
      MeetingAnalysis;

    model?: string;
  }> => {
    if (
      !getGroqApiKey()
    ) {
      return {
        analysis
      };
    }

    const candidates =
      collectReviewCandidates(
        analysis
      );

    if (
      candidates.length === 0
    ) {
      return {
        analysis
      };
    }

    const result =
      await runWithFallback(
        "REVIEW",

        REVIEW_MODELS,

        REVIEW_PROMPT,

        JSON.stringify(
          {
            transcript,
            candidates
          },
          null,
          2
        ),

        {
          temperature: 0,

          jsonSchema:
            REVIEW_SCHEMA,

          maxOutputTokens:
            7000,

          signal
        }
      );

    const parsed =
      parseJsonSafely<ReviewResponse>(
        result.text
      );

    return {
      analysis:
        applyReview(
          analysis,
          parsed
        ),

      model:
        result.model
    };
  };

/* ============================================================================
   RISK NORMALIZATION
============================================================================ */

const inferRiskCategory = (
  risk:
    MeetingRisk
): string => {
  if (
    isMeaningfulText(
      risk.category
    )
  ) {
    return risk.category;
  }

  const text =
    normalizeArabicForMatch(
      `${risk.text} ${risk.impact} ${risk.evidence.quote}`
    );

  if (
    /اصابه|سقوط|سلامه|تصريح|عزل|كهربا|باسكت|سله|مفتوح|انقلاب/
      .test(text)
  ) {
    return "سلامة";
  }

  if (
    /اشراف|ابلاغ|حوكم|مقاول|مسؤول/
      .test(text)
  ) {
    return "حوكمة";
  }

  if (
    /انقطاع|شبكه|تشغيل|مغذي|موثوق/
      .test(text)
  ) {
    return "تشغيل";
  }

  if (
    /بيانات|نظام|تقرير/
      .test(text)
  ) {
    return "بيانات";
  }

  if (
    /مشروع|مواد|تاخير|نقل/
      .test(text)
  ) {
    return "مشروع";
  }

  return "تشغيل";
};

const inferRiskLevel = (
  risk:
    MeetingRisk
): RiskLevel => {
  if (
    risk.level !==
      "غير محدد"
  ) {
    return risk.level;
  }

  const text =
    normalizeArabicForMatch(
      `${risk.text} ${risk.impact} ${risk.evidence.quote}`
    );

  if (
    /اصابه|سقوط|تصريح.*غير مغلق|شحن.*قبل|معدات.*مفتوح|متهالك|غير مؤهل|انقلاب|بدون عزل/
      .test(text)
  ) {
    return "عالٍ";
  }

  if (
    /تاخير|ضعف.*اشراف|عدم.*ابلاغ|معلق|نقص|تراكم/
      .test(text)
  ) {
    return "متوسط";
  }

  return "منخفض";
};

const inferRiskLikelihood = (
  risk:
    MeetingRisk
): RiskLikelihood => {
  if (
    risk.likelihood !==
      "غير محدد"
  ) {
    return risk.likelihood;
  }

  const text =
    normalizeArabicForMatch(
      `${risk.text} ${risk.evidence.quote}`
    );

  if (
    /اسبوعي|متكرر|كل يوم|مستمر|اكثر من/
      .test(text)
  ) {
    return "عالية";
  }

  if (
    /وجدنا|ظهر|حصل|معلق|قديم|مفتوح/
      .test(text)
  ) {
    return "متوسطة";
  }

  return "منخفضة";
};

/* ============================================================================
   CROSS-CATEGORY CONFLICTS
============================================================================ */

const removeCrossCategoryConflicts = (
  analysis:
    MeetingAnalysis
): MeetingAnalysis => {
  const approvedItems = [
    ...analysis.decisions,

    ...analysis.directives,

    ...analysis.action_items
  ];

  /*
   * إذا تم اعتماد الاقتراح أو أصبح مهمة،
   * لا يظهر مرة أخرى ضمن المقترحات.
   */
  analysis.proposals =
    analysis.proposals.filter(
      proposal =>
        !proposal.adopted &&
        !containsSimilarText(
          proposal.text,
          approvedItems,
          0.52
        )
    );

  /*
   * إذا أظهر تحديث الحالة أن الموضوع أغلق،
   * لا يظهر كسؤال مفتوح.
   */
  const closedUpdates =
    analysis.status_updates
      .filter(
        item =>
          /اغلاق|اغلق|تم الاغلاق|مغلق|اكتمل|انتهى/
            .test(
              normalizeArabicForMatch(
                `${item.text} ${item.status}`
              )
            )
      );

  analysis.open_questions =
    analysis.open_questions
      .filter(
        question =>
          !containsSimilarText(
            question.text,
            closedUpdates,
            0.45
          )
      );

  /*
   * لا نكرر المهمة نفسها كمتابعة
   * إلا إذا كانت المتابعة مختلفة بوضوح.
   */
  analysis.follow_ups =
    analysis.follow_ups.filter(
      followUp =>
        !containsSimilarText(
          followUp.text,
          analysis
            .action_items,
          0.72
        )
    );

  return analysis;
};

/* ============================================================================
   FINAL ANALYSIS
============================================================================ */

const finalizeAnalysis = (
  analysis:
    MeetingAnalysis
): MeetingAnalysis => {
  analysis.kpis =
    deduplicateKpis(
      analysis.kpis
    );

  analysis.decisions =
    deduplicateByText(
      analysis.decisions
    );

  analysis.directives =
    deduplicateByText(
      analysis.directives
    );

  analysis.action_items =
  deduplicateByText(
    analysis.action_items
      .map(
        item => ({
          ...item,

          status:
            normalizeTaskStatus(
              item.status
            )
        })
      ),

    0.55
  );

  analysis.ongoing_actions =
    deduplicateByText(
      analysis
        .ongoing_actions
    );

  analysis.status_updates =
    deduplicateByText(
      analysis
        .status_updates
    );

  analysis.proposals =
    deduplicateByText(
      analysis.proposals
    );

  analysis.follow_ups =
    deduplicateByText(
      analysis.follow_ups
    );

  analysis.open_questions =
    deduplicateByText(
      analysis
        .open_questions
    );

  analysis.risks =
    deduplicateByText(
      analysis.risks
        .filter(
          risk =>
            isMeaningfulText(
              risk.text
            )
        )
        .map(
          risk => ({
            ...risk,

            category:
              inferRiskCategory(
                risk
              ),

            level:
              inferRiskLevel(
                risk
              ),

            likelihood:
              inferRiskLikelihood(
                risk
              )
          })
        )
    );

  analysis =
    removeCrossCategoryConflicts(
      analysis
    );

  if (
    analysis.meeting
      .classification ===
      "أخرى"
  ) {
    if (
      analysis.kpis.length >=
        3
    ) {
      analysis.meeting
        .classification =
          "مراجعة أداء";
    } else if (
      analysis.action_items
        .length >= 2 ||
      analysis.risks
        .length >= 2
    ) {
      analysis.meeting
        .classification =
          "اجتماع تشغيلي";
    }
  }

  return refreshIds(
    analysis
  );
};

/* ============================================================================
   IMPORTANCE SCORING
============================================================================ */

const kpiImportance = (
  kpi:
    MeetingKpi
): number => {
  const text =
    normalizeArabicForMatch(
      `${kpi.name} ${kpi.context} ${kpi.category}`
    );

  let score =
    kpi.confidence * 10;

  if (
    /%|نسبه|امتثال|تدريب|اداء/
      .test(text)
  ) {
    score += 5;
  }

  if (
    /مستهدف|مقابل|انخفاض|ارتفاع|تحسن|تراجع/
      .test(text)
  ) {
    score += 5;
  }

  if (
    /سلامه|خطر|انذار|ملاحظه|انقطاع/
      .test(text)
  ) {
    score += 4;
  }

  if (
    /تحتاج تحقق|غير موكد|محل تحقق/
      .test(text)
  ) {
    score -= 4;
  }

  if (
    kpi.data_freshness ===
      "previous_period"
  ) {
    score -= 2;
  }

  if (
    kpi
      .data_quality_status ===
      "system_unavailable"
  ) {
    score -= 3;
  }

  return score;
};

const taskImportance = (
  task:
    MeetingActionItem
): number => {
  let score =
    task.confidence * 10;

  if (
    task.priority ===
      "عالية"
  ) {
    score += 6;
  }

  if (
    task.priority ===
      "متوسطة"
  ) {
    score += 3;
  }

  if (
    task.owner !==
      "غير محدد"
  ) {
    score += 2;
  }

  if (
    task.deadline_text !==
      "غير محدد"
  ) {
    score += 2;
  }

  return score;
};

const riskImportance = (
  risk:
    MeetingRisk
): number => {
  let score =
    risk.confidence * 10;

  if (
    risk.level ===
      "عالٍ"
  ) {
    score += 8;
  }

  if (
    risk.level ===
      "متوسط"
  ) {
    score += 4;
  }

  if (
    risk.likelihood ===
      "عالية"
  ) {
    score += 4;
  }

  if (
    risk.likelihood ===
      "متوسطة"
  ) {
    score += 2;
  }

  if (
    risk.unresolved
  ) {
    score += 2;
  }

  return score;
};

/* ============================================================================
   REPORT SELECTION
============================================================================ */

const selectTopKpis = (
  analysis:
    MeetingAnalysis
): MeetingKpi[] => {
  return [
    ...analysis.kpis
  ]
    .sort(
      (
        first,
        second
      ) =>
        kpiImportance(
          second
        ) -
        kpiImportance(
          first
        )
    )
    .slice(
      0,
      REPORT_LIMITS.maxKpis
    );
};

const selectTopDecisionTexts = (
  analysis:
    MeetingAnalysis
): string[] => {
  const combined = [
    ...analysis.decisions
      .map(
        item => ({
          text:
            item.text,

          confidence:
            item.confidence +
            0.05
        })
      ),

    ...analysis.directives
      .map(
        item => ({
          text:
            item.text,

          confidence:
            item.confidence
        })
      )
  ];

  return deduplicateByText(
    combined,
    0.64
  )
    .sort(
      (
        first,
        second
      ) =>
        second.confidence -
        first.confidence
    )
    .slice(
      0,
      REPORT_LIMITS
        .maxDecisionsAndDirectives
    )
    .map(
      item =>
        item.text
    );
};

const selectTopTasks = (
  analysis:
    MeetingAnalysis
): MeetingActionItem[] => {
  return [
    ...analysis.action_items
  ]
    .sort(
      (
        first,
        second
      ) =>
        taskImportance(
          second
        ) -
        taskImportance(
          first
        )
    )
    .slice(
      0,
      REPORT_LIMITS.maxTasks
    );
};

const selectTopRisks = (
  analysis:
    MeetingAnalysis
): MeetingRisk[] => {
  return [
    ...analysis.risks
  ]
    .sort(
      (
        first,
        second
      ) =>
        riskImportance(
          second
        ) -
        riskImportance(
          first
        )
    )
    .slice(
      0,
      REPORT_LIMITS.maxRisks
    );
};

interface FollowUpCandidate {
  text: string;
  owner: string;
  confidence: number;
}

const selectTopFollowUps = (
  analysis:
    MeetingAnalysis
): Array<{
  text: string;
  owner?: string;
}> => {
  const candidates:
    FollowUpCandidate[] = [
      ...analysis.follow_ups
        .map(
          item => ({
            text:
              item.text,

            owner:
              item.owner,

            confidence:
              item.confidence +
              0.08
          })
        ),

      ...analysis
        .management_attention
        .map(
          item => ({
            text:
              item.text,

            owner:
              "غير محدد",

            confidence:
              item.confidence +
              0.06
          })
        ),

      ...analysis
        .ongoing_actions
        .map(
          item => ({
            text:
              item.text,

            owner:
              item.owner,

            confidence:
              item.confidence
          })
        ),

      ...analysis
        .status_updates
        .map(
          item => ({
            text:
              item.text,

            owner:
              "غير محدد",

            confidence:
              item.confidence -
              0.03
          })
        ),

      ...analysis.proposals
        .map(
          item => ({
            text:
              item.text,

            owner:
              "غير محدد",

            confidence:
              item.confidence -
              0.06
          })
        ),

      ...analysis
        .open_questions
        .map(
          item => ({
            text:
              item.text,

            owner:
              "غير محدد",

            confidence:
              item.confidence -
              0.04
          })
        )
    ];

  return deduplicateByText(
    candidates,
    0.64
  )
    .sort(
      (
        first,
        second
      ) =>
        second.confidence -
        first.confidence
    )
    .slice(
      0,
      REPORT_LIMITS
        .maxFollowUps
    )
    .map(
      item => ({
        text:
          item.text,

        owner:
          item.owner
      })
    );
};

/* ============================================================================
   REPORT HELPERS
============================================================================ */

const escapeMarkdownCell = (
  value: string
): string => {
  return normalizeText(
    value
  )
    .replace(
      /\|/g,
      "\\|"
    )
    .replace(
      /\n+/g,
      " "
    );
};

const renderBulletSection = (
  title: string,
  items: string[],
  emptyText: string
): string => {
  const validItems =
    items.filter(
      isMeaningfulText
    );

  const content =
  validItems.length > 0
    ? validItems
        .map(
          item =>
            `- ${item.replace(
              /\n/g,
              "\n  "
            )}`
        )
        .join("\n")
    : emptyText;

  return `## ${title}\n\n${content}`;
};

const renderKpiText = (
  kpi:
    MeetingKpi
): string => {
  const notes:
    string[] = [];

  const combinedText =
    normalizeArabicForMatch(
      `${kpi.reported_value} ${kpi.context}`
    );

  if (
    /تقريب|تقدير|نحو|حوالي/
      .test(combinedText)
  ) {
    notes.push(
      "تقديري"
    );
  }

  if (
    /تحتاج تحقق|غير موكد|محل تحقق/
      .test(
        normalizeArabicForMatch(
          kpi.context
        )
      )
  ) {
    notes.push(
      "يحتاج تحققًا"
    );
  }

  if (
    kpi.data_freshness ===
      "previous_period"
  ) {
    notes.push(
      "بيانات فترة سابقة"
    );
  }

  if (
    kpi
      .data_quality_status ===
      "system_unavailable"
  ) {
    notes.push(
      "جودة البيانات متأثرة بتعطل النظام"
    );
  }

  return `${kpi.name}: ${kpi.reported_value}${
    notes.length > 0
      ? ` — ${notes.join(" — ")}`
      : ""
  }`;
};

const renderRiskText = (
  risk: MeetingRisk
): string => {
  const riskText =
    cleanSentenceEnding(
      risk.text
    );

  if (
    isMeaningfulText(
      risk.mitigation
    )
  ) {
    return `${riskText}.  \n**المعالجة:** ${cleanSentenceEnding(
  risk.mitigation
)}.`;
  }

  return `${riskText}.`;
};

/* ============================================================================
   EXECUTIVE SUMMARY
============================================================================ */
const cleanSentenceEnding = (
  value: string
): string => {
  return value
    .trim()
    .replace(/[.،؛:]+$/g, "")
    .trim();
};

const isSummaryDuplicate = (
  newText: string,
  existingTexts: string[],
  threshold = 0.48
): boolean => {
  return existingTexts.some(
    existingText =>
      textSimilarity(
        newText,
        existingText
      ) >= threshold
  );
};

const pushUniqueSummarySentence = (
  sentences: string[],
  coveredIdeas: string[],
  ideaText: string,
  sentence: string
): void => {
  if (
    !isMeaningfulText(
      ideaText
    )
  ) {
    return;
  }

  if (
    isSummaryDuplicate(
      ideaText,
      coveredIdeas
    )
  ) {
    return;
  }

  coveredIdeas.push(
    ideaText
  );

  sentences.push(
    sentence
  );
};





const buildExecutiveSummary = (
  analysis: MeetingAnalysis
): string => {
  const sentences: string[] = [];

  /*
   * نخزن الأفكار التي ظهرت،
   * وليس الجمل فقط.
   */
  const coveredIdeas: string[] = [];

  const kpis =
    selectTopKpis(
      analysis
    );

  const decisions =
    selectTopDecisionTexts(
      analysis
    );

  const tasks =
    selectTopTasks(
      analysis
    );

  const risks =
    selectTopRisks(
      analysis
    );

  /*
   * لا نعيد وصف الاجتماع هنا؛
   * لأنه ظاهر في القسم السابق.
   */

  if (
    kpis.length > 0
  ) {
    const selectedKpis =
      kpis.slice(0, 3);

    const kpiIdea =
      selectedKpis
        .map(
          item =>
            `${item.name} ${item.reported_value}`
        )
        .join(" ");

    pushUniqueSummarySentence(
      sentences,
      coveredIdeas,
      kpiIdea,
      `استعرض الاجتماع أبرز المؤشرات، ومنها ${selectedKpis
        .map(
          item =>
            `${cleanSentenceEnding(
              item.name
            )} ${cleanSentenceEnding(
              item.reported_value
            )}`
        )
        .join("، ")}.`
    );
  }

  if (
    risks.length > 0
  ) {
    const selectedRisks =
      risks.slice(0, 2);

    const riskIdea =
      selectedRisks
        .map(
          item =>
            item.text
        )
        .join(" ");

    pushUniqueSummarySentence(
      sentences,
      coveredIdeas,
      riskIdea,
      `تركزت أبرز المخاطر في ${selectedRisks
        .map(
          item =>
            cleanSentenceEnding(
              item.text
            )
        )
        .join("، ")}.`
    );
  }

  /*
   * نختار أول قرار غير مكرر مع ما سبق.
   */
  const mainDecision =
    decisions.find(
      decision =>
        !isSummaryDuplicate(
          decision,
          coveredIdeas
        )
    );

  if (
    mainDecision
  ) {
    pushUniqueSummarySentence(
      sentences,
      coveredIdeas,
      mainDecision,
      `تم اعتماد أو توجيه ${cleanSentenceEnding(
        mainDecision
      )}.`
    );
  }

  /*
   * لا نعرض المهمة إذا كانت مجرد تنفيذ
   * لنفس القرار المذكور في الخلاصة.
   */
  const mainTask =
    tasks.find(
      task =>
        !isSummaryDuplicate(
          task.text,
          coveredIdeas,
          0.42
        )
    );

  if (
    mainTask
  ) {
    const owner =
      mainTask.owner !==
        "غير محدد"
        ? `، والمسؤول ${mainTask.owner}`
        : "";

    const deadline =
      mainTask.deadline_text !==
        "غير محدد"
        ? `، والموعد ${mainTask.deadline_text}`
        : "";

    pushUniqueSummarySentence(
      sentences,
      coveredIdeas,
      mainTask.text,
      `أبرز مهمة متابعة هي ${cleanSentenceEnding(
        mainTask.text
      )}${owner}${deadline}.`
    );
  }

  return sentences
    .slice(
      0,
      REPORT_LIMITS
        .executiveSummarySentences
    )
    .join(" ");
};

/* ============================================================================
   REPORT
============================================================================ */

const renderReport = (
  analysis:
    MeetingAnalysis,

  meetingTitle?:
    string,

  meetingDate?:
    string,

  meetingDay?:
    string
): string => {
  const sections:
    string[] = [];

  if (
    meetingTitle ||
    meetingDate
  ) {
    const header:
      string[] = [];

    if (
      meetingTitle
    ) {
      header.push(
        `# ${meetingTitle}`
      );
    }

    if (
      meetingDate
    ) {
      header.push(
        `**تاريخ الاجتماع:** ${meetingDate}`
      );

      const day =
        meetingDay ||
        getArabicDayName(
          meetingDate
        );

      if (day) {
        header.push(
          `**يوم الاجتماع:** ${day}`
        );
      }
    }

    sections.push(
      header.join("\n")
    );
  }

  /*
   * القسم الأول:
   * دمج الوصف والتصنيف.
   */
  sections.push(
    `## وصف الاجتماع وتصنيفه

${analysis.meeting.description}

**التصنيف:** ${analysis.meeting.classification}`
  );

  /*
   * القسم الثاني:
   * الخلاصة في البداية.
   */
  sections.push(
    `## الخلاصة التنفيذية

${buildExecutiveSummary(
  analysis
)}`
  );

  /*
   * القسم الثالث:
   * أهم 8 مؤشرات فقط.
   */
  const topKpis =
    selectTopKpis(
      analysis
    );

  sections.push(
    renderBulletSection(
      "أهم المؤشرات",

      topKpis.map(
        renderKpiText
      ),

      "لم يتم مناقشة مؤشرات أداء رئيسية."
    )
  );

  /*
   * القسم الرابع:
   * دمج القرارات والتوجيهات.
   */
  const decisionTexts =
    selectTopDecisionTexts(
      analysis
    );

  sections.push(
    renderBulletSection(
      "القرارات والتوجيهات",

      decisionTexts,

      "لا توجد قرارات أو توجيهات صريحة."
    )
  );

  /*
   * القسم الخامس:
   * أهم 7 مهام.
   */
  const tasks =
    selectTopTasks(
      analysis
    );

  if (
    tasks.length > 0
  ) {
    const rows =
      tasks
        .map(
          item =>
            `| ${escapeMarkdownCell(item.text)} | ${escapeMarkdownCell(item.owner)} | ${escapeMarkdownCell(item.deadline_text)} | ${escapeMarkdownCell(normalizeTaskStatus(item.status))} |`
        )
        .join("\n");

    sections.push(
      `## المهام المطلوبة

| المهمة | المسؤول | الموعد النهائي | الحالة |
|---|---|---|---|
${rows}`
    );
  } else {
    sections.push(
      `## المهام المطلوبة

لا توجد مهام جديدة محددة بدليل واضح.`
    );
  }

  /*
   * القسم السادس:
   * أهم 4 مخاطر.
   */
  const risks =
    selectTopRisks(
      analysis
    );

  sections.push(
    renderBulletSection(
      "المخاطر والمعوقات",

      risks.map(
        renderRiskText
      ),

      "لم يتم مناقشة مخاطر أو معوقات رئيسية."
    )
  );

  /*
   * القسم السابع:
   * دمج المتابعات والإجراءات الجارية
   * وتحديثات الحالة المهمة.
   */
  const followUps =
    selectTopFollowUps(
      analysis
    );

  sections.push(
  renderBulletSection(
    "المتابعات",

    followUps.map(
      item =>
        item.text
    ),

    "لا توجد عناصر متابعة رئيسية."
  )
);
  return sections
    .join(
      "\n\n---\n\n"
    )
    .trim();
};

/* ============================================================================
   ERROR HANDLING
============================================================================ */

const formatUserFriendlyError = (
  error: unknown
): Error => {
  const message =
    error instanceof Error
      ? error.message
      : "حدث خطأ غير متوقع.";

  const status =
    error instanceof Error
      ? (
          error as Error & {
            status?: number;
          }
        ).status
      : undefined;

  if (
    status === 401 ||
    message.includes(
      "401"
    )
  ) {
    return new Error(
      "مفتاح API غير صالح أو غير موجود."
    );
  }

  if (
    status === 429 ||
    message.includes(
      "429"
    ) ||
    message
      .toLowerCase()
      .includes(
        "quota"
      ) ||
    message
      .toLowerCase()
      .includes(
        "resource_exhausted"
      )
  ) {
    return new Error(
      "تم بلوغ حد الاستخدام المجاني. حاول لاحقًا."
    );
  }

  if (
    status === 503 ||
    message.includes(
      "503"
    ) ||
    message
      .toLowerCase()
      .includes(
        "unavailable"
      )
  ) {
    return new Error(
      "النموذج غير متاح مؤقتًا بسبب الضغط."
    );
  }

  if (
    message
      .toLowerCase()
      .includes(
        "failed to fetch"
      )
  ) {
    return new Error(
      "تعذر الاتصال بالخدمة. تحقق من الإنترنت أو إعدادات CORS."
    );
  }

  if (
    message
      .toLowerCase()
      .includes(
        "aborted"
      )
  ) {
    return new Error(
      "تم إلغاء العملية."
    );
  }

  return new Error(
    message
  );
};

/* ============================================================================
   RUN CONTROL
============================================================================ */

let currentRunId:
  string | null = null;

let currentAbortController:
  AbortController | null =
    null;

const startNewRun = (): {
  runId: string;

  controller:
    AbortController;
} => {
  currentAbortController
    ?.abort();

  const runId =
    typeof crypto !==
      "undefined" &&
    crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;

  const controller =
    new AbortController();

  currentRunId =
    runId;

  currentAbortController =
    controller;

  return {
    runId,
    controller
  };
};

const assertCurrentRun = (
  runId: string
): void => {
  if (
    currentRunId !==
    runId
  ) {
    throw new Error(
      "تم تجاهل نتيجة قديمة بسبب بدء تحليل جديد."
    );
  }
};

/* ============================================================================
   SERVICE
============================================================================ */

export const governanceService = {
  cancelCurrentProcess: () => {
    currentAbortController
      ?.abort();
  },

  transcribeAudio:
    async (
      file: File
    ): Promise<string> => {
      try {
        const fileBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(",")[1];
            resolve(base64);
          };
          reader.onerror = (error) => reject(error);
        });

        const response = await fetch("/api/governance/transcribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fileBase64,
            fileName: file.name,
            fileType: file.type
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errText = errData.error || await response.text();
          throw new Error(errText);
        }

        const data = await response.json();
        if (!data?.text || typeof data.text !== "string") {
          throw new Error("لم ترجع خدمة التفريغ نصًا صالحًا.");
        }

        return data.text.trim();
      } catch (error) {
        throw formatUserFriendlyError(error);
      }
    },

  processTranscriptDetailed:
    async (
      rawTranscript:
        string,

      updateStep: (
        id: number,

        status:
          GovernanceStepStatus
      ) => void,

      meetingTitle?:
        string,

      meetingDate?:
        string,

      meetingDay?:
        string
    ): Promise<ProcessTranscriptResult> => {
      const startedAt =
        performance.now();

      const {
        runId,
        controller
      } =
        startNewRun();

      const modelsUsed:
        ProcessTranscriptResult["modelsUsed"] =
        {};

      try {
        initialSteps
          .forEach(
            step => {
              updateStep(
                step.id,
                "pending"
              );
            }
          );

        if (
          !rawTranscript ||
          rawTranscript
            .trim()
            .length < 10
        ) {
          throw new Error(
            "نص الاجتماع فارغ أو قصير جدًا."
          );
        }

        /* ================================================================
           STEP 1: CLEAN
        ================================================================= */

        updateStep(
          1,
          "loading"
        );

        const cleanResult =
          await runWithFallback(
            "CLEAN",

            CLEAN_MODELS,

            CLEAN_PROMPT,

            rawTranscript.trim(),

            {
              temperature: 0,

              maxOutputTokens:
                18000,

              signal:
                controller.signal
            }
          );

        assertCurrentRun(
          runId
        );

        modelsUsed.clean =
          cleanResult.model;

        const cleanedTranscript =
          cleanResult.text;

        updateStep(
          1,
          "success"
        );

        /* ================================================================
           STEP 2: ANALYSIS
        ================================================================= */

        updateStep(
          2,
          "loading"
        );

        const analysisResult =
          await runWithFallback(
            "ANALYSIS",

            ANALYSIS_MODELS,

            ANALYSIS_PROMPT,

            cleanedTranscript,

            {
              temperature:
                0.05,

              jsonMode:
                true,

              jsonTemplate:
                ANALYSIS_JSON_TEMPLATE,

              jsonExtraInstructions:
                `
استخرج المضمون كاملًا دون تكرار.
استخدم مصفوفة فارغة عند عدم وجود عنصر.
لا تكتب صفوفًا نموذجية فارغة.
                `,

              maxOutputTokens:
                18000,

              signal:
                controller.signal
            }
          );

        assertCurrentRun(
          runId
        );

        modelsUsed.analysis =
          analysisResult.model;

        let analysis =
          normalizeAnalysis(
            parseJsonSafely<any>(
              analysisResult.text
            ),

            cleanedTranscript
          );

        updateStep(
          2,
          "success"
        );

        /* ================================================================
           STEP 3: KPI AUDIT
        ================================================================= */

        updateStep(
          3,
          "loading"
        );

        try {
          const audited =
            await auditKpis(
              cleanedTranscript,
              analysis,
              controller.signal
            );

          assertCurrentRun(
            runId
          );

          analysis =
            audited.analysis;

          if (
            audited.model
          ) {
            modelsUsed.kpiAudit =
              audited.model;
          }
        } catch (
          auditError
        ) {
          console.warn(
            "KPI audit skipped:",
            auditError
          );
        }

        updateStep(
          3,
          "success"
        );

        /* ================================================================
           STEP 4: EXECUTIVE AUDIT
        ================================================================= */

        updateStep(
          4,
          "loading"
        );

        try {
          const audited =
            await auditExecutiveCoverage(
              cleanedTranscript,
              analysis,
              controller.signal
            );

          assertCurrentRun(
            runId
          );

          analysis =
            audited.analysis;

          if (
            audited.model
          ) {
            modelsUsed
              .executiveAudit =
                audited.model;
          }
        } catch (
          auditError
        ) {
          console.warn(
            "Executive audit skipped:",
            auditError
          );
        }

        updateStep(
          4,
          "success"
        );

        /*
         * منع تكرار المعرّفات قبل إرسال العناصر للمراجع.
         */
        analysis =
          refreshIds(
            analysis
          );

        /* ================================================================
           STEP 5: REVIEW
        ================================================================= */

        updateStep(
          5,
          "loading"
        );

        try {
          const reviewed =
            await reviewLowConfidenceItems(
              analysis,
              cleanedTranscript,
              controller.signal
            );

          assertCurrentRun(
            runId
          );

          analysis =
            reviewed.analysis;

          if (
            reviewed.model
          ) {
            modelsUsed.review =
              reviewed.model;
          }
        } catch (
          reviewError
        ) {
          /*
           * فشل المراجع لا يوقف التقرير.
           */
          console.warn(
            "Review skipped:",
            reviewError
          );
        }

        updateStep(
          5,
          "success"
        );

        /*
         * التنظيف النهائي وإزالة التعارضات.
         */
        analysis =
  preserveOriginalNames(
    analysis,
    `${rawTranscript}\n${cleanedTranscript}`
  );

analysis =
  finalizeAnalysis(
    analysis
  );

        /* ================================================================
           STEP 6: REPORT
        ================================================================= */

        updateStep(
          6,
          "loading"
        );

        const report =
          renderReport(
            analysis,
            meetingTitle,
            meetingDate,
            meetingDay
          );

        assertCurrentRun(
          runId
        );

        updateStep(
          6,
          "success"
        );

        return {
          runId,

          report,

          analysis,

          cleanedTranscript,

          modelsUsed,

          processingTimeMs:
            Math.round(
              performance.now() -
              startedAt
            )
        };
      } catch (error) {
        console.error(
          "Governance Error:",
          error
        );

        initialSteps
          .forEach(
            step => {
              updateStep(
                step.id,
                "error"
              );
            }
          );

        throw formatUserFriendlyError(
          error
        );
      }
    },

  /*
   * متوافق مع استدعاء منصتك السابق.
   * يعيد التقرير النصي فقط.
   */

  processTranscript:
    async (
      rawTranscript:
        string,

      updateStep: (
        id: number,

        status:
          GovernanceStepStatus
      ) => void,

      meetingTitle?:
        string,

      meetingDate?:
        string,

      meetingDay?:
        string
    ): Promise<string> => {
      const result =
        await governanceService
          .processTranscriptDetailed(
            rawTranscript,
            updateStep,
            meetingTitle,
            meetingDate,
            meetingDay
          );

      return result.report;
    }
};