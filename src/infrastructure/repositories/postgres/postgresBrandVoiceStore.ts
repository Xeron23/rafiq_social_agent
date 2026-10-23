import { pool } from '../../database/db.js';
import { BrandVoiceProfileVO } from '../../../domain/campaign/campaign.types.js';

let sharedCachedProfile: BrandVoiceProfileVO = {
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

let loadPromise: Promise<void> | null = null;

export class PostgresBrandVoiceStore {
  constructor() {
    if (!loadPromise) {
      loadPromise = this.loadFromDb();
    }
  }

  public async loadFromDb(): Promise<void> {
    try {
      const res = await pool.query('SELECT * FROM brand_voice_profiles WHERE is_active = TRUE LIMIT 1');
      if (res.rows.length > 0) {
        const row = res.rows[0];
        const keywords = Array.isArray(row.mandatory_keywords)
          ? row.mandatory_keywords
          : (typeof row.mandatory_keywords === 'string' ? JSON.parse(row.mandatory_keywords) : []);

        sharedCachedProfile = {
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
    return { ...sharedCachedProfile };
  }

  async getProfileAsync(): Promise<BrandVoiceProfileVO> {
    await this.loadFromDb();
    return { ...sharedCachedProfile };
  }

  updateProfile(profile: Partial<BrandVoiceProfileVO>): BrandVoiceProfileVO {
    sharedCachedProfile = { ...sharedCachedProfile, ...profile };

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
      sharedCachedProfile.name,
      sharedCachedProfile.desc,
      sharedCachedProfile.formal,
      sharedCachedProfile.warm,
      sharedCachedProfile.simple,
      JSON.stringify(sharedCachedProfile.keywords),
      sharedCachedProfile.guidelines || ''
    ]).catch(err => console.error('[BrandVoiceStore] Error updating profile in Postgres:', err));

    return { ...sharedCachedProfile };
  }
}
