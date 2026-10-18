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

  it("keeps unit-level hiding for remote verdicts without a local match", async () => {
    storedSettings = { ...DEFAULT_SETTINGS, apiUrl: "https://api.example.com" };
    const chromeApi = (globalThis as unknown as { chrome: { runtime: { sendMessage: ReturnType<typeof vi.fn> } } }).chrome;
    vi.mocked(chromeApi.runtime.sendMessage).mockResolvedValue({
      ok: true,
      result: { labels: [{ category: "spam", score: 0.99 }], provider: "remote-test" }
    });
    document.body.innerHTML =
      '<div id="feed">' +
      '<div role="article" id="remote-mix">' +
      '<div class="post-body">A quiet afternoon reading books.</div>' +
      '<div class="plain-reply">More quiet pages to enjoy slowly.</div>' +
      "</div></div>";
    await loadContentModule();
    const article = byId("remote-mix");
    await vi.waitFor(() => expect(isHidden(article)).toBe(true));
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
