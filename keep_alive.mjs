const express = require('express');
const r = express();
const port = 8080;

r.get('/', (req, res) => {
    res.send('🤖 Bot is running!');
});

r.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

function keepAlive() {
    r.listen(port, () => {
        console.log(`🌐 Keep-alive server running on port ${port}`);
    });
}

module.exports = keepAlive;