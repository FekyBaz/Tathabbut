import { describe, expect, it } from "vitest";
import { DEFAULT_LANGUAGE, LANGUAGES, STRINGS, pickLanguage, t, type LocaleStrings } from "./i18n";

function keysOf(strings: LocaleStrings): string[] {
  return Object.keys(strings).sort();
}

describe("locale dictionaries", () => {
  it("supports Arabic and English with Arabic as the default", () => {
    expect(LANGUAGES).toEqual(["ar", "en"]);
    expect(DEFAULT_LANGUAGE).toBe("ar");
  });

  it("defines the exact same keys in both languages", () => {
    expect(keysOf(STRINGS.ar)).toEqual(keysOf(STRINGS.en));
  });

  it("fills every string in both languages", () => {
    for (const lang of LANGUAGES) {
      for (const key of keysOf(STRINGS[lang])) {
        const value = STRINGS[lang][key as keyof LocaleStrings] as string;
        expect(typeof value).toBe("string");
        expect(value.length, lang + "." + key).toBeGreaterThan(0);
      }
    }
  });

  it("uses RTL for Arabic and LTR for English", () => {
    expect(t("ar").dir).toBe("rtl");
    expect(t("ar").htmlLang).toBe("ar");
    expect(t("en").dir).toBe("ltr");
    expect(t("en").htmlLang).toBe("en");
  });

  it("keeps technical endpoint paths identical across languages", () => {
    expect(t("ar").apiHint).toContain("/v1/classify");
    expect(t("en").apiHint).toContain("/v1/classify");
  });
});

describe("pickLanguage", () => {
  it("defaults missing, undefined, and invalid values to Arabic", () => {
    expect(pickLanguage(undefined)).toBe("ar");
    expect(pickLanguage("")).toBe("ar");
    expect(pickLanguage("fr")).toBe("ar");
    expect(pickLanguage(null)).toBe("ar");
    expect(pickLanguage("AR")).toBe("ar");
  });

  it("honors an explicit English choice", () => {
    expect(pickLanguage("en")).toBe("en");
  });
});
