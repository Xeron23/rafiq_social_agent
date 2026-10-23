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
    const conditions: string[] = [];
    const params: any[] = [];
    if (month && month >= 1 && month <= 12) {
      params.push(month);
      conditions.push(`EXTRACT(MONTH FROM event_date)::int = $${params.length}`);
    }
    if (year && year >= 2000 && year <= 2100) {
      params.push(year);
      conditions.push(`EXTRACT(YEAR FROM event_date)::int = $${params.length}`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await pool.query(`
      SELECT id, event_date, EXTRACT(DAY FROM event_date)::int as day_of_month,
             title, short_label, category, suggested_content_type
      FROM calendar_events
      ${whereClause}
      ORDER BY event_date ASC
    `, params);
    return res.rows;
  }

  // --- PERFORMANCE METRICS AGGREGATION (STAGE 5 REAL DB COMPUTATION) ---
  async getAggregatedMetrics(): Promise<{
    totalViews: number;
    totalLikes: number;
    totalShares: number;
    formattedViews: string;
    formattedLikes: string;
    formattedShares: string;
    channelBreakdown: Record<string, { views: number; likes: number; shares: number }>;
    topPostsSummary: string;
  }> {
    const sumRes = await pool.query(`
      SELECT
        COALESCE(SUM(views_count), 0)::int as total_views,
        COALESCE(SUM(likes_count), 0)::int as total_likes,
        COALESCE(SUM(shares_count), 0)::int as total_shares
      FROM post_performance_metrics
    `);
    const totalViews = sumRes.rows[0]?.total_views || 0;
    const totalLikes = sumRes.rows[0]?.total_likes || 0;
    const totalShares = sumRes.rows[0]?.total_shares || 0;

    const chRes = await pool.query(`
      SELECT channel_key,
             COALESCE(SUM(views_count), 0)::int as views,
             COALESCE(SUM(likes_count), 0)::int as likes,
             COALESCE(SUM(shares_count), 0)::int as shares
      FROM post_performance_metrics
      GROUP BY channel_key
    `);
    const channelBreakdown: Record<string, { views: number; likes: number; shares: number }> = {};
    for (const r of chRes.rows) {
      channelBreakdown[r.channel_key] = { views: r.views, likes: r.likes, shares: r.shares };
    }

    const topRes = await pool.query(`
      SELECT sp.title, sp.format_badge, sp.scheduled_time,
             SUM(pm.views_count)::int as views,
             SUM(pm.likes_count)::int as likes,
             SUM(pm.shares_count)::int as shares
      FROM post_performance_metrics pm
      JOIN scheduled_posts sp ON sp.id = pm.post_id
      GROUP BY sp.id, sp.title, sp.format_badge, sp.scheduled_time
      ORDER BY views DESC
      LIMIT 5
    `);

    const topPostsSummary = topRes.rows.length > 0
      ? topRes.rows.map((r, idx) => `${idx + 1}. "${r.title}" (${r.format_badge}, jam ${r.scheduled_time}) -> ${r.views} views, ${r.likes} likes, ${r.shares} shares`).join('\n')
      : 'Belum ada postingan yang memiliki metrik tercatat.';

    const fmtNum = (n: number): string => {
      if (n >= 1000) {
        return (n / 1000).toFixed(1).replace('.', ',') + ' rb';
      }
      return n.toLocaleString('id-ID');
    };

    return {
      totalViews,
      totalLikes,
      totalShares,
      formattedViews: fmtNum(totalViews),
      formattedLikes: totalLikes.toLocaleString('id-ID'),
      formattedShares: totalShares.toLocaleString('id-ID'),
      channelBreakdown,
      topPostsSummary,
    };
  }

  async recordSimulatedMetricsForPost(postId: number, channels: string[]): Promise<void> {
    const check = await pool.query('SELECT COUNT(*) FROM post_performance_metrics WHERE post_id = $1', [postId]);
    if (parseInt(check.rows[0].count, 10) > 0) return;
    const baseSeed = postId * 149;
    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      const mult = ch === 'li' ? 1.8 : ch === 'ig' ? 1.4 : ch === 'x' ? 1.1 : 0.9;
      const views = Math.round(((baseSeed % 800) + 1100 + i * 250) * mult);
      const likes = Math.round(views * 0.05);
      const shares = Math.round(views * 0.01);
      await pool.query(
        'INSERT INTO post_performance_metrics (post_id, channel_key, views_count, likes_count, shares_count) VALUES ($1, $2, $3, $4, $5)',
        [postId, ch, views, likes, shares]
      );
    }
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
