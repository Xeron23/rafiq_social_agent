import { pool } from '../../database/db.js';
import { AIMemoryAggregate, IMemoryRepository } from '../../../domain/analytics/memory.aggregate.js';

export class PostgresMemoryRepository implements IMemoryRepository {
  async save(memory: AIMemoryAggregate): Promise<void> {
    const text = `
      INSERT INTO ai_memory_insights (
        id, title, evidence, impact_delta, target_stage, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, TRUE, $6)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        evidence = EXCLUDED.evidence,
        impact_delta = EXCLUDED.impact_delta,
        target_stage = EXCLUDED.target_stage;
    `;
    await pool.query(text, [
      memory.id,
      memory.title,
      memory.lesson,
      memory.impact,
      memory.targetStage,
      memory.createdAt
    ]);
  }

  async findAll(): Promise<AIMemoryAggregate[]> {
    const res = await pool.query('SELECT * FROM ai_memory_insights WHERE is_active = TRUE ORDER BY created_at DESC');
    return res.rows.map(row => new AIMemoryAggregate(
      row.id,
      row.title,
      row.evidence,
      row.impact_delta || '',
      row.target_stage as 'STAGE_1' | 'STAGE_2',
      new Date(row.created_at)
    ));
  }

  async findByStage(stage: 'STAGE_1' | 'STAGE_2'): Promise<AIMemoryAggregate[]> {
    const res = await pool.query(
      'SELECT * FROM ai_memory_insights WHERE target_stage = $1 AND is_active = TRUE ORDER BY created_at DESC',
      [stage]
    );
    return res.rows.map(row => new AIMemoryAggregate(
      row.id,
      row.title,
      row.evidence,
      row.impact_delta || '',
      row.target_stage as 'STAGE_1' | 'STAGE_2',
      new Date(row.created_at)
    ));
  }
}
