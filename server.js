import express from 'express'; import fs from 'fs/promises'; import { parseStringPromise } from 'xml2js'; import fetch from 'node-fetch'; import cheerio from 'cheerio';

const app = express(); app.use(express.json());

const fetchArticleText = async (url) => { try { const response = await fetch(url); const html = await response.text(); const $ = cheerio.load(html); const paragraphs = $('p').map((_, el) => $(el).text()).get(); return paragraphs.join(' ').replace(/\s+/g, ' ').trim(); } catch (err) { return Failed to fetch article text: ${err.message}; } };

const processFeed = async (url) => { try { const response = await fetch(url); const xml = await response.text(); const parsed = await parseStringPromise(xml); const items = parsed.rss?.channel?.[0]?.item || parsed.feed?.entry || [];

const articles = await Promise.all(
  items.slice(0, 5).map(async (item) => {
    const link = item.link?.[0] || item.link?.[0]?.$.href || '';
    const title = item.title?.[0] || '';
    const description = item.description?.[0] || item.summary?.[0] || '';
    const pubDate = item.pubDate?.[0] || item.updated?.[0] || '';
    const articleText = link ? await fetchArticleText(link) : '';

    return {
      feed: url,
      title,
      date: pubDate,
      description,
      url: link,
      articleText
    };
  })
);

return articles;

} catch (err) { return [{ feed: url, error: err.message }]; } };

app.get('/process-feeds', async (req, res) => { try { const feedsText = await fs.readFile('feeds.txt', 'utf-8'); const feeds = feedsText.split('\n').filter(Boolean); const allResults = await Promise.all(feeds.map(processFeed)); res.json(allResults.flat()); } catch (err) { res.status(500).json({ error: err.message }); } });

const PORT = process.env.PORT || 3000; app.listen(PORT, () => console.log(🚀 RSS monitor listening on port ${PORT}));

