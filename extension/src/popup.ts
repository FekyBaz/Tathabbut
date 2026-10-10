import { DEFAULT_SETTINGS, type Category, type UserSettings } from "./policy";
import { apiPermissionPattern, normalizeApiUrl } from "./remote-api";

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
  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeApiUrl(apiUrl.value);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Enter a valid API URL.";
    return;
  }

  try {
    const stored = await chrome.storage.sync.get("tathabbutSettings");
    const oldValue = stored.tathabbutSettings as UserSettings | undefined;
    let oldUrl = "";
    try {
      oldUrl = oldValue?.apiUrl ? normalizeApiUrl(oldValue.apiUrl) : "";
    } catch {
      // A previously stored invalid URL is not trusted or reused.
    }

    let newPermission: string | null = null;
    if (normalizedUrl) {
      newPermission = apiPermissionPattern(normalizedUrl);
      const alreadyGranted = await chrome.permissions.contains({ origins: [newPermission] });
      if (!alreadyGranted) {
        const granted = await chrome.permissions.request({ origins: [newPermission] });
        if (!granted) {
          status.textContent = "API permission was not granted. Settings were not changed.";
          return;
        }
      }
    }

    const value: UserSettings = {
      enabled: enabled.checked,
      enabledCategories: selectedCategories(),
      threshold: Number(threshold.value) / 100,
      apiUrl: normalizedUrl
    };
    await chrome.storage.sync.set({ tathabbutSettings: value });

    if (oldUrl) {
      const oldPermission = apiPermissionPattern(oldUrl);
      if (oldPermission !== newPermission) {
        await chrome.permissions.remove({ origins: [oldPermission] });
      }
    }
    status.textContent = normalizedUrl
      ? "Settings saved. Remote classification uses the granted host only."
      : "Settings saved. Local-only mode is active.";
  } catch {
    status.textContent = "Could not save settings or update API permissions.";
  }
});
void load();
