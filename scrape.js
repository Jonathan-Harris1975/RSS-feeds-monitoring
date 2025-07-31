
// scrape.js - Scrapes full articles from URLs in RSS feeds

import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs-extra';
import path from 'path';

const urlsFile = './snapshots/new-articles.json'; // This should contain [{ title, link }] style objects
const outputDir = './content/articles';

await fs.ensureDir(outputDir);

// Wake nudge to avoid cold start timeouts
await axios.get('https://www.google.com').catch(() => {});

const loadUrls = async () => {
  if (!(await fs.pathExists(urlsFile))) return [];
  return await fs.readJSON(urlsFile);
};

const cleanArticle = ($, container) => {
  // Remove unwanted elements that clutter the article
  container.find('aside, footer, form, .newsletter, .popup, nav, header, script, style').remove();

  // Grab all decent-sized paragraphs
  const paragraphs = container.find('p')
    .map((i, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 40);

  return paragraphs.join('\n\n');
};

const scrapeArticle = async (url) => {
  try {
    const { data: html } = await axios.get(url, { timeout: 10000 });
    const $ = cheerio.load(html);

    const container = $('article').length
      ? $('article')
      : $('main').length
      ? $('main')
      : $('body');

    return cleanArticle($, container);

  } catch (err) {
    console.error(`Failed to scrape ${url}:`, err.message);
    return '';
  }
};

const urls = await loadUrls();

for (const { title, link } of urls) {
  const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const content = await scrapeArticle(link);

  if (content) {
    const outputPath = path.join(outputDir, `${safeTitle}.txt`);
    await fs.writeFile(outputPath, content);
    console.log(`Saved: ${title}`);
  }
}
