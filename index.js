import express from 'express';
import * as tdl from 'tdl';
import { getTdjson } from 'prebuilt-tdlib';
import fs from 'fs';
import readline from 'readline';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;
const SAVE_PATH = './saved_messages.json';
const CHANNEL_USERNAME = '@perspolisfans'; // 👈 change this to your channel username

// // Initialize TDLib
tdl.configure({
  tdjson: getTdjson(),
  verbosityLevel: 1,
});


const client = tdl.createClient({
  apiId: 19661737,
  apiHash: "28b0dd4e86b027fd9a2905d6c343c6bb",
});

const authState = await client.invoke({
  _: 'getAuthorizationState'
})
if (authState._ !== "authorizationStateReady") {
  client.login()
}


console.log('🔐 Current auth state:', authState)



// Store message ID if not already stored
function saveMessageId(messageId) {
  let data = [];
  if (fs.existsSync(SAVE_PATH)) {
    try {
      data = JSON.parse(fs.readFileSync(SAVE_PATH, 'utf-8'));
    } catch {
      data = [];
    }
  }
  if (!data.includes(messageId)) {
    data.push(messageId);
    fs.writeFileSync(SAVE_PATH, JSON.stringify(data, null, 2));
    console.log(`💾 Saved message ID: ${messageId}`);
  }
}

// Get chat ID using channel username
async function getChatIdByUsername(username) {
  try {
    const chat = await client.invoke({ _: 'searchPublicChat', username: username.replace('@', '') });
    console.log(`📡 Chat found: ${chat.title}`);
    return chat.id;
  } catch (err) {
    console.error('❌ Failed to find chat:', err.message);
    process.exit(1);
  }
}

// Fetch last 10 messages
async function fetchLastMessages(chatId) {
  try {
    const result = await client.invoke({
      _: 'getChatHistory',
      chat_id: chatId,
      limit: 10,
      offset_id: 0,
      offset_position: 0,
      only_local: false,
    });

    for (const message of result.messages) {
      console.log('📥 Message:', message.content?.text?.text || '[non-text]');
      saveMessageId(message.id);
    }
  } catch (err) {
    console.error('⚠️ Error fetching messages:', err.message);
  }
}

// Watch for new messages
function listenToMessages(chatId) {
  client.on('update', (update) => {
    if (update._ === 'updateNewMessage') {
      const message = update.message;
      if (message.chat_id === chatId) {
        console.log('🆕 New message:', message.content?.text?.text || '[non-text]');
        saveMessageId(message.id);
      }
    }
  });
}

// Setup messages API
app.get('/messages', (req, res) => {
  if (fs.existsSync(SAVE_PATH)) {
    const data = JSON.parse(fs.readFileSync(SAVE_PATH, 'utf-8'));
    res.json(data);
  } else {
    res.json([]);
  }
});

const main = async () => {
    const chatId = await getChatIdByUsername(CHANNEL_USERNAME);
    await fetchLastMessages(chatId);
    listenToMessages(chatId);
}
main()



app.listen(PORT, () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}`);
});
