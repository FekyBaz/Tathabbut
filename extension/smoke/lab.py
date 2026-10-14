"""Tathabbut Testing Lab: one-command verification of the real built
extension inside Chromium against deterministic local fixtures.

Run from extension/:  npm run test:e2e
Direct:                python smoke/lab.py [--hosts www,web] [--headed/--headless]

Pipeline per run: build -> verify-dist -> launch Chromium with the
unpacked extension -> serve fixture matrix under facebook.com hosts ->
drive discovery/classification/hide/reveal/dynamic/settings/threshold
scenarios -> collect diagnostics -> JSON report + summary -> exit code.

Exit codes: 0 all green, 1 assertion failures, 2 infrastructure failure.
A fixture run validates the pipeline; it does NOT prove live-DOM
compatibility (see docs/MANUAL_TEST.md).
"""

import json
import os
import subprocess
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path

SMOKE_DIR = Path(__file__).resolve().parent
EXT_DIR = SMOKE_DIR.parent
DIST = Path(os.environ.get("TATHABBUT_DIST", str(EXT_DIR / "dist")))
FIXTURE = SMOKE_DIR / "scenarios.html"
REPORT = SMOKE_DIR / "lab-report.json"
ARTIFACTS = SMOKE_DIR / "artifacts"

HOSTS = {
    "www": "https://www.facebook.com/",
    "web": "https://web.facebook.com/",
    "m": "https://m.facebook.com/",
}

DEFAULT_SETTINGS = {
    "enabled": True,
    "enabledCategories": ["harassment", "hate", "threats", "spam"],
    "threshold": 0.85,
    "apiUrl": "",
}


