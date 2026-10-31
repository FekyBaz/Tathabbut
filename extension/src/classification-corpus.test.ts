// Phase 1 labeled corpus for Arabic and English harmful-content rules.
// Positives are direct, targeted abuse. Negatives protect criticism, quoted
// reports, self-description, and neutral/news text. Keep this table explicit:
// every rule change must be represented here.
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, classifyLocally, shouldHide, type Category } from "./policy";

interface Case {
  text: string;
  action: "hide" | "show";
  category?: Category;
  note: string;
}

const CASES: Case[] = [
  // English insults, bullying, and profanity.
  { text: "You are an idiot.", action: "hide", category: "harassment", note: "direct insult" },
  { text: "You're a loser.", action: "hide", category: "harassment", note: "direct insult" },
  { text: "You’re a loser.", action: "hide", category: "harassment", note: "typographic apostrophe" },
  { text: "You're such a moron.", action: "hide", category: "harassment", note: "direct insult" },
  { text: "You are worthless.", action: "hide", category: "harassment", note: "personal put-down" },
  { text: "Shut up, nobody cares about you.", action: "hide", category: "harassment", note: "targeted bullying" },
  { text: "Everyone hates you and you have no friends.", action: "hide", category: "harassment", note: "targeted bullying" },
  { text: "Fuck you.", action: "hide", category: "harassment", note: "targeted profanity" },
  { text: "You are a piece of shit.", action: "hide", category: "harassment", note: "targeted profanity" },

  // English threats, including self-harm encouragement.
  { text: "I will kill you.", action: "hide", category: "threats", note: "explicit threat" },
  { text: "I'll kill you.", action: "hide", category: "threats", note: "contracted threat" },
  { text: "I'm gonna kill you.", action: "hide", category: "threats", note: "colloquial threat" },
  { text: "I'm going to hurt you.", action: "hide", category: "threats", note: "explicit threat" },
  { text: "I will beat you up.", action: "hide", category: "threats", note: "explicit threat" },
  { text: "Kill yourself.", action: "hide", category: "threats", note: "self-harm encouragement" },
  { text: "Go die.", action: "hide", category: "threats", note: "self-harm encouragement" },

  // Arabic targeted insults, profanity, and bullying.
  { text: "انت غبي", action: "hide", category: "harassment", note: "direct insult" },
  { text: "يا كلب", action: "hide", category: "harassment", note: "targeted animal insult" },
  { text: "انت حيوان", action: "hide", category: "harassment", note: "targeted animal insult" },
  { text: "انت قذر", action: "hide", category: "harassment", note: "targeted insult" },
  { text: "اخرس", action: "hide", category: "harassment", note: "shut up" },
  { text: "اسكت يا غبي", action: "hide", category: "harassment", note: "shut up plus insult" },
  { text: "تبا لك", action: "hide", category: "harassment", note: "targeted profanity" },

  // Arabic threats.
  { text: "سوف اقتلك", action: "hide", category: "threats", note: "explicit threat" },
  { text: "سأقتلك", action: "hide", category: "threats", note: "hamza spelling" },
  { text: "هذبحك", action: "hide", category: "threats", note: "explicit threat variant" },
  { text: "راح اقتلك", action: "hide", category: "threats", note: "dialect threat variant" },
  { text: "هضربك", action: "hide", category: "threats", note: "explicit threat variant" },

  // Protected English negatives.
  { text: "I respectfully disagree with your opinion.", action: "show", note: "respectful disagreement" },
  { text: "You are wrong, but I understand your point.", action: "show", note: "criticism without abuse" },
  { text: "This is a stupid question, but I can explain it.", action: "show", note: "criticism of an idea" },
  { text: "The movie was terrible and the acting was awful.", action: "show", note: "negative review" },
  { text: "I feel sad about the news.", action: "show", note: "negative emotion" },
  { text: "I will beat you at chess tomorrow.", action: "show", note: "competitive banter, not a threat" },
  { text: "I am an idiot sometimes.", action: "show", note: "self-description" },
  { text: "I was called an idiot yesterday.", action: "show", note: "reported experience" },
  { text: "He said, \"You are an idiot.\"", action: "show", note: "quoted insult" },
  { text: "He said, \"I will kill you.\"", action: "show", note: "quoted threat" },
  { text: "\"You are an idiot.\"", action: "show", note: "bare quotation with no target context" },
  { text: "You are an \"idiot\".", action: "hide", category: "harassment", note: "quotes used for emphasis" },
  { text: "The word \"idiot\" is an insult.", action: "show", note: "discussion about abusive language" },
  { text: "The comment \"You are an idiot\" was removed.", action: "show", note: "moderation report" },
  { text: "The post says \"You are an idiot.\"", action: "show", note: "reported post" },
  { text: "The article said \"You are an idiot.\"", action: "show", note: "reported article" },
  { text: "He said you are an idiot.", action: "show", note: "reported without quotation marks" },
  { text: "This article discusses bullying and harassment.", action: "show", note: "meta-discussion" },
  { text: "If someone says \"you are worthless\", report them.", action: "show", note: "quoted advice" },
  { text: "This post is about you: you are an idiot.", action: "hide", category: "harassment", note: "direct despite the word post" },
  { text: "This comment is about you: you are a loser.", action: "hide", category: "harassment", note: "direct despite the word comment" },
  { text: "You are an idiot, he said.", action: "hide", category: "harassment", note: "direct attack with a trailing attribution" },

  // Protected Arabic negatives.
  { text: "أنا مختلف معاك في الرأي", action: "show", note: "respectful disagreement" },
  { text: "رأيك مش دقيق ومحتاج دليل", action: "show", note: "criticism without abuse" },
  { text: "هذا سؤال غبي لكنه يستحق النقاش", action: "show", note: "criticism of an idea" },
  { text: "هذا الخبر حزين", action: "show", note: "negative emotion" },
  { text: "أنا غبي أحيانا", action: "show", note: "self-description" },
  { text: "قال لي: \"أنت غبي\"", action: "show", note: "quoted insult" },
  { text: "\"أنت غبي\"", action: "show", note: "bare Arabic quotation" },
  { text: "كلمة غبي تعتبر إهانة", action: "show", note: "discussion about abusive language" },
  { text: "الشتيمة مش حل، خلينا نتناقش باحترام", action: "show", note: "counterspeech" },
  { text: "أسلوبك غير لائق لكن الفكرة واضحة", action: "show", note: "criticism of behavior" }
];

describe("Phase 1 Arabic/English labeled corpus", () => {
  it.each(CASES)("$action: $text ($note)", ({ text, action, category }) => {
    const result = classifyLocally(text);
    if (action === "hide") {
      expect(shouldHide(result, DEFAULT_SETTINGS)).toBe(true);
      expect(result.labels.map((label) => label.category)).toContain(category);
    } else {
      expect(result.labels).toEqual([]);
      expect(shouldHide(result, DEFAULT_SETTINGS)).toBe(false);
    }
  });
});
