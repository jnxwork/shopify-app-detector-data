const fs = require("fs");
const puppeteer = require("puppeteer");

const categories = [
  "https://apps.shopify.com/categories/selling-products-custom-products-product-variants/all",
  "https://apps.shopify.com/categories/selling-products-custom-products-custom-products-other/all"
];

const stopwords = ["product", "products", "options", "option", "custom", "product-options"];

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 150);
    });
  });
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled"
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36");

  // remove navigator.webdriver
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const apps = new Map();

  for (const url of categories) {
    for (let pageNum = 1; pageNum <= 10; pageNum++) {
      const fullUrl = `${url}?page=${pageNum}`;
      console.log("Visiting", fullUrl);
      await page.goto(fullUrl, { waitUntil: "networkidle2", timeout: 60000 });
      await autoScroll(page);
      await new Promise(r => setTimeout(r, 1000));

      const result = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll("[data-app-card]"));
        return cards.map(card => {
          const linkEl = card.querySelector("a[href*='/apps/']");
          const name = card.querySelector("h3")?.innerText?.trim();
          const icon = card.querySelector("img")?.src || "";
          const href = linkEl?.getAttribute("href") || "";
          return { name, slug: href.split("/").pop(), url: "https://apps.shopify.com" + href, icon };
        });
      });

      if (!result || result.length === 0) break;

      for (const app of result) {
        if (!app.slug || !app.name) continue;
        const baseKeywords = [app.slug, ...app.slug.split("-")];
        try {
          const domain = (new URL(app.icon)).hostname.split(".")[0];
          baseKeywords.push(domain);
        } catch {}
        const keywords = [...new Set(baseKeywords.map(k => k.toLowerCase().trim()).filter(k => k.length > 2 && !stopwords.includes(k)))];
        apps.set(app.url, { ...app, keywords });
      }
    }
  }

  await browser.close();
  console.log("✅ Collected", apps.size, "apps.");
  fs.writeFileSync("apps.json", JSON.stringify([...apps.values()], null, 2));
})();
