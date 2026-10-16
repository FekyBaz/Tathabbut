// Centralized locale dictionary. Arabic is the product default; English is
// selectable. chrome.i18n is intentionally NOT used: it follows the browser
// UI language, while Tathabbut must default to Arabic independently of it.
// The stored setting keeps the technical enum value ("ar" | "en"); only
// displayed labels are localized, never identifiers or settings payloads.
export type Language = "ar" | "en";

export const LANGUAGES: readonly Language[] = ["ar", "en"];

export const DEFAULT_LANGUAGE: Language = "ar";

export interface LocaleStrings {
  dir: "rtl" | "ltr";
  htmlLang: string;
  documentTitle: string;
  appSubtitle: string;
  enableFiltering: string;
  categoriesLegend: string;
  categoryHarassment: string;
  categoryHate: string;
  categoryThreats: string;
  categorySpam: string;
  thresholdLabel: string;
  apiLabel: string;
  apiHint: string;
  saveButton: string;
  languageLabel: string;
  languageNameAr: string;
  languageNameEn: string;
  diagnosticsLegend: string;
  diagnosticsToggle: string;
  diagnosticsHint: string;
  tabNote: string;
  refreshButton: string;
  rowStarted: string;
  rowSettings: string;
  rowArticles: string;
  rowCounts: string;
  rowReason: string;
  rowSkips: string;
  rowUpdated: string;
  rowSource: string;
  statusLoadFailed: string;
  statusSavedLocal: string;
  statusSavedRemote: string;
  statusPermissionDenied: string;
  statusSaveFailed: string;
  statusDiagSaveFailed: string;
  apiErrorScheme: string;
  apiErrorCredentials: string;
  apiErrorQuery: string;
  apiErrorPath: string;
  apiErrorHttps: string;
  apiErrorInvalid: string;
  noticeHidden: string;
  noticeSupport: string;
  revealLabel: string;
  revealAria: string;
}

const en: LocaleStrings = {
  dir: "ltr",
  htmlLang: "en",
  documentTitle: "Tathabbut settings",
  appSubtitle: "Hide locally. Restore anytime.",
  enableFiltering: "Enable filtering",
  categoriesLegend: "Filter categories",
  categoryHarassment: "Personal insults / harassment",
  categoryHate: "Hateful or dehumanizing attacks",
  categoryThreats: "Threats of violence",
  categorySpam: "Spam",
  thresholdLabel: "Confidence threshold:",
  apiLabel: "Optional self-hosted API origin",
  apiHint: "Enter the origin only; /v1/classify is appended automatically. Leave blank for local-only mode. HTTPS is required except for localhost. You will be asked to grant access to this host. Never paste provider API keys here.",
  saveButton: "Save settings",
  languageLabel: "Language",
  languageNameAr: "Arabic",
  languageNameEn: "English",
  diagnosticsLegend: "Diagnostics",
  diagnosticsToggle: "Enable diagnostic mode (this device only)",
  diagnosticsHint: "Shows whether the content script runs and what it finds. Counts and reasons only — never post text or names, and nothing leaves this device.",
  tabNote: "With several Facebook tabs open, this reflects the most recently updated tab. Pinpointing the exact tab would need extra browser permissions, which this extension does not request.",
  refreshButton: "Refresh status",
  rowStarted: "Content script",
  rowSettings: "Settings",
  rowArticles: "Content units found",
  rowCounts: "Evaluated / classified / hidden / skipped",
  rowReason: "Last outcome",
  rowSkips: "Skipped by cause",
  rowUpdated: "Status updated",
  rowSource: "Reported from",
  statusLoadFailed: "Could not load settings; defaults are active.",
  statusSavedLocal: "Settings saved. Local-only mode is active.",
  statusSavedRemote: "Settings saved. Remote classification uses the granted host only.",
  statusPermissionDenied: "API permission was not granted. Settings were not changed.",
  statusSaveFailed: "Could not save settings or update API permissions.",
  statusDiagSaveFailed: "Could not save the diagnostic setting.",
  apiErrorScheme: "API URL must use HTTP or HTTPS.",
  apiErrorCredentials: "API URL must not contain credentials.",
  apiErrorQuery: "API URL must not contain a query string or fragment.",
  apiErrorPath: "Enter the API origin only; /v1/classify is appended automatically.",
  apiErrorHttps: "Non-local API URLs must use HTTPS.",
  apiErrorInvalid: "Enter a valid API URL.",
  noticeHidden: "This content was hidden by Tathabbut.",
  noticeSupport: "You can reveal it again.",
  revealLabel: "Reveal content",
  revealAria: "Reveal content hidden by Tathabbut"
};

