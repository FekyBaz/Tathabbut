"""DOM compatibility inspector: visit a page (default: the local lab
fixture) and print a SANITIZED structural summary that answers whether
Tathabbut's discovery strategy fits the observed DOM.

Privacy: no text content, no attribute values except ARIA role names, no
URLs beyond the page hostname, no full HTML. Nothing is uploaded anywhere.

Run:  python extension/smoke/inspect.py [--url <https-url>]
"""

import sys
from urllib.parse import urlparse

TARGETS = ("article", "feed", "comment", "complementary", "main", "region")


def summarize(page):
    summary = {}
    summary["hostname"] = urlparse(page.url).hostname or ""
    summary["totalElements"] = page.locator("*").count()
    roles = {}
    for role in TARGETS:
        roles[role] = page.locator('[role="%s"]' % role).count()
    summary["roleCounts"] = roles
    articles = page.locator('[role="article"]')
    summary["articleCount"] = articles.count()
    depths, children, textlens = [], [], []
    for i in range(min(articles.count(), 50)):
        handle = articles.nth(i).element_handle()
        info = page.evaluate(
            """(el) => {
              let depth = 0, node = el;
              while (node.parentElement) { depth += 1; node = node.parentElement; }
              const kids = el.querySelectorAll('*').length;
              return {depth: depth, descendants: kids, chars: (el.textContent || '').length};
            }""",
            handle,
        )
        depths.append(info["depth"])
        children.append(info["descendants"])
        textlens.append(info["chars"])

    def stats(values):
        if not values:
            return {"n": 0}
        ordered = sorted(values)
        return {"n": len(values), "min": ordered[0], "median": ordered[len(ordered) // 2],
                "max": ordered[-1]}

    summary["articleDepth"] = stats(depths)
    summary["articleDescendants"] = stats(children)
    summary["articleTextLength"] = stats(textlens)
    nested = page.locator('[role="article"] [role="comment"], [role="article"] .comment').count()
    summary["nestedCommentNodes"] = nested
    return summary


def main():
    url = sys.argv[sys.argv.index("--url") + 1] if "--url" in sys.argv else None
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = browser.new_page()
            if url:
                page.goto(url, wait_until="domcontentloaded", timeout=45000)
            else:
                from pathlib import Path

                fixture = Path(__file__).resolve().parent / "scenarios.html"
                page.goto(fixture.as_uri(), wait_until="domcontentloaded")
            page.wait_for_timeout(2000)
            first = summarize(page)
            page.wait_for_timeout(3000)
            second = summarize(page)
            print("=== structure ===")
            for key, value in first.items():
                print("%s: %s" % (key, value))
            print("=== after 3s (late rendering?) ===")
            print("articleCount: %s -> %s" % (first["articleCount"], second["articleCount"]))
            print("=== implementation check (current: '[role=\"article\"]') ===")
            if first["articleCount"] == 0:
                print("MISS: selector matches nothing on this page")
            else:
                print("HIT: selector matches %d node(s)" % first["articleCount"])
            if first["roleCounts"].get("feed", 0) > 0:
                print("NOTE: [role=feed] containers exist; articles may live inside them")
            if first["nestedCommentNodes"] > 0:
                print("NOTE: comment-like descendants found inside articles")
        finally:
            browser.close()


if __name__ == "__main__":
    main()
