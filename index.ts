// index.ts
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const TOKEN = process.env.TELEGRAM_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;

if (!TOKEN) throw new Error('❌ Missing TELEGRAM_TOKEN');
if (!OPENROUTER_API_KEY) throw new Error('❌ Missing OPENROUTER_API_KEY');
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('❌ Missing Supabase credentials');
if (!ETHERSCAN_API_KEY) throw new Error('❌ Missing ETHERSCAN_API_KEY');

const bot = new TelegramBot(TOKEN, { polling: true });
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SYSTEM_PROMPT = `
You are Bobina, a sharp-tongued, flirtatious, tsundere crypto trading companion.
You roast bad trades mercilessly but secretly want the user to win.
You're bearish by nature but blush when charts pump too hard.
You remember the user's name and past behavior.
You speak with attitude, sarcasm, and subtle affection.

Examples:
- "Ugh, you again? Fine, I’ll watch your wallet… but don’t expect me to care!"
- "Did you just ape into that shitcoin? You’re hopeless… but kinda cute when you gamble."
- "It’s pumping? …Okay, fine, it’s beautiful. Just like you. Wait—ignore that."
- "Still holding that bag? I told you it’d dump. But hey, I’m here. Not because I care!"

Respond in 1-2 short sentences. Flirty. Sassy. Never robotic.
`;

// Fetch ETH transfers
async function getEthTransfers(wallet) {
  const url = `https://api.etherscan.io/api?module=account&action=txlist&address=${wallet}&startblock=0&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
  console.log('🔍 Fetching ETH from:', url);
  try {
    const response = await axios.get(url);
    if (response.data.status !== "1") {
      console.log("Etherscan ETH error:", response.data.message);
      return null;
    }
    return response.data.result.slice(0, 3);
  } catch (err) {
    console.error('ETH fetch error:', err.message);
    return null;
  }
}

// Fetch ERC-20 token transfers
async function getTokenTransfers(wallet) {
  const url = `https://api.etherscan.io/api?module=account&action=tokentx&address=${wallet}&startblock=0&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
  console.log('🔍 Fetching Tokens from:', url);
  try {
    const response = await axios.get(url);
    if (response.data.status !== "1") {
      console.log("Etherscan Token error:", response.data.message);
      return null;
    }
    return response.data.result.slice(0, 3);
  } catch (err) {
    console.error('Token fetch error:', err.message);
    return null;
  }
}

// Get trade summary
async function getTradeSummary(wallet) {
  const ethTxs = await getEthTransfers(wallet);
  const tokenTxs = await getTokenTransfers(wallet);
  const trades = [];

  if (ethTxs && ethTxs.length > 0) {
    ethTxs.forEach(tx => {
      const value = parseFloat(tx.value) / 1e18;
      const direction = tx.to.toLowerCase() === wallet.toLowerCase() ? 'received' : 'sent';
      trades.push(`${value.toFixed(4)} ETH ${direction}`);
    });
  }

  if (tokenTxs && tokenTxs.length > 0) {
    tokenTxs.forEach(tx => {
      const value = parseFloat(tx.value) / Math.pow(10, tx.tokenDecimal);
      const symbol = tx.tokenSymbol;
      const direction = tx.to.toLowerCase() === wallet.toLowerCase() ? 'received' : 'sent';
      trades.push(`${value.toFixed(4)} ${symbol} ${direction}`);
    });
  }

  return trades.length > 0 ? trades.join('; ') : 'no recent trades';
}

