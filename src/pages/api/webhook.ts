// src/pages/api/webhook.ts
const TelegramBot = require('node-telegram-bot-api');

// Get your bot token from environment variables
const BOT_TOKEN = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// Handle incoming webhook requests
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Process the incoming Telegram update
    await bot.handleUpdate(req.body);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}