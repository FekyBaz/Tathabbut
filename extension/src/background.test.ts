import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => unknown;

let messageListener: Listener | undefined;
let permissionGranted: boolean;
let fetchHandler: ((url: string, init?: RequestInit) => Promise<Response>) | undefined;

function installWorkerStubs(): void {
  messageListener = undefined;
  permissionGranted = true;
  fetchHandler = undefined;
  (globalThis as unknown as { chrome: unknown }).chrome = {
    permissions: { contains: vi.fn(async () => permissionGranted) },
    runtime: {
      onMessage: {
        addListener: vi.fn((listener: Listener) => {
          messageListener = listener;
        })
      }
    }
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (!fetchHandler) throw new Error("no fetch handler installed");
      return fetchHandler(url, init);
    })
  );
}

function okResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as Response;
}

async function send(message: unknown): Promise<{ replied: boolean; keptOpen: unknown; response: unknown }> {
  vi.resetModules();
  await import("./background");
  if (!messageListener) throw new Error("background did not register a listener");
  let replied = false;
  let response: unknown;
  const keptOpen = messageListener(message, {}, (value) => {
    replied = true;
    response = value;
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  return { replied, keptOpen, response };
}

beforeEach(() => {
  installWorkerStubs();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("background remote-classification worker", () => {
  it("ignores messages that are not remote requests", async () => {
    const outcome = await send({ type: "something-else" });
    expect(outcome.keptOpen).not.toBe(true);
    expect(outcome.replied).toBe(false);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("rejects oversized text and unknown categories without fetching", async () => {
    const longText = await send({
      type: "tathabbut:classify-remote",
      apiUrl: "https://api.example.com",
      text: "x".repeat(4001),
      enabledCategories: ["harassment"]
    });
    expect(longText.replied).toBe(false);
    const badCategory = await send({
      type: "tathabbut:classify-remote",
      apiUrl: "https://api.example.com",
      text: "hello",
      enabledCategories: ["misinformation"]
    });
    expect(badCategory.replied).toBe(false);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("refuses invalid API URLs without fetching", async () => {
    const outcome = await send({
      type: "tathabbut:classify-remote",
      apiUrl: "http://api.example.com",
      text: "hello",
      enabledCategories: ["harassment"]
    });
    expect(outcome.replied).toBe(true);
    expect(outcome.response).toEqual({ ok: false, result: null });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("refuses to fetch without the host permission", async () => {
    permissionGranted = false;
    const outcome = await send({
      type: "tathabbut:classify-remote",
      apiUrl: "https://api.example.com",
      text: "You are an idiot",
      enabledCategories: ["harassment"]
    });
    expect(outcome.response).toEqual({ ok: false, result: null });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("forwards a valid remote classification", async () => {
    fetchHandler = async () => okResponse({ labels: [{ category: "harassment", score: 0.9 }], provider: "remote-test" });
    const outcome = await send({
      type: "tathabbut:classify-remote",
      apiUrl: "https://api.example.com/",
      text: "You are an idiot",
      enabledCategories: ["harassment"]
    });
    expect(outcome.keptOpen).toBe(true);
    expect(outcome.response).toEqual({
      ok: true,
      result: { labels: [{ category: "harassment", score: 0.9 }], provider: "remote-test" }
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/v1/classify");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("omit");
  });

  it("rejects malformed and failed remote responses", async () => {
    fetchHandler = async () => okResponse({ labels: [{ category: "bogus", score: 0.9 }], provider: "x" });
    const malformed = await send({
      type: "tathabbut:classify-remote",
      apiUrl: "https://api.example.com",
      text: "hello",
      enabledCategories: ["harassment"]
    });
    expect(malformed.response).toEqual({ ok: false, result: null });

    fetchHandler = async () => ({ ok: false, json: async () => ({}) }) as Response;
    const failed = await send({
      type: "tathabbut:classify-remote",
      apiUrl: "https://api.example.com",
      text: "hello",
      enabledCategories: ["harassment"]
    });
    expect(failed.response).toEqual({ ok: false, result: null });
  });
});
