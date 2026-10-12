"""Real-browser smoke test: load the unpacked MV3 extension into Chromium,
serve a local feed fixture under facebook.com hosts, and verify the full
pipeline (inject -> discover -> classify -> hide -> reveal -> diagnostics).

Run:  python extension/smoke/smoke_test.py   (from the repo root)
Requires: playwright + chromium (python -m playwright install chromium).

A local fixture validates the extension pipeline; it does NOT prove
compatibility with Facebook's live DOM.
"""

import json
import sys
import traceback

from playwright.sync_api import sync_playwright

DIST = r"C:\Users\laphouse\AppData\Local\Temp\opencode\Tathabbut\extension\dist"
FIXTURE = r"C:\Users\laphouse\AppData\Local\Temp\opencode\Tathabbut\extension\smoke\fixture.html"
LOG = r"C:\Users\laphouse\AppData\Local\Temp\opencode\smoke_log.txt"
RESULTS = []


def log(msg):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(msg + "\n")


def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond), detail))
    log(("PASS " if cond else "FAIL ") + name + (" | " + detail if detail else ""))


def main():
    open(LOG, "w", encoding="utf-8").write("")
    with open(FIXTURE, encoding="utf-8") as f:
        fixture_html = f.read()
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            "",
            headless=False,
            args=[
                "--disable-extensions-except=" + DIST,
                "--load-extension=" + DIST,
            ],
        )
        try:
            sw = ctx.service_workers[0] if ctx.service_workers else None
            if sw is None:
                sw = ctx.wait_for_event("serviceworker", timeout=15000)
            extension_id = sw.url.split("/")[2]
            check("service worker running", True, sw.url)

            for host in ("https://www.facebook.com/", "https://web.facebook.com/"):
                page = ctx.new_page()
                page.route(
                    "https://*.facebook.com/*",
                    lambda route: route.fulfill(body=fixture_html, content_type="text/html"),
                )
                page.goto(host, wait_until="domcontentloaded")

                harmful = page.locator("#harmful-en")
                try:
                    page.wait_for_selector("#harmful-en.tathabbut-hidden", timeout=10000)
                    check("harmful post hidden on " + host, True)
                except Exception:
                    check("harmful post hidden on " + host, False, "no .tathabbut-hidden")

                check(
                    "exactly one reveal control on hidden post",
                    harmful.locator(":scope > .tathabbut-reveal").count() == 1,
                )
                check(
                    "neutral post stays visible on " + host,
                    page.locator("#neutral.tathabbut-hidden").count() == 0,
                )
                check(
                    "nested-comment article hidden on " + host,
                    page.locator("#nested.tathabbut-hidden").count() == 1,
                )
                check(
                    "standalone comment untouched on " + host,
                    page.locator("#standalone.tathabbut-hidden").count() == 0,
                )

                harmful.locator(":scope > .tathabbut-reveal").click()
                page.wait_for_timeout(500)
                check(
                    "reveal restores content on " + host,
                    page.locator("#harmful-en.tathabbut-hidden").count() == 0,
                )

                page.evaluate(
                    "(() => { const d = document.createElement('div'); d.setAttribute('role', 'article');"
                    " d.id = 'late'; d.textContent = 'You are an idiot';"
                    " document.getElementById('feed').appendChild(d); })()"
                )
                try:
                    page.wait_for_selector("#late.tathabbut-hidden", timeout=10000)
                    check("dynamically inserted post hidden on " + host, True)
                except Exception:
                    check("dynamically inserted post hidden on " + host, False)
                page.close()

            raw = sw.evaluate(
                "chrome.storage.local.get('tathabbutStatus').then(r => JSON.stringify(r))"
            )
            status = json.loads(raw).get("tathabbutStatus", {})
            check("status snapshot exists", bool(status), json.dumps(status)[:200])
            check("status reports discovered articles", status.get("articlesFound", 0) >= 3)
            check("status reports hidden items", status.get("hidden", 0) >= 1)
            check("status origin is a facebook host", "facebook.com" in str(status.get("origin", "")))

            popup = ctx.new_page()
            popup.goto("chrome-extension://" + extension_id + "/popup.html")
            popup.locator("#refreshStatus").click()
            popup.wait_for_timeout(500)
            articles = (popup.locator("#st-articles").text_content() or "").strip()
            source = (popup.locator("#st-source").text_content() or "").strip()
            check("popup shows discovered articles", articles.isdigit() and int(articles) >= 3, articles)
            check("popup shows reporting site", "facebook.com" in source, source)
            popup.close()
        finally:
            ctx.close()

    failed = [r for r in RESULTS if not r[1]]
    log("TOTAL %d passed=%d failed=%d" % (len(RESULTS), len(RESULTS) - len(failed), len(failed)))
    return 1 if failed else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        with open(LOG, "a", encoding="utf-8") as f:
            f.write("SMOKE-ERROR:\n" + traceback.format_exc())
        sys.exit(2)
