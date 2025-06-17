import express from 'express';
import * as tdl from 'tdl';
import { getTdjson } from 'prebuilt-tdlib';
import dotenv from 'dotenv';
import AppDataSource from './data-source.js';

dotenv.config();
const app = express();
const PORT = 3000;

const CHANNELS = [
  'Esteghlaal_twitter',
  'bad_ss',
  'Perspolisirfans',
  'Barca_We',
  'Tans_Footbali',
];

let chatRepo;
await AppDataSource.initialize().then(() => {
  chatRepo = AppDataSource.getRepository('Chat');
});

tdl.configure({ tdjson: getTdjson(), verbosityLevel: 1 });

const client = tdl.createClient({
  apiId: parseInt(process.env.API_ID),
  apiHash: process.env.API_HASH,
});
await client.login();
console.log('🔐 Authenticated');

function calcScore({ views = 0, forwards = 0, replies = 0, canInteract = true }) {
  if (!canInteract) return forwards * 0.6 + views * 0.4;
  return views * 0.2 + forwards * 0.3 + replies * 0.5;
}

async function getChatId(username) {
  try {
    const chat = await client.invoke({ _: 'searchPublicChat', username });
    return chat.id;
  } catch (e) {
    console.error(`❌ Chat ${username} not found:`, e.message);
    return null;
  }
}

async function fetchRecentMessages(chatId, limit = 50) {
  const history = await client.invoke({
    _: 'getChatHistory',
    chat_id: chatId,
    limit,
    offset_id: 0,
    offset_position: 0,
    only_local: false,
  });

  const now = Date.now() / 1000;
  const twoHoursAgo = now - 2 * 60 * 60;

  return (history.messages || []).filter((m) => m.date > twoHoursAgo);
}

async function enrichMessage(chatId, message) {
  try {
    const full = await client.invoke({
      _: 'getMessage',
      chat_id: chatId,
      message_id: message.id,
    });

    const replies = full.reply_info?.reply_count || 0;
    const views = full.view_count || 0;
    const forwards = full.forward_info ? 1 : 0;
    const canInteract = !message.can_be_reported;

    const score = calcScore({ views, forwards, replies, canInteract });

    return {
      chatId: String(chatId),
      messageId: String(message.id),
      score,
    };
  } catch (e) {
    console.error(`❌ Failed to enrich message:`, e.message);
    return null;
  }
}

// 📡 GET /best
app.get('/best', async (req, res) => {
  console.log('🔍 Fetching top 10 messages from each channel (last 2h)...');

  // مرحله 1: پاک‌سازی قبلی
  await chatRepo.clear();

  // مرحله 2: گرفتن پیام‌های برتر برای هر کانال
  const topMessagesPerChannel = [];

  for (const username of CHANNELS) {
    const chatId = await getChatId(username);
    if (!chatId) continue;

    const recentMessages = await fetchRecentMessages(chatId, 50);
    const enriched = await Promise.all(
      recentMessages.map((msg) => enrichMessage(chatId, msg))
    );

    const valid = enriched.filter(Boolean);
    valid.sort((a, b) => b.score - a.score);

    const top10 = valid.slice(0, 10);
    topMessagesPerChannel.push(...top10);
    console.log(`✅ ${username}: ${top10.length} top messages`);
  }

  // مرحله 3: میکس رندوم
  const shuffled = topMessagesPerChannel
    .map((msg) => ({ ...msg, rand: Math.random() }))
    .sort((a, b) => a.rand - b.rand)
    .map(({ rand, ...msg }) => msg); // حذف rand

  // مرحله 4: ذخیره در دیتابیس
  for (const msg of shuffled) {
    try {
      await chatRepo.save({
        chatId: msg.chatId,
        messageId: msg.messageId,
      });
    } catch (e) {
      console.error(`❌ DB save failed:`, e.message);
    }
  }

  // مرحله 5: ارسال فقط آیدی‌ها
  res.json(shuffled.map(({ chatId, messageId }) => ({ chatId, messageId })));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
