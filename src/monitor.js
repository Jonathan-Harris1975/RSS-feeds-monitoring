const fs = require('fs');
const Parser = require('rss-parser');
const parser = new Parser();

const feeds = fs.readFileSync('feeds.txt', 'utf-8').trim().split('\n');
let lastCheck = {};
try {
  lastCheck = JSON.parse(fs.readFileSync('data/last-check.json', 'utf-8'));
} catch (e) {}

(async () => {
  for (const feedUrl of feeds) {
    try {
      const feed = await parser.parseURL(feedUrl);
      const latestItem = feed.items[0];
      const lastPubDate = lastCheck[feedUrl];

      if (!lastPubDate || new Date(latestItem.pubDate) > new Date(lastPubDate)) {
        console.log(`🆕 New item in ${feed.title}: ${latestItem.title}`);
        lastCheck[feedUrl] = latestItem.pubDate;
      } else {
        console.log(`No update for ${feed.title}`);
      }
    } catch (err) {
      console.error(`Failed to fetch ${feedUrl}`, err.message);
    }
  }
  fs.writeFileSync('data/last-check.json', JSON.stringify(lastCheck, null, 2));
})();
