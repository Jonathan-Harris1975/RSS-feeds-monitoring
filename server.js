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

const loadFeedUrls = () =>
  fs.readFileSync(FEED_FILE, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean);

const getCurrentBatch = () => {
  const all = loadFeedUrls();
  if (fs.existsSync(STATE_FILE)) {
    const st = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    currentBatchStart = st.index || 0;
  }
  const batch = [];
  for (let i = 0; i < BATCH_SIZE; i++) {
    batch.push(all[(currentBatchStart + i) % all.length]);
  }
  currentBatchStart = (currentBatchStart + BATCH_SIZE) % all.length;
  fs.writeFileSync(STATE_FILE, JSON.stringify({ index: currentBatchStart }), 'utf8');
  return batch;
};

const fetchArticleText = async (url) => {
  try {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);
    return $('p').map((_, el) => $(el).text()).get().join(' ').replace(/\s+/g, ' ').trim();
  } catch (e) {
    return `Error fetching article: ${e.message}`;
  }
};

const toISODate = (s) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const processFeeds = async () => {
  const urls = getCurrentBatch();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const out = [];
  for (const url of urls) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items) {
        const dateISO = toISODate(item.pubDate || item.isoDate);
        if (!dateISO || new Date(dateISO).getTime() < cutoff) continue;
        if (!seenLinks.has(item.link)) {
          const fullText = await fetchArticleText(item.link);
          out.push({
            feed: url,
            title: item.title,
            url: item.link,
            date: dateISO,
            description: item.contentSnippet || item.summary || '',
            article: fullText
          });
          seenLinks.add(item.link);
        }
      }
    } catch (e) {
      console.error('Error', url, e.message);
    }
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify([...seenLinks]), 'utf8');
  return out;
};

app.get('/health', (req, res) => res.send('OK'));

app.get('/process-feeds', async (req, res) => {
  if (fs.existsSync(CACHE_FILE)) {
    seenLinks = new Set(JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')));
  }
  try {
    const data = await processFeeds();
    res.json({ data, batchInfo: { currentPosition: currentBatchStart, totalFeeds: loadFeedUrls().length } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ Running on port ${PORT}`));
