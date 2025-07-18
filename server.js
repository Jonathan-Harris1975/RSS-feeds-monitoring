
import express from 'express';
import fetch from 'node-fetch';
import xml2js from 'xml2js';
import fs from 'fs-extra';
import cheerio from 'cheerio';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const FEEDS_FILE = './feeds.txt';
const PREVIOUS_FILE = './previous.json';

// Utility to load feeds from feeds.txt
const loadFeeds = async () => {
  try {
    const content = await fs.readFile(FEEDS_FILE, 'utf-8');
    return content.split('\n').filter(line => line.trim() !== '');
  } catch (err) {
    console.error('Error reading feeds file:', err.message);
    return [];
  }
};

// Utility to fetch article HTML content and extract readable text
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

// Core feed processing endpoint
app.get('/process-feeds', async (req, res) => {
  const feeds = await loadFeeds();

  if (!Array.isArray(feeds) || feeds.length === 0) {
    return res.status(400).json({ error: 'No feeds found.' });
  }

  const parser = new xml2js.Parser({ explicitArray: false });
  let newItems = [];

  const previous = await fs.readJson(PREVIOUS_FILE, { throws: false }) || {};

  for (const feedUrl of feeds) {
    try {
      const response = await fetch(feedUrl);
      const xml = await response.text();
      const json = await parser.parseStringPromise(xml);
      const items = json.rss?.channel?.item || [];

      for (const item of Array.isArray(items) ? items : [items]) {
        const id = item.guid || item.link || item.title;
        const published = item.pubDate || item.date || '';
        const previousFeed = previous[feedUrl] || {};

        if (!previousFeed[id]) {
          const articleText = await fetchArticleText(item.link);
          newItems.push({
            feed: feedUrl,
            title: item.title,
            link: item.link,
            description: item.description,
            pubDate: published,
            content: articleText
          });
        }

        previousFeed[id] = published;
        previous[feedUrl] = previousFeed;
      }
    } catch (err) {
      console.error(`Failed to process ${feedUrl}:`, err.message);
    }
  }

  await fs.writeJson(PREVIOUS_FILE, previous, { spaces: 2 });
  res.json(newItems);
});

app.listen(PORT, () => console.log(`RSS monitor server running on port ${PORT}`));
