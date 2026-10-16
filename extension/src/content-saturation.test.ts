// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "./policy";
import { DEBUG_FLAG_KEY, STATUS_KEY } from "./diagnostics";

// Isolated in its own file on purpose: every content-module import installs
// another live MutationObserver on the shared jsdom document, so exact
// submission counting is only deterministic with a single module instance.
let storedSettings: unknown;
let storedDebug: unknown;
let localSets: Array<Record<string, unknown>>;
let changeListeners: Array<(changes: Record<string, unknown>, area: string) => void>;

function installChromeStub(): void {
  changeListeners = [];
  localSets = [];
  const sync = {
    get: vi.fn(async (keys: unknown) => {
      if (typeof keys === "string" && keys === "tathabbutSettings") {
        return { tathabbutSettings: storedSettings };
      }
      return {};
    })
  };
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
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: { sync, local, onChanged },
    runtime: { sendMessage: vi.fn(async () => undefined) }
  };
}

async function settle(milliseconds = 500): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

beforeEach(() => {
  document.body.innerHTML = "";
  window.localStorage.clear();
  installChromeStub();
  storedSettings = { ...DEFAULT_SETTINGS };
  storedDebug = undefined;
  vi.restoreAllMocks();
});

afterEach(() => {
  document.body.innerHTML = "";
  window.localStorage.clear();
});

describe("queue saturation accounting", () => {
  it("counts a rejected submission only as skipped", async () => {
    document.body.innerHTML = '<div id="feed"></div>';
    vi.resetModules();
    const mod = await import("./content");
    const feed = document.getElementById("feed") as HTMLElement;
    for (let i = 0; i < 201; i++) {
      const el = document.createElement("div");
      el.setAttribute("role", "article");
      el.textContent = "You are an idiot number " + i;
      feed.appendChild(el);
      mod.evaluate(el);
    }
    await settle();
    const snapshots = localSets
      .map((items) => items[STATUS_KEY])
      .filter((value): value is Record<string, unknown> => !!value && typeof value === "object");
    expect(snapshots.length).toBeGreaterThan(0);
    const latest = snapshots[snapshots.length - 1] as unknown as {
      evaluated: number;
      skipped: number;
      classified: number;
    };
    // 200 submissions fit the bounded queue; at least the 201st is
    // rejected. Rejections (and only real submissions) drive the counters:
    // evaluated stays near the queue bound instead of counting every
    // observer re-entry, and every rejection surfaces as skipped.
    expect(latest.evaluated).toBeGreaterThanOrEqual(200);
    expect(latest.evaluated).toBeLessThan(250);
    expect(latest.skipped).toBeGreaterThanOrEqual(1);
    expect(latest.classified).toBeGreaterThanOrEqual(190);
  });
});