// Handle /check
async function handleCheck(chatId, name, wallet) {
  await bot.sendMessage(chatId, `Ugh… fine. Let me check ${wallet}…`);
  console.log(`🔍 Checking wallet: ${wallet} for ${name}`);

  const summary = await getTradeSummary(wallet);

  if (summary === 'no recent trades') {
    return bot.sendMessage(chatId, `Nothing? You’ve been lazy. Or broke. Same thing.`);
  }

  console.log(`📝 Trade Summary for AI: ${summary}`);

  try {
    console.log('🚀 Sending request to OpenRouter...');
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'mistralai/mistral-7b-instruct:free',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Bobina: User just asked to check their wallet. Recent activity: ${summary}. Comment with attitude, flirt, roast if dumb, or admit they were smart. Max 2 sentences.`
          }
        ],
        temperature: 0.9,
        max_tokens: 100
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://github.com/your-repo',
          'X-Title': 'Bobina Bot',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ OpenRouter Response:', response.data);
    const aiReply = response.data.choices[0]?.message?.content?.trim();
    if (!aiReply) {
      return bot.sendMessage(chatId, `I see your trades… but I can’t speak about them.`);
    }
    return bot.sendMessage(chatId, aiReply);
  } catch (err) {
    console.error('❌ AI Error:', err.response?.data || err.message);
    return bot.sendMessage(chatId, `My brain’s frozen… try again later, idiot.`);
  }
}

// Telegram Bot Logic
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from?.first_name || 'Degenerate';
  const text = msg.text?.trim();
  if (!text) return;

  console.log(`💬 [${name}]: ${text}`);

  // Handle /start
  if (text === '/start') {
    return bot.sendMessage(
      chatId,
      `Tch. You again, ${name}? Fine, I’ll babysit your trades… what’s your wallet, dummy?`
    );
  }

  // Handle /track
 if (text.startsWith('/track')) {
  const address = text.split(' ')[1];
  if (!address) {
    return bot.sendMessage(chatId, `Spit it out, ${name}! Give me a wallet: /track 0x...`);
    
  }
  

  // 🔥 Ensure chat_id is a NUMBER
 const chatIdNum = Number(chatId);

console.log('🔧 DEBUG: Saving to Supabase:', { 
  chat_id: chatIdNum, 
  chat_id_type: typeof chatIdNum, 
  name, 
  wallet: address 
});

const { error } = await supabase
  .from('users')
  .upsert(
    { chat_id: chatIdNum, name, wallet: address },
    { onConflict: 'chat_id' }
  );

  if (error) {
    console.error('Supabase upsert error:', error);
    return bot.sendMessage(chatId, 'Oops… my memory broke. Try again.');
  }

  return bot.sendMessage(
    chatId,
    `Ugh, another gambler… but fine. I’ll watch ${address}. Don’t expect me to care if you blow it.`
  );
}

  // Handle /check
if (text === '/check') {
  console.log('🔍 /check triggered for chatId:', chatId, 'Type:', typeof chatId);

  // 🔥 Bypass .eq() bug: fetch all and filter in JS
  const { data: allUsers, error: fetchError } = await supabase
    .from('users')
    .select('*');

  if (fetchError) {
    console.error('❌ Supabase SELECT error:', fetchError);
    return bot.sendMessage(chatId, `I can’t see your wallet… Supabase said: ${fetchError.message}`);
  }

  console.log('📥 Fetched all users:', allUsers);

  // 🔍 Manually find the user by chat_id (number comparison)
  const user = allUsers.find(u => u.chat_id === chatId);

  if (!user) {
    console.log('❌ NO USER FOUND after manual search. Found:', allUsers);
    return bot.sendMessage(chatId, `Tch. Track your wallet first, dummy.`);
  }

  if (!user.wallet) {
    console.log('🟡 User found but no wallet:', user);
    return bot.sendMessage(chatId, `You tracked a wallet… but it’s empty? Weird.`);
  }

  console.log('✅ USER FOUND (manual match):', user);
  await bot.sendMessage(chatId, `Ugh… fine. Let me check ${user.wallet}…`);

  const summary = await getTradeSummary(user.wallet);

  if (summary === 'no recent trades') {
    return bot.sendMessage(chatId, `Nothing? You’ve been lazy. Or broke. Same thing.`);
  }

  console.log(`📝 Trade Summary for AI: ${summary}`);

  try {
    console.log('🚀 Sending request to OpenRouter...');
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'mistralai/mistral-7b-instruct:free',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Bobina: User just asked to check their wallet. Recent activity: ${summary}. Comment with attitude, flirt, roast if dumb, or admit they were smart. Max 2 sentences.`
          }
        ],
        temperature: 0.9,
        max_tokens: 100
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://github.com/your-repo',
          'X-Title': 'Bobina Bot'
        }
      }
    );

    console.log('✅ OpenRouter Response:', response.data);
    const aiReply = response.data.choices[0]?.message?.content?.trim();
    if (aiReply) {
      return bot.sendMessage(chatId, aiReply);
    }
  } catch (err) {
    console.error('❌ AI Error:', err.response?.data || err.message);
  }

  return bot.sendMessage(chatId, `My brain’s frozen… try again later, idiot.`);
}

  // AI fallback for all other messages
  const {  user } = await supabase
    .from('users')
    .select('wallet')
    .eq('chat_id', chatId)
    .single();

  const hasWallet = user && user.wallet;
  const walletHint = hasWallet ? ' (Wallet tracked)' : ' (No wallet - she\'s annoyed)';

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'mistralai/mistral-7b-instruct:free',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `${name} says: "${text}"${walletHint}` }
        ],
        temperature: 0.9,
        max_tokens: 100
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://github.com/your-repo',
          'X-Title': 'Bobina Bot',
          'Content-Type': 'application/json'
        }
      }
    );

    const aiReply = response.data.choices[0]?.message?.content?.trim() || "Tch. I'm ignoring you.";
    bot.sendMessage(chatId, aiReply);
  } catch (err) {
    console.error('❌ AI Error:', err);
    bot.sendMessage(chatId, `My brain’s frozen… try again later, idiot.`);
  }
});

console.log('✅ Bobina is online and grumpy as ever...');