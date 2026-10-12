import { describe, expect, it } from "vitest";
import {
  DEBUG_FLAG_KEY,
  STATUS_KEY,
  describeReason,
  formatStatusAge,
  isFreshStatus,
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
    lastReason: "rule-match",
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
