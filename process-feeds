import express from 'express'; import dotenv from 'dotenv'; import fetch from 'node-fetch'; import { parseStringPromise } from 'xml2js'; import cheerio from 'cheerio'; import fs from 'fs-extra';

dotenv.config();

const app = express(); const PORT = process.env.PORT || 3000; const FEED_LIST_PATH = './feeds.txt'; const CACHE_PATH = './cache.json';

// Load feed URLs from text file const loadFeeds = async () => { const data = await fs.readFile(FEED_LIST_PATH, 'utf-8'); return data.split('\n').map(url => url.trim()).filter(Boolean); };

// Load cached titles const loadCache = async () => { try { const cache = await fs.readJson(CACHE_PATH); return cache; } catch { return {}; } };

// Save new cache const saveCache = async (cache) => { await fs.writeJson(CACHE_PATH, cache, { spaces: 2 }); };

// Fetch article content using Cheerio const scrapeArticle = async (url) => { try { const response = await fetch(url); const html = await response.text(); const $ = cheerio.load(html); const paragraphs = $('p').map((_, el) => $(el).text()).get(); return paragraphs.join(' ').replace(/\s+/g, ' ').trim(); } catch (err) { console.error(Scraping failed for ${url}:, err); return ''; } };

// Main processing route app.get('/process-feeds', async (req, res) => { try { const feeds = await loadFeeds(); const cache = await loadCache(); const updates = [];

for (const url of feeds) {
  const xml = await fetch(url).then(r => r.text());
  const parsed = await parseStringPromise(xml);
  const items = parsed.rss.channel[0].item || [];

  for (const item of items) {
    const title = item.title[0];
    const link = item.link[0];

    if (!cache[link]) {
      const content = await scrapeArticle(link);
      updates.push({ title, link, content });
      cache[link] = true;
    }
  }
}

await saveCache(cache);
res.json({ updated: updates });

} catch (err) { console.error('Error processing feeds:', err); res.status(500).json({ error: err.message }); } });

app.listen(PORT, () => console.log(🚀 Feed monitor + scraper running on port ${PORT}));