const ar: LocaleStrings = {
  dir: "rtl",
  htmlLang: "ar",
  documentTitle: "إعدادات تثبّت",
  appSubtitle: "إخفاء محلي. استعادة في أي وقت.",
  enableFiltering: "تفعيل التصفية",
  categoriesLegend: "فئات التصفية",
  categoryHarassment: "الإهانات الشخصية والتحرش",
  categoryHate: "خطاب الكراهية أو نزع الإنسانية",
  categoryThreats: "التهديدات بالعنف",
  categorySpam: "المحتوى المزعج",
  thresholdLabel: "عتبة الثقة:",
  apiLabel: "عنوان واجهة API المستضافة ذاتيًا (اختياري)",
  apiHint: "أدخل الأصل فقط؛ تتم إضافة /v1/classify تلقائيًا. اتركه فارغًا للوضع المحلي فقط. يلزم HTTPS ما عدا localhost. سيُطلب منك منح الوصول إلى هذا المضيف. لا تلصق مفاتيح API هنا أبدًا.",
  saveButton: "حفظ الإعدادات",
  languageLabel: "اللغة",
  languageNameAr: "العربية",
  languageNameEn: "الإنجليزية",
  diagnosticsLegend: "التشخيص",
  diagnosticsToggle: "تفعيل وضع التشخيص (هذا الجهاز فقط)",
  diagnosticsHint: "يوضح ما إذا كان سكربت المحتوى يعمل وماذا يجد. أعداد وأسباب فقط — وليس نصوص المنشورات أو الأسماء أبدًا، ولا يغادر أي شيء هذا الجهاز.",
  tabNote: "عند فتح عدة تبويبات لفيسبوك، يعكس هذا آخر تبويب حُدّث. تحديد التبويب بدقة يحتاج أذونات متصفح إضافية، وهذه الإضافة لا تطلبها.",
  refreshButton: "تحديث الحالة",
  rowStarted: "سكربت المحتوى",
  rowSettings: "الإعدادات",
  rowArticles: "عناصر المحتوى المكتشفة",
  rowCounts: "تم التقييم / التصنيف / الإخفاء / التجاوز",
  rowReason: "آخر نتيجة",
  rowSkips: "المتجاوَز حسب السبب",
  rowUpdated: "آخر تحديث للحالة",
  rowSource: "مصدر التقرير",
  statusLoadFailed: "تعذر تحميل الإعدادات؛ الإعدادات الافتراضية نشطة.",
  statusSavedLocal: "تم حفظ الإعدادات. الوضع المحلي فقط نشط.",
  statusSavedRemote: "تم حفظ الإعدادات. التصنيف عن بُعد يستخدم المضيف المصرّح به فقط.",
  statusPermissionDenied: "لم يُمنح إذن الواجهة. لم تتغير الإعدادات.",
  statusSaveFailed: "تعذر حفظ الإعدادات أو تحديث أذونات الواجهة.",
  statusDiagSaveFailed: "تعذر حفظ إعداد التشخيص.",
  apiErrorScheme: "يجب أن يستخدم عنوان API بروتوكول HTTP أو HTTPS.",
  apiErrorCredentials: "يجب ألا يحتوي عنوان API على بيانات اعتماد.",
  apiErrorQuery: "يجب ألا يحتوي عنوان API على استعلام أو جزء.",
  apiErrorPath: "أدخل أصل الواجهة فقط؛ تتم إضافة /v1/classify تلقائيًا.",
  apiErrorHttps: "العناوين غير المحلية يجب أن تستخدم HTTPS.",
  apiErrorInvalid: "أدخل عنوان API صالحًا.",
  noticeHidden: "تم إخفاء هذا المحتوى بواسطة تثبّت.",
  noticeSupport: "يمكنك إظهار المحتوى مرة أخرى.",
  revealLabel: "إظهار المحتوى",
  revealAria: "إظهار المحتوى المخفي بواسطة تثبّت"
};

export const STRINGS: Record<Language, LocaleStrings> = { ar, en };

/** Resolve any stored value to a supported language; unknown means Arabic. */
export function pickLanguage(value: unknown): Language {
  return value === "en" ? "en" : "ar";
}

export function t(lang: Language): LocaleStrings {
  return STRINGS[lang];
}
