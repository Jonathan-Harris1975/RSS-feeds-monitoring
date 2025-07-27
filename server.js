import express from 'express';
import { readFile, writeFile } from 'fs/promises';
import { parseStringPromise } from 'xml2js';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import fs from 'fs/promises';

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_FILE = './cache.json';

// Load previously seen article links from cache
let seenLinks = new Set();
  try {
    await fs.access(CACHE_FILE);
    const data = await readFile(CACHE_FILE, 'utf-8');
    seenLinks = new Set(JSON.parse(data));
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File does not exist, proceed with empty seenLinks
    } else {
      console.error('Error accessing cache file:', error);
    }
  }

// Load feed URLs from feeds.txt
const loadFeedUrls = async () => {
  const text = await readFile('./feeds.txt', 'utf-8');
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
};

// Scrape article content using Cheerio
const fetchArticleText = async (url) => {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    const paragraphs = $('p')
      .map((_, el) => $(el).text())
      .get()
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return paragraphs;
  } catch (err) {
    return `Failed to fetch article text: ${err.message}`;
  }
};

// Convert to ISO format safely
const toISODate = (dateStr) => {
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

// Process feeds and return new articles with metadata
const processFeeds = async () => {
  const urls = await loadFeedUrls();
  const newArticles = [];

  for (const feedUrl of urls) {
    try {
      const res = await fetch(feedUrl);
      const xml = await res.text();
      const parsed = await parseStringPromise(xml);
      const items = parsed.rss?.channel?.[0]?.item || [];

      for (const item of items) {
        const title = item.title?.[0] || '';
        const link = item.link?.[0] || '';
        const description = item.description?.[0] || '';
        const pubDateRaw = item.pubDate?.[0] || '';
        const isoDate = toISODate(pubDateRaw);

        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

        if (isoDate && new Date(isoDate) < twoDaysAgo) {
          continue; // Skip articles older than 48 hours
        }

        if (!seenLinks.has(link)) {
          const articleText = await fetchArticleText(link);
          newArticles.push({
            feed: feedUrl,
            title,
            url: link,
            date: isoDate,
            description,
            article: articleText
          });
          seenLinks.add(link);
        }
      }
    } catch (err) {
      console.error(`Failed to process feed ${feedUrl}:`, err.message);
    }
  }

  await writeFile(CACHE_FILE, JSON.stringify([...seenLinks]), 'utf-8');
  return newArticles;
};

// Endpoint to return processed feed data
app.get('/process-feeds', async (req, res) => {
  try {
    const data = await processFeeds();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ RSS Feed Monitor running on port ${PORT}`);
});
