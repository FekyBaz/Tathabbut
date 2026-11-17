import { DEFAULT_SETTINGS, type Category, type UserSettings } from "./policy";
import { DEBUG_FLAG_KEY, STATUS_KEY, statusViewModel, type ContentStatus } from "./diagnostics";
import { pickLanguage, t, type Language, type LocaleStrings } from "./i18n";

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error("Missing popup element: " + id);
  return element as T;
};

let lang: Language = "ar";
let strings: LocaleStrings = t(lang);

function applyDocumentLanguage(): void {
  document.documentElement.lang = strings.htmlLang;
  document.documentElement.dir = strings.dir;
  document.title = strings.documentTitle;
}

const enabled = byId<HTMLInputElement>("enabled");
const threshold = byId<HTMLInputElement>("threshold");
const thresholdValue = byId<HTMLElement>("thresholdValue");
const status = byId<HTMLElement>("status");
const debugToggle = byId<HTMLInputElement>("debug");
const languageSelect = byId<HTMLSelectElement>("language");
const stStarted = byId<HTMLElement>("st-started");
const stSettings = byId<HTMLElement>("st-settings");
const stArticles = byId<HTMLElement>("st-articles");
const stCounts = byId<HTMLElement>("st-counts");
const stReason = byId<HTMLElement>("st-reason");
const stUpdated = byId<HTMLElement>("st-updated");
const stSource = byId<HTMLElement>("st-source");
const stSkips = byId<HTMLElement>("st-skips");

function selectedCategories(): Category[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[name="category"]:checked'))
    .map((input) => input.value)
    .filter((value): value is Category => DEFAULT_SETTINGS.enabledCategories.includes(value as Category));
}

function settingsFromStored(value: unknown): UserSettings {
  const candidate = value && typeof value === "object" ? value as Partial<UserSettings> : undefined;
  return {
    enabled: typeof candidate?.enabled === "boolean" ? candidate.enabled : DEFAULT_SETTINGS.enabled,
    enabledCategories: Array.isArray(candidate?.enabledCategories)
      ? candidate.enabledCategories.filter((item): item is Category =>
          DEFAULT_SETTINGS.enabledCategories.includes(item as Category))
      : [...DEFAULT_SETTINGS.enabledCategories],
    threshold: typeof candidate?.threshold === "number" && candidate.threshold >= 0 && candidate.threshold <= 1
      ? candidate.threshold : DEFAULT_SETTINGS.threshold,
    language: pickLanguage(candidate?.language)
  };
}

function hasLegacyApiUrl(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "apiUrl"));
}

async function removeLegacyApiPermission(value: unknown): Promise<boolean> {
  if (typeof value !== "string" || !value.trim()) return true;
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) return true;
    const origin = parsed.protocol + "//" + parsed.hostname + "/*";
    if (!await chrome.permissions.contains({ origins: [origin] })) return true;
    return await chrome.permissions.remove({ origins: [origin] });
  } catch {
    return false;
  }
}

function renderTexts(): void {
  strings = t(lang);
  applyDocumentLanguage();
  byId("appSubtitle").textContent = strings.appSubtitle;
  byId("enabledLabel").textContent = strings.enableFiltering;
  byId("categoriesLegend").textContent = strings.categoriesLegend;
  byId("cat-harassment").textContent = strings.categoryHarassment;
  byId("cat-hate").textContent = strings.categoryHate;
  byId("cat-threats").textContent = strings.categoryThreats;
  byId("cat-spam").textContent = strings.categorySpam;
  byId("thresholdLabel").textContent = strings.thresholdLabel;
  byId("languageLabel").textContent = strings.languageLabel;
  byId("lang-ar").textContent = strings.languageNameAr;
  byId("lang-en").textContent = strings.languageNameEn;
  byId("save").textContent = strings.saveButton;
  byId("diagnosticsLegend").textContent = strings.diagnosticsLegend;
  byId("diagnosticsToggle").textContent = strings.diagnosticsToggle;
  byId("diagnosticsHint").textContent = strings.diagnosticsHint;
  byId("dt-started").textContent = strings.rowStarted;
  byId("dt-settings").textContent = strings.rowSettings;
  byId("dt-articles").textContent = strings.rowArticles;
  byId("dt-counts").textContent = strings.rowCounts;
  byId("dt-reason").textContent = strings.rowReason;
  byId("dt-skips").textContent = strings.rowSkips;
  byId("dt-updated").textContent = strings.rowUpdated;
  byId("dt-source").textContent = strings.rowSource;
  byId("tabNote").textContent = strings.tabNote;
  byId("refreshStatus").textContent = strings.refreshButton;
}

