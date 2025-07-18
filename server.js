// server.js (ESM-compliant, Render-compatible)

import express from 'express'; import fs from 'fs/promises'; import path from 'path'; import { fileURLToPath } from 'url'; import xml2js from 'xml2js'; import fetch from 'node-fetch'; import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url); const __dirname = path.dirname(__filename);

const app = express(); const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: '10mb' }));

const fetchArticleText = async (url) => { try { const response = await fetch(url); const html = await response.text(); const $ = cheerio.load(html); const paragraphs = $('p') .map((_, el) => $(el).text()) .get() .join(' ') .trim(); return paragraphs; } catch (err) { return Failed to fetch article text: ${err.message}; } };

app.post('/process-feeds', async (req, res) => { try { const feedsFilePath = path.join(__dirname, 'feeds.txt'); const feedsData = await fs.readFile(feedsFilePath, 'utf8'); const feeds = feedsData.split('\n').filter(Boolean);

if (!Array.isArray(feeds) || feeds.length === 0) {
  return res.status(400).json({ error: 'Invalid feeds array' });
}

const parser = new xml2js.Parser();
const result = [];

for (const feedUrl of feeds) {
  try {
    const response = await fetch(feedUrl);
    const xml = await response.text();
    const parsed = await parser.parseStringPromise(xml);
    const items = parsed.rss.channel[0].item.slice(0, 5);

    for (const item of items) {
      const url = item.link[0];
      const articleText = await fetchArticleText(url);

      result.push({
        feed: feedUrl,
        title: item.title[0],
        url,
        date: item.pubDate ? item.pubDate[0] : null,
        description: item.description ? item.description[0] : null,
        article: articleText
      });
    }
  } catch (err) {
    console.error(`Error processing feed ${feedUrl}:`, err);
  }
}

res.json(result);

} catch (err) { res.status(500).json({ error: 'Server error: ' + err.message }); } });

app.listen(PORT, () => { console.log(📰 Feed processor running on port ${PORT}); });

