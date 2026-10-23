import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export class TelegramPollingDaemon {
  private botToken: string;
  private running: boolean = false;
  private lastUpdateId: number = 0;
  private backendWebhookUrl: string;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.backendWebhookUrl = 'http://127.0.0.1:3010/api/webhooks/telegram';
  }

  public async start(): Promise<void> {
    if (!this.botToken) {
      console.warn('[TelegramPollingDaemon] Bot token not provided. Polling disabled.');
      return;
    }

    this.running = true;
    console.log('[TelegramPollingDaemon] 🤖 Telegram bot polling daemon started...');

    // Delete webhook to ensure getUpdates polling works cleanly
    try {
      await axios.post(`https://api.telegram.org/bot${this.botToken}/deleteWebhook`, {}, { proxy: false, timeout: 15000 });
    } catch (e: any) {
      console.warn('[TelegramPollingDaemon] deleteWebhook warning:', e.message);
    }

    this.pollLoop();
  }

  public stop(): void {
    this.running = false;
    console.log('[TelegramPollingDaemon] Stopped.');
  }

  private async pollLoop(): Promise<void> {
    while (this.running) {
      try {
        const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=15`;
        const res = await axios.get(url, { timeout: 20000, proxy: false });
        const updates = res.data?.result || [];

        for (const update of updates) {
          this.lastUpdateId = update.update_id;
          const msg = update.message;
          if (msg && msg.text) {
            console.log(`[TelegramPollingDaemon] 📩 Inbound from ${msg.chat.id} (@${msg.chat.username || 'unknown'}): "${msg.text}"`);

            // If user types /start, handle welcome setup directly
            if (msg.text === '/start') {
              axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
                chat_id: msg.chat.id,
                text: `👋 Halo @${msg.chat.username || 'rekan'}!\n\nSaya adalah **Socialpal AI Assistant**, digital employee Anda untuk otomatisasi media sosial.\n\nKetik *"mulai"* atau *"bantu setup"* untuk inisialisasi awal, atau langsung ketik instruksi seperti *"buat kampanye Hari Pahlawan 2026"*!`,
                parse_mode: 'Markdown',
              }, { proxy: false, timeout: 15000 }).catch(() => {});
              continue;
            }

            // Send instant typing action in Telegram
            axios.post(`https://api.telegram.org/bot${this.botToken}/sendChatAction`, {
              chat_id: msg.chat.id,
              action: 'typing',
            }, { proxy: false, timeout: 10000 }).catch(() => {});

            // Forward to our internal Fast-ACK webhook (bypass system proxy to avoid protocol mismatch)
            try {
              await axios.post(
                this.backendWebhookUrl,
                {
                  update_id: update.update_id,
                  message: {
                    chat: { id: msg.chat.id },
                    text: msg.text,
                    from: msg.from,
                  },
                },
                {
                  timeout: 5000,
                  proxy: false,
                }
              );
            } catch (postErr: any) {
              console.error('[TelegramPollingDaemon] Error forwarding to webhook:', postErr.message);
            }
          }
        }
      } catch (err: any) {
        if (!err.message?.includes('timeout')) {
          console.warn('[TelegramPollingDaemon] Polling tick error:', err.message);
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
}
