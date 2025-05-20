// scrape-apps.js
const fs = require("fs");
const axios = require("axios");
const cheerio = require("cheerio");

const categories = [
  "https://apps.shopify.com/categories/selling-products-custom-products-product-variants/all",
  "https://apps.shopify.com/categories/selling-products-custom-products-custom-products-other/all"
];

async function scrapeApps() {
  const apps = new Map();
  for (const url of categories) {
    for (let page = 1; page <= 10; page++) {
      const res = await axios.get(`${url}?page=${page}`);
      const $ = cheerio.load(res.data);
      const cards = $("[data-app-card]");
      if (cards.length === 0) break;

      cards.each((_, el) => {
        const link = $(el).find("a[href*='/apps/']").attr("href");
        const name = $(el).find("h3").text().trim();
        const icon = $(el).find("img").attr("src") || $(el).find("img").attr("data-src");
        if (!link || !name) return;

        const slug = link.split("/").pop();
        const url = "https://apps.shopify.com" + link;
        const baseKeywords = [slug, ...slug.split("-")];
        if (icon) {
          const domain = icon.split("/")[2];
          baseKeywords.push(domain.split(".")[0]);
        }
        const keywords = [...new Set(baseKeywords.filter(k => k.length > 2 && isNaN(k)))];

        apps.set(url, { slug, name, url, icon, keywords });
      });
    }
  }
  fs.writeFileSync("apps.json", JSON.stringify([...apps.values()], null, 2));
}

scrapeApps();
