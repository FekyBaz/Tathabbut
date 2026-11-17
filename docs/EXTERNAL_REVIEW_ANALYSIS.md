# تحليل المراجعة الخارجية للمشروع — Extracted Insights from External Review

> **التاريخ:** 2026-11-17
> **المصدر:** مراجعة خارجية نقدية وردت على فكرة مشروع تثبّت (نسخ نصية حرفية من المراجعة أعلاه).
> **الغاية من هذا الملف:** استخراج كل ما يفيد المشروع من المراجعة، توثيقه، وتصنيف كل ادعاء إلى **موثّق (Verified)** أو **منقول من المراجعة وغير موثق (Reported / Unverified)** حتى لا تُبنى قرارات على ادعاءات غير مثبتة.
> **هذا الملف توثيق فقط:** لا يغيّر أي سلوك في الإضافة، ولا يعدّل القواعد أو التصنيف.

---

## Executive Summary (English)

1. **The core "hide content → starve the algorithm" hypothesis is not novel.** A peer-reviewed user-side intervention study (Downranking vs Replacement on YouTube) exists, and the FeedMonitor field-experiment guide explicitly names the user→algorithm feedback loop as a known confounder. Both were located and verified in this session.
2. **The reviewer's "display:none kills the impression" critique does not fully apply to Tathabbut as implemented:** our hide is a **blur/collapse** (`max-height: 3.25rem`, `opacity: 0.28`, `blur(3px)` in `extension/src/content.css`), not `display:none`. The item remains in layout, so impressions/dwell time are likely still recorded. That weakens the "algorithm learns nothing" objection — but also means Tathabbut currently sends no explicit negative engagement signal either.
3. **Facebook is the hardest target** (unstable frontend, no extension runtime on mobile, treatment dilution). This is corroborated by the FeedMonitor README, which documents the same constraints for X.
4. **The review's numeric verdict (19/25) and its reasoning are opinion, not measurement** — recorded here for context, not as ground truth.
5. **The one surviving, defensible angle is measurement of false-positive harm:** *who does the filter silence when it errs?* (victims reporting abuse, counterspeech, satire, quoted/reporting speech) — measured per discourse type, for Egyptian Arabic. Related English-language work exists (counterspeech is measurably "more toxic than ordinary discourse" to classifiers), but a dedicated Arabic/Egyptian FP-harm-by-discourse-type evaluation appears open.
6. **Recommended posture:** keep the working system as the engineering asset; **drop "change the algorithm" from the proposal narrative**; reframe as **"a working moderation system + a rigorous false-positive-harm measurement study on Arabic."** Scope must be set once team size is known (the reviewer asked this and it remains unanswered).
7. **Immediate next steps:** run the one-week "kill test" (literature check + 200-sample FP-rate experiment using the existing eval harness) before committing to the pivot.

---

## 1. ما الذي يقوله البحث الخارجي (نظرة عامة)

المراجعة الخارجية بنت على أربع قنوات:

| # | القناة | الخلاصة باختصار | حالة التوثيق |
|---|---|---|---|
| 1 | **تغطية الأهداف الثلاثة** (بلور NSFW، التأطير الديني، فلترة عربي سام) | كل هدف تقريبًا "مشتغل" بمشاريع/ورود منشورة | مزيج: بعضها موثق هنا، بعضها منقول |
| 2 | **فكرة "تدريب الألجوريزم"** | مختبرة بدراسة كبيرة ومكتوبة كـ confounder معروف في دليل منشور | **موثقة جزئيًا أدناه** ✅ |
| 3 | **تقييم رقمي للمشروع** (19/25) | رأي مراجع؛ مفيد كاتجاه لا كحقيقة | رأي (غير قابل للتحقق) |
| 4 | **الزاوية المقترحة للنجاة** | قياس ضرر الـ false positives على المتحدثين بالعربي | **موثقة جزئيًا أدناه** ✅ |

---

## 2. جدول "الأهداف مشبع" كما وردت — وحالة التحقق

> ⚠️ الجدول يوثق **ما قالته المراجعة**. عمود التحقق يوضح ما تحقق فعليًا في هذه الجلسة.

| الهدف الأصلي | ما قالته المراجعة | حالة التحقق | الأثر على المشروع |
|---|---|---|---|
| بلور NSFW on-device | مشاريع مفتوحة (nsfw-filter بـ TF.js، ونسخ 2026) | منقول — غير موثق هنا | مشبع: لا يُبنى عليه كأصل |
| التأطير الديني للحماية | HaramBlur: تحليل فيديو frame-by-frame | منقول — غير موثق هنا | مشبع ومتقدم أكثر من المشروع |
| فلترة عربي سام + threshold | **AraTox** (LRE/Springer، multi-dialect multi-label، hand-annotated) + dataset على Mendeley | **موثق ✅** (تم التحقق من وجود الورقة والداتاسِت) | يجب الاستفادة منها كـ evaluation data لا كمنافس |
| ثقة/confidence-aware عربي | ورقة Hybrid Confidence-Aware Arabic Toxicity | منقول — غير موثق هنا | يتوافق مع توجهنا للـ contextual layer |
| تحكم المستخدم في الفيد | Gobo (MIT Media Lab)، Alexandria (ICWSM 2026) | منقول — غير موثق هنا | مشبع كفكرة عامة |

