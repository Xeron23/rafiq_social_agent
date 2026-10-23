import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export class TelegramNotificationService {
  private botToken: string;
  private defaultChatId: string;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.defaultChatId = process.env.TELEGRAM_CHAT_ID || '1391982793';
  }

  public async sendMessage(text: string, chatId?: string | number): Promise<boolean> {
    const targetChat = chatId ? String(chatId) : this.defaultChatId;
    if (!this.botToken || !targetChat) {
      console.warn('[TelegramNotificationService] Bot token or Chat ID not configured');
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      await axios.post(url, {
        chat_id: targetChat,
        text,
        parse_mode: 'Markdown',
      }, { proxy: false, timeout: 20000 });
      console.log(`[TelegramNotificationService] 📤 Message sent to ${targetChat}`);
      return true;
    } catch (err: any) {
      // Fallback without Markdown if parsing fails
      try {
        const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
        await axios.post(url, {
          chat_id: targetChat,
          text,
        }, { proxy: false, timeout: 20000 });
        console.log(`[TelegramNotificationService] 📤 Message sent (plain text) to ${targetChat}`);
        return true;
      } catch (innerErr: any) {
        console.error('[TelegramNotificationService] ❌ Failed to send message:', innerErr.message);
        return false;
      }
    }
  }

  /**
   * Proactive alert to user about campaign progress, approvals, and reminders
   */
  public async notifyCampaignCreated(campaignName: string, campaignId: string, goal: string, chatId?: string | number) {
    const text = `🎯 *Socialpal AI: Kampanye Baru Disiapkan!*\n\n` +
      `Halo! Saya baru saja menyusun draf strategi untuk:\n` +
      `📌 *${campaignName}*\n` +
      `💡 *Goal:* ${goal}\n` +
      `🆔 \`${campaignId}\`\n\n` +
      `Draf ini sekarang berada di *Tahap 1 (Menunggu Persetujuan Anda)*.\n` +
      `Ketik *"Setujui strategi"* untuk langsung melanjutkan, atau beri saya catatan revisi.`;
    return this.sendMessage(text, chatId);
  }

  public async notifyStrategyApproved(campaignName: string, chatId?: string | number) {
    const text = `📋 *Socialpal AI: Strategi Disetujui!*\n\n` +
      `Strategi untuk *${campaignName}* telah Anda setujui.\n` +
      `Planning Agent telah menyusun kalender postingan mingguan.\n\n` +
      `Ketik *"Setujui rencana"* untuk melanjutkan ke pembuatan materi konten utama.`;
    return this.sendMessage(text, chatId);
  }

  public async notifyContentPlanApproved(campaignName: string, chatId?: string | number) {
    const text = `✍️ *Socialpal AI: Konten Master Selesai Disintesis!*\n\n` +
      `Konten master dan variasi channel (LinkedIn, X, IG, Medium) untuk *${campaignName}* sudah siap diotorisasi.\n\n` +
      `Ketik *"Jadwalkan semua"* untuk memasukkannya ke antrean kalender publikasi otomatis.`;
    return this.sendMessage(text, chatId);
  }

  public async notifyScheduledSuccess(campaignName: string, count: number, chatId?: string | number) {
    const text = `🚀 *Socialpal AI: Postingan Terjadwal!*\n\n` +
      `Sebanyak *${count} postingan* untuk *${campaignName}* berhasil dijadwalkan ke kalender dan siap terbit otomatis.\n\n` +
      `Pantau jadwal dan analitiknya kapan saja!`;
    return this.sendMessage(text, chatId);
  }
}

export const telegramNotifier = new TelegramNotificationService();
