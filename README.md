# RSS Feed Monitoring and Article Scraper

This project monitors RSS feeds, scrapes full article content, and provides a web endpoint to access the processed data. It has been optimized for speed and to filter articles older than 48 hours upon restart.

## Features

- Monitors a list of RSS feeds.
- Scrapes full article content from links in the feeds.
- Caches seen links to avoid reprocessing.
- Filters articles older than 48 hours on application restart.
- Provides a `/process-feeds` endpoint to retrieve processed data.

## Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd RSS-feeds-monitoring-main
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure feeds:**
    Edit `feeds.txt` and add the URLs of the RSS feeds you want to monitor, one URL per line.

## Usage

To start the server:

```bash
npm start
```

The server will run on `http://localhost:3000` (or the port specified in your environment variables).

Access the processed feed data by navigating to `http://localhost:3000/process-feeds` in your browser or by making an API request to this endpoint.

## Optimizations Implemented

-   **Asynchronous File Operations:** Replaced synchronous file system operations (`fs.readFileSync`, `fs.writeFileSync`) with their asynchronous counterparts (`fs.readFile`, `fs.writeFile`) using `fs/promises` for non-blocking I/O, improving overall application responsiveness.
-   **48-Hour Data Filtering:** Implemented a filter within the `processFeeds` function to only include articles published within the last 48 hours when the application starts or `process-feeds` endpoint is called. This reduces the amount of data processed and stored, leading to faster operations and more relevant data.
-   **Error Handling for Cache:** Improved cache file handling by using `fs.access` to check for file existence asynchronously, preventing crashes if `cache.json` is not found on startup.

## Project Structure

-   `server.js`: The main application file, responsible for setting up the Express server, processing RSS feeds, scraping articles, and handling the `/process-feeds` endpoint.
-   `feeds.txt`: A plain text file containing the URLs of the RSS feeds to be monitored.
-   `cache.json`: A JSON file used to cache previously seen article links to prevent reprocessing.
-   `package.json`: Defines project metadata and dependencies.
-   `scrape.js`: (Optional/Separate script) A utility for scraping full articles from URLs, potentially used independently or integrated into a larger workflow.


