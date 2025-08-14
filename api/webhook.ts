const TelegramBot = require('node-telegram-bot-api');

const BOT_TOKEN = process.env.TELEGRAM_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ Missing TELEGRAM_TOKEN');
}

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

export default async function handler(req, res) {
  console.log('🔴 Incoming request:', req.method);
  console.log('📥 Body:', JSON.stringify(req.body, null, 2));

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await bot.handleUpdate(req.body);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('💥 Webhook error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}