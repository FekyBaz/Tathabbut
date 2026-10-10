export function normalizeText(text: string): string {
  return text.replace(/\\s+/g, " ").trim();
}

/** Small stable fingerprint for deduplication; not a security hash. */
export function fingerprintText(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16) + ":" + text.length;
}

/** Bounded FIFO work queue with fixed concurrency to avoid flooding the page or API. */
export class BoundedTaskQueue {
  private readonly pending: Array<() => Promise<void>> = [];
  private active = 0;

  constructor(
    private readonly concurrency = 2,
    private readonly maxPending = 200
  ) {
    if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("concurrency must be a positive integer");
    if (!Number.isInteger(maxPending) || maxPending < 1) throw new Error("maxPending must be a positive integer");
  }

  enqueue(task: () => Promise<void>): boolean {
    if (this.pending.length + this.active >= this.maxPending) return false;
    this.pending.push(task);
    this.drain();
    return true;
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  get activeCount(): number {
    return this.active;
  }

  private drain(): void {
    while (this.active < this.concurrency && this.pending.length > 0) {
      const task = this.pending.shift();
      if (!task) continue;
      this.active += 1;
      void task().catch(() => {
        // A single failed classification must not stop later work.
      }).finally(() => {
        this.active -= 1;
        this.drain();
      });
    }
  }
}
