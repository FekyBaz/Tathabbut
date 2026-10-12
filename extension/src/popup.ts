import { DEFAULT_SETTINGS, type Category, type UserSettings } from "./policy";
import { apiPermissionPattern, normalizeApiUrl } from "./remote-api";
import { DEBUG_FLAG_KEY, STATUS_KEY, statusViewModel, type ContentStatus } from "./diagnostics";

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
const debugToggle = byId<HTMLInputElement>("debug");
const stStarted = byId<HTMLElement>("st-started");
const stSettings = byId<HTMLElement>("st-settings");
const stArticles = byId<HTMLElement>("st-articles");
const stCounts = byId<HTMLElement>("st-counts");
const stReason = byId<HTMLElement>("st-reason");
const stUpdated = byId<HTMLElement>("st-updated");
const stSource = byId<HTMLElement>("st-source");

function selectedCategories(): Category[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[name="category"]:checked'))
    .map((input) => input.value)
    .filter((value): value is Category => DEFAULT_SETTINGS.enabledCategories.includes(value as Category));
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
  const view = statusViewModel(input);
  stStarted.textContent = view.started;
  stSettings.textContent = view.settings;
  stArticles.textContent = view.articles;
  stCounts.textContent = view.counts;
  stReason.textContent = view.reason;
  stUpdated.textContent = view.updated;
  stSource.textContent = view.source;
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
    status.textContent = "Could not save the diagnostic setting.";
  }
});

byId<HTMLButtonElement>("refreshStatus").addEventListener("click", async () => {
  renderStatus(await readStatus());
});

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
  await loadDiagnostics();
}

byId<HTMLButtonElement>("save").addEventListener("click", async () => {
  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeApiUrl(apiUrl.value);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Enter a valid API URL.";
    return;
  }

  let newPermission: string | null = null;
  let permissionWasNewlyGranted = false;
  try {
    // Request permission directly from the save click before any asynchronous storage calls.
    if (normalizedUrl) {
      newPermission = apiPermissionPattern(normalizedUrl);
      // Start the permission check, but invoke request before yielding so it remains tied to the Save click.
      const wasGranted = chrome.permissions.contains({ origins: [newPermission] });
      const granted = await chrome.permissions.request({ origins: [newPermission] });
      if (!granted) {
        status.textContent = "API permission was not granted. Settings were not changed.";
        return;
      }
      permissionWasNewlyGranted = !(await wasGranted);
    }

    const stored = await chrome.storage.sync.get("tathabbutSettings");
    const oldValue = stored.tathabbutSettings as UserSettings | undefined;
    let oldUrl = "";
    try {
      oldUrl = oldValue?.apiUrl ? normalizeApiUrl(oldValue.apiUrl) : "";
    } catch {
      // A previously stored invalid URL is not trusted or reused.
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
        try {
          await chrome.permissions.remove({ origins: [oldPermission] });
        } catch {
          // Settings are already saved; failure to revoke the old optional grant is non-fatal.
        }
      }
    }
    status.textContent = normalizedUrl
      ? "Settings saved. Remote classification uses the granted host only."
      : "Settings saved. Local-only mode is active.";
  } catch {
    if (permissionWasNewlyGranted && newPermission) {
      await chrome.permissions.remove({ origins: [newPermission] }).catch(() => false);
    }
    status.textContent = "Could not save settings or update API permissions.";
  }
});
void load();
