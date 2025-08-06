// feedReader.js
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const parser = new Parser();

async function readNextFiveFeeds() {
  const feedFile = path.resolve(__dirname, 'feeds.txt');
  const lines = fs.readFileSync(feedFile, 'utf8').split(/\r?\n/).filter(Boolean);
  // Read current index, stored separately
  const indexFile = path.resolve(__dirname, 'state.json');
  let state = { index: 0 };
  if (fs.existsSync(indexFile)) {
    state = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  }
  const start = state.index;
  const subset = lines.slice(start, start + 5);
  state.index = (start + 5) % lines.length;
  fs.writeFileSync(indexFile, JSON.stringify(state), 'utf8');
  return subset;
}

async function fetchRecentItems() {
  const feeds = await readNextFiveFeeds();
  const cutoff = Date.now() - 24 * 3600 * 1000;
  const allItems = [];
  for (const url of feeds) {
    try {
      const feed = await parser.parseURL(url);
      const recent = feed.items.filter(item => {
        const pub = new Date(item.pubDate || item.isoDate).getTime();
        return pub >= cutoff;
      });
      allItems.push(...recent);
    } catch (err) {
      console.error('Failed feed', url, err.message);
    }
  }
  return allItems;
}

// Example usage
fetchRecentItems().then(items => {
  console.log('Recent items:', items.map(i => i.title));
});};

// Get the current batch of feed URLs
const getCurrentBatch = async () => {
  const allFeeds = await loadFeedUrls();
  const batch = [];
  
  for (let i = 0; i < BATCH_SIZE; i++) {
    const index = (currentBatchStart + i) % allFeeds.length;
    batch.push(allFeeds[index]);
  }
  
  // Update the batch start for next time
  currentBatchStart = (currentBatchStart + 1) % allFeeds.length;
  
  return batch;
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
  const feedUrls = await getCurrentBatch();
  const newArticles = [];

  for (const feedUrl of feedUrls) {
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
    res.json({
      data,
      batchInfo: {
        currentPosition: currentBatchStart,
        totalFeeds: (await loadFeedUrls()).length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ RSS Feed Monitor running on port ${PORT}`);
});
