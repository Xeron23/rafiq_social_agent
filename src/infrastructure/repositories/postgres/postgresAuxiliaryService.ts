import { pool } from '../../database/db.js';

export interface CalendarEventDTO {
  id: number;
  event_date: string;
  day_of_month: number;
  title: string;
  short_label: string;
  category: string;
  suggested_content_type: string;
}

export interface NotificationDTO {
  id: number;
  group_label: string;
  category_key: string;
  category_tags: string[];
  time_str: string;
  title: string;
  body: string;
  cta_label?: string;
  cta_href?: string;
  is_unread: boolean;
}

export interface NotificationPreferenceDTO {
  category_key: string;
  label: string;
  send_email: boolean;
  send_telegram: boolean;
}

export class PostgresAuxiliaryService {
  // --- CALENDAR EVENTS ---
  async getCalendarEvents(month?: number, year?: number): Promise<CalendarEventDTO[]> {
    const res = await pool.query(`
      SELECT id, event_date, EXTRACT(DAY FROM event_date)::int as day_of_month,
             title, short_label, category, suggested_content_type
      FROM calendar_events
      ORDER BY event_date ASC
    `);
    return res.rows;
  }

  // --- NOTIFICATIONS ---
  async getNotifications(tab: string = 'all'): Promise<{
    notifications: NotificationDTO[];
    unreadCount: number;
    groups: Array<{ label: string; items: NotificationDTO[] }>;
  }> {
    const res = await pool.query('SELECT * FROM notifications ORDER BY id ASC');
    const allNotifs: NotificationDTO[] = res.rows.map(r => ({
      id: r.id,
      group_label: r.group_label,
      category_key: r.category_key,
      category_tags: Array.isArray(r.category_tags) ? r.category_tags : JSON.parse(r.category_tags || '[]'),
      time_str: r.time_str,
      title: r.title,
      body: r.body,
      cta_label: r.cta_label || undefined,
      cta_href: r.cta_href || undefined,
      is_unread: r.is_unread
    }));

    const filtered = allNotifs.filter(n => tab === 'all' || n.category_tags.includes(tab));
    const unreadCount = allNotifs.filter(n => n.is_unread).length;

    const groupLabels = ['Hari ini', 'Kemarin', 'Minggu ini'];
    const groups = groupLabels.map(label => ({
      label,
      items: filtered.filter(n => n.group_label === label)
    })).filter(g => g.items.length > 0);

    return { notifications: filtered, unreadCount, groups };
  }

  async markNotificationRead(id: number): Promise<void> {
    await pool.query('UPDATE notifications SET is_unread = FALSE WHERE id = $1', [id]);
  }

  async markAllNotificationsRead(): Promise<void> {
    await pool.query('UPDATE notifications SET is_unread = FALSE');
  }

  // --- PREFERENCES ---
  async getNotificationPreferences(): Promise<NotificationPreferenceDTO[]> {
    const res = await pool.query('SELECT * FROM notification_preferences ORDER BY id ASC');
    return res.rows;
  }

  async updateNotificationPreference(category_key: string, field: 'email' | 'tg', value: boolean): Promise<void> {
    const col = field === 'email' ? 'send_email' : 'send_telegram';
    await pool.query(`UPDATE notification_preferences SET ${col} = $1, updated_at = NOW() WHERE category_key = $2`, [value, category_key]);
  }

  // --- ANALYTICS RECOMMENDATIONS (STAGE 5) ---
  async getRecommendations(): Promise<Array<{ id: number; target_stage: string; text: string; is_applied: boolean }>> {
    const res = await pool.query('SELECT * FROM ai_recommendations ORDER BY id ASC');
    return res.rows.map(r => ({
      id: r.id,
      target_stage: r.target_stage,
      text: r.recommendation_text,
      is_applied: r.is_applied
    }));
  }

  async toggleRecommendation(id: number, applied: boolean): Promise<void> {
    await pool.query('UPDATE ai_recommendations SET is_applied = $1, applied_at = NOW() WHERE id = $2', [applied, id]);
  }

  // --- CHANNELS & OAUTH ---
  async getChannels(): Promise<any[]> {
    const res = await pool.query('SELECT * FROM channels ORDER BY id ASC');
    return res.rows.map(r => ({
      ...r,
      caps: Array.isArray(r.capabilities) ? r.capabilities : JSON.parse(r.capabilities || '[]')
    }));
  }

  async toggleChannelStatus(id: string): Promise<string> {
    const current = await pool.query('SELECT status FROM channels WHERE id = $1', [id]);
    if (current.rows.length === 0) return 'off';
    const nextStatus = current.rows[0].status === 'ok' ? 'expired' : 'ok';
    await pool.query('UPDATE channels SET status = $1, updated_at = NOW() WHERE id = $2', [nextStatus, id]);
    return nextStatus;
  }
}
