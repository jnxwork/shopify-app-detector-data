const fs = require("fs");
const puppeteer = require("puppeteer");

const categories = [
  "https://apps.shopify.com/categories/selling-products-custom-products-product-variants/all",
  "https://apps.shopify.com/categories/selling-products-custom-products-custom-products-other/all"
];

const stopwords = ["product", "products", "options", "option", "custom", "product-options"];

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const apps = new Map();

  for (const url of categories) {
    for (let pageNum = 1; pageNum <= 10; pageNum++) {
      await page.goto(`${url}?page=${pageNum}`, { waitUntil: "networkidle2" });
      await page.waitForTimeout(1500);

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
        const domain = (new URL(app.icon)).hostname.split(".")[0];
        baseKeywords.push(domain);
        const keywords = [...new Set(baseKeywords.map(k => k.toLowerCase().trim()).filter(k => k.length > 2 && !stopwords.includes(k)))];
        apps.set(app.url, { ...app, keywords });
      }
    }
  }

  await browser.close();
  fs.writeFileSync("apps.json", JSON.stringify([...apps.values()], null, 2));
})();
