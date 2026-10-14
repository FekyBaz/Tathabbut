# Classifier options: rules baseline vs semantic alternatives

Status: analysis only. No model is implemented, integrated, or endorsed.
The shipped default remains the deterministic local rules described in
`extension/src/policy.ts` (heuristic scores, not calibrated probabilities).

## Baseline: local starter rules

- Latency: microseconds, fully synchronous in the content script.
- Size/memory: a few KB of patterns; no model weights, no extra process.
- Privacy: nothing leaves the browser in local-only mode.
- Reliability: deterministic; identical input always yields identical output.
- Arabic: a handful of explicit patterns plus normalization (diacritics,
  tatweel, alef variants, alef-maqsura). Not dialect understanding.
- Limits (measured): quotation/educational mentions false-positive;
  paraphrased abuse false-negatives; no intent or truth judgments.

## Option A: optional self-hosted API (already scaffolded, not required)

- Latency: network round-trip per item plus a 5s worker timeout; queue
  bounds cap the blast radius, and every failure falls back to local rules.
- Size/memory: zero client cost; the operator runs the model.
- Privacy: sends the text snippet and selected categories off-device, only
  after explicit user configuration and host-permission grant. Requires a
  documented retention policy and user consent before any production use.
- Reliability: depends on deployment (timeouts, rate limits, provider
  behavior all unproven here).
- Arabic: depends entirely on the chosen provider/model; unevaluated.
- Cost: hosting plus per-request inference cost paid by the deployer.

## Option B: local in-browser model (not implemented)

- Latency: tens to hundreds of ms per item on typical hardware; needs
  batching, worker isolation, and the existing bounded queue to stay
  responsive on long feeds.
- Size/memory: tens to hundreds of MB of weights shipped or downloaded;
  multiplies install size and RAM pressure per tab.
- Privacy: comparable to rules if weights run fully on-device with no
  telemetry — but must be audited, not assumed.
- Reliability: versioned weights, nondeterminism across runtimes, and new
  failure modes (OOM, slow devices) with no field data yet.
- Arabic: small multilingual models exist but Egyptian-dialect performance
  would need its own labeled evaluation; none exists here.
- Cost: no per-request fees; large distribution and maintenance burden.

## Decision

Keep the rules baseline as the default. Revisit only when live-feed
evidence shows a specific, reproducible gap that narrow documented rules
cannot cover, and then only with a labeled evaluation, a privacy/security
review, and explicit user consent for anything leaving the device. Never
present heuristic scores as model confidence or moral/factual judgments.
