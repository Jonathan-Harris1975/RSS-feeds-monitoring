import express from 'express';
import fs from 'fs-extra';
import fetch from 'node-fetch';
import { parseStringPromise } from 'xml2js';
import * as cheerio from 'cheerio';

const app = express();
app.use(express.json({ limit: '10mb' }));

// 🧠 In-memory tracking for processed links
const seen = new Set();

app.post('/process-feeds', async (req, res) => {
  const { feeds } = req.body;

  if (!feeds || !Array.isArray(feeds)) {
    return res.status(400).json({ error: 'Invalid feeds array' });
  }

  const results = [];

  for (const url of feeds) {
    try {
      const response = await fetch(url);
      const xml = await response.text();
      const json = await parseStringPromise(xml);
      const items = json.rss?.channel?.[0]?.item || [];

      for (const item of items) {
        const title = item.title?.[0];
        const link = item.link?.[0];
        const description = item.description?.[0];

        if (!link || seen.has(link)) continue;
        seen.add(link);

        // Scrape main content with Cheerio (fallback to description)
        let fullContent = '';
        try {
          const articleRes = await fetch(link);
          const html = await articleRes.text();
          const $ = cheerio.load(html);
          fullContent = $('article').text().trim().slice(0, 800);
        } catch {
          fullContent = description || 'No content.';
        }

        results.push({ title, link, content: fullContent });
      }
    } catch (err) {
      console.error(`Feed error for ${url}:`, err.message);
    }
  }

  res.json({ items: results });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Feed monitor running on port ${PORT}`);
});
