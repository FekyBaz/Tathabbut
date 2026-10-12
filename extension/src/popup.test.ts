// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "./policy";
import { STATUS_KEY } from "./diagnostics";
import popupHtml from "./popup.html?raw";

function popupBodyHtml(): string {
  const match = popupHtml.match(/<body>([\s\S]*)<\/body>/);
  if (!match) throw new Error("popup.html has no body");
  return match[1];
}

let storedSettings: unknown;
let localStore: Record<string, unknown>;
let localGetFails: boolean;

function installPopupChromeStub(): void {
  const sync = {
    get: vi.fn(async (keys: unknown) => {
      if (typeof keys === "string" && keys === "tathabbutSettings") {
        return { tathabbutSettings: storedSettings };
      }
      return {};
    }),
    set: vi.fn(async () => undefined)
  };
  const local = {
    get: vi.fn(async (keys: unknown) => {
      if (localGetFails) throw new Error("storage unavailable");
      const names = typeof keys === "string" ? [keys] : (keys as string[]);
      const out: Record<string, unknown> = {};
      for (const name of names ?? []) {
        if (name in localStore) out[name] = localStore[name];
      }
      return out;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(localStore, items);
    })
  };
  const permissions = {
    contains: vi.fn(async () => true),
    request: vi.fn(async () => true),
    remove: vi.fn(async () => undefined)
  };
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: { sync, local },
    permissions
  };
}

function freshSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    startedAt: Date.now() - 1000,
    settingsOk: true,
    enabled: true,
    threshold: 0.85,
    categories: 4,
    apiMode: "local",
    articlesFound: 5,
    evaluated: 5,
    classified: 5,
    hidden: 2,
    lastReason: "rule-match",
    origin: "www.facebook.com",
    updatedAt: Date.now(),
    ...overrides
  };
}

function text(id: string): string {
  const element = document.getElementById(id);
  if (!element) throw new Error("missing popup element: " + id);
  return element.textContent ?? "";
}

async function settle(milliseconds = 50): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

beforeEach(() => {
  document.body.innerHTML = popupBodyHtml();
  installPopupChromeStub();
  storedSettings = { ...DEFAULT_SETTINGS };
  localStore = {};
  localGetFails = false;
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

async function loadPopupModule() {
  vi.resetModules();
  await import("./popup");
  await settle();
}

describe("popup diagnostics panel", () => {
  it("renders the stored status into the panel", async () => {
    localStore[STATUS_KEY] = freshSnapshot();
    await loadPopupModule();
    expect(text("st-source")).toBe("www.facebook.com");
    expect(text("st-articles")).toBe("5");
    expect(text("st-counts")).toBe("5 / 5 / 2");
    expect(text("st-started")).toContain("Running since");
    expect(text("st-settings")).toContain("threshold 0.85");
  });

  it("shows a readable error when status storage fails", async () => {
    localGetFails = true;
    await loadPopupModule();
    expect(text("st-started")).toContain("Could not read diagnostic storage");
    expect(text("st-articles")).toBe("—");
  });

  it("reports a missing snapshot honestly", async () => {
    await loadPopupModule();
    expect(text("st-started")).toContain("Not reported yet");
  });

  it("labels a stale snapshot as stale", async () => {
    localStore[STATUS_KEY] = freshSnapshot({ updatedAt: Date.now() - 10 * 60_000 });
    await loadPopupModule();
    expect(text("st-started")).toContain("stale");
    expect(text("st-articles")).toBe("5");
  });

  it("persists the debug toggle to device-local storage", async () => {
    await loadPopupModule();
    const toggle = document.getElementById("debug") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    expect(localStore["tathabbutDebug"]).toBe(true);
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    expect(localStore["tathabbutDebug"]).toBe(false);
  });

  it("refresh re-reads the panel", async () => {
    localStore[STATUS_KEY] = freshSnapshot({ articlesFound: 5 });
    await loadPopupModule();
    expect(text("st-articles")).toBe("5");
    localStore[STATUS_KEY] = freshSnapshot({ articlesFound: 9 });
    (document.getElementById("refreshStatus") as HTMLButtonElement).click();
    await settle();
    expect(text("st-articles")).toBe("9");
  });
});
