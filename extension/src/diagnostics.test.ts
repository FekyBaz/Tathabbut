import { describe, expect, it } from "vitest";
import {
  DEBUG_FLAG_KEY,
  STATUS_KEY,
  describeReason,
  formatStatusAge,
  isFreshStatus,
  statusViewModel,
  type ContentStatus
} from "./diagnostics";

function sampleStatus(overrides: Partial<ContentStatus> = {}): ContentStatus {
  return {
    startedAt: 1000,
    settingsOk: true,
    enabled: true,
    threshold: 0.85,
    categories: 4,
    apiMode: "local",
    articlesFound: 3,
    evaluated: 3,
    classified: 3,
    hidden: 1,
    skipped: 4,
    skippedUnchanged: 2,
    skippedEmpty: 1,
    skippedDisabled: 0,
    skippedQueueFull: 1,
    lastReason: "rule-match",
    origin: "www.facebook.com",
    updatedAt: 2000,
    ...overrides
  };
}

describe("diagnostics helpers", () => {
  it("uses stable storage keys", () => {
    expect(DEBUG_FLAG_KEY).toBe("tathabbutDebug");
    expect(STATUS_KEY).toBe("tathabbutStatus");
  });

  it("explains every known outcome reason", () => {
    for (const reason of [
      "rule-match",
      "no-rule-match",
      "below-threshold",
      "category-disabled",
      "filter-disabled",
      "empty-text",
      "unchanged",
      "queue-full",
      "starting"
    ]) {
      const text = describeReason(reason);
      expect(text.length).toBeGreaterThan(reason.length);
    }
    expect(describeReason("something-new")).toBe("something-new");
  });

  it("formats status age without leaking anything", () => {
    expect(formatStatusAge(1000, 1000)).toBe("just now");
    expect(formatStatusAge(1000, 46_000)).toBe("45s ago");
    expect(formatStatusAge(1000, 121_000)).toBe("2m ago");
    expect(formatStatusAge(1000, 3_700_000)).toBe("stale (over an hour old)");
  });

  it("treats missing or stale snapshots as not fresh", () => {
    expect(isFreshStatus(undefined)).toBe(false);
    expect(isFreshStatus(sampleStatus(), 2000 + 60_000)).toBe(true);
    expect(isFreshStatus(sampleStatus(), 2000 + 6 * 60_000)).toBe(false);
  });
});

describe("statusViewModel", () => {
  it("reports a missing snapshot honestly", () => {
    const view = statusViewModel({ snapshot: undefined, storageError: false });
    expect(view.started).toContain("Not reported yet");
    expect(view.articles).toBe("—");
  });

  it("reports a storage failure instead of silence", () => {
    const view = statusViewModel({ snapshot: undefined, storageError: true });
    expect(view.started).toContain("Could not read diagnostic storage");
    expect(view.updated).toBe("—");
  });

  it("labels a stale snapshot as stale while keeping last-known values", () => {
    const view = statusViewModel(
      { snapshot: sampleStatus(), storageError: false },
      2000 + 10 * 60_000
    );
    expect(view.started).toContain("stale");
    expect(view.articles).toBe("3");
    expect(view.source).toBe("www.facebook.com");
  });

  it("renders a fresh snapshot with its reporting site", () => {
    const view = statusViewModel(
      { snapshot: sampleStatus(), storageError: false },
      2000 + 10_000
    );
    expect(view.started).toContain("Running since");
    expect(view.settings).toContain("threshold 0.85");
    expect(view.counts).toBe("3 / 3 / 1 / 4");
    expect(view.skips).toBe("2 unchanged · 1 empty · 0 disabled · 1 queue-full");
    expect(view.source).toBe("www.facebook.com");
  });
});
