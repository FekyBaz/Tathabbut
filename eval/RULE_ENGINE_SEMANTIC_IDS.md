# Semantic rule IDs — technical migration record

> **التاريخ:** 2026-11-18
> **نوع التغيير:** تقني بحت — **لا تغيير سلوكي**. القواعد، الدرجات، العتبة،
> التصنيفات، و`decidePolicy` كما هي. تغيّر فقط المعرف الذي تحمله `RuleMatch`
> والـ diagnostics من `category.N` (مشتق من الموضع) إلى `category.meaning`
> (ثابت ودلالي).

## لماذا

المعرفات الموضعية تتغير بهدوء عند إدراج نمط أو إعادة ترتيبه — أي تسجيل
تشخيصي أو تقرير دورات سابقة يصبح مضللًا. الخريطة الصريحة تجعل المعرف
مستقرًا حتى لو تغيّر ترتيب الأنماط، وتجعل أي إضافة جديدة تمر عبر اختبار
سلامة يمنع النسيان أو التكرار.

## التنفيذ

- `RULE_IDS: Readonly<Record<Category, readonly string[]>>` محاذٍ بالفهرس لمصفوفة
  `patterns` داخل `extension/src/policy.ts`.
- `ruleId = RULE_IDS[category][index]` مع fallback رقمي دفاعي فقط.
- معرفات السياق (`harassment.ambiguous-mockery`, `hate.placeholder-group`,
  `spam.generic-promotion`, `spam.prize-phrase-only`) وحالتا الاستثناء
  `hasExplicitArabicAddressee` و`hasPrizeAndPrivateSolicitation` تستخدم الأسماء
  الجديدة — نفس المنطق، نفس النتيجة.
- `patternCount(category)` + اختبار سلامة: لكل فئة، عدد المعرفات = عدد الأنماط،
  وكل معرف فريد ويحمل بادئة الفئة. أي نمط جديد بلا معرف يفشل الاختبار.

## خريطة legacy → semantic

### Harassment

| Legacy | Semantic |
|---|---|
| harassment.1 | `harassment.direct-en-insult` |
| harassment.2 | `harassment.en-fraud-joke` |
| harassment.3 | `harassment.en-joke-of-person` |
| harassment.4 | `harassment.ar-fraud-joke-faker` |
| harassment.5 | `harassment.en-silencing-phrase` |
| harassment.6 | `harassment.en-fuck-screw-you` |
| harassment.7 | `harassment.ar-second-person-basic-insult` |
| harassment.8 | `harassment.ar-vocative-basic-insult` |
| harassment.9 | `harassment.ar-second-person-insult-list` |
| harassment.10 | `harassment.ar-vocative-insult-list` |
| harassment.11 | `harassment.ar-standalone-insult` |
| harassment.12 | `harassment.ar-shut-up` |
| harassment.13 | `harassment.ar-insult-dismissal` |
| harassment.14 | `harassment.ambiguous-mockery` *(contextual)* |
| harassment.15 | `harassment.ar-belittling-phrase` |
| harassment.16 | `harassment.arabizi-legacy-ghaby` |
| harassment.17 | `harassment.arabizi-legacy-faker` |
| harassment.18 | `harassment.mixed-second-person-ahbal` |
| harassment.19 | `harassment.arabizi-vocative-7mar` |
| harassment.20 | `harassment.arabizi-vocative-ahbal` |
| harassment.21 | `harassment.ar-vocative-3alaq` |
| harassment.22 | `harassment.ar-second-person-3alaq` |
| harassment.23 | `harassment.en-third-person-insult` |
| harassment.24 | `harassment.ar-third-person-insult` |
| harassment.25 | `harassment.en-idot-alias` |
| harassment.26 | `harassment.arabizi-second-person-insult` |
| harassment.27 | `harassment.arabizi-third-person-insult` |
| harassment.28 | `harassment.en-plural-past-insult` |

### Hate / Threats / Spam

| Legacy | Semantic |
|---|---|
| hate.1 | `hate.placeholder-group` *(contextual)* |
| threats.1 | `threats.en-future-harm` |
| threats.2 | `threats.en-body-part-injury` |
| threats.3 | `threats.en-self-harm-encouragement` |
| threats.4 | `threats.ar-future-harm-second` |
| threats.5 | `threats.ar-future-harm-third` |
| threats.6 | `threats.arabizi-future-harm` |
| threats.7 | `threats.en-additional-injury` |
| threats.8 | `threats.ar-choke-injury` |
| spam.1 | `spam.generic-promotion` *(contextual)* |
| spam.2 | `spam.repeated-links` |
| spam.3 | `spam.prize-phrase-only` *(contextual)* |
| spam.4 | `spam.mixed-prize-private-claim` |
| spam.5 | `spam.arabizi-prize-claim` |
| spam.6 | `spam.expanded-private-contact-triad` |

> تقارير V7–V14 تستخدم المعرفات الرقمية لأنها **لحظة تاريخية** قبل الترحيل؛
> هذا الجدول يترجمها. لا تُعدَّل التقارير القديمة.

## التحقق من عدم تغيير السلوك

- 524 اختبار extension (منها اختبار سلامة المعرفات الجديد) — كلها ناجحة.
- انقسامات V7–V14 مجمدة: **صفر action-error**، نفس الإحصاءات السابقة.
- `tsc --noEmit`، `npm run build` + `verify-dist`، backend pytest (33)، ومختبر
  الـ fixtures **103/103** — كلها خضراء.

بوابة السقف والقرارات الأخرى في
[`RULE_ENGINE_CEILING_ASSESSMENT.md`](RULE_ENGINE_CEILING_ASSESSMENT.md) لم تتغير.
