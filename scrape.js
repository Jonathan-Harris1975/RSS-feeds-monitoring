// scrape.js - Scrapes full articles from URLs in RSS feeds

import axios from 'axios'; import * as cheerio from 'cheerio'; import fs from 'fs-extra'; import path from 'path';

const urlsFile = './snapshots/new-articles.json'; // This should contain [{ title, link }] style objects const outputDir = './content/articles';

await fs.ensureDir(outputDir);

const loadUrls = async () => { if (!(await fs.pathExists(urlsFile))) return []; return await fs.readJSON(urlsFile); };

const scrapeArticle = async (url) => { try { const { data: html } = await axios.get(url, { timeout: 10000 }); const $ = cheerio.load(html);

// Attempt to target main readable content blocks
const article = $('article').length
  ? $('article')
  : $('main').length
  ? $('main')
  : $('body');

const paragraphs = article.find('p')
  .map((i, el) => $(el).text())
  .get()
  .filter((t) => t.length > 40); // Filter out nav/footer fluff

return paragraphs.join('\n\n');

} catch (err) { console.error(Failed to scrape ${url}:, err.message); return null; } };

const run = async () => { const articles = await loadUrls();

for (const { title, link } of articles) { const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60); const filePath = path.join(outputDir, ${cleanTitle}.json); if (await fs.pathExists(filePath)) continue;

console.log(`Scraping: ${link}`);
const content = await scrapeArticle(link);

if (content) {
  await fs.writeJSON(filePath, { title, link, content });
  console.log(`Saved → ${filePath}`);
}

} };

run();

