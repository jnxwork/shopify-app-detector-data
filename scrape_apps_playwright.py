# scrape_apps_playwright.py
import json
from playwright.sync_api import sync_playwright

CATEGORIES = [
    "https://apps.shopify.com/categories/selling-products-custom-products-product-variants/all",
    "https://apps.shopify.com/categories/selling-products-custom-products-custom-products-other/all"
]

STOPWORDS = {"product", "products", "options", "option", "custom", "product-options"}

def extract_keywords(slug, icon_url):
    parts = slug.split("-")
    domain = icon_url.split("/")[2].split(".")[0] if icon_url.startswith("https://") else ""
    base = set([slug, *parts, domain])
    return [k.lower() for k in base if k.lower() not in STOPWORDS and len(k) > 2]

def main():
    apps = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        for category in CATEGORIES:
            for page_num in range(1, 11):
                url = f"{category}?page={page_num}"
                print("Visiting", url)
                try:
                    page.goto(url, timeout=60000)
                    page.wait_for_selector("[data-app-card]", timeout=10000)
                except:
                    print("❌ Timeout or load fail:", url)
                    break

                cards = page.query_selector_all("[data-app-card]")
                if not cards:
                    break

                for card in cards:
                    link = card.query_selector("a[href*='/apps/']")
                    name = card.query_selector("h3")
                    img = card.query_selector("img")
                    if not link or not name:
                        continue
                    href = link.get_attribute("href")
                    slug = href.split("/")[-1]
                    app_url = "https://apps.shopify.com" + href
                    app_name = name.inner_text().strip()
                    icon_url = img.get_attribute("src") if img else ""

                    keywords = extract_keywords(slug, icon_url)
                    apps[app_url] = {
                        "slug": slug,
                        "name": app_name,
                        "url": app_url,
                        "icon": icon_url,
                        "keywords": keywords
                    }

        browser.close()

    print(f"✅ Collected {len(apps)} apps")
    with open("apps.json", "w") as f:
        json.dump(list(apps.values()), f, indent=2)

if __name__ == "__main__":
    main()
