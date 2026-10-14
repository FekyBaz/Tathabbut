// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type UserSettings } from "./policy";
import { DEBUG_FLAG_KEY, STATUS_KEY } from "./diagnostics";

const SETTINGS_KEY = "tathabbutSettings";
const DEBUG_KEY = "tathabbutDebug";

const MATCHING_POST = "post-harass";
const CLEAN_POST = "post-clean";
const NESTED_PARENT = "post-nested";
const NESTED_CHILD = "comment-nested";
const STANDALONE_COMMENT = "comment-only";

function fixture(): string {
  return (
    '<div id="feed">' +
    '<div role="article" id="' + MATCHING_POST + '"><div class="post-body">You are an idiot</div></div>' +
    '<div role="article" id="' + CLEAN_POST + '"><div class="post-body">I love sunny days and long walks.</div></div>' +
    '<div role="article" id="' + NESTED_PARENT + '"><div class="post-body">Great match today!</div>' +
    '<div role="article" id="comment-nested"><span>You are a loser</span></div></div>' +
    '<div class="comment" id="' + STANDALONE_COMMENT + '"><span>Shut up, you are pathetic</span></div>' +
    "</div>"
  );
}

let storedSettings: unknown;
let storedDebug: unknown;
let localSets: Array<Record<string, unknown>>;
let changeListeners: Array<(changes: Record<string, unknown>, area: string) => void>;

function installChromeStub(): void {
  changeListeners = [];
  const sync = {
    get: vi.fn(async (keys: unknown) => {
      if (typeof keys === "string" && keys === SETTINGS_KEY) return { [SETTINGS_KEY]: storedSettings };
      return {};
    })
  };
  localSets = [];
  const local = {
    get: vi.fn(async (keys: unknown) => {
      const names = typeof keys === "string" ? [keys] : (keys as string[]);
      const out: Record<string, unknown> = {};
      for (const name of names ?? []) {
        if (name === DEBUG_FLAG_KEY) out[name] = storedDebug;
      }
      return out;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      localSets.push(items);
    })
  };
  const onChanged = {
    addListener: vi.fn((listener: (changes: Record<string, unknown>, area: string) => void) => {
      changeListeners.push(listener);
    })
  };
  const runtime = { sendMessage: vi.fn(async () => undefined) };
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: { sync, local, onChanged },
    runtime
  };
}

function fireStorageChange(area = "sync", changes: Record<string, unknown> = { [SETTINGS_KEY]: {} }): void {
  for (const listener of changeListeners) listener(changes, area);
}

async function loadContentModule() {
  vi.resetModules();
  return import("./content");
}

function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error("missing fixture element: " + id);
  return element;
}

function isHidden(element: HTMLElement): boolean {
  return (
    element.classList.contains("tathabbut-hidden") &&
    element.getAttribute("data-tathabbut-hidden") === "true"
  );
}

function revealButtons(element: HTMLElement): number {
  return element.querySelectorAll(":scope > .tathabbut-reveal").length;
}

async function settle(milliseconds = 150): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

beforeEach(() => {
  document.body.innerHTML = "";
  window.localStorage.clear();
  installChromeStub();
  storedSettings = undefined;
  storedDebug = undefined;
  vi.restoreAllMocks();
});

afterEach(() => {
  document.body.innerHTML = "";
  window.localStorage.clear();
});

