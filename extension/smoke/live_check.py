"""Live-site (logged-out) check: navigate REAL facebook.com hosts with the
unpacked extension loaded and observe injection, init, settings, scan,
status, and popup on the genuine site. No login, no private data, no
interaction with any account. Feed-content stages cannot pass here by
design (login wall) and are reported as UNVERIFIED, not failed.
"""

import json
from pathlib import Path

from playwright.sync_api import sync_playwright

SMOKE_DIR = Path(__file__).resolve().parent
DIST = str(SMOKE_DIR.parent / "dist")
LOG = str(SMOKE_DIR / "live_log.txt")
RESULTS = []


def log(msg):
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(msg + "\n")


def record(stage, result, evidence):
    RESULTS.append((stage, result, evidence))
    log(stage + " | " + result + " | " + evidence)


def main():
    open(LOG, "w", encoding="utf-8").write("")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        log("browser: Chromium " + browser.version + " (headed, Playwright)")
        ctx = browser.new_context(
            ignore_https_errors=False,
        )
        # Load extension via CDP-independent persistent profile is unavailable
        # here, so install through persistent context instead.
        ctx.close()
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
            record("environment", "PASS", "Chromium " + browser.version + ", ext " + extension_id)

            for host in ("https://www.facebook.com/", "https://web.facebook.com/", "https://m.facebook.com/"):
                page = ctx.new_page()
                tathabbut_lines = []
                page.on("console", lambda msg: tathabbut_lines.append(msg.text) if "[Tathabbut" in msg.text else None)
                try:
                    page.goto(host, wait_until="domcontentloaded", timeout=45000)
                except Exception as e:
                    record("navigation " + host, "FAIL", type(e).__name__ + " " + str(e)[:120])
                    page.close()
                    continue
                record("navigation " + host, "PASS", "final URL " + page.url)
                page.wait_for_timeout(4000)

                articles = page.locator('[role="article"]').count()
                record("live DOM article count " + host, "INFO", "role=article nodes: %d" % articles)

                # Enable diagnostics the documented way (page console command),
                # then reload so the flag is read at startup.
                page.evaluate("() => { try { window.localStorage.setItem('tathabbutDebug', '1'); } catch (e) {} }")
                page.reload(wait_until="domcontentloaded")
                page.wait_for_timeout(4000)
                loaded = [t for t in tathabbut_lines if "loaded" in t]
                settings = [t for t in tathabbut_lines if "settings" in t]
                scans = [t for t in tathabbut_lines if t.startswith("[Tathabbut debug] scan")]
                record(
                    "injection+init " + host,
                    "PASS" if loaded else "FAIL",
                    "loaded lines: %d" % len(loaded),
                )
                record(
                    "settings+scan " + host,
                    "PASS" if (settings and scans) else "FAIL",
                    "settings=%d scan=%d" % (len(settings), len(scans)),
                )

                raw = sw.evaluate(
                    "chrome.storage.local.get('tathabbutStatus').then(r => JSON.stringify(r))"
                )
                status = json.loads(raw).get("tathabbutStatus", {})
                record(
                    "status snapshot " + host,
                    "PASS" if status.get("updatedAt") else "FAIL",
                    "origin=%s articles=%s evaluated=%s hidden=%s ok=%s"
                    % (
                        status.get("origin"),
                        status.get("articlesFound"),
                        status.get("evaluated"),
                        status.get("hidden"),
                        status.get("settingsOk"),
                    ),
                )
                page.close()

            popup = ctx.new_page()
            popup.goto("chrome-extension://" + extension_id + "/popup.html")
            popup.locator("#refreshStatus").click()
            popup.wait_for_timeout(500)
            started = (popup.locator("#st-started").text_content() or "").strip()
            record("popup diagnostics live", "PASS" if started else "FAIL", started[:100])
            popup.close()
        finally:
            ctx.close()
            browser.close()

    log("LIVE-CHECK-DONE")


if __name__ == "__main__":
    main()