function reflectThreshold(): void {
  thresholdValue.textContent = threshold.value + "%";
}
threshold.addEventListener("input", reflectThreshold);

async function readStatus(): Promise<{ snapshot?: ContentStatus; storageError: boolean }> {
  try {
    const stored = await chrome.storage.local.get(STATUS_KEY);
    const snapshot = stored[STATUS_KEY] as ContentStatus | undefined;
    if (!snapshot || typeof snapshot !== "object" || typeof snapshot.updatedAt !== "number") {
      return { snapshot: undefined, storageError: false };
    }
    return { snapshot, storageError: false };
  } catch {
    return { snapshot: undefined, storageError: true };
  }
}

function renderStatus(input: { snapshot?: ContentStatus; storageError: boolean }): void {
  const view = statusViewModel(input, lang);
  stStarted.textContent = view.started;
  stSettings.textContent = view.settings;
  stArticles.textContent = view.articles;
  stCounts.textContent = view.counts;
  stReason.textContent = view.reason;
  stUpdated.textContent = view.updated;
  stSource.textContent = view.source;
  stSkips.textContent = view.skips;
}

async function loadDiagnostics(): Promise<void> {
  try {
    const stored = await chrome.storage.local.get(DEBUG_FLAG_KEY);
    debugToggle.checked = stored[DEBUG_FLAG_KEY] === true;
  } catch {
    debugToggle.checked = false;
  }
  renderStatus(await readStatus());
}

debugToggle.addEventListener("change", async () => {
  try {
    await chrome.storage.local.set({ [DEBUG_FLAG_KEY]: debugToggle.checked });
  } catch {
    status.textContent = strings.statusDiagSaveFailed;
  }
});

byId<HTMLButtonElement>("refreshStatus").addEventListener("click", async () => {
  renderStatus(await readStatus());
});

async function persistLanguage(next: Language): Promise<void> {
  lang = next;
  renderTexts();
  try {
    const stored = await chrome.storage.sync.get("tathabbutSettings");
    const saved = settingsFromStored(stored.tathabbutSettings);
    const hadLegacyApiUrl = hasLegacyApiUrl(stored.tathabbutSettings);
    await chrome.storage.sync.set({
      tathabbutSettings: { ...saved, enabledCategories: [...saved.enabledCategories], language: next }
    });
    if (hadLegacyApiUrl) {
      status.textContent = await removeLegacyApiPermission(stored.tathabbutSettings.apiUrl)
        ? strings.statusLegacyApiRemoved : strings.statusLegacyApiPermissionNotRemoved;
    }
  } catch {
    status.textContent = strings.statusSaveFailed;
  }
  renderStatus(await readStatus());
}

languageSelect.addEventListener("change", () => {
  void persistLanguage(pickLanguage(languageSelect.value));
});

async function load(): Promise<void> {
  renderTexts();
  try {
    const stored = await chrome.storage.sync.get("tathabbutSettings");
    const value = settingsFromStored(stored.tathabbutSettings);
    const hadLegacyApiUrl = hasLegacyApiUrl(stored.tathabbutSettings);
    lang = pickLanguage(value.language);
    renderTexts();
    enabled.checked = value.enabled;
    threshold.value = String(Math.round(value.threshold * 100));
    languageSelect.value = lang;
    document.querySelectorAll<HTMLInputElement>('input[name="category"]').forEach((input) => {
      input.checked = value.enabledCategories.includes(input.value as Category);
    });
    reflectThreshold();
    if (hadLegacyApiUrl) {
      await chrome.storage.sync.set({
        tathabbutSettings: { ...value, enabledCategories: [...value.enabledCategories] }
      });
      status.textContent = await removeLegacyApiPermission(stored.tathabbutSettings.apiUrl)
        ? strings.statusLegacyApiRemoved : strings.statusLegacyApiPermissionNotRemoved;
    }
  } catch {
    status.textContent = strings.statusLoadFailed;
  }
  await loadDiagnostics();
}

byId<HTMLButtonElement>("save").addEventListener("click", async () => {
  try {
    const value: UserSettings = {
      enabled: enabled.checked,
      enabledCategories: selectedCategories(),
      threshold: Number(threshold.value) / 100,
      language: pickLanguage(languageSelect.value)
    };
    await chrome.storage.sync.set({ tathabbutSettings: value });
    status.textContent = strings.statusSavedLocal;
  } catch {
    status.textContent = strings.statusSaveFailed;
  }
});
void load();