describe("content lifecycle on feed fixtures", () => {
  it("hides a matching post once and reveals it reversibly", async () => {
    document.body.innerHTML = fixture();
    await loadContentModule();
    const post = byId(MATCHING_POST);
    await vi.waitFor(() => expect(isHidden(post)).toBe(true));
    expect(revealButtons(post)).toBe(1);

    const button = post.querySelector(".tathabbut-reveal") as HTMLButtonElement;
    button.click();
    expect(isHidden(post)).toBe(false);
    expect(revealButtons(post)).toBe(0);
  });

  it("leaves a clean post visible without controls", async () => {
    document.body.innerHTML = fixture();
    await loadContentModule();
    const post = byId(CLEAN_POST);
    await settle();
    expect(isHidden(post)).toBe(false);
    expect(revealButtons(post)).toBe(0);
  });

  it("does not reprocess an unchanged post", async () => {
    document.body.innerHTML = fixture();
    const mod = await loadContentModule();
    const post = byId(MATCHING_POST);
    await vi.waitFor(() => expect(isHidden(post)).toBe(true));
    mod.evaluate(post);
    mod.scan();
    await settle();
    expect(isHidden(post)).toBe(true);
    expect(revealButtons(post)).toBe(1);
  });

  it("classifies nested articles independently without hiding their parent", async () => {
    document.body.innerHTML = fixture();
    await loadContentModule();
    const parent = byId(NESTED_PARENT);
    const comment = byId(NESTED_CHILD);
    await vi.waitFor(() => expect(isHidden(comment)).toBe(true));
    expect(isHidden(parent)).toBe(false);
    expect(revealButtons(parent)).toBe(0);
    expect(revealButtons(comment)).toBe(1);
  });

  it("skips a standalone comment without an article role", async () => {
    document.body.innerHTML = fixture();
    await loadContentModule();
    const comment = byId(STANDALONE_COMMENT);
    await settle();
    expect(isHidden(comment)).toBe(false);
    expect(revealButtons(comment)).toBe(0);
  });

  it("hides nothing matching at a 99% threshold with stock rule scores", async () => {
    storedSettings = { ...DEFAULT_SETTINGS, threshold: 0.99 };
    document.body.innerHTML = fixture();
    await loadContentModule();
    const post = byId(MATCHING_POST);
    await settle();
    // Stock local scores top out at 0.90, so 0.99 hides nothing by design.
    expect(isHidden(post)).toBe(false);
  });

  it("hides nothing while disabled, then hides after re-enabling", async () => {
    storedSettings = { ...DEFAULT_SETTINGS, enabled: false };
    document.body.innerHTML = fixture();
    await loadContentModule();
    const post = byId(MATCHING_POST);
    await settle();
    expect(isHidden(post)).toBe(false);

    storedSettings = { ...DEFAULT_SETTINGS, enabled: true };
    fireStorageChange();
    await vi.waitFor(() => expect(isHidden(post)).toBe(true));
  });

  it("processes dynamically inserted posts through the observer", async () => {
    document.body.innerHTML = fixture();
    await loadContentModule();
    const feed = document.getElementById("feed") as HTMLElement;
    const added = document.createElement("div");
    added.setAttribute("role", "article");
    added.id = "post-late";
    added.textContent = "You are an idiot";
    feed.appendChild(added);
    await vi.waitFor(() => expect(isHidden(added)).toBe(true));
    expect(revealButtons(added)).toBe(1);
  });

  it("keeps the reveal control out of the classified text", async () => {
    document.body.innerHTML = fixture();
    const mod = await loadContentModule();
    const post = byId(MATCHING_POST);
    await vi.waitFor(() => expect(isHidden(post)).toBe(true));
    expect(mod.readText(post)).not.toContain("reveal");
  });

  it("writes a device-local status snapshot without post text", async () => {
    document.body.innerHTML = fixture();
    await loadContentModule();
    const post = byId(MATCHING_POST);
    await vi.waitFor(() => expect(isHidden(post)).toBe(true));
    let snapshots: Array<Record<string, unknown>> = [];
    await vi.waitFor(() => {
      snapshots = localSets
        .map((items) => items[STATUS_KEY])
        .filter((value): value is Record<string, unknown> => !!value && typeof value === "object");
      const done = snapshots[snapshots.length - 1] as unknown as { classified: number };
      expect(done.classified).toBeGreaterThanOrEqual(3);
    });
    const latest = snapshots[snapshots.length - 1] as unknown as {
      startedAt: number; settingsOk: boolean; articlesFound: number;
      evaluated: number; classified: number; hidden: number; lastReason: string;
    };
    expect(typeof latest.startedAt).toBe("number");
    expect(latest.settingsOk).toBe(true);
    expect(latest.articlesFound).toBe(4);
    expect(latest.classified).toBeGreaterThanOrEqual(3);
    expect(latest.hidden).toBeGreaterThanOrEqual(2);
    expect(typeof latest.lastReason).toBe("string");
    expect(typeof (latest as unknown as { skipped: unknown }).skipped).toBe("number");
    expect((latest as unknown as { skippedUnchanged: number }).skippedUnchanged).toBeGreaterThanOrEqual(0);
    expect((latest as unknown as { skippedEmpty: number }).skippedEmpty).toBeGreaterThanOrEqual(0);
    // Re-evaluations triggered by our own reveal-button insertions must
    // surface as unchanged skips, never as new submissions.
    await vi.waitFor(() => {
      const settled = localSets
        .map((items) => items[STATUS_KEY])
        .filter((value): value is Record<string, unknown> => !!value && typeof value === "object");
      const current = settled[settled.length - 1] as unknown as { skippedUnchanged: number };
      expect(current.skippedUnchanged).toBeGreaterThanOrEqual(1);
    });
    expect(typeof (latest as unknown as { origin: unknown }).origin).toBe("string");
    expect((latest as unknown as { origin: string }).origin).not.toContain("/");
    expect(JSON.stringify(snapshots)).not.toContain("You are an idiot");
    expect(JSON.stringify(snapshots)).not.toContain("sunny days");
    expect(JSON.stringify(snapshots)).not.toContain("You are a loser");
  });

  it("reports zero discovered articles on an empty feed", async () => {
    document.body.innerHTML = "";
    await loadContentModule();
    await settle();
    const snapshots = localSets
      .map((items) => items[STATUS_KEY])
      .filter((value): value is Record<string, unknown> => !!value && typeof value === "object");
    expect(snapshots.length).toBeGreaterThan(0);
    const latest = snapshots[snapshots.length - 1] as unknown as { articlesFound: number; evaluated: number };
    expect(latest.articlesFound).toBe(0);
    expect(latest.evaluated).toBe(0);
  });

  it("falls back to defaults and reports it when storage read fails", async () => {
    const chromeStub = (globalThis as unknown as { chrome: { storage: { sync: { get: unknown } } } }).chrome;
    chromeStub.storage.sync.get = vi.fn(async () => {
      throw new Error("storage unavailable");
    });
    document.body.innerHTML = fixture();
    await loadContentModule();
    const post = byId(MATCHING_POST);
    await vi.waitFor(() => expect(isHidden(post)).toBe(true));
    const snapshots = localSets
      .map((items) => items[STATUS_KEY])
      .filter((value): value is Record<string, unknown> => !!value && typeof value === "object");
    const latest = snapshots[snapshots.length - 1] as unknown as { settingsOk: boolean };
    expect(latest.settingsOk).toBe(false);
  });

  it("enables diagnostics through the stored flag, without console commands", async () => {
    document.body.innerHTML = fixture();
    await loadContentModule();
    const post = byId(MATCHING_POST);
    await vi.waitFor(() => expect(isHidden(post)).toBe(true));

    const seen: unknown[][] = [];
    const spy = vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
      seen.push(args);
    });
    try {
      storedDebug = true;
      fireStorageChange("local", { [DEBUG_FLAG_KEY]: true });
      await vi.waitFor(() => {
        const prefixed = seen.filter(
          (args) => typeof args[0] === "string" && (args[0] as string).startsWith("[Tathabbut debug]")
        );
        expect(prefixed.length).toBeGreaterThan(0);
      });
      expect(JSON.stringify(seen)).not.toContain("You are an idiot");
    } finally {
      spy.mockRestore();
    }
  });

  it("debug mode reports stages without logging post text", async () => {
    window.localStorage.setItem(DEBUG_KEY, "1");
    const seen: unknown[][] = [];
    const spy = vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
      seen.push(args);
    });
    try {
      document.body.innerHTML = fixture();
      await loadContentModule();
      const post = byId(MATCHING_POST);
      await vi.waitFor(() => expect(isHidden(post)).toBe(true));
      const prefixed = seen.filter(
        (args) => typeof args[0] === "string" && args[0].startsWith("[Tathabbut debug]")
      );
      expect(prefixed.length).toBeGreaterThan(0);
      const dumped = JSON.stringify(seen);
      expect(dumped).not.toContain("You are an idiot");
      expect(dumped).not.toContain("sunny days");
      expect(dumped).toContain("decision");
    } finally {
      spy.mockRestore();
    }
  });
});