**الاستنتاج:** لا يجوز عرض أيٍّ من هذه كمساهمة. قيمتنا المتبقية في: (أ) نظام شغال حقيقي، (ب) قياس أدق للضرر، (ج) انضباط موثق.

---

## 3. أكبر تهديد للـ novelty: دراسة التدخلات على الفيد

**الورقة:** "User-Side Interventions Reduce Harmful Content Exposure in Algorithmic Feeds" — منشورة في ICWSM (AAAI OJS, article 42704).

**ما تحقق منه:**
- ✅ وجود الورقة وعنوانها ونتيجتها العامة: تقييم **Downranking** و **Replacement** على YouTube (Homepage + Up-Next) مع ضبط لميل المستخدم الأساسي.

**ما ورد في المراجعة ولم يُتحقق رقميًا (Reported):**
- إطار sock-puppet يحاكي 30 جولة توصية/تفاعل (feedback loop).
- 18 حالة × 1,000 حساب = 18,000 حساب.
- أن Downranking قلب ميل الزيادة الطبيعية (+0.6 نقطة) إلى نقصان (−0.9 نقطة)، وأنه أقوى وأكثر اتساقًا من Replacement.

**الدليل المرافق (موثق ✅):** دليل FeedMonitor (Piccardi et al., ACM Trans. Soc. Comput. 2026, `StanfordHCI/FeedMonitor`) يكتب في Known limitations حرفيًا:

> "Down-ranking reduces engagement signals sent back to the platform, which may cause it to further suppress that content in future sessions — **a potential confounder**."

أي أن فكرة "التدخل يؤثر على الألجوريزم" موثقة كـ **confounder معروف** في الدليل الميداني، وليست اكتشافًا خاصًا بمشروعنا.

**القرار المقترح:** إزالة "تغيير/تدريب الألجوريزم" من صياغة الهدف في الـ proposal، والاكتفاء بوصف التدخل كأداة حماية للمستخدم.

---

## 4. ملاحظة تقنية مهمة: إخفاء vs إنزال — وتصحيح لادعاء المراجعة

المراجعة افترضت أن الإخفاء = `display:none` وبالتالي:
- قد لا يُسجل impression أصلًا → الألجوريزم لا يتعلم شيئًا.
- Downranking أقوى لأنه يترك impression + skip = إشارة سلبية فعلية.

**التصحيح بناءً على كودنا الحالي:** إخفاء تثبّت **ليس** `display:none`. في `extension/src/content.css`:

```css
.tathabbut-hidden > :not(.tathabbut-reveal):not(.tathabbut-notice)... {
  max-height: 3.25rem !important;
  overflow: hidden !important;
  opacity: 0.28 !important;
  filter: blur(3px);
}
```

أي أن العنصر يبقى في الـ layout بارتفاع ~3.25rem معتم/ضبابي:
- **الـ impression و dwell time على الأغلب يظلان مسجلين** (عنصر موجود في الـ viewport) → اعتراض "الألجوريزم لن يتعلم" لا ينطبق كما هو.
- لكن **لا نرسل أي إشارة سلبية صريحة** (لا skip click، لا downrank).

**الدلالة التصميمية (لا تُنفذ الآن):**
- الوضع الحالي = "عرض مصغّر ضبابي" وهو حل وسط بين الإخفاء الكامل وDownranking.
- لو أردنا مستقبلًا محاذاة أنماط Downranking، فالخيارات (إعادة ترتيب DOM، تقليص أدق مع الإبقاء على الظهور) **هشة على Facebook** وينبغي دراستها كخيار مستقبلي منفصل، وليست تعديلًا فوريًا.

---

## 5. Facebook كهدف صعب — وما يوثقه FeedMonitor

المراجعة قالت إن Facebook أسوأ هدف ممكن. نقاطها تدعمها قراءة `StanfordHCI/FeedMonitor` README (موثقة ✅):

| القيد | المصدر/الحالة |
|---|---|
| الـ extension يعمل **desktop فقط** (الموبايل: certificate pinning ولا يوجد runtime للإضافات) | موثق في README ✅ |
| واجهات/APIs للمنصة تتغير دون إشعار؛ الدراسات الطويلة تحتاج مراقبة | موثق في README ✅ |
| قيد الـ inventory: لا نرى إلا ما اختارته المنصة أصلًا | موثق في README ✅ |
| أن أغلب مستخدمي مصر على الموبايل → "treatment dilution" | منطق المراجعة (منقول)؛ الاتجاه منطقي |

