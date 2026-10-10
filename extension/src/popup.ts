import { DEFAULT_SETTINGS, type Category, type UserSettings } from "./policy";

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error("Missing popup element: " + id);
  return element as T;
};
const enabled = byId<HTMLInputElement>("enabled");
const threshold = byId<HTMLInputElement>("threshold");
const thresholdValue = byId<HTMLElement>("thresholdValue");
const apiUrl = byId<HTMLInputElement>("apiUrl");
const status = byId<HTMLElement>("status");

function selectedCategories(): Category[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[name="category"]:checked'))
    .map((input) => input.value)
    .filter((value): value is Category => DEFAULT_SETTINGS.enabledCategories.includes(value as Category));
}
function reflectThreshold(): void {
  thresholdValue.textContent = threshold.value + "%";
}
threshold.addEventListener("input", reflectThreshold);

async function load(): Promise<void> {
  try {
    const stored = await chrome.storage.sync.get("tathabbutSettings");
    const saved = stored.tathabbutSettings as UserSettings | undefined;
    const value = saved ?? DEFAULT_SETTINGS;
    enabled.checked = value.enabled;
    threshold.value = String(Math.round(value.threshold * 100));
    apiUrl.value = value.apiUrl ?? "";
    document.querySelectorAll<HTMLInputElement>('input[name="category"]').forEach((input) => {
      input.checked = value.enabledCategories.includes(input.value as Category);
    });
    reflectThreshold();
  } catch {
    status.textContent = "Could not load settings; defaults are active.";
  }
}
byId<HTMLButtonElement>("save").addEventListener("click", async () => {
  const rawUrl = apiUrl.value.trim();
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
    } catch {
      status.textContent = "Enter a valid HTTP(S) API URL without credentials.";
      return;
    }
  }
  const value: UserSettings = {
    enabled: enabled.checked,
    enabledCategories: selectedCategories(),
    threshold: Number(threshold.value) / 100,
    apiUrl: rawUrl.replace(/\/$/, "")
  };
  try {
    await chrome.storage.sync.set({ tathabbutSettings: value });
    status.textContent = "Settings saved. Reload Facebook to reprocess previous items.";
  } catch {
    status.textContent = "Could not save settings. Check extension storage permissions.";
  }
});
void load();
