import { createServerApp } from './server/app.js';
import { initDatabase } from './infrastructure/database/db.js';
import { TelegramPollingDaemon } from './infrastructure/telegram/telegramPollingDaemon.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3010;

async function bootstrap() {
  try {
    // 1. Initialize PostgreSQL database and run seeds if needed
    await initDatabase();

    // 2. Start Express server with DDD repositories
    const { app } = createServerApp();

    app.listen(PORT, () => {
      console.log(`🚀 Rafiq Social Media Agent Backend listening on port ${PORT}`);
      console.log(`🐘 Database: PostgreSQL 15 connected (socialpal_db)`);
      console.log(`🤖 AI Engine: Mastra v1.73 (Agentic Workflows + Prompt Chaining)`);
      console.log(`🧠 AI Provider Base URL: ${process.env.OPENAI_BASE_URL || 'https://je.jerouter.web.id/v1'}`);
      console.log(`🎯 AI Model: ${process.env.DEFAULT_MODEL || 'jerouter'}`);

      // 3. Start proactive Telegram polling daemon
      if (process.env.TELEGRAM_BOT_TOKEN) {
        const tgDaemon = new TelegramPollingDaemon();
        tgDaemon.start();
      }
    });
  } catch (err) {
    console.error('❌ Failed to bootstrap application:', err);
    process.exit(1);
  }
}

bootstrap();