**الأثر على المشروع:** يجب أن يصرّح الـ proposal بحدود desktop/الويب صراحة، وأن يعامل أي نشر طويل كدراسة تحتاج مراقبة استمرارية، لا كمنتج.

---

## 6. التقييم الرقمي الوارد في المراجعة (19/25)

| المعيار | الدرجة | تفسير المراجعة |
|---|---|---|
| Feasibility | 4 | كود شغال يوفر ~3 أشهر |
| Data | 4 | داتاسِتات جاهزة (AraTox/MPOLD…) |
| Novelty | 2 | الأهداف مشبعة + الفكرة الكبرى مختبرة |
| Impact | 4 | |
| Demo | 5 | فلتر لايف على فيد حقيقي مبهر |

**التعامل الصحيح:** هذا **رأي تقديري** وليس قياسًا، لكن تشخيصه منطقي: نقطة ضعفنا الحقيقية Novelty، ونقطة قوتنا الحقيقية التنفيذ والـ demo. أرقام Novelty لن تتحسن بالشرح، بل بتغيير **السؤال البحثي** (القسم التالي).

---

## 7. الزاوية الحية: "من الذي يظلمه الفلتر عندما يخطئ؟"

**السؤال البحثي المقترح:**
> قياس **تكلفة الـ false positive** لفلترة المحتوى السام بالعربي (وخاصة المصري)، **مقسّمة على نوع الخطاب** — هل الفلتر يظلم: الضحية التي تشتكي؟ من يرد بخطاب مضاد (counterspeech)؟ الساخر؟ من ينقل/يقتبس إساءة؟ — أكثر مما يظلم المعتدي نفسه؟

**لماذا قوية:**
1. **Ground truth موجود:** HateXplain (annotations للـ target والـ rationale — معروف وموثق تاريخيًا)، AraTox (موثقة ✅)، MPOLD (منقولة).
2. **قابلة للقياس على كودنا الحالي:** لدينا بالفعل corpus من 60 حالة (hide/show مع مبررات) وبنية eval جاهزة (`eval/`)، وthreshold وcategories قابلة للضبط.
3. **المقياس جديد عمليًا:** FP-rate **مقسّم على نوع الخطاب** (attack / counterspeech / reporting / satire / quotation) بدل F1 إجمالي.
4. **الفشل نفسه نتيجة قابلة للنشر.**

**الدليل الأولي من الأدبيات (موثق جزئيًا ✅ في هذه الجلسة):**
- ورقة ICWSM 2026 (Hickey et al.): تعليقات الـ counterspeech **أقل سمية من الـ hate speech لكنها تقريبًا ضعف سمية الخطاب العادي** داخل نفس المجتمعات — أي أن المصنفات مهددة بطبيعتها للإمس على counterspeech كـ false positives.
- Position paper (arXiv 2503.16072): "Toxicity Detection Should Measure Contextual Harm, Not Text-Intrinsic…" — يدعم توجّهنا نحو الطبقة السياقية بعد قواعد السقف.

**⚠️ تنبيه انضباط (من المراجعة نفسها):** يجب بحث شامل أولًا عن أعمال سابقة تقيس FP-harm في العربية تحديدًا؛ إن وُجدت، تُغلق الزاوية ويُعاد التوجيه.

---

## 8. اختبار القتل — Kill Test في أسبوع

**اليوم 1–2 — بحث أدبيات (قبل الالتزام):**
شغّل وسجّل النتائج والتواريخ:
- `"counterspeech false positive toxicity filter Arabic"`
- `"over-moderation harm counterspeech measurement"`
- `"toxicity classifier false positive victims reporting abuse"`
- `"Arabic moderation false positive counterspeech"`

**معيار الإغلاق:** إن وُجدت ورقة تقيس FP-hair بالعربي مقسّمًا على نوع الخطاب → **تُغلق الزاوية** ونعيد التوجيه إلى "نظام + قياس عام".

**اليوم 3–5 — تجربة كمية على كودنا:**
1. خذ **200 نص** من AraTox/MPOLD (موثقة/منقولة على الترتيب) — مع الالتزام بتراخيص الاستخدام البحثي.
2. صُنّفها يدويًا حسب نوع الخطاب: `attack` / `counterspeech` / `reporting` / `satire` / `other`.
3. شغّل **قواعد V7 الحالية** عليها عبر `eval/` (الموجود بالفعل في الريبو).
4. احسب: **FP-rate لكل نوع خطاب**، خصوصًا مقارنة `counterspeech` بـ `attack`.

