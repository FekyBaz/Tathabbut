import { describe, expect, it, vi } from "vitest";
import { BoundedTaskQueue, fingerprintText, normalizeText } from "./text-engine";

describe("text normalization and fingerprints", () => {
  it("normalizes whitespace consistently", () => {
    expect(normalizeText("  hello\\n  world  ")).toBe("hello world");
  });

  it("is stable for identical text and changes when text changes", () => {
    expect(fingerprintText("same")).toBe(fingerprintText("same"));
    expect(fingerprintText("same")).not.toBe(fingerprintText("changed"));
  });
});

describe("BoundedTaskQueue", () => {
  it("limits concurrent tasks", async () => {
    const queue = new BoundedTaskQueue(1, 3);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const first = vi.fn(async () => gate);
    const second = vi.fn(async () => {});
    expect(queue.enqueue(first)).toBe(true);
    expect(queue.enqueue(second)).toBe(true);
    expect(queue.activeCount).toBe(1);
    expect(queue.pendingCount).toBe(1);
    release();
    await vi.waitFor(() => expect(second).toHaveBeenCalledOnce());
  });

  it("rejects work beyond its configured bound", () => {
    const queue = new BoundedTaskQueue(1, 1);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    expect(queue.enqueue(() => gate)).toBe(true);
    expect(queue.enqueue(async () => {})).toBe(false);
    release();
  });

  it("continues processing after a task fails", async () => {
    const queue = new BoundedTaskQueue(1, 3);
    const next = vi.fn(async () => {});
    expect(queue.enqueue(async () => { throw new Error("expected"); })).toBe(true);
    expect(queue.enqueue(next)).toBe(true);
    await vi.waitFor(() => expect(next).toHaveBeenCalledOnce());
  });
});
