# scrape_apps_worker.py
import json
import requests
from bs4 import BeautifulSoup

CATEGORIES = [
    "https://apps.shopify.com/categories/selling-products-custom-products-product-variants/all",
    "https://apps.shopify.com/categories/selling-products-custom-products-custom-products-other/all"
]

STOPWORDS = {"product", "products", "options", "option", "custom", "product-options"}
WORKER_PROXY = "https://option-detector.jnx-works.workers.dev/"

def extract_keywords(slug, icon_url):
    parts = slug.split("-")
    domain = icon_url.split("/")[2].split(".")[0] if icon_url.startswith("https") else ""
    base = set([slug, *parts, domain])
    return [k for k in base if k.lower() not in STOPWORDS and len(k) > 2]

def fetch_and_parse(url):
    print(f"📥 Fetching: {url}")
    try:
        resp = requests.get(WORKER_PROXY, params={"url": url}, timeout=30)
        soup = BeautifulSoup(resp.text, "html.parser")
        return soup.select("[data-app-card]")
    except Exception as e:
        print(f"❌ Failed to load {url}:", e)
        return []

def main():
    apps = {}
    for cat_url in CATEGORIES:
        for page in range(1, 11):
            url = f"{cat_url}?page={page}"
            cards = fetch_and_parse(url)
            if not cards:
                break
            for card in cards:
                a = card.select_one("a[href*='/apps/']")
                img = card.select_one("img")
                name = card.select_one("h3")
                if not (a and name): continue
                slug = a["href"].split("/")[-1]
                link = "https://apps.shopify.com" + a["href"]
                icon = img["src"] if img else ""
                keywords = extract_keywords(slug, icon)
                apps[link] = {
                    "slug": slug,
                    "name": name.text.strip(),
                    "url": link,
                    "icon": icon,
                    "keywords": keywords
                }

    print(f"✅ Collected {len(apps)} apps")
    with open("apps.json", "w") as f:
        json.dump(list(apps.values()), f, indent=2)

if __name__ == "__main__":
    main()
