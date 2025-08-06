const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';

async function pingServer() {
  try {
    await axios.get(`${BASE_URL}/health`);
    console.log(`[Keepalive] Success at ${new Date().toISOString()}`);
  } catch (err) {
    console.error(`[Keepalive] Fail at ${new Date().toISOString()}: ${err.message}`);
  }
}

pingServer();
setInterval(pingServer, 300000);