**✅ النجاح:** FP-rate على counterspeech أعلى بوضوح وبشكل قابل للتفسير → قصة بحث حقيقية.
**❌ الفشل:** الفرق مهمل → نعتمد مشروع "نظام + قياس عام" (والأصل: كود شغال + demo).

---

## 9. قرارات مقترحة للمشروع (خطة توجيه)

| القرار | التفصيل | ملاحظات |
|---|---|---|
| ✅ **احتفظ بالكود كما هو** | هو الأصل الحقيقي للمشروع (نظام يعمل + demo) | لا تعديل سلوك الآن |
| ✅ **أعد صياغة الهدف في الـ proposal** | حذف "تغيير/تدريب الألجوريزم"؛ الاستبدال بـ "نظام حماية + دراسة قياس ضرر الإمس الخاطئ" | مبني على توثيق القسم 3 |
| ✅ **تبنَّ زاوية FP-harm العربي** | بشرط اجتياز Kill Test | القسم 7–8 |
| ✅ **موقع المشروع** | "system + measurement study" وليس "innovation" | صياغة أمينة أمام لجنة |
| ⏸️ **عوّق أي تغيير hide→downrank** | خيار مستقبلي هش على FB؛ لا يُنفذ الآن | القسم 4 |
| ❓ **حدّد حجم الفريق** | المراجعة سألت 7 مرات ولم يُجب | يغير الـ scope جذريًا: فردي ≠ فريق 6 |
| ⚠️ **أخلاقيات أي تجربة على مستخدمين حقيقيين** | IRB/informed consent/debriefing على الأقل | إن شملنا مستخدمين حقيقيين |

---

## 10. سجل المراجع (Verification Ledger)

| # | المرجع كما ورد في المراجعة | الحالة في هذه الجلسة |
|---|---|---|
| [[52]] | `StanfordHCI/FeedMonitor` + Piccardi et al., "Reranking Social Media Feeds: A Practical Guide for Field Experiments" (ACM TSC 2026) + دراسة Science 2025 (1,256 مشاركًا على X) | **موثق ✅** — تم فحص الريبو؛ الببليوغرافيا موجودة في README؛ النص حول feedback-loop confounder مطابق تقريبًا |
| [[49]] | "User-Side Interventions Reduce Harmful Content Exposure in Algorithmic Feeds" (ICWSM/AAAI 42704) | **موثق ✅** (الوجود والعنوان والمداخلتين) — أرقام 18,000/30 جولة/-0.9 **منقولة غير موثقة رقميًا** |
| [[38]][[39]] | **AraTox** — Alshargi et al., Language Resources & Evaluation (Springer) + dataset على Mendeley | **موثق ✅** — وجود الورقة والداتاسِت مؤكد |
| [[46]] | MPOLD — multi-platform Arabic dataset | منقول — غير موثق هنا |
| [[43]] | Hybrid Confidence-Aware Arabic Toxicity | منقول — غير موثق هنا |
| [[27]] | Gobo (MIT Media Lab) | منقول — معروف تاريخيًا لكن لم يُفحص هنا |
| [[52b]] | Alexandria (ICWSM 2026) — مكتبة قيم تعيد ترتيب الفيد | منقول — غير موثق هنا |
| [[21]] | CHI 2025 — "intentional implicit feedback" | منقول — غير موثق هنا |
| [[42]] | HateXplain — annotations للـ target والـ rationale | معروف تاريخيًا (ACL 2021)؛ لم يُفحص رابطه هنا |
| [[1]][[7]] | nsfw-filter (TF.js) / NSFW Filter 2026 | منقول — غير موثق هنا |
| [[5]] | HaramBlur — تحليل فيديو + blur | منقول — غير موثق هنا |

> **قاعدة التوثيق:** أي رقم أو استنتاج يُستخدم في الـ proposal يجب أن يُنسب لمصدر **فُحص فعليًا**، وإلا يُكتب "بحسب مراجعة خارجية — قيد التحقق".

---

## 11. أسئلة مفتوحة قبل أي التزام

1. **حجم الفريق؟** (يغيّر الـ scope جذريًا).
2. هل توجد ورقة عربية تقيس FP-hair حسب نوع الخطاب؟ (Kill Test يوم 1–2).
3. تراخيص استخدام AraTox/MPOLD لأغراض بحثية/تخرج؟
4. هل نحتاج موافقة أخلاقيات (IRB) لو شملت الدراسة حسابات/مستخدمين حقيقيين؟
5. هل نعرض الـ "hide-downrank" كخيار مستقبلي فقط أم نتركه خارج الـ proposal تمامًا؟ (التوصية: خارجها).

---

## 12. ما يُوثَّق لاحقًا

- نتيجة Kill Test (بحث + تجربة الـ 200 نص) في ملف `eval/` مستقل عند اكتمالها.
- قرار التوجيه النهائي (proposal v2) بعد الإجابة على الأسئلة المفتوحة.
