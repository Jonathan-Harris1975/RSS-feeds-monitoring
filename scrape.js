cp > scrape.js <<'EOF'
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
  // Remove obvious non-article elements
  container.find('aside, footer, form, .newsletter, .popup, nav, header, script, style').remove();

  // Extract and filter paragraphs
  const blacklist = [
    'newsletter',
    'subscribe',
    'sign up',
    'follow us',
    'read more',
    'more from',
    'share this',
    'advertisement',
    'sponsored'
  ];

  const paragraphs = container.find('p')
    .map((i, el) => $(el).text().trim())
    .get()
    .filter((t) => {
      if (t.length < 40) return false; // skip tiny fragments
      const lower = t.toLowerCase();
      return !blacklist.some(bad => lower.includes(bad));
    });

  return paragraphs.join('\n\n');
};

const scrapeArticle = async (title, link) => {
  console.log(`Scraping: ${title} (${link})`);
  try {
    const { data } = await axios.get(link, { timeout: 20000 });
    const $ = cheerio.load(data);

    // Try to detect main content area
    let container = $('article');
    if (!container.length) container = $('main');
    if (!container.length) container = $('body');

    const text = cleanArticle($, container);
    if (!text) return null;

    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filePath = path.join(outputDir, `${safeTitle}.txt`);
    await fs.writeFile(filePath, text, 'utf-8');
    return { title, link, file: filePath };
  } catch (err) {
    console.error(`Error scraping ${link}:`, err.message);
    return null;
  }
};

const run = async () => {
  const urls = await loadUrls();
  if (!urls.length) {
    console.log('No URLs to scrape.');
    return;
  }

  const results = [];
  for (const { title, link } of urls) {
    const res = await scrapeArticle(title, link);
    if (res) results.push(res);
  }

  console.log(`Scraping complete. ${results.length} articles saved.`);
};

run();
EOF
