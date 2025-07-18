import express from 'express';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import { parseStringPromise } from 'xml2js';

const app = express();
const PORT = process.env.PORT || 3000;
const FEEDS_FILE = './feeds.txt';
const DATA_FILE = './data.json';

const loadFeeds = async () => {
  const text = await fs.readFile(FEEDS_FILE, 'utf-8');
  return text.split('\n').filter(Boolean);
};

const loadData = async () => {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const saveData = async (data) => {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
};

const checkFeeds = async () => {
  const feeds = await loadFeeds();
  const previous = await loadData();
  const updated = [];

  for (const url of feeds) {
    try {
      const res = await fetch(url);
      const xml = await res.text();
      const parsed = await parseStringPromise(xml);
      const item = parsed.rss?.channel?.[0]?.item?.[0];
      const latestGuid = item?.guid?.[0] || item?.link?.[0];
      if (!latestGuid) continue;

      if (previous[url] !== latestGuid) {
        updated.push({ url, latest: item });
        previous[url] = latestGuid;
      }
    } catch (err) {
      console.error('Feed error:', url, err.message);
    }
  }

  await saveData(previous);
  return updated;
};

app.get('/changed-feeds', async (req, res) => {
  const updated = await checkFeeds();
  res.json(updated);
});

app.listen(PORT, () => {
  console.log(`RSS monitor running on port ${PORT}`);
});
