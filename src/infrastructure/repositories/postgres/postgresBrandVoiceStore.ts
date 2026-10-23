import { pool } from '../../database/db.js';
import { BrandVoiceProfileVO } from '../../../domain/campaign/campaign.types.js';

export class PostgresBrandVoiceStore {
  private cachedProfile: BrandVoiceProfileVO = {
    name: 'Rafiqspace.ai',
    desc: 'Perusahaan AI Indonesia yang membangun solusi AI berdaulat untuk enterprise dan pemerintah — dari asisten rapat hingga keamanan siber — dengan data yang tetap berada di kendali klien.',
    formal: 30, // 0=Formal, 100=Santai
    warm: 60,   // 0=Lugas, 100=Hangat
    simple: 55, // 0=Teknis, 100=Sederhana
    keywords: [
      'Responsible AI',
      'Enterprise Grade',
      'Secure',
      'AI Governance',
      'Kedaulatan Data',
      'Sovereignty'
    ],
    guidelines: 'Bahasa Indonesia baku; istilah teknis boleh dalam bahasa Inggris.'
  };

  constructor() {
    this.loadFromDb();
  }

  private async loadFromDb(): Promise<void> {
    try {
      const res = await pool.query('SELECT * FROM brand_voice_profiles WHERE is_active = TRUE LIMIT 1');
      if (res.rows.length > 0) {
        const row = res.rows[0];
        const keywords = Array.isArray(row.mandatory_keywords)
          ? row.mandatory_keywords
          : (typeof row.mandatory_keywords === 'string' ? JSON.parse(row.mandatory_keywords) : []);

        this.cachedProfile = {
          name: row.brand_name,
          desc: row.brand_description,
          formal: row.tone_formal,
          warm: row.tone_warm,
          simple: row.tone_simple,
          keywords,
          guidelines: row.language_guidelines || ''
        };
      }
    } catch (err) {
      console.warn('[BrandVoiceStore] Warning loading from DB:', err);
    }
  }

  getProfile(): BrandVoiceProfileVO {
    return { ...this.cachedProfile };
  }

  updateProfile(profile: Partial<BrandVoiceProfileVO>): BrandVoiceProfileVO {
    this.cachedProfile = { ...this.cachedProfile, ...profile };

    // Asynchronously persist to Postgres
    pool.query(`
      UPDATE brand_voice_profiles SET
        brand_name = $1,
        brand_description = $2,
        tone_formal = $3,
        tone_warm = $4,
        tone_simple = $5,
        mandatory_keywords = $6,
        language_guidelines = $7,
        updated_at = NOW()
      WHERE is_active = TRUE
    `, [
      this.cachedProfile.name,
      this.cachedProfile.desc,
      this.cachedProfile.formal,
      this.cachedProfile.warm,
      this.cachedProfile.simple,
      JSON.stringify(this.cachedProfile.keywords),
      this.cachedProfile.guidelines || ''
    ]).catch(err => console.error('[BrandVoiceStore] Error updating profile in Postgres:', err));

    return { ...this.cachedProfile };
  }
}
