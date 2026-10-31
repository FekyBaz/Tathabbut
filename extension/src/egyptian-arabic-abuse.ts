/**
 * Reviewed, high-confidence Egyptian Arabic personal-abuse patterns.
 *
 * Keep entries phrase/token based and scoped to direct personal targeting.
 * Add only forms with a rationale and paired neutral/quoted/negated tests.
 * This is an expandable sample, not an exhaustive Arabic profanity dictionary.
 */
export const EGYPTIAN_ARABIC_PERSONAL_ABUSE = {
  // Vocatives are direct address; do not match the insult token by itself.
  vocativeInsults: [
    /(?:^|[\s،,.!?؟])يا\s+علق(?=$|[\s،,.!?؟])/u
  ],
  // Explicit second-person grammar supplies the personal target.
  secondPersonInsults: [
    /(?:^|[\s،,.!?؟])(?:انت|انتي|انتوا|انتم)\s+علق(?=$|[\s،,.!?؟])/u
  ]
} as const;

export const EGYPTIAN_ARABIC_PERSONAL_ABUSE_PATTERNS = [
  ...EGYPTIAN_ARABIC_PERSONAL_ABUSE.vocativeInsults,
  ...EGYPTIAN_ARABIC_PERSONAL_ABUSE.secondPersonInsults
];
