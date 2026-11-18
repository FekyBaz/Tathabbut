// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, classifyLocally, shouldHide, type UserSettings } from "./policy";
import { DEBUG_FLAG_KEY, STATUS_KEY } from "./diagnostics";

const SETTINGS_KEY = "tathabbutSettings";
const DEBUG_KEY = "tathabbutDebug";
const LIFECYCLE_KEY = "tathabbutLifecycleDebug";
const LIFECYCLE_PREFIX = "[Tathabbut:Lifecycle]";

const MATCHING_POST = "post-harass";
const CLEAN_POST = "post-clean";
const NESTED_PARENT = "post-nested";
const NESTED_CHILD = "comment-nested";
const STANDALONE_COMMENT = "comment-only";
const STANDALONE_THREAT = "threat-only";
const STANDALONE_PARAGRAPH = "paragraph-only";

function fixture(): string {
  return (
    '<div id="feed">' +
    '<div role="article" id="' + MATCHING_POST + '"><div class="post-body">You are an idiot</div></div>' +
    '<div role="article" id="' + CLEAN_POST + '"><div class="post-body">I love sunny days and long walks.</div></div>' +
    '<div role="article" id="' + NESTED_PARENT + '"><div class="post-body">Great match today!</div>' +
    '<div class="comment" id="comment-nested"><span>You are a loser</span></div></div>' +
    '<div role="article" id="harmful-parent-clean-reply"><div class="post-body">You are an idiot</div>' +
    '<div class="comment" id="clean-reply-inside-harmful-parent"><span>Thanks for explaining your point respectfully.</span></div></div>' +
    '<div data-testid="comment-123" id="testid-comment-prefix"><span>You are a loser</span></div>' +
    '<div data-testid="comments" id="comments-container">' +
    '<div data-testid="comment" id="' + STANDALONE_COMMENT + '"><span>Shut up, you are pathetic</span></div>' +
    '<div data-testid="comment" id="' + STANDALONE_THREAT + '"><span>سوف اقتلك</span></div>' +
    '<div data-testid="comment" id="respectful-comment"><span>I respectfully disagree with your opinion.</span></div>' +
    '</div>' +
    '<p id="' + STANDALONE_PARAGRAPH + '">You are an idiot</p>' +
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
    }),
    removeListener: vi.fn((listener: (changes: Record<string, unknown>, area: string) => void) => {
      const index = changeListeners.indexOf(listener);
      if (index >= 0) changeListeners.splice(index, 1);
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

let activeContent: typeof import("./content") | undefined;

function disposeActiveContent(): void {
  activeContent?.dispose();
  activeContent = undefined;
}

async function loadContentModule(): Promise<typeof import("./content")> {
  disposeActiveContent();
  vi.resetModules();
  const module = await import("./content");
  activeContent = module;
  return module;
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
  disposeActiveContent();
  document.body.innerHTML = "";
  window.localStorage.clear();
  installChromeStub();
  storedSettings = undefined;
  storedDebug = undefined;
  vi.restoreAllMocks();
});

afterEach(() => {
  disposeActiveContent();
  document.body.innerHTML = "";
  window.localStorage.clear();
});

describe("narrow hide targets (parent-container false positive)", () => {
  it("leaves a single-block article on the unit itself", async () => {
    document.body.innerHTML =
      '<div id="feed"><div role="article" id="solo"><div class="post-body">You are an idiot</div></div></div>';
    await loadContentModule();
    const solo = byId("solo");
    await vi.waitFor(() => expect(isHidden(solo)).toBe(true));
    expect(revealButtons(solo)).toBe(1);
  });

  it("restores only the narrowed target on reveal", async () => {
    document.body.innerHTML =
      '<div id="feed">' +
      '<div role="article" id="mixed-article">' +
      '<div class="post-body">I respectfully disagree with your opinion.</div>' +
      '<div class="plain-reply">You are an idiot</div>' +
      "</div></div>";
    await loadContentModule();
    const article = byId("mixed-article");
    const child = document.querySelector("#mixed-article .plain-reply") as HTMLElement;
    await vi.waitFor(() => expect(isHidden(child)).toBe(true));
    (child.querySelector(":scope > .tathabbut-reveal") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(isHidden(child)).toBe(false));
    expect(isHidden(article)).toBe(false);
    expect(revealButtons(child)).toBe(0);
  });

  it("keeps an explicitly revealed narrowed reply visible when sibling metadata changes", async () => {
    document.body.innerHTML =
      '<div id="feed">' +
      '<div role="article" id="mixed-article">' +
      '<div class="post-body">I respectfully disagree with your opinion.</div>' +
      '<div class="plain-reply">You are an idiot</div>' +
      '</div></div>';
    await loadContentModule();
    const article = byId("mixed-article");
    const child = document.querySelector("#mixed-article .plain-reply") as HTMLElement;
    await vi.waitFor(() => expect(isHidden(child)).toBe(true));

    (child.querySelector(":scope > .tathabbut-reveal") as HTMLButtonElement).click();
    expect(isHidden(child)).toBe(false);

    const timestamp = document.createElement("span");
    timestamp.id = "sibling-metadata";
    timestamp.textContent = " · 2 min";
    article.appendChild(timestamp);
    await settle();

    expect(isHidden(child)).toBe(false);
    expect(revealButtons(child)).toBe(0);
    expect(child.querySelector(":scope > .tathabbut-notice")).toBeNull();
  });

  it("reclassifies a narrowed reply when its own text changes after reveal", async () => {
    document.body.innerHTML =
      '<div id="feed">' +
      '<div role="article" id="mixed-article">' +
      '<div class="post-body">I respectfully disagree with your opinion.</div>' +
      '<div class="plain-reply">You are an idiot</div>' +
      '</div></div>';
    await loadContentModule();
    const child = document.querySelector("#mixed-article .plain-reply") as HTMLElement;
    await vi.waitFor(() => expect(isHidden(child)).toBe(true));

    (child.querySelector(":scope > .tathabbut-reveal") as HTMLButtonElement).click();
    child.textContent = "Shut up, you are pathetic";

    await vi.waitFor(() => expect(isHidden(child)).toBe(true));
    expect(revealButtons(child)).toBe(1);
  });

  it("invalidates a manual reveal when filtering settings are reloaded", async () => {
    document.body.innerHTML =
      '<div id="feed">' +
      '<div role="article" id="mixed-article">' +
      '<div class="post-body">I respectfully disagree with your opinion.</div>' +
      '<div class="plain-reply">You are an idiot</div>' +
      '</div></div>';
    await loadContentModule();
    const child = document.querySelector("#mixed-article .plain-reply") as HTMLElement;
    await vi.waitFor(() => expect(isHidden(child)).toBe(true));

    (child.querySelector(":scope > .tathabbut-reveal") as HTMLButtonElement).click();
    expect(isHidden(child)).toBe(false);

    storedSettings = { ...DEFAULT_SETTINGS, language: "en" };
    fireStorageChange();
    await vi.waitFor(() => expect(isHidden(child)).toBe(true));
    expect((child.querySelector(":scope > .tathabbut-reveal") as HTMLButtonElement).textContent)
      .toBe("Reveal content");
  });

  it("keeps one control on the narrowed target across churn", async () => {
    document.body.innerHTML =
      '<div id="feed">' +
      '<div role="article" id="mixed-article">' +
      '<div class="post-body">Great match today!</div>' +
      '<div class="plain-reply">Shut up, you are pathetic</div>' +
      "</div></div>";
    await loadContentModule();
    const child = document.querySelector("#mixed-article .plain-reply") as HTMLElement;
    await vi.waitFor(() => expect(isHidden(child)).toBe(true));
    const churn = document.createElement("div");
    churn.id = "churn";
    (document.getElementById("feed") as HTMLElement).appendChild(churn);
    await settle();
    expect(isHidden(child)).toBe(true);
    expect(child.querySelectorAll(":scope > .tathabbut-reveal").length).toBe(1);
  });

  it("hides the whole unit when several children match", async () => {
    document.body.innerHTML =
      '<div id="feed">' +
      '<div role="article" id="multi-match">' +
      '<div class="c1">You are an idiot</div>' +
      '<div class="c2">Shut up, you are pathetic</div>' +
      "</div></div>";
    await loadContentModule();
    const article = byId("multi-match");
    await vi.waitFor(() => expect(isHidden(article)).toBe(true));
  });

  it("classifies legacy API settings locally without fetch or remote messaging", async () => {
    storedSettings = { ...DEFAULT_SETTINGS, apiUrl: "https://api.example.test" };
    const chromeApi = (globalThis as unknown as { chrome: { runtime: { sendMessage: ReturnType<typeof vi.fn> } } }).chrome;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    document.body.innerHTML =
      '<div id="feed"><div role="article" id="legacy-api-post"><div class="post-body">You are an idiot</div></div></div>';
    await loadContentModule();
    await vi.waitFor(() => expect(isHidden(byId("legacy-api-post"))).toBe(true));
    expect(chromeApi.runtime.sendMessage).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("hides only the harassing child, not the respectful article", async () => {
    document.body.innerHTML =
      '<div id="feed">' +
      '<div role="article" id="mixed-article">' +
      '<div class="post-body">I respectfully disagree with your opinion.</div>' +
      '<div class="plain-reply">You are an idiot</div>' +
      "</div></div>";
    await loadContentModule();
    const article = byId("mixed-article");
    const child = document.querySelector("#mixed-article .plain-reply") as HTMLElement;
    await vi.waitFor(() => expect(isHidden(child)).toBe(true));
    expect(isHidden(article)).toBe(false);
    expect(revealButtons(child)).toBe(1);
  });
});

describe("content lifecycle on feed fixtures", () => {
  it("hides observed Egyptian insults once, preserves criticism, and keeps reveal reversible", async () => {
    document.body.innerHTML =
      '<div id="feed">' +
      '<div role="comment" id="obs-idiot">غبي</div>' +
      '<div role="comment" id="obs-failure">فاشل</div>' +
      '<div role="comment" id="obs-vocative">يا علق</div>' +
      '<div role="comment" id="obs-code">الكود فاشل ومحتاج إعادة كتابة</div>' +
      '<div role="comment" id="obs-explanation">الشرح ضعيف ومش واضح</div>' +
      '</div>';
    await loadContentModule();
    const insultIds = ["obs-idiot", "obs-failure", "obs-vocative"];
    for (const id of insultIds) await vi.waitFor(() => expect(isHidden(byId(id))).toBe(true));
    for (const id of insultIds) {
      expect(byId(id).querySelectorAll(":scope > .tathabbut-notice").length).toBe(1);
      expect(byId(id).querySelectorAll(":scope > .tathabbut-reveal").length).toBe(1);
    }
    for (const id of ["obs-code", "obs-explanation"]) {
      expect(isHidden(byId(id))).toBe(false);
      expect(byId(id).querySelector(".tathabbut-reveal")).toBeNull();
    }
    (byId("obs-vocative").querySelector(".tathabbut-reveal") as HTMLButtonElement).click();
    expect(isHidden(byId("obs-vocative"))).toBe(false);
    expect(byId("obs-vocative").querySelector(".tathabbut-reveal")).toBeNull();
    const harmlessSibling = document.createElement("div");
    harmlessSibling.textContent = "more feed content";
    byId("feed").appendChild(harmlessSibling);
    await settle();
    expect(isHidden(byId("obs-vocative"))).toBe(false);
  });

  it("reuses and deduplicates existing controls when Facebook drops the marker attribute", async () => {
    document.body.innerHTML = fixture();
    const mod = await loadContentModule();
    const post = byId(MATCHING_POST);
    await vi.waitFor(() => expect(isHidden(post)).toBe(true));
    const notice = post.querySelector(":scope > .tathabbut-notice") as HTMLElement;
    const button = post.querySelector(":scope > .tathabbut-reveal") as HTMLButtonElement;
    post.append(notice.cloneNode(true), button.cloneNode(true));
    post.removeAttribute("data-tathabbut-hidden");

    mod.applyResult(post, classifyLocally("You are an idiot"));

    expect(isHidden(post)).toBe(true);
    expect(post.querySelectorAll(":scope > .tathabbut-notice").length).toBe(1);
    expect(post.querySelectorAll(":scope > .tathabbut-reveal").length).toBe(1);
  });

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

  it("hides only the harmful parent and preserves its clean nested comment", async () => {
    document.body.innerHTML = fixture();
    await loadContentModule();
    const parent = byId("harmful-parent-clean-reply");
    const reply = byId("clean-reply-inside-harmful-parent");
    await vi.waitFor(() => expect(isHidden(parent)).toBe(true));
    expect(isHidden(reply)).toBe(false);
    expect(revealButtons(parent)).toBe(1);
    expect(revealButtons(reply)).toBe(0);
  });

  it("discovers comment test IDs with a suffix without matching containers", async () => {
    document.body.innerHTML = fixture();
    await loadContentModule();
    await vi.waitFor(() => expect(isHidden(byId("testid-comment-prefix"))).toBe(true));
    expect(isHidden(byId("comments-container"))).toBe(false);
  });

  it("hides semantic comments without an article role, including the exact Arabic threat", async () => {
    document.body.innerHTML = fixture();
    await loadContentModule();
    const comment = byId(STANDALONE_COMMENT);
    const threat = byId(STANDALONE_THREAT);
    const paragraph = byId(STANDALONE_PARAGRAPH);
    await vi.waitFor(() => expect(isHidden(comment)).toBe(true));
    await vi.waitFor(() => expect(isHidden(threat)).toBe(true));
    await vi.waitFor(() => expect(isHidden(paragraph)).toBe(true));
    expect(revealButtons(comment)).toBe(1);
    expect(revealButtons(threat)).toBe(1);
    expect(revealButtons(paragraph)).toBe(1);
    expect(isHidden(byId("comments-container"))).toBe(false);
    expect(isHidden(byId("respectful-comment"))).toBe(false);
    expect(paragraph.querySelector(".tathabbut-hidden-text")?.textContent).toBe("You are an idiot");
    (paragraph.querySelector(".tathabbut-reveal") as HTMLButtonElement).click();
    expect(isHidden(paragraph)).toBe(false);
    expect(paragraph.querySelector(".tathabbut-hidden-text")).toBeNull();
    expect(paragraph.textContent).toBe("You are an idiot");
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

  it("shows the hidden notice in Arabic by default", async () => {
    document.body.innerHTML = fixture();
    await loadContentModule();
    const post = byId(MATCHING_POST);
    await vi.waitFor(() => expect(isHidden(post)).toBe(true));
    const button = post.querySelector(".tathabbut-reveal") as HTMLButtonElement;
    expect(button.textContent).toBe("إظهار المحتوى");
    const notice = post.querySelector(".tathabbut-notice") as HTMLElement;
    expect(notice.textContent).toContain("تم إخفاء هذا المحتوى بواسطة تثبّت.");
    expect(notice.getAttribute("lang")).toBe("ar");
  });

  it("shows the hidden notice in English when selected", async () => {
    storedSettings = { ...DEFAULT_SETTINGS, language: "en" };
    document.body.innerHTML = fixture();
    await loadContentModule();
    const post = byId(MATCHING_POST);
    await vi.waitFor(() => expect(isHidden(post)).toBe(true));
    const button = post.querySelector(".tathabbut-reveal") as HTMLButtonElement;
    expect(button.textContent).toBe("Reveal content");
    const notice = post.querySelector(".tathabbut-notice") as HTMLElement;
    expect(notice.textContent).toContain("This content was hidden by Tathabbut.");
  });

  it("re-renders hidden notices after a language change", async () => {
    document.body.innerHTML = fixture();
    await loadContentModule();
    const post = byId(MATCHING_POST);
    await vi.waitFor(() => expect(isHidden(post)).toBe(true));
    expect((post.querySelector(".tathabbut-reveal") as HTMLElement).textContent).toBe("إظهار المحتوى");
    storedSettings = { ...DEFAULT_SETTINGS, language: "en" };
    fireStorageChange();
    await vi.waitFor(() => expect(
      (post.querySelector(".tathabbut-reveal") as HTMLElement).textContent
    ).toBe("Reveal content"));
    expect(isHidden(post)).toBe(true);
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
    const converged = snapshots.some((value) => {
      const item = value as unknown as { classified: number; hidden: number };
      return item.classified >= 3 && item.hidden >= 2;
    });
    expect(converged).toBe(true);
    const latest = snapshots[snapshots.length - 1] as unknown as {
      startedAt: number; settingsOk: boolean; articlesFound: number;
      evaluated: number; classified: number; hidden: number; lastReason: string;
    };
    expect(typeof latest.startedAt).toBe("number");
    expect(latest.settingsOk).toBe(true);
    expect(latest.articlesFound).toBe(11);
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
    const reported = snapshots.some(
      (value) => (value as unknown as { settingsOk: boolean }).settingsOk === false
    );
    expect(reported).toBe(true);
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

describe("content module lifecycle ownership", () => {
  it("dispose unregisters the storage listener and stops mutating the DOM", async () => {
    document.body.innerHTML = fixture();
    const module = await loadContentModule();
    const post = byId(MATCHING_POST);
    await vi.waitFor(() => expect(isHidden(post)).toBe(true));
    expect(changeListeners.length).toBe(1);

    module.dispose();
    expect(changeListeners.length).toBe(0);

    const late = document.createElement("div");
    late.setAttribute("role", "article");
    late.id = "post-after-dispose";
    late.textContent = "You are an idiot";
    (document.getElementById("feed") as HTMLElement).appendChild(late);
    await settle();

    expect(isHidden(late)).toBe(false);
    expect(revealButtons(late)).toBe(0);
  });

  it("a disposed instance ignores later storage changes", async () => {
    document.body.innerHTML = fixture();
    const module = await loadContentModule();
    const post = byId(MATCHING_POST);
    await vi.waitFor(() => expect(isHidden(post)).toBe(true));

    module.dispose();
    storedSettings = { ...DEFAULT_SETTINGS, language: "en" };
    fireStorageChange();
    await settle();

    const button = post.querySelector(".tathabbut-reveal") as HTMLButtonElement;
    expect(button.textContent).toBe("إظهار المحتوى");
  });

  it("re-importing the module leaves only the newest instance registered", async () => {
    document.body.innerHTML = fixture();
    const first = await loadContentModule();
    await vi.waitFor(() => expect(isHidden(byId(MATCHING_POST))).toBe(true));
    expect(changeListeners.length).toBe(1);

    const second = await loadContentModule();
    expect(changeListeners.length).toBe(1);

    first.dispose();
    expect(changeListeners.length).toBe(1);

    const late = document.createElement("div");
    late.setAttribute("role", "article");
    late.id = "post-after-reimport";
    late.textContent = "You are an idiot";
    (document.getElementById("feed") as HTMLElement).appendChild(late);
    await vi.waitFor(() => expect(isHidden(late)).toBe(true));

    second.dispose();
    expect(changeListeners.length).toBe(0);
  });
});

function dispatchPageHide(persisted: boolean): void {
  const event = new Event("pagehide") as Event & { persisted?: boolean };
  Object.defineProperty(event, "persisted", { value: persisted });
  window.dispatchEvent(event);
}

describe("content module disposal hardening", () => {
  it("an in-flight settings load cannot mutate the DOM after dispose", async () => {
    document.body.innerHTML = fixture();
    const module = await loadContentModule();
    const post = byId(MATCHING_POST);
    await vi.waitFor(() => expect(isHidden(post)).toBe(true));

    const chromeApi = (globalThis as unknown as {
      chrome: { storage: { sync: Record<string, unknown> } };
    }).chrome;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    chromeApi.storage.sync.get = vi.fn(async () => {
      await gate;
      return { [SETTINGS_KEY]: { ...DEFAULT_SETTINGS, language: "en" } };
    });

    fireStorageChange();
    module.dispose();
    expect(changeListeners.length).toBe(0);

    release();
    await settle();

    expect(isHidden(post)).toBe(true);
    expect(revealButtons(post)).toBe(1);
  });

  it("a retained reveal control cannot act through a disposed instance", async () => {
    document.body.innerHTML =
      '<div id="feed">' +
      '<div role="article" id="solo"><div class="post-body">You are an idiot</div></div>' +
      "</div>";
    const module = await loadContentModule();
    const solo = byId("solo");
    await vi.waitFor(() => expect(isHidden(solo)).toBe(true));
    const button = solo.querySelector(":scope > .tathabbut-reveal") as HTMLButtonElement;
    expect(button).toBeInstanceOf(HTMLButtonElement);

    module.dispose();
    button.click();
    await settle();

    expect(isHidden(solo)).toBe(true);
    expect(revealButtons(solo)).toBe(1);
  });

  it("permanent pagehide disposes the instance", async () => {
    document.body.innerHTML = fixture();
    const module = await loadContentModule();
    await vi.waitFor(() => expect(isHidden(byId(MATCHING_POST))).toBe(true));
    expect(changeListeners.length).toBe(1);

    dispatchPageHide(false);

    expect(changeListeners.length).toBe(0);
    const late = document.createElement("div");
    late.setAttribute("role", "article");
    late.id = "post-after-teardown";
    late.textContent = "You are an idiot";
    (document.getElementById("feed") as HTMLElement).appendChild(late);
    await settle();
    expect(isHidden(late)).toBe(false);
    module.dispose();
    expect(changeListeners.length).toBe(0);
  });

  it("persisted pagehide keeps the instance active for bfcache restore", async () => {
    document.body.innerHTML = fixture();
    const module = await loadContentModule();
    await vi.waitFor(() => expect(isHidden(byId(MATCHING_POST))).toBe(true));

    dispatchPageHide(true);

    expect(changeListeners.length).toBe(1);
    const late = document.createElement("div");
    late.setAttribute("role", "article");
    late.id = "post-after-restore";
    late.textContent = "You are an idiot";
    (document.getElementById("feed") as HTMLElement).appendChild(late);
    await vi.waitFor(() => expect(isHidden(late)).toBe(true));

    module.dispose();
    expect(changeListeners.length).toBe(0);
  });

  it("repeated pagehide events do not duplicate registrations", async () => {
    document.body.innerHTML = fixture();
    const module = await loadContentModule();
    await vi.waitFor(() => expect(isHidden(byId(MATCHING_POST))).toBe(true));
    expect(changeListeners.length).toBe(1);

    dispatchPageHide(true);
    dispatchPageHide(true);
    expect(changeListeners.length).toBe(1);

    const churn = document.createElement("div");
    (document.getElementById("feed") as HTMLElement).appendChild(churn);
    await settle();
    expect(revealButtons(byId(MATCHING_POST))).toBe(1);

    dispatchPageHide(false);
    expect(changeListeners.length).toBe(0);
    module.dispose();
    expect(changeListeners.length).toBe(0);
  });
});

function lifecycleEvents(seen: unknown[][], event: string): unknown[][] {
  return seen.filter((args) => args[0] === LIFECYCLE_PREFIX + " " + event);
}

function hasLifecycleEvent(seen: unknown[][], event: string): boolean {
  return lifecycleEvents(seen, event).length > 0;
}

function captureConsoleInfo(): { seen: unknown[][]; restore: () => void } {
  const seen: unknown[][] = [];
  const spy = vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
    seen.push(args);
  });
  return { seen, restore: () => spy.mockRestore() };
}

describe("content lifecycle diagnostics", () => {
  it("emits no lifecycle diagnostics by default", async () => {
    const { seen, restore } = captureConsoleInfo();
    try {
      document.body.innerHTML = fixture();
      const module = await loadContentModule();
      await vi.waitFor(() => expect(isHidden(byId(MATCHING_POST))).toBe(true));
      module.dispose();
      await settle();

      const lifecycle = seen.filter(
        (args) => typeof args[0] === "string" && (args[0] as string).startsWith(LIFECYCLE_PREFIX)
      );
      expect(lifecycle).toEqual([]);
    } finally {
      restore();
    }
  });

  it("logs lifecycle setup and disposal when enabled", async () => {
    window.localStorage.setItem(LIFECYCLE_KEY, "1");
    const { seen, restore } = captureConsoleInfo();
    try {
      document.body.innerHTML = fixture();
      const module = await loadContentModule();
      await vi.waitFor(() => expect(isHidden(byId(MATCHING_POST))).toBe(true));

      expect(hasLifecycleEvent(seen, "init")).toBe(true);
      expect(hasLifecycleEvent(seen, "observer:observe")).toBe(true);
      expect(hasLifecycleEvent(seen, "listeners:add")).toBe(true);
      expect(hasLifecycleEvent(seen, "dispose")).toBe(false);

      module.dispose();
      expect(hasLifecycleEvent(seen, "dispose")).toBe(true);
      expect(lifecycleEvents(seen, "dispose")[0]?.[1]).toMatchObject({
        observer: "disconnected",
        storageListener: "removed",
        pagehideListener: "removed"
      });
    } finally {
      restore();
    }
  });

  it("logs whether pagehide was persisted or triggered disposal", async () => {
    window.localStorage.setItem(LIFECYCLE_KEY, "1");
    const { seen, restore } = captureConsoleInfo();
    try {
      document.body.innerHTML = fixture();
      const module = await loadContentModule();
      await vi.waitFor(() => expect(isHidden(byId(MATCHING_POST))).toBe(true));

      dispatchPageHide(true);
      const persistedLog = lifecycleEvents(seen, "pagehide").at(-1);
      expect(persistedLog?.[1]).toMatchObject({ persisted: true });
      expect(hasLifecycleEvent(seen, "pagehide:keep-alive")).toBe(true);
      expect(hasLifecycleEvent(seen, "dispose")).toBe(false);
      expect(changeListeners.length).toBe(1);

      dispatchPageHide(false);
      const permanentLog = lifecycleEvents(seen, "pagehide").at(-1);
      expect(permanentLog?.[1]).toMatchObject({ persisted: false });
      expect(hasLifecycleEvent(seen, "dispose")).toBe(true);
      expect(changeListeners.length).toBe(0);
    } finally {
      restore();
    }
  });

  it("logs a guard when a retained reveal control acts after disposal", async () => {
    window.localStorage.setItem(LIFECYCLE_KEY, "1");
    const { seen, restore } = captureConsoleInfo();
    try {
      document.body.innerHTML =
        '<div id="feed">' +
        '<div role="article" id="solo"><div class="post-body">You are an idiot</div></div>' +
        "</div>";
      const module = await loadContentModule();
      const solo = byId("solo");
      await vi.waitFor(() => expect(isHidden(solo)).toBe(true));
      const button = solo.querySelector(":scope > .tathabbut-reveal") as HTMLButtonElement;

      module.dispose();
      button.click();
      await settle();

      expect(isHidden(solo)).toBe(true);
      const rejected = lifecycleEvents(seen, "guard:reject").some(
        (args) => (args[1] as { where?: string } | undefined)?.where === "revealFromButton"
      );
      expect(rejected).toBe(true);
    } finally {
      restore();
    }
  });

  it("can be toggled on at runtime without reloading the module", async () => {
    const { seen, restore } = captureConsoleInfo();
    try {
      document.body.innerHTML = fixture();
      const module = await loadContentModule();
      await vi.waitFor(() => expect(isHidden(byId(MATCHING_POST))).toBe(true));
      expect(hasLifecycleEvent(seen, "init")).toBe(false);

      window.localStorage.setItem(LIFECYCLE_KEY, "1");
      module.dispose();
      expect(hasLifecycleEvent(seen, "dispose")).toBe(true);
    } finally {
      restore();
    }
  });

  it("cannot throw or change behavior when console.info throws", async () => {
    window.localStorage.setItem(LIFECYCLE_KEY, "1");
    const spy = vi.spyOn(console, "info").mockImplementation(() => {
      throw new Error("console unavailable");
    });
    try {
      document.body.innerHTML = fixture();
      const module = await loadContentModule();
      await vi.waitFor(() => expect(isHidden(byId(MATCHING_POST))).toBe(true));
      expect(revealButtons(byId(MATCHING_POST))).toBe(1);

      module.dispose();
      expect(changeListeners.length).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  it("never logs post text through lifecycle diagnostics", async () => {
    window.localStorage.setItem(LIFECYCLE_KEY, "1");
    const { seen, restore } = captureConsoleInfo();
    try {
      document.body.innerHTML = fixture();
      const module = await loadContentModule();
      await vi.waitFor(() => expect(isHidden(byId(MATCHING_POST))).toBe(true));
      module.dispose();

      expect(JSON.stringify(seen)).not.toContain("You are an idiot");
      expect(JSON.stringify(seen)).not.toContain("sunny days");
    } finally {
      restore();
    }
  });
});

function serverText(id: string, text: string): string {
  return (
    '<div data-type="text" data-mcomponent="ServerTextArea" class="m">' +
    '<div class="native-text rslh" id="' + id + '"><span class="f1">' + text + "</span></div>" +
    "</div>"
  );
}

// Exact live shape reported from Brave: ServerTextArea > .native-text.rslh.rtl
// > span.f1 (often several sibling spans, e.g. text plus "See more").
function liveTextArea(id: string, inner: string): string {
  return (
    '<div data-type="text" data-mcomponent="ServerTextArea" class="m" id="area-' + id + '">' +
    '<div class="native-text rslh rtl" dir="rtl" id="' + id + '">' + inner + "</div>" +
    "</div>"
  );
}

function mobileShell(inner: string): string {
  return (
    '<div data-mcomponent="MScreen"><div data-type="vscroller" data-mcomponent="MContainer">' +
    inner +
    "</div></div>"
  );
}

function mobileFeed(): string {
  return (
    '<div data-mcomponent="MScreen" id="mscreen">' +
    '<div data-type="vscroller" data-mcomponent="MContainer" class="m" id="vscroller">' +
    '<div data-type="container" data-mcomponent="MContainer" class="m" id="refresh"><span class="f1">↻</span></div>' +
    '<div data-type="container" data-mcomponent="MContainer" class="m" id="filler"></div>' +
    '<div data-type="container" data-mcomponent="MContainer" class="m" id="header">' +
    serverText("author-text", "Tathabbut Test Author") +
    "</div>" +
    '<div class="m bg-s3" data-type="container" data-mcomponent="MContainer" id="post-body">' +
    serverText("post-body-text", "You are an idiot") +
    "</div>" +
    '<div data-type="container" data-mcomponent="MContainer" class="m" id="actions"><span>Like Comment Share</span></div>' +
    '<div data-type="container" data-mcomponent="MContainer" class="m" id="comments">' +
    serverText("comment-offensive", "Shut up, you are pathetic") +
    serverText("comment-benign-1", "I respectfully disagree with your opinion.") +
    serverText("comment-benign-2", "Thanks for explaining your point.") +
    "</div>" +
    "</div>" +
    "</div>"
  );
}

describe("SSR/mobile ServerTextArea discovery", () => {
  it("discovers the post body and hides only that text block", async () => {
    document.body.innerHTML = mobileFeed();
    await loadContentModule();
    await vi.waitFor(() => expect(isHidden(byId("post-body-text"))).toBe(true));

    expect(isHidden(byId("post-body"))).toBe(false);
    expect(isHidden(byId("vscroller"))).toBe(false);
    expect(isHidden(byId("mscreen"))).toBe(false);
    expect(isHidden(byId("header"))).toBe(false);
    expect(isHidden(byId("actions"))).toBe(false);
    expect(revealButtons(byId("post-body-text"))).toBe(1);
  });

  it("filters one offensive comment without hiding neighbors or the comments region", async () => {
    document.body.innerHTML = mobileFeed();
    await loadContentModule();
    await vi.waitFor(() => expect(isHidden(byId("comment-offensive"))).toBe(true));

    expect(isHidden(byId("comment-benign-1"))).toBe(false);
    expect(isHidden(byId("comment-benign-2"))).toBe(false);
    expect(isHidden(byId("comments"))).toBe(false);
    expect(isHidden(byId("vscroller"))).toBe(false);
    expect(revealButtons(byId("comment-offensive"))).toBe(1);
  });

  it("splits multiple comments inside one text component instead of hiding them all", async () => {
    document.body.innerHTML =
      '<div data-mcomponent="MScreen"><div data-type="vscroller" data-mcomponent="MContainer">' +
      '<div data-mcomponent="ServerTextArea" class="m" id="comments-area">' +
      '<div class="native-text" id="split-offensive"><span class="f1">Shut up, you are pathetic</span></div>' +
      '<div class="native-text" id="split-benign"><span class="f1">I respectfully disagree with your opinion.</span></div>' +
      "</div></div></div>";
    await loadContentModule();
    await vi.waitFor(() => expect(isHidden(byId("split-offensive"))).toBe(true));

    expect(isHidden(byId("split-benign"))).toBe(false);
    expect(isHidden(byId("comments-area"))).toBe(false);
  });

  it("leaves a benign SSR post visible", async () => {
    document.body.innerHTML =
      '<div data-mcomponent="MScreen" id="mscreen2">' +
      '<div data-type="vscroller" data-mcomponent="MContainer" id="vscroller2">' +
      serverText("benign-body", "I love sunny days and long walks.") +
      "</div></div>";
    await loadContentModule();
    await settle();

    expect(isHidden(byId("benign-body"))).toBe(false);
    expect(revealButtons(byId("benign-body"))).toBe(0);
  });

  it("does not treat generic .m/.bg-s3 or MContainer as a post by itself", async () => {
    document.body.innerHTML =
      '<div id="feed">' +
      '<div class="m bg-s3" data-type="container" data-mcomponent="MContainer" id="generic-only">' +
      '<span class="f1">You are an idiot</span></div>' +
      "</div>";
    await loadContentModule();
    await settle();

    expect(isHidden(byId("generic-only"))).toBe(false);
    expect(revealButtons(byId("generic-only"))).toBe(0);
  });

  it("deduplicates nested text containers to one hide target", async () => {
    document.body.innerHTML =
      '<div data-mcomponent="MScreen"><div data-type="vscroller" data-mcomponent="MContainer">' +
      '<div data-type="text" data-mcomponent="ServerTextArea" id="nested-area">' +
      '<div data-type="container" data-mcomponent="MContainer" id="nested-outer">' +
      '<div class="native-text" id="nested-inner"><span class="f1">You are an idiot</span></div>' +
      "</div></div></div></div>";
    await loadContentModule();
    await vi.waitFor(() => expect(isHidden(byId("nested-inner"))).toBe(true));

    expect(isHidden(byId("nested-outer"))).toBe(false);
    expect(isHidden(byId("nested-area"))).toBe(false);
    expect(document.querySelectorAll(".tathabbut-reveal").length).toBe(1);
  });

  it("discovers dynamically inserted SSR posts through the observer", async () => {
    document.body.innerHTML =
      '<div data-mcomponent="MScreen">' +
      '<div data-type="vscroller" data-mcomponent="MContainer" id="live-vscroller"></div></div>';
    await loadContentModule();
    const vscroller = byId("live-vscroller");

    const wrapper = document.createElement("div");
    wrapper.className = "m bg-s3";
    wrapper.setAttribute("data-type", "container");
    wrapper.setAttribute("data-mcomponent", "MContainer");
    wrapper.id = "late-post";
    const area = document.createElement("div");
    area.setAttribute("data-type", "text");
    area.setAttribute("data-mcomponent", "ServerTextArea");
    const body = document.createElement("div");
    body.className = "native-text rslh";
    body.id = "late-body";
    const span = document.createElement("span");
    span.className = "f1";
    span.textContent = "I will kill you";
    body.appendChild(span);
    area.appendChild(body);
    wrapper.appendChild(area);
    vscroller.appendChild(wrapper);

    await vi.waitFor(() => expect(isHidden(body)).toBe(true));
    expect(isHidden(wrapper)).toBe(false);
    expect(isHidden(vscroller)).toBe(false);
  });

  it("ignores empty, control, and hidden text regions", async () => {
    document.body.innerHTML =
      '<div data-mcomponent="MScreen"><div data-type="vscroller" data-mcomponent="MContainer" id="noise">' +
      '<div data-mcomponent="ServerTextArea"><div class="native-text" id="empty-text">   </div></div>' +
      '<div role="button"><div data-mcomponent="ServerTextArea">' +
      '<div class="native-text" id="control-text">Shut up, you are pathetic</div></div></div>' +
      '<div aria-hidden="true"><div data-mcomponent="ServerTextArea">' +
      '<div class="native-text" id="hidden-text">You are an idiot</div></div></div>' +
      "</div></div>";
    await loadContentModule();
    await settle();

    expect(isHidden(byId("empty-text"))).toBe(false);
    expect(isHidden(byId("control-text"))).toBe(false);
    expect(isHidden(byId("hidden-text"))).toBe(false);
    expect(document.querySelectorAll(".tathabbut-reveal").length).toBe(0);
  });

  it("handles conventional desktop and SSR structures side by side", async () => {
    document.body.innerHTML =
      '<div id="feed">' +
      '<div role="article" id="desktop-post"><div class="post-body">You are an idiot</div></div>' +
      '<div role="article" id="desktop-clean"><div class="post-body">I love sunny days.</div></div>' +
      "</div>" +
      '<div data-mcomponent="MScreen"><div data-type="vscroller" data-mcomponent="MContainer">' +
      serverText("ssr-post", "You are an idiot") +
      serverText("ssr-clean", "I respectfully disagree with your opinion.") +
      "</div></div>";
    await loadContentModule();

    await vi.waitFor(() => expect(isHidden(byId("desktop-post"))).toBe(true));
    await vi.waitFor(() => expect(isHidden(byId("ssr-post"))).toBe(true));
    expect(isHidden(byId("desktop-clean"))).toBe(false);
    expect(isHidden(byId("ssr-clean"))).toBe(false);
  });
});

describe("live SSR diagnostics (counts only)", () => {
  const DEBUG_PREFIX = "[Tathabbut debug]";

  function debugEvents(seen: unknown[][], event: string): unknown[][] {
    return seen.filter((args) => args[0] === DEBUG_PREFIX + " " + event);
  }

  it("hides the exact live .native-text > span.f1 shape once, not its wrapper", async () => {
    document.body.innerHTML = mobileShell(
      '<div data-type="text" data-mcomponent="ServerTextArea" class="m" id="live-area">' +
        '<div class="native-text rslh rtl" dir="rtl" id="live-body">' +
        '<span class="f1">You are an </span><span class="f1">idiot</span>' +
        "</div></div>"
    );
    await loadContentModule();
    await vi.waitFor(() => expect(isHidden(byId("live-body"))).toBe(true));

    expect(isHidden(byId("live-area"))).toBe(false);
    expect(revealButtons(byId("live-body"))).toBe(1);
    expect(document.querySelectorAll(".tathabbut-hidden").length).toBe(1);
    expect(document.querySelectorAll(".tathabbut-reveal").length).toBe(1);
  });

  it("reports raw areas, native-text leaves, eligible regions, and rejection reasons", async () => {
    window.localStorage.setItem(DEBUG_KEY, "1");
    const { seen, restore } = captureConsoleInfo();
    try {
      document.body.innerHTML = mobileShell(
        liveTextArea("live-match", '<span class="f1">You are an idiot</span>') +
          liveTextArea("live-clean", '<span class="f1">I love sunny days.</span>') +
          '<div aria-hidden="true">' +
          liveTextArea("live-hidden", '<span class="f1">You are an idiot</span>') +
          "</div>"
      );
      await loadContentModule();
      await vi.waitFor(() => expect(debugEvents(seen, "scan").length).toBeGreaterThan(0));

      const scan = debugEvents(seen, "scan");
      const details = scan[scan.length - 1][1] as Record<string, unknown>;
      expect(details.areas).toBe(3);
      expect(details.nativeTextNodes).toBe(3);
      expect(details.f1Nodes).toBe(3);
      expect(details.leaves).toBe(2);
      expect(details.nativeTextLeaves).toBe(2);
      expect(details.serverUnits).toBe(2);
      expect(details.desktopUnits).toBe(0);
      expect(details.uniqueUnits).toBe(2);
      expect(details.unknownUnits).toBe(2);
      expect(details.postUnits).toBe(0);
      expect(details.commentUnits).toBe(0);
      expect(details.replyUnits).toBe(0);
      expect(details.insideExisting).toBe(0);
      expect((details.suppressed as Record<string, number>)["aria-hidden"]).toBe(1);
      expect(JSON.stringify(seen)).not.toContain("sunny days");
    } finally {
      restore();
    }
  });

  it("reports candidate source and length for observer-discovered live text", async () => {
    window.localStorage.setItem(DEBUG_KEY, "1");
    const { seen, restore } = captureConsoleInfo();
    try {
      document.body.innerHTML = mobileShell(
        '<div data-type="vscroller" data-mcomponent="MContainer" id="live-scroller"></div>'
      );
      await loadContentModule();

      const wrapper = document.createElement("div");
      wrapper.innerHTML = liveTextArea("late-live", '<span class="f1">You are an idiot</span>');
      byId("live-scroller").appendChild(wrapper);
      await vi.waitFor(() => expect(isHidden(byId("late-live"))).toBe(true));

      const reports = debugEvents(seen, "mutations").map(
        (args) => args[1] as Record<string, unknown>
      );
      const withLeaves = reports.find((details) => Number(details.nativeTextLeaves) >= 1);
      expect(withLeaves).toBeDefined();
      expect(Number(withLeaves?.areas)).toBeGreaterThanOrEqual(1);
      expect(Number(withLeaves?.leaves)).toBeGreaterThanOrEqual(1);
      expect(Number(withLeaves?.serverUnits)).toBeGreaterThanOrEqual(1);

      const candidates = debugEvents(seen, "candidate").map(
        (args) => args[1] as Record<string, unknown>
      );
      const late = candidates.find((details) => details.stage === "extraction" && details.source === "ssr");
      expect(late).toBeDefined();
      expect(typeof late?.textLength).toBe("number");
      expect(late).not.toHaveProperty("fingerprint");
      expect(JSON.stringify(seen)).not.toContain("You are an idiot");
    } finally {
      restore();
    }
  });

  it("logs a shown decision with no-rule-match for an unmatched live candidate", async () => {
    window.localStorage.setItem(DEBUG_KEY, "1");
    const { seen, restore } = captureConsoleInfo();
    try {
      document.body.innerHTML = mobileShell(
        liveTextArea("live-benign", '<span class="f1">I respectfully disagree with your opinion.</span>')
      );
      await loadContentModule();
      await vi.waitFor(() => {
        const decisions = debugEvents(seen, "decision");
        expect(
          decisions.some((args) => (args[1] as { reason?: string } | undefined)?.reason === "no-rule-match")
        ).toBe(true);
      });

      const decisions = debugEvents(seen, "decision").map(
        (args) => args[1] as Record<string, unknown>
      );
      const shown = decisions.find((details) => details.reason === "no-rule-match");
      expect(shown?.decision).toBe("shown");
      expect(shown?.via).toBe("ssr");
      expect(typeof shown?.candidateId).toBe("string");
      expect(shown).not.toHaveProperty("fingerprint");
      expect(isHidden(byId("live-benign"))).toBe(false);
      expect(JSON.stringify(seen)).not.toContain("respectfully disagree");
    } finally {
      restore();
    }
  });

  it("filters the exact live Arabic RTL shape", async () => {
    document.body.innerHTML = mobileShell(
      liveTextArea("live-arabic", '<span class="f1">انت غبي</span>')
    );
    await loadContentModule();
    await vi.waitFor(() => expect(isHidden(byId("live-arabic"))).toBe(true));
    expect(revealButtons(byId("live-arabic"))).toBe(1);
  });
});

describe("Facebook post, comment, and reply boundaries", () => {
  function ssrPostFeed(): string {
    return mobileShell(
      '<div data-mcomponent="MContainer" id="post-container">' +
        liveTextArea("post-violent", '<span class="f1">You are an idiot</span>') +
        '<div data-mcomponent="MContainer" id="comment-container">' +
          liveTextArea("comment-clean", '<span class="f1">I respectfully disagree with your opinion.</span>') +
          '<div data-mcomponent="MContainer" id="reply-container">' +
            liveTextArea("reply-violent", '<span class="f1">You are a loser</span>') +
          "</div>" +
        "</div>" +
      "</div>" +
      '<div data-mcomponent="MContainer" id="second-post-container">' +
        liveTextArea("post-clean", '<span class="f1">I love sunny days.</span>') +
        liveTextArea("comment-violent", '<span class="f1">Shut up, you are pathetic</span>') +
      "</div>"
    );
  }

  it("hides a post, a separate harmful comment, and a separate harmful reply without containers", async () => {
    document.body.innerHTML = ssrPostFeed();
    await loadContentModule();

    await vi.waitFor(() => expect(isHidden(byId("post-violent"))).toBe(true));
    await vi.waitFor(() => expect(isHidden(byId("reply-violent"))).toBe(true));
    await vi.waitFor(() => expect(isHidden(byId("comment-violent"))).toBe(true));

    expect(isHidden(byId("comment-clean"))).toBe(false);
    expect(isHidden(byId("post-clean"))).toBe(false);
    for (const id of ["post-container", "comment-container", "reply-container", "second-post-container"]) {
      expect(isHidden(byId(id))).toBe(false);
    }
    expect(document.querySelectorAll(".tathabbut-hidden").length).toBe(3);
  });

  it("hides a truncated live post without treating See more as content", async () => {
    document.body.innerHTML = mobileShell(
      liveTextArea(
        "truncated-post",
        '<span class="f1">You are an idiot</span><span class="f1">See more</span>'
      )
    );
    await loadContentModule();
    await vi.waitFor(() => expect(isHidden(byId("truncated-post"))).toBe(true));
    expect(revealButtons(byId("truncated-post"))).toBe(1);
    expect(byId("truncated-post").textContent).toContain("See more");

    (byId("truncated-post").querySelector(".tathabbut-reveal") as HTMLButtonElement).click();
    expect(isHidden(byId("truncated-post"))).toBe(false);
    expect(byId("truncated-post").textContent).toContain("You are an idiot");
    expect(byId("truncated-post").textContent).toContain("See more");
  });

  it("hides a truncated post whose See more is a role=button child", async () => {
    document.body.innerHTML = mobileShell(
      liveTextArea(
        "button-truncated-post",
        '<span class="f1">You are an idiot</span>' +
          '<div role="button"><span class="f1">See more</span></div>'
      )
    );
    await loadContentModule();
    await vi.waitFor(() => expect(isHidden(byId("button-truncated-post"))).toBe(true));
  });

  it("hides an Arabic truncated post with عرض المزيد without separating control text", async () => {
    document.body.innerHTML = mobileShell(
      liveTextArea(
        "arabic-truncated-post",
        '<span class="f1">انت غبي</span><span class="f1">عرض المزيد</span>'
      )
    );
    await loadContentModule();
    await vi.waitFor(() => expect(isHidden(byId("arabic-truncated-post"))).toBe(true));
  });

  it("does not hide a mixed parent when it contains an independent nested comment", async () => {
    document.body.innerHTML = mobileShell(
      '<div data-mcomponent="ServerTextArea" id="mixed-area">' +
        '<div class="native-text" id="mixed-parent">' +
          '<span class="f1">I respectfully disagree with your opinion.</span>' +
          '<div class="native-text" id="mixed-reply"><span class="f1">You are an idiot</span></div>' +
        "</div>" +
      "</div>"
    );
    await loadContentModule();
    await vi.waitFor(() => expect(isHidden(byId("mixed-reply"))).toBe(true));
    expect(isHidden(byId("mixed-parent"))).toBe(false);
    expect(isHidden(byId("mixed-area"))).toBe(false);
  });

  it("reports mixed SSR parents and unknown nested units", async () => {
    window.localStorage.setItem(DEBUG_KEY, "1");
    const { seen, restore } = captureConsoleInfo();
    try {
      document.body.innerHTML = mobileShell(
        '<div data-mcomponent="ServerTextArea" id="diag-mixed-area">' +
          '<div class="native-text" id="diag-mixed-parent">' +
            '<span class="f1">I respectfully disagree with your opinion.</span>' +
            '<div class="native-text" id="diag-mixed-reply"><span class="f1">You are an idiot</span></div>' +
          "</div>" +
        "</div>"
      );
      await loadContentModule();
      await vi.waitFor(() => {
        const reports = seen.filter((args) => args[0] === "[Tathabbut debug] scan");
        const details = reports[reports.length - 1]?.[1] as Record<string, unknown> | undefined;
        expect(details?.mixedSkipped).toBeGreaterThanOrEqual(1);
      });
      const scan = seen
        .filter((args) => args[0] === "[Tathabbut debug] scan")
        .map((args) => args[1] as Record<string, unknown>)
        .pop();
      expect(scan?.serverUnits).toBe(1);
      expect(scan?.uniqueUnits).toBe(1);
      expect(scan?.unknownUnits).toBe(1);
      expect(scan?.postUnits).toBe(0);
      expect(scan?.commentUnits).toBe(0);
      expect(scan?.replyUnits).toBe(0);
    } finally {
      restore();
    }
  });

  it("hides duplicate nested text once without stacking controls", async () => {
    document.body.innerHTML = mobileShell(
      liveTextArea(
        "duplicate-parent",
        '<span class="f1">You are an idiot</span>' +
          '<div class="native-text" id="duplicate-child"><span class="f1">You are an idiot</span></div>'
      )
    );
    await loadContentModule();
    await vi.waitFor(() => expect(isHidden(byId("duplicate-parent"))).toBe(true));
    await settle();
    expect(document.querySelectorAll(".tathabbut-hidden").length).toBe(1);
    expect(document.querySelectorAll(".tathabbut-reveal").length).toBe(1);
  });

  it("reclassifies a visible comment after its text changes from benign to harmful", async () => {
    document.body.innerHTML = mobileShell(
      liveTextArea("changing-comment", '<span class="f1">I respectfully disagree.</span>')
    );
    await loadContentModule();
    const comment = byId("changing-comment");
    await settle();
    expect(isHidden(comment)).toBe(false);

    (comment.querySelector(".f1") as HTMLElement).textContent = "You are an idiot";
    await vi.waitFor(() => expect(isHidden(comment)).toBe(true));
    expect(revealButtons(comment)).toBe(1);
  });

  it("discovers a comment inserted after initialization without hiding its post", async () => {
    document.body.innerHTML = ssrPostFeed();
    const mod = await loadContentModule();
    await vi.waitFor(() => expect(isHidden(byId("post-violent"))).toBe(true));
    await vi.waitFor(() => expect(isHidden(byId("reply-violent"))).toBe(true));
    await vi.waitFor(() => expect(isHidden(byId("comment-violent"))).toBe(true));
    const before = document.querySelectorAll(".tathabbut-hidden").length;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = liveTextArea("late-comment", '<span class="f1">Shut up, you are pathetic</span>');
    byId("comment-container").appendChild(wrapper);
    await vi.waitFor(() => expect(isHidden(byId("late-comment"))).toBe(true));

    expect(isHidden(byId("post-clean"))).toBe(false);
    expect(isHidden(byId("comment-clean"))).toBe(false);
    expect(isHidden(byId("post-container"))).toBe(false);
    expect(document.querySelectorAll(".tathabbut-hidden").length).toBe(before + 1);

    // A manual reveal on the new comment must not affect its post or siblings.
    (byId("late-comment").querySelector(".tathabbut-reveal") as HTMLButtonElement).click();
    expect(isHidden(byId("late-comment"))).toBe(false);
    expect(isHidden(byId("post-container"))).toBe(false);
    mod.scan();
    await settle();
    expect(isHidden(byId("late-comment"))).toBe(false);
  });

  it("discovers a reply inserted after initialization without hiding its parent comment", async () => {
    document.body.innerHTML = ssrPostFeed();
    const mod = await loadContentModule();
    await vi.waitFor(() => expect(isHidden(byId("reply-violent"))).toBe(true));

    const wrapper = document.createElement("div");
    wrapper.innerHTML = liveTextArea("late-reply", '<span class="f1">You are a loser</span>');
    byId("reply-container").appendChild(wrapper);
    await vi.waitFor(() => expect(isHidden(byId("late-reply"))).toBe(true));

    expect(isHidden(byId("comment-clean"))).toBe(false);
    expect(isHidden(byId("comment-container"))).toBe(false);
    expect(isHidden(byId("post-clean"))).toBe(false);

    const count = document.querySelectorAll(".tathabbut-reveal").length;
    mod.scan();
    mod.scan();
    await settle();
    expect(document.querySelectorAll(".tathabbut-reveal").length).toBe(count);
  });

  it("reports a DOM-application failure and leaves no partial hide", async () => {
    window.localStorage.setItem(DEBUG_KEY, "1");
    const { seen, restore } = captureConsoleInfo();
    try {
      document.body.innerHTML = '<div role="article" id="fail-post">You are an idiot</div>';
      const post = byId("fail-post");
      vi.spyOn(post, "prepend").mockImplementation(() => {
        throw new Error("page blocked mutation");
      });
      await loadContentModule();
      await vi.waitFor(() => {
        const failed = seen.some((args) =>
          args[0] === "[Tathabbut debug] decision" &&
          (args[1] as { decision?: string } | undefined)?.decision === "hide-failed"
        );
        expect(failed).toBe(true);
      });

      expect(isHidden(post)).toBe(false);
      expect(post.querySelectorAll(".tathabbut-reveal, .tathabbut-notice").length).toBe(0);
      expect(post.textContent).toBe("You are an idiot");
    } finally {
      restore();
    }
  });
});

describe("structured pipeline diagnostics", () => {
  it("counts desktop posts, comments, replies, decisions, and duplicate work", async () => {
    window.localStorage.setItem(DEBUG_KEY, "1");
    const { seen, restore } = captureConsoleInfo();
    try {
      document.body.innerHTML =
        '<div role="article" id="diag-post">A clean post.' +
          '<div role="comment" id="diag-comment">A clean comment.' +
            '<div role="comment" id="diag-reply">A clean reply.</div>' +
          "</div>" +
        "</div>";
      await loadContentModule();
      await vi.waitFor(() => {
        const reports = seen.filter((args) => args[0] === "[Tathabbut debug] scan");
        const details = reports[reports.length - 1]?.[1] as Record<string, unknown> | undefined;
        expect(details?.uniqueUnits).toBe(3);
      });

      const scan = seen
        .filter((args) => args[0] === "[Tathabbut debug] scan")
        .map((args) => args[1] as Record<string, unknown>)
        .pop();
      expect(scan?.desktopUnits).toBe(3);
      expect(scan?.serverUnits).toBe(0);
      expect(scan?.uniqueUnits).toBe(3);
      expect(scan?.postUnits).toBe(1);
      expect(scan?.commentUnits).toBe(1);
      expect(scan?.replyUnits).toBe(1);
      expect(scan?.unknownUnits).toBe(0);

      const kinds = seen
        .filter((args) => args[0] === "[Tathabbut debug] candidate")
        .map((args) => (args[1] as { kind?: string }).kind);
      expect(kinds).toEqual(expect.arrayContaining(["post", "comment", "reply"]));

      await vi.waitFor(() => {
        const progress = seen
          .filter((args) => args[0] === "[Tathabbut debug] progress")
          .map((args) => args[1] as Record<string, unknown>);
        expect(progress.some((details) => Number(details.shown) >= 3)).toBe(true);
      }, { timeout: 2500 });
      const progress = seen
        .filter((args) => args[0] === "[Tathabbut debug] progress")
        .map((args) => args[1] as Record<string, unknown>)
        .pop();
      expect(progress?.shown).toBeGreaterThanOrEqual(3);
      expect(progress?.hidden).toBe(0);
      expect(progress?.hideFailed).toBe(0);
      expect(progress?.noRuleMatch).toBeGreaterThanOrEqual(3);
      expect(progress?.duplicates).toBeGreaterThanOrEqual(0);

      // The same units must not be hidden twice by observer feedback.
      expect(document.querySelectorAll(".tathabbut-hidden").length).toBe(0);
      expect(JSON.stringify(seen)).not.toContain("A clean post");
    } finally {
      restore();
    }
  });

  it("correlates extraction, classification, decision, hide, and reveal without logging content", async () => {
    window.localStorage.setItem(DEBUG_KEY, "1");
    const { seen, restore } = captureConsoleInfo();
    try {
      document.body.innerHTML =
        '<a href="https://facebook.com/some-post">Post link</a>' +
        '<a href="https://facebook.com/profile.php?id=123">Profile Name</a>' +
        '<div role="comment" id="diag-sensitive-comment">غبي</div>';
      await loadContentModule();
      const comment = byId("diag-sensitive-comment");
      await vi.waitFor(() => expect(isHidden(comment)).toBe(true));

      const event = (name: string) => seen
        .filter((args) => args[0] === `[Tathabbut debug] ${name}`)
        .map((args) => args[1] as Record<string, unknown>);
      const loaded = event("loaded")[0];
      expect(loaded?.buildId).toMatch(/^content-[a-z0-9]+$/);
      const extracted = event("candidate").find((item) => item.stage === "extraction" && item.kind === "comment");
      expect(extracted).toMatchObject({ textLength: 3, outcome: "nonempty", connected: true,
        nestedUnitsExcluded: true, nestedTextIsolated: false });
      const id = extracted?.candidateId;
      expect(id).toMatch(/^c\d+$/);
      expect(event("classify")).toEqual(expect.arrayContaining([
        expect.objectContaining({ candidateId: id, mode: "local", enabledCategories: expect.arrayContaining(["harassment"]),
          threshold: 0.85, localRuleIds: expect.arrayContaining([expect.stringMatching(/^harassment\./)]) })
      ]));
      expect(event("decision")).toEqual(expect.arrayContaining([
        expect.objectContaining({ candidateId: id, decision: "hidden",
          categoryDecisions: expect.arrayContaining([expect.objectContaining({ category: "harassment", matched: true, hide: true })]) })
      ]));
      expect(event("hide")).toEqual(expect.arrayContaining([
        expect.objectContaining({ candidateId: id, stage: "success" })
      ]));

      const button = comment.querySelector(":scope > .tathabbut-reveal") as HTMLButtonElement;
      button.click();
      expect(event("reveal")).toEqual(expect.arrayContaining([
        expect.objectContaining({ candidateId: id, reason: "user-click" })
      ]));
      const serialized = JSON.stringify(seen);
      for (const privateValue of ["غبي", "Post link", "Profile Name", "https://facebook.com/some-post",
        "https://facebook.com/profile.php?id=123"]) {
        expect(serialized).not.toContain(privateValue);
      }
    } finally {
      restore();
    }
  });

  it("correlates mutation reconsideration and stops output after diagnostics are disabled", async () => {
    window.localStorage.setItem(DEBUG_KEY, "1");
    const { seen, restore } = captureConsoleInfo();
    try {
      document.body.innerHTML = '<div role="comment" id="diag-mutation-comment">A respectful comment.</div>';
      await loadContentModule();
      const comment = byId("diag-mutation-comment");
      const initial = seen.find((args) => args[0] === "[Tathabbut debug] candidate" &&
        (args[1] as { stage?: string; kind?: string } | undefined)?.stage === "extraction" &&
        (args[1] as { kind?: string } | undefined)?.kind === "comment")?.[1] as Record<string, unknown>;
      const id = initial.candidateId;
      comment.textContent = "فاشل";
      await vi.waitFor(() => expect(isHidden(comment)).toBe(true));
      await vi.waitFor(() => {
        expect(seen.some((args) => args[0] === "[Tathabbut debug] candidate" &&
          (args[1] as { candidateId?: string; stage?: string; trigger?: string } | undefined)?.candidateId === id &&
          (args[1] as { stage?: string } | undefined)?.stage === "extraction" &&
          (args[1] as { trigger?: string } | undefined)?.trigger === "mutation")).toBe(true);
      });

      window.localStorage.removeItem(DEBUG_KEY);
      fireStorageChange("local", { [DEBUG_FLAG_KEY]: { oldValue: true, newValue: false } });
      await settle();
      const loggedAfterDisable = seen.length;
      comment.textContent = "غبي";
      await settle();
      expect(seen).toHaveLength(loggedAfterDisable);
    } finally {
      restore();
    }
  });

  it("reports reuse and cleanup of duplicate controls with a bounded count", async () => {
    window.localStorage.setItem(DEBUG_KEY, "1");
    const { seen, restore } = captureConsoleInfo();
    try {
      document.body.innerHTML = '<div role="comment" id="diag-controls">غبي</div>';
      const mod = await loadContentModule();
      const comment = byId("diag-controls");
      await vi.waitFor(() => expect(isHidden(comment)).toBe(true));
      comment.insertAdjacentHTML("beforeend",
        '<span class="tathabbut-notice">stale</span><button class="tathabbut-reveal">stale</button>');
      mod.applyResult(comment, classifyLocally("غبي"));

      const reuse = seen.filter((args) => args[0] === "[Tathabbut debug] hide")
        .map((args) => args[1] as Record<string, unknown>)
        .find((details) => details.stage === "reused");
      expect(reuse).toMatchObject({ stage: "reused", controlsBefore: 4, duplicateControlsRemoved: 2, controlsAfter: 2 });
      expect(comment.querySelectorAll(":scope > .tathabbut-reveal")).toHaveLength(1);
      expect(comment.querySelectorAll(":scope > .tathabbut-notice")).toHaveLength(1);
      expect(JSON.stringify(seen)).not.toContain("stale");
    } finally {
      restore();
    }
  });
});

describe("six end-to-end content filtering regression scenarios", () => {
  function latestStatus(): Record<string, unknown> | undefined {
    return localSets
      .map((items) => items[STATUS_KEY])
      .filter((value): value is Record<string, unknown> => !!value && typeof value === "object")
      .pop();
  }

  it("directly harmful post is extracted, classified, and its body hidden without hiding its header or neighbor", async () => {
    window.localStorage.setItem(DEBUG_KEY, "1");
    const { seen, restore } = captureConsoleInfo();
    try {
      document.body.innerHTML =
        '<div id="e2e-feed">' +
          '<div role="article" id="e2e-direct-post">' +
            '<div class="post-header" id="e2e-direct-author">Test Author</div>' +
            '<div class="post-body" id="e2e-direct-body">You are an idiot</div>' +
          "</div>" +
          '<div role="article" id="e2e-direct-neighbor">' +
            '<div class="post-body">I love sunny days and long walks.</div>' +
          "</div>" +
        "</div>";
      const mod = await loadContentModule();
      const post = byId("e2e-direct-post");
      const body = byId("e2e-direct-body");
      const author = byId("e2e-direct-author");

      await vi.waitFor(() => expect(isHidden(body)).toBe(true));
      expect(mod.readText(body)).toBe("You are an idiot");
      const result = classifyLocally("You are an idiot");
      expect(result.labels).toEqual(
        expect.arrayContaining([expect.objectContaining({ category: "harassment" })])
      );
      expect(shouldHide(result, DEFAULT_SETTINGS)).toBe(true);

      expect(isHidden(body)).toBe(true);
      expect(isHidden(author)).toBe(false);
      expect(isHidden(post)).toBe(false);
      expect(isHidden(byId("e2e-direct-neighbor"))).toBe(false);
      expect(revealButtons(body)).toBe(1);

      await vi.waitFor(() => {
        const scans = seen
          .filter((args) => args[0] === "[Tathabbut debug] scan")
          .map((args) => args[1] as Record<string, unknown>);
        expect(scans.at(-1)?.postUnits).toBe(2);
        expect(scans.at(-1)?.uniqueUnits).toBe(2);
      });
      const candidates = seen
        .filter((args) => args[0] === "[Tathabbut debug] candidate")
        .map((args) => args[1] as Record<string, unknown>);
      expect(candidates).toEqual(
        expect.arrayContaining([expect.objectContaining({ via: "desktop", kind: "post" })])
      );
      const decisions = seen
        .filter((args) => args[0] === "[Tathabbut debug] decision")
        .map((args) => args[1] as Record<string, unknown>);
      expect(decisions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ decision: "hidden", reason: "rule-match", kind: "post", via: "desktop" })
        ])
      );
      await vi.waitFor(() => {
        const progress = seen
          .filter((args) => args[0] === "[Tathabbut debug] progress")
          .map((args) => args[1] as Record<string, unknown>);
        expect(progress.some((details) => Number(details.hidden) >= 1)).toBe(true);
      }, { timeout: 2500 });
      expect(JSON.stringify(seen)).not.toContain("You are an idiot");
      expect(JSON.stringify(seen)).not.toContain("Test Author");
    } finally {
      restore();
    }
  });

  it("See more and عرض المزيد are excluded from classification and expansion controls survive reveal", async () => {
    window.localStorage.setItem(DEBUG_KEY, "1");
    const { seen, restore } = captureConsoleInfo();
    try {
      document.body.innerHTML =
        '<div id="e2e-feed">' +
          '<div role="article" id="e2e-en-post">' +
            '<div class="post-body" id="e2e-en-body">You are an idiot' +
              '<button type="button" id="e2e-en-expand">See more</button></div>' +
          "</div>" +
          '<div role="article" id="e2e-ar-post">' +
            '<div class="post-body" id="e2e-ar-body">أنت غبي' +
              '<button type="button" id="e2e-ar-expand">عرض المزيد</button></div>' +
          "</div>" +
          '<div role="article" id="e2e-see-more-neighbor">' +
            '<div class="post-body">I respectfully disagree with your opinion.</div>' +
          "</div>" +
        "</div>";
      const enExpand = byId("e2e-en-expand") as HTMLButtonElement;
      const arExpand = byId("e2e-ar-expand") as HTMLButtonElement;
      let enClicks = 0;
      let arClicks = 0;
      enExpand.addEventListener("click", () => { enClicks += 1; });
      arExpand.addEventListener("click", () => { arClicks += 1; });

      const mod = await loadContentModule();
      await vi.waitFor(() => expect(isHidden(byId("e2e-en-post"))).toBe(true));
      await vi.waitFor(() => expect(isHidden(byId("e2e-ar-post"))).toBe(true));

      expect(mod.readText(byId("e2e-en-body"))).toBe("You are an idiot");
      expect(mod.readText(byId("e2e-ar-body"))).toBe("أنت غبي");
      expect(isHidden(byId("e2e-see-more-neighbor"))).toBe(false);
      expect(revealButtons(byId("e2e-en-post"))).toBe(1);
      expect(revealButtons(byId("e2e-ar-post"))).toBe(1);

      const hiddenStatusBefore = latestStatus();
      expect(hiddenStatusBefore).toBeDefined();
      mod.scan();
      mod.scan();
      await settle();
      expect(document.querySelectorAll(".tathabbut-hidden").length).toBe(2);
      expect(revealButtons(byId("e2e-en-post"))).toBe(1);
      expect(revealButtons(byId("e2e-ar-post"))).toBe(1);
      expect(latestStatus()?.evaluated).toBe(hiddenStatusBefore?.evaluated);
      expect(latestStatus()?.classified).toBe(hiddenStatusBefore?.classified);

      (byId("e2e-en-post").querySelector(":scope > .tathabbut-reveal") as HTMLButtonElement).click();
      (byId("e2e-ar-post").querySelector(":scope > .tathabbut-reveal") as HTMLButtonElement).click();
      expect(isHidden(byId("e2e-en-post"))).toBe(false);
      expect(isHidden(byId("e2e-ar-post"))).toBe(false);
      expect(byId("e2e-en-expand")).toBe(enExpand);
      expect(byId("e2e-ar-expand")).toBe(arExpand);
      enExpand.click();
      arExpand.click();
      expect(enClicks).toBe(1);
      expect(arClicks).toBe(1);

      const before = latestStatus();
      expect(before).toBeDefined();
      mod.scan();
      mod.scan();
      await settle();
      const after = latestStatus();
      expect(after).toBeDefined();
      expect(after?.evaluated).toBe(before?.evaluated);
      expect(after?.classified).toBe(before?.classified);
      expect(document.querySelectorAll(".tathabbut-hidden").length).toBe(0);
      expect(document.querySelectorAll(".tathabbut-reveal").length).toBe(0);
      expect(isHidden(byId("e2e-see-more-neighbor"))).toBe(false);
      expect(JSON.stringify(seen)).not.toContain("See more");
    } finally {
      restore();
    }
  });

  it("harmful individual comment is hidden and reported as a comment, not as its post", async () => {
    window.localStorage.setItem(DEBUG_KEY, "1");
    const { seen, restore } = captureConsoleInfo();
    try {
      document.body.innerHTML =
        '<div id="e2e-feed">' +
          '<div role="article" id="e2e-comment-post">' +
            '<div class="post-body">Great match today!</div>' +
            '<div role="comment" id="e2e-harmful-comment"><span>You are an idiot</span></div>' +
            '<div role="comment" id="e2e-benign-comment"><span>I respectfully disagree with your opinion.</span></div>' +
          "</div>" +
        "</div>";
      await loadContentModule();
      const post = byId("e2e-comment-post");
      const harmful = byId("e2e-harmful-comment");
      const benign = byId("e2e-benign-comment");

      await vi.waitFor(() => expect(isHidden(harmful)).toBe(true));
      expect(isHidden(post)).toBe(false);
      expect(isHidden(benign)).toBe(false);
      expect(revealButtons(harmful)).toBe(1);
      expect(revealButtons(benign)).toBe(0);

      await vi.waitFor(() => {
        const scans = seen
          .filter((args) => args[0] === "[Tathabbut debug] scan")
          .map((args) => args[1] as Record<string, unknown>);
        expect(scans.at(-1)?.postUnits).toBe(1);
        expect(scans.at(-1)?.commentUnits).toBe(2);
        expect(scans.at(-1)?.replyUnits).toBe(0);
      });
      const decisions = seen
        .filter((args) => args[0] === "[Tathabbut debug] decision")
        .map((args) => args[1] as Record<string, unknown>);
      expect(decisions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ decision: "hidden", kind: "comment", category: "harassment" })
        ])
      );
      expect(JSON.stringify(seen)).not.toContain("You are an idiot");
    } finally {
      restore();
    }
  });

  it("harmful nested reply is hidden and revealed independently of its parent and sibling", async () => {
    window.localStorage.setItem(DEBUG_KEY, "1");
    const { seen, restore } = captureConsoleInfo();
    try {
      document.body.innerHTML =
        '<div id="e2e-feed">' +
          '<div role="article" id="e2e-reply-post">' +
            '<div class="post-body">Great match today!</div>' +
            '<div role="comment" id="e2e-parent-comment">' +
              '<span>I respectfully disagree with your opinion.</span>' +
              '<div role="comment" id="e2e-harmful-reply"><span>Shut up, you are pathetic</span></div>' +
              '<div role="comment" id="e2e-benign-reply"><span>Thanks for explaining your point.</span></div>' +
            "</div>" +
          "</div>" +
        "</div>";
      const mod = await loadContentModule();
      const post = byId("e2e-reply-post");
      const parent = byId("e2e-parent-comment");
      const harmful = byId("e2e-harmful-reply");
      const benign = byId("e2e-benign-reply");

      await vi.waitFor(() => expect(isHidden(harmful)).toBe(true));
      expect(isHidden(post)).toBe(false);
      expect(isHidden(parent)).toBe(false);
      expect(isHidden(benign)).toBe(false);
      expect(revealButtons(harmful)).toBe(1);

      await vi.waitFor(() => {
        const scans = seen
          .filter((args) => args[0] === "[Tathabbut debug] scan")
          .map((args) => args[1] as Record<string, unknown>);
        expect(scans.at(-1)?.postUnits).toBe(1);
        expect(scans.at(-1)?.commentUnits).toBe(1);
        expect(scans.at(-1)?.replyUnits).toBe(2);
      });
      const decisions = seen
        .filter((args) => args[0] === "[Tathabbut debug] decision")
        .map((args) => args[1] as Record<string, unknown>);
      expect(decisions).toEqual(
        expect.arrayContaining([expect.objectContaining({ decision: "hidden", kind: "reply" })])
      );

      (harmful.querySelector(":scope > .tathabbut-reveal") as HTMLButtonElement).click();
      expect(isHidden(harmful)).toBe(false);
      expect(isHidden(parent)).toBe(false);
      expect(isHidden(benign)).toBe(false);
      expect(revealButtons(harmful)).toBe(0);

      mod.scan();
      mod.scan();
      await settle();
      expect(isHidden(harmful)).toBe(false);
      expect(isHidden(parent)).toBe(false);
      expect(isHidden(benign)).toBe(false);
      expect(document.querySelectorAll(".tathabbut-hidden").length).toBe(0);
    } finally {
      restore();
    }
  });

  it("reveal restores original text and expansion state without wrappers, missing nodes, or a re-hide", async () => {
    document.body.innerHTML =
      '<div id="e2e-feed">' +
        '<div role="article" id="e2e-reveal-post">' +
          '<div class="post-body" id="e2e-reveal-body">You are an idiot' +
            '<button type="button" id="e2e-reveal-expand">See more</button></div>' +
        "</div>" +
        '<div role="article" id="e2e-reveal-neighbor">' +
          '<div class="post-body">I love sunny days and long walks.</div>' +
        "</div>" +
      "</div>";
    const expand = byId("e2e-reveal-expand") as HTMLButtonElement;
    let clicks = 0;
    expand.addEventListener("click", () => { clicks += 1; });

    const mod = await loadContentModule();
    const post = byId("e2e-reveal-post");
    const body = byId("e2e-reveal-body");
    await vi.waitFor(() => expect(isHidden(post)).toBe(true));
    expect(revealButtons(post)).toBe(1);

    (post.querySelector(":scope > .tathabbut-reveal") as HTMLButtonElement).click();
    expect(isHidden(post)).toBe(false);
    expect(revealButtons(post)).toBe(0);
    expect(post.querySelectorAll(".tathabbut-notice").length).toBe(0);
    expect(post.querySelectorAll(".tathabbut-hidden-text").length).toBe(0);
    expect(byId("e2e-reveal-expand")).toBe(expand);
    expect(byId("e2e-reveal-body")).toBe(body);
    expect(mod.readText(body)).toBe("You are an idiot");
    expect(body.textContent).toContain("See more");
    expand.click();
    expect(clicks).toBe(1);
    expect(isHidden(byId("e2e-reveal-neighbor"))).toBe(false);
    expect(document.querySelectorAll(".tathabbut-hidden").length).toBe(0);

    mod.scan();
    await settle();
    expect(isHidden(post)).toBe(false);
    expect(revealButtons(post)).toBe(0);
    expect(document.querySelectorAll(".tathabbut-hidden-text").length).toBe(0);
  });

  it("benign criticism, sad news, and a negative statement stay visible while a neighboring comment is hidden", async () => {
    document.body.innerHTML =
      '<div id="e2e-feed">' +
        '<div role="article" id="e2e-benign-criticism">' +
          '<div class="post-body">I respectfully disagree with your opinion.</div>' +
        "</div>" +
        '<div role="article" id="e2e-benign-sad-news">' +
          '<div class="post-body">I feel sad about the news.</div>' +
        "</div>" +
        '<div role="article" id="e2e-benign-negative">' +
          '<div class="post-body">The movie was terrible and the acting was awful.</div>' +
        "</div>" +
        '<div role="article" id="e2e-benign-parent">' +
          '<div class="post-body">Great match today!</div>' +
          '<div role="comment" id="e2e-benign-next-to-harm">' +
            '<span>Thanks for explaining your point.</span>' +
          "</div>" +
          '<div role="comment" id="e2e-harmful-next">' +
            '<span>You are an idiot</span>' +
          "</div>" +
        "</div>" +
      "</div>";

    for (const text of [
      "I respectfully disagree with your opinion.",
      "I feel sad about the news.",
      "The movie was terrible and the acting was awful.",
      "I will beat you at chess tomorrow.",
      "Thanks for explaining your point."
    ]) {
      expect(classifyLocally(text).labels).toEqual([]);
      expect(shouldHide(classifyLocally(text), DEFAULT_SETTINGS)).toBe(false);
    }

    await loadContentModule();
    await vi.waitFor(() => expect(isHidden(byId("e2e-harmful-next"))).toBe(true));
    expect(isHidden(byId("e2e-benign-criticism"))).toBe(false);
    expect(isHidden(byId("e2e-benign-sad-news"))).toBe(false);
    expect(isHidden(byId("e2e-benign-negative"))).toBe(false);
    expect(isHidden(byId("e2e-benign-next-to-harm"))).toBe(false);
    expect(isHidden(byId("e2e-benign-parent"))).toBe(false);
    expect(isHidden(byId("e2e-feed"))).toBe(false);
    expect(document.querySelectorAll(".tathabbut-hidden").length).toBe(1);
    expect(revealButtons(byId("e2e-harmful-next"))).toBe(1);
  });
});

describe("foundation audit: extraction, identity, mutations, and ambiguity", () => {
  it("extracts body content while excluding author, UI controls, and nested comment text", async () => {
    document.body.innerHTML =
      '<div role="article" id="audit-article">' +
        '<div class="post-header" id="audit-author">Test Author</div>' +
        '<div class="post-body" id="audit-body">You are <span>an idiot</span>' +
          '<button type="button" id="audit-expand">See more</button>' +
        "</div>" +
        '<div role="comment" id="audit-nested-comment">' +
          '<span>Thanks for explaining your point.</span>' +
        "</div>" +
      "</div>";
    const mod = await loadContentModule();
    const article = byId("audit-article");
    const body = byId("audit-body");

    expect(mod.readText(body)).toBe("You are an idiot");
    expect(mod.readText(byId("audit-nested-comment"))).toBe("Thanks for explaining your point.");
    const articleText = mod.readText(article);
    expect(articleText).toContain("Test Author");
    expect(articleText).toContain("You are an idiot");
    expect(articleText).not.toContain("See more");
    expect(articleText).not.toContain("Thanks for explaining");

    await vi.waitFor(() => expect(isHidden(body)).toBe(true));
    expect(mod.readText(body)).toBe("You are an idiot");
  });

  it("targets post, comment, and reply independently when their text is identical", async () => {
    document.body.innerHTML =
      '<div id="audit-feed">' +
        '<div role="article" id="audit-same-post">' +
          '<div class="post-header">Test Author</div>' +
          '<div class="post-body">You are an idiot</div>' +
          '<div role="comment" id="audit-same-parent">' +
            '<span>I respectfully disagree with your opinion.</span>' +
            '<div role="comment" id="audit-same-reply"><span>You are an idiot</span></div>' +
          "</div>" +
          '<div role="comment" id="audit-same-comment"><span>You are an idiot</span></div>' +
        "</div>" +
      "</div>";
    await loadContentModule();
    const parent = byId("audit-same-parent");
    const reply = byId("audit-same-reply");
    const comment = byId("audit-same-comment");

    await vi.waitFor(() => expect(isHidden(reply)).toBe(true));
    await vi.waitFor(() => expect(isHidden(comment)).toBe(true));

    expect(isHidden(byId("audit-same-post"))).toBe(false);
    expect(isHidden(parent)).toBe(false);
    expect(document.querySelectorAll(".tathabbut-hidden").length).toBe(3);
    expect(document.querySelectorAll(".tathabbut-notice").length).toBe(3);
    expect(revealButtons(reply)).toBe(1);
    expect(revealButtons(comment)).toBe(1);
    expect(revealButtons(byId("audit-same-post"))).toBe(0);
  });

  it("keeps duplicate notices out across scans, churn, reveal, and re-hide", async () => {
    document.body.innerHTML =
      '<div id="audit-cycle-feed">' +
        '<div role="article" id="audit-cycle-post">' +
          '<div class="post-header">Test Author</div>' +
          '<div class="post-body" id="audit-cycle-body">You are an idiot</div>' +
        "</div>" +
        '<div role="article" id="audit-cycle-neighbor">' +
          '<div class="post-body">I love sunny days and long walks.</div>' +
        "</div>" +
      "</div>";
    const mod = await loadContentModule();
    const body = byId("audit-cycle-body");
    const neighbor = byId("audit-cycle-neighbor");
    const feed = byId("audit-cycle-feed");
    const surfaceCounts = () => ({
      hidden: document.querySelectorAll(".tathabbut-hidden").length,
      notices: document.querySelectorAll(".tathabbut-notice").length,
      buttons: document.querySelectorAll(".tathabbut-reveal").length
    });

    await vi.waitFor(() => expect(isHidden(body)).toBe(true));
    expect(surfaceCounts()).toEqual({ hidden: 1, notices: 1, buttons: 1 });

    mod.scan();
    mod.scan();
    const churn = document.createElement("div");
    churn.setAttribute("role", "article");
    churn.textContent = "A quiet afternoon reading books.";
    feed.appendChild(churn);
    await settle(200);
    expect(surfaceCounts()).toEqual({ hidden: 1, notices: 1, buttons: 1 });

    (body.querySelector(":scope > .tathabbut-reveal") as HTMLButtonElement).click();
    expect(isHidden(body)).toBe(false);
    expect(surfaceCounts()).toEqual({ hidden: 0, notices: 0, buttons: 0 });

    mod.scan();
    const laterChurn = document.createElement("div");
    laterChurn.setAttribute("role", "article");
    laterChurn.textContent = "Thanks for explaining your point.";
    feed.appendChild(laterChurn);
    await settle(200);
    expect(surfaceCounts()).toEqual({ hidden: 0, notices: 0, buttons: 0 });

    body.textContent = "You are a loser";
    await vi.waitFor(() => expect(isHidden(body)).toBe(true));
    expect(surfaceCounts()).toEqual({ hidden: 1, notices: 1, buttons: 1 });
    expect(isHidden(neighbor)).toBe(false);
  });

  it("rehides a replacement target whose text is unchanged", async () => {
    document.body.innerHTML =
      '<div role="article" id="audit-replace-post">' +
        '<div class="post-header">Test Author</div>' +
        '<div class="post-body" id="audit-replace-body">You are an idiot</div>' +
      "</div>";
    await loadContentModule();
    const article = byId("audit-replace-post");
    const oldBody = byId("audit-replace-body");

    await vi.waitFor(() => expect(isHidden(oldBody)).toBe(true));
    const newBody = document.createElement("div");
    newBody.className = "post-body";
    newBody.id = "audit-replacement-body";
    newBody.textContent = "You are an idiot";
    oldBody.replaceWith(newBody);

    await vi.waitFor(() => expect(isHidden(newBody)).toBe(true));
    expect(isHidden(article)).toBe(false);
    expect(isHidden(oldBody)).toBe(false);
    expect(document.querySelectorAll(".tathabbut-hidden").length).toBe(1);
    expect(document.querySelectorAll(".tathabbut-notice").length).toBe(1);
  });

  it("cleans up when a hidden target disappears from the DOM", async () => {
    document.body.innerHTML =
      '<div role="article" id="audit-remove-post">' +
        '<div class="post-header">Test Author</div>' +
        '<div class="post-body" id="audit-remove-body">You are an idiot</div>' +
      "</div>";
    const mod = await loadContentModule();
    const article = byId("audit-remove-post");
    const body = byId("audit-remove-body");

    await vi.waitFor(() => expect(isHidden(body)).toBe(true));
    body.remove();
    await settle(200);

    expect(isHidden(article)).toBe(false);
    expect(isHidden(body)).toBe(false);
    expect(document.querySelectorAll(".tathabbut-hidden, .tathabbut-notice, .tathabbut-reveal").length)
      .toBe(0);
    expect(() => mod.reveal(body)).not.toThrow();
  });

  it("keeps an ambiguous mixed SSR parent visible instead of guessing a target", async () => {
    document.body.innerHTML = mobileShell(
      '<div data-mcomponent="ServerTextArea" id="audit-ambiguous-area">' +
        '<div class="native-text" id="audit-ambiguous-parent">' +
          '<span class="f1">You are an idiot</span>' +
          '<div class="native-text" id="audit-ambiguous-child">' +
            '<span class="f1">Thanks for explaining your point.</span>' +
          "</div>" +
        "</div>" +
      "</div>"
    );
    await loadContentModule();
    await settle(200);

    expect(isHidden(byId("audit-ambiguous-parent"))).toBe(false);
    expect(isHidden(byId("audit-ambiguous-child"))).toBe(false);
    expect(document.querySelectorAll(".tathabbut-hidden").length).toBe(0);
    expect(document.querySelectorAll(".tathabbut-reveal, .tathabbut-notice").length).toBe(0);
  });
});
