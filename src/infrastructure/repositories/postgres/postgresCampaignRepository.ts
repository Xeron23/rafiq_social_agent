import { pool } from '../../database/db.js';
import { CampaignAggregate } from '../../../domain/campaign/campaign.aggregate.js';
import { ICampaignRepository } from '../../../domain/campaign/campaign.repository.js';
import { CampaignLifecycleStatus, CampaignType, ChannelKey } from '../../../domain/campaign/campaign.types.js';

export class PostgresCampaignRepository implements ICampaignRepository {
  async save(campaign: CampaignAggregate): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const text = `
        INSERT INTO campaigns (
          id, title, campaign_type, brief, status, current_stage,
          duration_weeks, start_date, target_channels,
          strategy_data, content_plan_data, canonical_data,
          platform_variants, custom_captions, version, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          status = EXCLUDED.status,
          current_stage = EXCLUDED.current_stage,
          strategy_data = EXCLUDED.strategy_data,
          content_plan_data = EXCLUDED.content_plan_data,
          canonical_data = EXCLUDED.canonical_data,
          platform_variants = EXCLUDED.platform_variants,
          custom_captions = EXCLUDED.custom_captions,
          version = campaigns.version + 1,
          updated_at = NOW()
        WHERE campaigns.version = $15
        RETURNING version;
      `;

      const values = [
        campaign.id,
        campaign.name,
        campaign.type,
        campaign.strategy?.brief || '',
        campaign.status.toLowerCase(),
        campaign.step,
        campaign.contentPlan?.length || 2,
        new Date().toISOString().split('T')[0],
        JSON.stringify(campaign.targetChannels),
        campaign.strategy ? JSON.stringify(campaign.strategy) : null,
        campaign.contentPlan ? JSON.stringify(campaign.contentPlan) : null,
        campaign.canonicalContent ? JSON.stringify(campaign.canonicalContent) : null,
        JSON.stringify(campaign.platformVariants || {}),
        JSON.stringify(campaign.customCaptions || {}),
        campaign.version || 1
      ];

      const res = await client.query(text, values);

      if (res.rowCount === 0) {
        throw new Error(`[ConcurrencyError] Campaign ${campaign.id} was modified concurrently (version mismatch: expected ${campaign.version}).`);
      }

      if (res.rows[0]?.version) {
        campaign.version = res.rows[0].version;
      }

      // Save revision history idempotently (avoid duplicates on multiple saves)
      if (campaign.revisionHistory.length > 0) {
        await client.query('DELETE FROM campaign_hitl_revisions WHERE campaign_id = $1', [campaign.id]);
        for (const rev of campaign.revisionHistory) {
          await client.query(`
            INSERT INTO campaign_hitl_revisions (campaign_id, stage_number, action, feedback_notes, created_at)
            VALUES ($1, $2, 'REVISION', $3, $4)
          `, [campaign.id, rev.stage, rev.feedback, rev.at]);
        }
      }

      // Transactional Outbox Pattern: Flush domain events atomically in the same transaction
      const domainEvents = campaign.pullDomainEvents();
      for (const event of domainEvents) {
        await client.query(`
          INSERT INTO outbox_events (aggregate_id, event_type, payload, status)
          VALUES ($1, $2, $3, 'PENDING')
        `, [
          campaign.id,
          event.eventName,
          JSON.stringify({
            eventId: event.eventId,
            occurredOn: event.occurredOn,
            campaignId: campaign.id,
            status: campaign.status,
            step: campaign.step,
            version: campaign.version
          })
        ]);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<CampaignAggregate | null> {
    const res = await pool.query('SELECT * FROM campaigns WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    const revRes = await pool.query(
      'SELECT stage_number, feedback_notes, created_at FROM campaign_hitl_revisions WHERE campaign_id = $1 ORDER BY created_at ASC',
      [id]
    );
    const revisions = revRes.rows.map(r => ({
      stage: r.stage_number,
      feedback: r.feedback_notes || '',
      at: new Date(r.created_at),
    }));
    return this.mapRowToAggregate(row, revisions);
  }

  async findAll(): Promise<CampaignAggregate[]> {
    const res = await pool.query('SELECT * FROM campaigns ORDER BY updated_at DESC');
    return res.rows.map(row => this.mapRowToAggregate(row, []));
  }

  async delete(id: string): Promise<boolean> {
    const res = await pool.query('DELETE FROM campaigns WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  private mapRowToAggregate(
    row: any,
    revisions: Array<{ stage: number; feedback: string; at: Date }> = []
  ): CampaignAggregate {
    const defaultVoice = {
      name: 'Rafiqspace.ai',
      desc: '',
      formal: 30,
      warm: 60,
      simple: 55,
      keywords: ['Sovereignty']
    };

    const targetChannels: ChannelKey[] = Array.isArray(row.target_channels)
      ? row.target_channels
      : (typeof row.target_channels === 'string' ? JSON.parse(row.target_channels) : ['li', 'ig']);

    const createdAt = row.created_at ? new Date(row.created_at) : new Date();
    const updatedAt = row.updated_at ? new Date(row.updated_at) : new Date();

    const agg = new CampaignAggregate(
      row.id,
      row.title,
      row.campaign_type as CampaignType,
      targetChannels,
      defaultVoice,
      row.status.toUpperCase() as CampaignLifecycleStatus,
      row.current_stage,
      row.strategy_data || undefined,
      row.content_plan_data || undefined,
      row.canonical_data || undefined,
      row.platform_variants || {},
      row.custom_captions || {},
      revisions,
      createdAt,
      updatedAt,
      row.version || 1
    );

    return agg;
  }
}
