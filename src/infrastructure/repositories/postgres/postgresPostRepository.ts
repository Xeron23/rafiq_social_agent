import { pool } from '../../database/db.js';
import { PostAggregate, IPostRepository, PostStatus } from '../../../domain/planner/post.aggregate.js';
import { ChannelKey } from '../../../domain/campaign/campaign.types.js';

export class PostgresPostRepository implements IPostRepository {
  async save(post: PostAggregate): Promise<void> {
    const text = `
      INSERT INTO scheduled_posts (
        id, day_of_month, scheduled_time, title, short_title,
        content_type, status, channels, caption, stage_label,
        campaign_id, campaign_name, when_str, stage_number,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        day_of_month = EXCLUDED.day_of_month,
        scheduled_time = EXCLUDED.scheduled_time,
        title = EXCLUDED.title,
        short_title = EXCLUDED.short_title,
        content_type = EXCLUDED.content_type,
        status = EXCLUDED.status,
        channels = EXCLUDED.channels,
        caption = EXCLUDED.caption,
        stage_label = EXCLUDED.stage_label,
        campaign_id = EXCLUDED.campaign_id,
        campaign_name = EXCLUDED.campaign_name,
        when_str = EXCLUDED.when_str,
        stage_number = EXCLUDED.stage_number,
        updated_at = NOW();
    `;

    const values = [
      post.id,
      post.dayOfMonth,
      post.timeStr,
      post.title,
      post.shortTitle,
      post.type,
      post.status,
      JSON.stringify(post.channels),
      post.caption,
      post.stage || null,
      post.campaignId || null,
      post.campaignName || null,
      post.whenStr || null,
      post.stageNumber || 4
    ];

    await pool.query(text, values);
  }

  async saveBatch(posts: PostAggregate[]): Promise<void> {
    for (const post of posts) {
      await this.save(post);
    }
  }

  async findById(id: number): Promise<PostAggregate | null> {
    const res = await pool.query('SELECT * FROM scheduled_posts WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return this.mapRowToAggregate(res.rows[0]);
  }

  async findAll(): Promise<PostAggregate[]> {
    const res = await pool.query('SELECT * FROM scheduled_posts ORDER BY day_of_month ASC, id ASC');
    return res.rows.map(row => this.mapRowToAggregate(row));
  }

  private mapRowToAggregate(row: any): PostAggregate {
    const channels: ChannelKey[] = Array.isArray(row.channels)
      ? row.channels
      : (typeof row.channels === 'string' ? JSON.parse(row.channels) : ['li']);

    return new PostAggregate(
      row.id,
      row.day_of_month,
      row.scheduled_time,
      row.title,
      row.short_title,
      row.content_type,
      row.status as PostStatus,
      channels,
      row.caption,
      row.stage_label || undefined,
      row.when_str || undefined,
      row.campaign_id || undefined,
      row.campaign_name || undefined,
      row.stage_number || 4
    );
  }
}
