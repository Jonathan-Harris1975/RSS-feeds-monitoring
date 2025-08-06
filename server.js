const express = require('express');
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const cheerio = require('cheerio');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const parser = new Parser();
const BATCH_SIZE = 5;
const FEED_FILE = path.join(__dirname, 'feeds.txt');
const STATE_FILE = path.join(__dirname, 'state.json');
const CACHE_FILE = path.join(__dirname, 'seen.json');

let seenLinks = new Set();
let currentBatchStart = 0;

const loadFeedUrls = () => {
  return fs.readFileSync(FEED_FILE, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean);
};

const getCurrentBatch = () => {
  const allFeeds = loadFeedUrls();
  if (fs.existsSync(STATE_FILE)) {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    currentBatchStart = state.index || 0;
  }

  const batch = [];
  for (let i = 0; i < BATCH_SIZE; i++) {
    const idx = (currentBatchStart + i) % allFeeds.length;
    batch.push(allFeeds[idx]);
  }

  currentBatchStart = (currentBatchStart + BATCH_SIZE) % allFeeds.length;
  fs.writeFileSync(STATE_FILE, JSON.stringify({ index: currentBatchStart }), 'utf8');
  return batch;
};

const fetchArticleText = async (url) => {
  try {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);
    return $('p')
      .map((_, el) => $(el).text())
      .get()
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (err) {
    return `Failed to fetch article: ${err.message}`;
  }
};

const toISODate = (dateStr) => {
  const dt = new Date(dateStr);
  return isNaN(dt.getTime()) ? null : dt.toISOString();
};

const processFeeds = async () => {
  const batch = getCurrentBatch();
  const newArticles = [];
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  for (const url of batch) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items) {
        const iso = toISODate(item.pubDate || item.isoDate);
        if (!iso || new Date(iso).getTime() < cutoff) continue;
        const link = item.link;
        if (!seenLinks.has(link)) {
          const txt = await fetchArticleText(link);
          newArticles.push({
            feed: url,
            title: item.title,
            url: link,
            date: iso,
            description: item.contentSnippet || item.summary || '',
            article: txt
          });
          seenLinks.add(link);
        }
      }
    } catch (err) {
      console.error(`Feed failed: ${url}`, err.message);
    }
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify([...seenLinks]), 'utf8');
  return newArticles;
};

app.get('/health', (req, res) => res.send('OK'));

app.get('/process-feeds', async (req, res) => {
  if (fs.existsSync(CACHE_FILE)) {
    seenLinks = new Set(JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')));
  }
  try {
    const data = await processFeeds();
    res.json({
      data,
      batchInfo: {
        currentPosition: currentBatchStart,
        totalFeeds: loadFeedUrls().length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ RSS Feed Monitor running on port ${PORT}`);
});