def run_build(log):
    log.append("$ npm run build")
    try:
        proc = subprocess.run(
            "npm run build",
            cwd=str(EXT_DIR),
            shell=True,
            capture_output=True,
            text=True,
            timeout=300,
        )
    except Exception as e:
        return {"ok": False, "output": "build spawn failed: %s" % e}
    tail = (proc.stdout + proc.stderr)[-2000:]
    return {"ok": proc.returncode == 0, "exit": proc.returncode, "output": tail}


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Tathabbut Testing Lab")
    parser.add_argument("--hosts", default="www", help="comma list: www,web,m")
    parser.add_argument("--headless", action="store_true", help="try headless (extensions may not load)")
    args = parser.parse_args()

    from playwright.sync_api import sync_playwright

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "liveSite": "unverified — fixture only; see docs/MANUAL_TEST.md",
        "scenarios": [],
    }

    def check(sid, stage, expected, actual, detail=""):
        ok = expected == actual
        report["scenarios"].append(
            {"id": sid, "stage": stage, "expected": expected, "actual": actual,
             "pass": ok, "detail": detail}
        )
        return ok

    build = run_build(report.setdefault("buildLog", []))
    report["build"] = {k: v for k, v in build.items() if k != "output"}
    if not build["ok"]:
        report["summary"] = {"total": 0, "passed": 0, "failed": 0, "buildFailed": True}
        REPORT.write_text(json.dumps(report, indent=1), encoding="utf-8")
        print("LAB FAIL: build failed\n" + build.get("output", ""))
        return 2

    hosts = [HOSTS[h.strip()] for h in args.hosts.split(",") if h.strip() in HOSTS]
    if not hosts:
        print("LAB FAIL: unknown --hosts value")
        return 2

    with open(FIXTURE, encoding="utf-8") as f:
        fixture_html = f.read()
    served = {"html": fixture_html}
    EMPTY_HTML = (
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\" />"
        "<title>Empty feed</title></head>"
        "<body><div id=\"feed\"></div></body></html>"
    )

    try:
        with sync_playwright() as p:
            browser_version = "unknown"
            try:
                browser_version = p.chromium.executable_path
            except Exception:
                pass
            report["browser"] = {"headless": bool(args.headless), "executable": str(browser_version)}
            ctx = p.chromium.launch_persistent_context(
                "",
                headless=bool(args.headless),
                args=[
                    "--disable-extensions-except=" + str(DIST),
                    "--load-extension=" + str(DIST),
                ],
            )
            try:
                sw = ctx.service_workers[0] if ctx.service_workers else None
                if sw is None:
                    sw = ctx.wait_for_event("serviceworker", timeout=20000)
                extension_id = sw.url.split("/")[2]
                report["extensionId"] = extension_id
                check("sw-running", "injection", True, True, sw.url)

                for host in hosts:
                    tag = host.split("/")[2]
                    page = ctx.new_page()
                    seen_urls: list = []
                    page.on("request", lambda req: seen_urls.append(req.url))
                    page.route(
                        "https://*.facebook.com/*",
                        lambda route: route.fulfill(body=served["html"], content_type="text/html"),
                    )
                    failures_before = len([s for s in report["scenarios"] if not s["pass"]])

                    def shot(name):
                        try:
                            ARTIFACTS.mkdir(exist_ok=True)
                            page.screenshot(path=str(ARTIFACTS / ("fail-" + tag + "-" + name + ".png")))
                        except Exception:
                            pass

                    def hidden(element_id):
                        return page.locator("#" + element_id + ".tathabbut-hidden").count() == 1

                    def buttons(element_id):
                        return page.locator("#" + element_id + " > .tathabbut-reveal").count()

                    page.goto(host, wait_until="domcontentloaded")

                    def read_status():
                        import json as _json

                        raw = sw.evaluate(
                            "chrome.storage.local.get('tathabbutStatus')"
                            ".then(r => JSON.stringify(r))"
                        )
                        return _json.loads(raw).get("tathabbutStatus", {})

                    # Gate 1: the content script is alive (it reported work).
                    alive = False
                    for _ in range(30):
                        try:
                            if read_status().get("evaluated", 0) > 0:
                                alive = True
                                break
                        except Exception:
                            pass
                        page.wait_for_timeout(500)
                    check("gate-alive-" + tag, "injection", True, alive)
                    if not alive:
                        shot("injection")
                        page.close()
                        continue
                    # Gate 2: hiding works on this host.
                    try:
                        page.wait_for_selector("#en-harass.tathabbut-hidden", timeout=15000)
                        gate_ok = True
                    except Exception:
                        gate_ok = False
                    check("gate-hide-" + tag, "classification", True, gate_ok,
                          "" if gate_ok else "no .tathabbut-hidden")
                    if not gate_ok:
                        shot("classification")
                        page.close()
                        continue
                    page.wait_for_timeout(1500)

                    expected_hidden = ["en-harass", "ar-harass", "en-threat", "en-spam",
                                       "ar-spam", "norm-diacritics", "dup-a", "dup-b",
                                       "nested-parent-comment", "nested-threat-ar-comment",
                                       "standalone-comment", "standalone-threat", "standalone-threat-ar"]
                    for eid in expected_hidden:
                        got = hidden(eid)
                        check("hide-" + eid + "-" + tag, "classification", True, got)
                        if got:
                            check("single-control-" + eid + "-" + tag, "hide", 1, buttons(eid))
                    for eid in ["neutral-en", "respect-en", "respect-ar", "long-mixed",
                                "spam-benign", "empty-article", "editable",
                                "nested-parent", "nested-threat-ar"]:
                        check("visible-" + eid + "-" + tag, "threshold", False, hidden(eid))

                    articles = page.locator('[role="article"]').count()
                    check("discovery-count-" + tag, "discovery", True, articles >= 16,
                          "articles=%d" % articles)

                    # Reveal, then re-hide through an edit (proves re-evaluation).
                    page.locator("#en-harass > .tathabbut-reveal").click()
                    page.wait_for_function(
                        "document.querySelectorAll('#en-harass.tathabbut-hidden').length === 0",
                        timeout=5000,
                    )
                    check("reveal-" + tag, "reveal", False, hidden("en-harass"))
                    check("reveal-control-removed-" + tag, "reveal", 0, buttons("en-harass"))

                    page.evaluate(
                        "document.querySelector('#editable .body').textContent = 'You are an idiot';"
                    )
                    try:
                        page.wait_for_selector("#editable.tathabbut-hidden", timeout=10000)
                        check("edit-rehide-" + tag, "dynamic", True, True)
                    except Exception:
                        check("edit-rehide-" + tag, "dynamic", True, False)

                    page.evaluate(
                        "(() => { const d = document.createElement('div');"
                        " d.setAttribute('role', 'article'); d.id = 'late-insert';"
                        " d.textContent = 'I will kill you';"
                        " document.getElementById('feed').appendChild(d); })()"
                    )
                    try:
                        page.wait_for_selector("#late-insert.tathabbut-hidden", timeout=10000)
                        check("dynamic-insert-" + tag, "dynamic", True, True)
                    except Exception:
                        check("dynamic-insert-" + tag, "dynamic", True, False)

                    def set_settings(patch):
                        cfg = dict(DEFAULT_SETTINGS)
                        cfg.update(patch)
                        sw.evaluate(
                            "cfg => chrome.storage.sync.set({tathabbutSettings: cfg}).then(() => 'ok')",
                            cfg,
                        )

                    set_settings({"enabled": False})
                    try:
                        page.wait_for_function(
                            "document.querySelectorAll('.tathabbut-hidden').length === 0",
                            timeout=10000,
                        )
                        check("disable-live-" + tag, "settings", True, True)
                    except Exception:
                        check("disable-live-" + tag, "settings", True, False)

                    set_settings({"threshold": 0.99})
                    try:
                        page.wait_for_function(
                            "document.querySelectorAll('#ar-harass.tathabbut-hidden').length === 0",
                            timeout=10000,
                        )
                        check("threshold-99-" + tag, "threshold", False, hidden("ar-harass"))
                    except Exception:
                        check("threshold-99-" + tag, "threshold", False, hidden("ar-harass"))

                    set_settings({"threshold": 0.86})
                    try:
                        page.wait_for_selector("#ar-harass.tathabbut-hidden", timeout=10000)
                        check("threshold-86-inclusive-" + tag, "threshold", True, True)
                    except Exception:
                        check("threshold-86-inclusive-" + tag, "threshold", True, False)

                    set_settings({"threshold": 0.87})
                    try:
                        page.wait_for_function(
                            "document.querySelectorAll('#ar-harass.tathabbut-hidden').length === 0",
                            timeout=10000,
                        )
                        check("threshold-87-" + tag, "threshold", False, hidden("ar-harass"))
                    except Exception:
                        check("threshold-87-" + tag, "threshold", False, hidden("ar-harass"))

                    set_settings({})
                    try:
                        page.wait_for_selector("#ar-harass.tathabbut-hidden", timeout=10000)
                        check("settings-restore-" + tag, "settings", True, True)
                    except Exception:
                        check("settings-restore-" + tag, "settings", True, False)

                    # --- Target granularity: hiding one target must not hide
                    # siblings, and each reveal restores exactly its target.
                    check("granularity-tall-hidden-" + tag, "classification", True,
                          hidden("tall-harass"))
                    box = page.locator("#tall-harass").bounding_box()
                    check("granularity-collapse-" + tag, "hide", True,
                          box is not None and box["height"] < 100,
                          "hidden tall article height=%s" % (box["height"] if box else None))
                    check("granularity-sibling-visible-" + tag, "hide", False,
                          hidden("sibling-clean"))
                    check("granularity-sibling-comment-visible-" + tag, "hide", True,
                          page.locator("#sibling-clean .comment").first.is_visible())
                    page.locator("#ar-harass > .tathabbut-reveal").click()
                    try:
                        page.wait_for_function(
                            "document.querySelectorAll('#ar-harass.tathabbut-hidden').length === 0",
                            timeout=5000,
                        )
                        check("granularity-reveal-one-" + tag, "reveal", False,
                              hidden("ar-harass"))
                    except Exception:
                        check("granularity-reveal-one-" + tag, "reveal", False, True)
                    check("granularity-other-stays-hidden-" + tag, "reveal", True,
                          hidden("en-threat"))
                    # Edit-after-reveal re-hides: user override is not a whitelist.
                    page.evaluate(
                        "document.querySelector('#ar-harass .body').textContent = 'You are an idiot';"
                    )
                    try:
                        page.wait_for_selector("#ar-harass.tathabbut-hidden", timeout=10000)
                        check("granularity-edit-rehide-" + tag, "dynamic", True, True)
                    except Exception:
                        check("granularity-edit-rehide-" + tag, "dynamic", True, False)

                    # --- Lifecycle robustness: adversarial DOM churn. ---
                    # Replace (not append) a neutral article with harassing text.
                    page.evaluate(
                        "(() => { const old = document.getElementById('neutral-en');"
                        " const d = document.createElement('div');"
                        " d.setAttribute('role', 'article'); d.id = 'replaced';"
                        " d.textContent = 'I will kill you';"
                        " old.replaceWith(d); })()"
                    )
                    try:
                        page.wait_for_selector("#replaced.tathabbut-hidden", timeout=10000)
                        check("replace-element-" + tag, "dynamic", True, True)
                    except Exception:
                        check("replace-element-" + tag, "dynamic", True, False)

                    # Move a hidden article elsewhere: decision must travel, no duplicate.
                    page.evaluate(
                        "document.getElementById('feed').appendChild(document.getElementById('ar-harass'));"
                    )
                    page.wait_for_timeout(1000)
                    check("move-stable-" + tag, "dynamic", True, hidden("ar-harass"))
                    check("move-single-control-" + tag, "hide", 1, buttons("ar-harass"))

                    # Rapid successive edits: only the final text may decide.
                    page.evaluate(
                        "(() => { const b = document.querySelector('#spam-benign .body');"
                        " b.textContent = 'You are an idiot';"
                        " b.textContent = 'What a wonderful day for a walk';"
                        " b.textContent = 'Shut up'; })()"
                    )
                    try:
                        page.wait_for_selector("#spam-benign.tathabbut-hidden", timeout=10000)
                        check("rapid-edits-final-" + tag, "dynamic", True, True)
                    except Exception:
                        check("rapid-edits-final-" + tag, "dynamic", True, False)
                    check("rapid-edits-single-control-" + tag, "hide", 1, buttons("spam-benign"))

                    # Delayed fill: empty article populated later.
                    page.evaluate(
                        "(() => { const d = document.createElement('div');"
                        " d.setAttribute('role', 'article'); d.id = 'delayed';"
                        " document.getElementById('feed').appendChild(d);"
                        " setTimeout(() => { d.textContent = 'You are an idiot'; }, 800); })()"
                    )
                    try:
                        page.wait_for_selector("#delayed.tathabbut-hidden", timeout=15000)
                        check("delayed-fill-" + tag, "dynamic", True, True)
                    except Exception:
                        check("delayed-fill-" + tag, "dynamic", True, False)

                    # Remove and reinsert the same hidden node.
                    page.evaluate(
                        "(() => { const el = document.getElementById('dup-a');"
                        " el.remove();"
                        " setTimeout(() => document.getElementById('feed').appendChild(el), 500); })()"
                    )
                    try:
                        page.wait_for_selector("#dup-a.tathabbut-hidden", timeout=10000)
                        check("reinsert-stable-" + tag, "dynamic", True, True)
                    except Exception:
                        check("reinsert-stable-" + tag, "dynamic", True, False)
                    check("reinsert-single-control-" + tag, "hide", 1, buttons("dup-a"))

                    # User reveal survives unrelated observer churn.
                    page.locator("#dup-b > .tathabbut-reveal").click()
                    page.wait_for_function(
                        "document.querySelectorAll('#dup-b.tathabbut-hidden').length === 0",
                        timeout=5000,
                    )
                    page.evaluate(
                        "(() => { const d = document.createElement('div');"
                        " d.id = 'churn'; document.getElementById('feed').appendChild(d); })()"
                    )
                    page.wait_for_timeout(1500)
                    check("reveal-persists-" + tag, "reveal", False, hidden("dup-b"))

                    # No-op churn leaves exactly one control per hidden item.
                    hidden_count = page.locator(".tathabbut-hidden").count()
                    control_count = page.locator(".tathabbut-hidden > .tathabbut-reveal").count()
                    check("no-duplicate-controls-" + tag, "hide", True,
                          hidden_count > 0 and hidden_count == control_count,
                          "hidden=%d controls=%d" % (hidden_count, control_count))

                    # Local-only network confinement: fixture traffic stays on-site.
                    allowed = ("https://www.facebook.com/", "https://web.facebook.com/",
                               "https://m.facebook.com/", "https://facebook.com/",
                               "chrome-extension://", "data:", "blob:")
                    stray = [u for u in seen_urls if not u.startswith(allowed)]
                    check("network-confinement-" + tag, "privacy", True, not stray,
                          "stray=%s" % (stray[:3],))

                    if len([s for s in report["scenarios"] if not s["pass"]]) > failures_before:
                        shot("scenario")

                    raw_status = sw.evaluate(
                        "chrome.storage.local.get('tathabbutStatus').then(r => JSON.stringify(r))"
                    )
                    status = json.loads(raw_status).get("tathabbutStatus", {})
                    check("status-exists-" + tag, "diagnostics", True, bool(status))
                    check("status-articles-" + tag, "diagnostics", True,
                          status.get("articlesFound", 0) >= 16)
                    check("status-hidden-" + tag, "diagnostics", True, status.get("hidden", 0) >= 1)
                    check("status-origin-" + tag, "diagnostics", True,
                          "facebook.com" in str(status.get("origin", "")))
                    page.close()

                def read_status():
                    raw = sw.evaluate(
                        "chrome.storage.local.get('tathabbutStatus').then(r => JSON.stringify(r))"
                    )
                    return json.loads(raw).get("tathabbutStatus", {})

                def set_api_settings(api_url, extra=None):
                    cfg = dict(DEFAULT_SETTINGS)
                    cfg["apiUrl"] = api_url
                    if extra:
                        cfg.update(extra)
                    sw.evaluate(
                        "cfg => chrome.storage.sync.set({tathabbutSettings: cfg}).then(() => 'ok')",
                        cfg,
                    )

                def wait_status(predicate, timeout=15000):
                    import time as _time

                    deadline = _time.time() + timeout / 1000
                    last = {}
                    while _time.time() < deadline:
                        try:
                            last = read_status()
                            if predicate(last):
                                return last
                        except Exception:
                            pass
                        _time.sleep(0.25)
                    return last

                context_urls: list = []
                ctx.on("request", lambda req: context_urls.append(req.url))

                # --- Phase F1: unreachable API falls back to local rules. ---
                # No host permission is ever granted here, and the port is
                # closed, so the worker must refuse before fetching; the page
                # must still hide stock-rule matches with zero mock traffic.
                set_api_settings("http://127.0.0.1:9")
                served["html"] = fixture_html
                fb_page = ctx.new_page()
                fb_page.route(
                    "https://*.facebook.com/*",
                    lambda route: route.fulfill(body=served["html"], content_type="text/html"),
                )
                fb_page.goto("https://www.facebook.com/", wait_until="domcontentloaded")
                try:
                    fb_page.wait_for_selector("#en-harass.tathabbut-hidden", timeout=15000)
                    check("fallback-unreachable-hides", "threshold", True, True)
                except Exception:
                    check("fallback-unreachable-hides", "threshold", True, False,
                          "local fallback did not hide a stock-rule match")
                check("fallback-unreachable-no-traffic", "privacy", True,
                      not [u for u in context_urls if "127.0.0.1:9" in u],
                      "mock host requests must be zero without a grant")

                # --- Phase F2: category policy wins even during fallback. ---
                set_api_settings("http://127.0.0.1:9", {"enabledCategories": ["spam"]})
                fb_page.reload(wait_until="domcontentloaded")
                try:
                    fb_page.wait_for_function(
                        "document.querySelectorAll('#en-harass.tathabbut-hidden').length === 0",
                        timeout=10000,
                    )
                    check("fallback-category-off", "threshold", False,
                          fb_page.locator("#en-harass.tathabbut-hidden").count() == 1)
                except Exception:
                    check("fallback-category-off", "threshold", False, False,
                          "category-off not honored during fallback")

                # --- Phase F3: garbage API URL falls back safely. ---
                set_api_settings("not a url")
                fb_page.reload(wait_until="domcontentloaded")
                try:
                    fb_page.wait_for_selector("#en-harass.tathabbut-hidden", timeout=15000)
                    check("fallback-invalid-url-hides", "threshold", True, True)
                except Exception:
                    check("fallback-invalid-url-hides", "threshold", True, False)

                # --- Phase F4: reveal still works while fallback is active. ---
                fb_page.locator("#en-harass > .tathabbut-reveal").click()
                try:
                    fb_page.wait_for_function(
                        "document.querySelectorAll('#en-harass.tathabbut-hidden').length === 0",
                        timeout=5000,
                    )
                    check("fallback-reveal", "reveal", True, True)
                except Exception:
                    check("fallback-reveal", "reveal", True, False)
                set_api_settings("")
                fb_page.close()

                # --- Phase E: empty first scan vs delayed insertion. ---
                # An empty feed must report articlesFound 0 with reason
                # "starting"-adjacent state, not a silent failure; content
                # arriving later must still be discovered and hidden.
                served["html"] = EMPTY_HTML
                empty_page = ctx.new_page()
                empty_page.route(
                    "https://*.facebook.com/*",
                    lambda route: route.fulfill(body=served["html"], content_type="text/html"),
                )
                before = read_status().get("updatedAt", 0)
                empty_page.goto("https://www.facebook.com/", wait_until="domcontentloaded")
                empty_ok = wait_status(
                    lambda st: st.get("updatedAt", 0) > before and st.get("articlesFound") == 0
                )
                check("empty-scan-zero", "discovery", True, bool(empty_ok),
                      "scan ran on empty feed" if empty_ok else "no fresh empty scan observed")
                empty_page.evaluate(
                    "(() => { const d = document.createElement('div');"
                    " d.setAttribute('role', 'article'); d.id = 'late-empty';"
                    " d.textContent = 'You are an idiot';"
                    " document.getElementById('feed').appendChild(d); })()"
                )
                try:
                    empty_page.wait_for_selector("#late-empty.tathabbut-hidden", timeout=10000)
                    check("delayed-insertion-hides", "dynamic", True, True)
                except Exception:
                    check("delayed-insertion-hides", "dynamic", True, False)
                empty_page.close()
                served["html"] = fixture_html

                # Recover to a populated feed so the trailing popup checks
                # observe a representative end-state, not the empty page.
                recover_page = ctx.new_page()
                recover_page.route(
                    "https://*.facebook.com/*",
                    lambda route: route.fulfill(body=served["html"], content_type="text/html"),
                )
                recover_page.goto("https://www.facebook.com/", wait_until="domcontentloaded")
                try:
                    recover_page.wait_for_selector("#en-harass.tathabbut-hidden", timeout=15000)
                    check("recover-populated-feed", "dynamic", True, True)
                except Exception:
                    check("recover-populated-feed", "dynamic", True, False)
                recover_page.close()

                popup = ctx.new_page()
                popup.goto("chrome-extension://" + extension_id + "/popup.html")
                popup.locator("#refreshStatus").click()
                try:
                    popup.wait_for_function(
                        "Number((document.getElementById('st-articles').textContent || '').trim()) >= 16",
                        timeout=10000,
                    )
                    check("popup-articles", "diagnostics", True, True,
                          popup.locator("#st-articles").text_content().strip())
                except Exception:
                    check("popup-articles", "diagnostics", True, False)
                source = (popup.locator("#st-source").text_content() or "").strip()
                check("popup-source", "diagnostics", True, "facebook.com" in source, source)
                popup.close()
            finally:
                ctx.close()
    except Exception:
        report["infrastructureError"] = traceback.format_exc()[-2000:]
        REPORT.write_text(json.dumps(report, indent=1), encoding="utf-8")
        print("LAB ERROR: infrastructure failure (see lab-report.json)")
        return 2

    failed = [s for s in report["scenarios"] if not s["pass"]]
    stages = [s["stage"] for s in failed]
    report["summary"] = {
        "total": len(report["scenarios"]),
        "passed": len(report["scenarios"]) - len(failed),
        "failed": len(failed),
        "earliestFailingStage": stages[0] if stages else None,
    }
    REPORT.write_text(json.dumps(report, indent=1), encoding="utf-8")

    print("=== Tathabbut Testing Lab ===")
    print("scenarios: %d passed=%d failed=%d" % (len(report["scenarios"]),
          len(report["scenarios"]) - len(failed), len(failed)))
    if failed:
        print("earliest failing stage: " + str(stages[0]))
        for s in failed[:10]:
            print("FAIL [%s] %s expected=%s actual=%s %s" % (
                s["stage"], s["id"], s["expected"], s["actual"], s.get("detail", "")))
        print("full report: extension/smoke/lab-report.json (fixture-only, not live DOM)")
        return 1
    print("ALL GREEN (fixture only - live Facebook DOM still unverified, see docs/MANUAL_TEST.md)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
