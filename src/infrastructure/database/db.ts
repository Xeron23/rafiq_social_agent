import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://postgres:rootpass@127.0.0.1:5432/socialpal_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function query(text: string, params?: any[]) {
  const start = performance.now();
  const res = await pool.query(text, params);
  const duration = (performance.now() - start).toFixed(2);
  // Optional debug logging
  // console.log(`[PG-Query] ⏱️ ${duration}ms | rows: ${res.rowCount}`);
  return res;
}

export async function initDatabase(): Promise<void> {
  console.log('[Database] 🐘 Initializing PostgreSQL connection...');

  try {
    const client = await pool.connect();
    console.log('[Database] ✅ Connected to PostgreSQL database: socialpal_db');
    client.release();

    // 1. Run schema migration
    const schemaSqlPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaSqlPath)) {
      const sql = fs.readFileSync(schemaSqlPath, 'utf8');
      await pool.query(sql);
      console.log('[Database] ✅ Schema migration applied successfully.');
    }

    // 2. Seed initial data if tables are empty
    await seedInitialData();
  } catch (error) {
    console.error('[Database] ❌ Database initialization failed:', error);
    throw error;
  }
}

async function seedInitialData(): Promise<void> {
  // Check Brand Voice
  const bvCheck = await pool.query('SELECT COUNT(*) FROM brand_voice_profiles');
  if (parseInt(bvCheck.rows[0].count, 10) === 0) {
    console.log('[Database] 🌱 Seeding Brand Voice profile...');
    await pool.query(`
      INSERT INTO brand_voice_profiles (
        brand_name, brand_description, tone_formal, tone_warm, tone_simple,
        mandatory_keywords, banned_keywords, language_guidelines
      ) VALUES (
        'Rafiqspace.ai',
        'Perusahaan AI Indonesia yang membangun solusi AI berdaulat untuk enterprise dan pemerintah — dari asisten rapat hingga keamanan siber — dengan data yang tetap berada di kendali klien.',
        30, 60, 55,
        $1, $2,
        'Bahasa Indonesia baku; istilah teknis boleh dalam bahasa Inggris.'
      )
    `, [
      JSON.stringify(['Responsible AI', 'Enterprise Grade', 'Secure', 'AI Governance', 'Scalability', 'Sovereignty']),
      JSON.stringify(['Murahan', 'Gimmick', 'Trial error'])
    ]);
  }

  // Check Calendar Events (Hari Besar Nasional & Tech Moments)
  const calCheck = await pool.query('SELECT COUNT(*) FROM calendar_events');
  if (parseInt(calCheck.rows[0].count, 10) === 0) {
    console.log('[Database] 🌱 Seeding Calendar Events for October 2026...');
    const holidays = [
      { date: '2026-10-01', title: 'Hari Kesaktian Pancasila', short: 'Pancasila', cat: 'national_holiday' },
      { date: '2026-10-02', title: 'Hari Batik Nasional', short: 'Hari Batik', cat: 'national_holiday' },
      { date: '2026-10-05', title: 'Hari Tentara Nasional Indonesia (TNI)', short: 'Hari TNI', cat: 'national_holiday' },
      { date: '2026-10-22', title: 'Hari Santri Nasional', short: 'Hari Santri', cat: 'national_holiday' },
      { date: '2026-10-24', title: 'Hari Dokter Nasional', short: 'Hari Dokter', cat: 'national_holiday' },
      { date: '2026-10-27', title: 'Hari Listrik Nasional', short: 'Hari Listrik', cat: 'national_holiday' },
      { date: '2026-10-28', title: 'Hari Sumpah Pemuda', short: 'Sumpah Pemuda', cat: 'national_holiday' },
      { date: '2026-10-30', title: 'Hari Keuangan Nasional', short: 'Hari Keuangan', cat: 'national_holiday' },
    ];
    for (const h of holidays) {
      await pool.query(
        'INSERT INTO calendar_events (event_date, title, short_label, category) VALUES ($1, $2, $3, $4)',
        [h.date, h.title, h.short, h.cat]
      );
    }
  }

  // Check Scheduled Posts (Planner & Drafts data)
  const postCheck = await pool.query('SELECT COUNT(*) FROM scheduled_posts');
  if (parseInt(postCheck.rows[0].count, 10) === 0) {
    console.log('[Database] 🌱 Seeding Scheduled Posts for Planner & Drafts...');
    const samplePosts = [
      {
        d: 1, date: '2026-10-01', t: '09.00',
        title: 'Hari Kesaktian Pancasila: nilai yang kami pegang dalam membangun AI',
        short: 'Hari Kesaktian Pancasila', type: 'Konten Hari Besar', fmt: 'Quote card',
        s: 'terbit', ch: ['li', 'ig', 'fb'],
        cap: 'Selamat Hari Kesaktian Pancasila. Bagi kami, membangun AI berarti membangun teknologi yang adil, berdaulat, dan berpihak pada bangsa.',
        stage: 'Tahap 4 · Selesai terbit'
      },
      {
        d: 6, date: '2026-10-06', t: '08.30',
        title: 'Kedaulatan AI dimulai dari data yang kita kelola sendiri',
        short: 'Kedaulatan AI dimulai dari data', type: 'Leadership Thought', fmt: 'Carousel',
        s: 'terbit', ch: ['li', 'x', 'th', 'md'],
        cap: 'Sovereignty bukan jargon. Ia dimulai dari keputusan sederhana: di mana data organisasi Anda disimpan, dan siapa yang memegang kendalinya.',
        stage: 'Tahap 4 · Selesai terbit'
      },
      {
        d: 8, date: '2026-10-08', t: '11.00',
        title: 'Teaser: rapat yang terdokumentasi tanpa mencatat manual',
        short: 'Teaser Meetpal', type: 'Promosi Produk', fmt: 'Single image',
        s: 'terbit', ch: ['li', 'ig', 'fb'],
        cap: 'Berapa jam tim Anda habiskan untuk menulis notulen? Sesuatu yang baru akan hadir minggu depan.',
        stage: 'Tahap 4 · Selesai terbit'
      },
      {
        d: 13, date: '2026-10-13', t: '10.00',
        title: 'Meetpal: notulen otomatis dalam hitungan menit',
        short: 'Meetpal: notulen otomatis', type: 'Promosi Produk', fmt: 'Single image',
        s: 'terjadwal', ch: ['li', 'ig', 'fb', 'th'],
        cap: 'Meetpal merekam, mentranskrip, dan merangkum rapat Anda — lengkap dengan daftar tindak lanjut. Data tetap di infrastruktur Anda.',
        stage: 'Terjadwal di Kalender'
      },
      {
        d: 15, date: '2026-10-15', t: '08.30',
        title: 'Responsible AI bukan slogan, melainkan proses',
        short: 'Responsible AI bukan slogan', type: 'Leadership Thought', fmt: 'Carousel',
        s: 'terjadwal', ch: ['li', 'x', 'md'],
        cap: 'Tiga pertanyaan yang selalu kami ajukan sebelum sebuah model masuk produksi.',
        stage: 'Terjadwal di Kalender'
      },
      {
        d: 20, date: '2026-10-20', t: '10.00',
        title: 'ThreatPal: pemantauan ancaman siber 24/7 untuk enterprise',
        short: 'ThreatPal: pantau ancaman 24/7', type: 'Promosi Produk', fmt: 'Single image',
        s: 'menunggu', ch: ['li', 'fb', 'x'],
        cap: 'Serangan tidak mengenal jam kantor. ThreatPal memantau dan memprioritaskan ancaman agar tim keamanan fokus pada yang penting.',
        stage: 'Tahap 4 · Validasi per platform'
      },
      {
        d: 22, date: '2026-10-22', t: '07.00',
        title: 'Selamat Hari Santri Nasional',
        short: 'Hari Santri Nasional', type: 'Konten Hari Besar', fmt: 'Quote card',
        s: 'terjadwal', ch: ['li', 'ig', 'fb', 'th', 'x'],
        cap: 'Selamat Hari Santri Nasional. Ilmu, adab, dan teknologi — tiga bekal generasi yang membangun negeri.',
        stage: 'Terjadwal di Kalender'
      },
      {
        d: 27, date: '2026-10-27', t: '08.30',
        title: 'Memimpin tim di era AI agent',
        short: 'Memimpin tim di era AI agent', type: 'Leadership Thought', fmt: 'Artikel',
        s: 'draft', ch: ['li', 'md'],
        cap: 'Draf tulisan panjang CEO tentang peran pemimpin ketika sebagian pekerjaan dijalankan AI agent.',
        stage: 'Tahap 3 · Konten master'
      },
      {
        d: 28, date: '2026-10-28', t: '07.00',
        title: 'Sumpah Pemuda: bersatu untuk kedaulatan digital',
        short: 'Sumpah Pemuda', type: 'Konten Hari Besar', fmt: 'Single image',
        s: 'menunggu', ch: ['li', 'ig', 'fb', 'th', 'x'],
        cap: 'Satu nusa, satu bangsa, satu bahasa — dan kini, satu tekad untuk berdaulat atas teknologi kita sendiri.',
        stage: 'Tahap 2 · Rencana mingguan'
      },
      {
        d: 30, date: '2026-10-30', t: '10.00',
        title: 'Recap campaign Meetpal Oktober',
        short: 'Recap Meetpal', type: 'Promosi Produk', fmt: 'Carousel',
        s: 'draft', ch: ['li', 'ig'],
        cap: 'Draf ringkasan campaign Meetpal bulan ini.',
        stage: 'Tahap 2 · Rencana'
      }
    ];

    for (const p of samplePosts) {
      await pool.query(`
        INSERT INTO scheduled_posts (
          day_of_month, scheduled_date, scheduled_time, title, short_title,
          content_type, format_badge, status, channels, caption, stage_label
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        p.d, p.date, p.t, p.title, p.short, p.type, p.fmt, p.s,
        JSON.stringify(p.ch), p.cap, p.stage
      ]);
    }
  }

  // Check Notifications & Preferences
  const notifCheck = await pool.query('SELECT COUNT(*) FROM notifications');
  if (parseInt(notifCheck.rows[0].count, 10) === 0) {
    console.log('[Database] 🌱 Seeding Notifications & Preferences...');
    const notifs = [
      {
        g: 'Hari ini', k: 'act', tags: ['act', 'ai'], time: '08.42',
        title: 'Rencana mingguan “Sumpah Pemuda 2026” siap ditinjau',
        body: 'AI Agent selesai menyusun rencana 2 minggu (6 postingan). Menunggu persetujuan Anda di Tahap 2.',
        cta: 'Tinjau rencana', href: '/campaign', unread: true
      },
      {
        g: 'Hari ini', k: 'act', tags: ['act', 'pub'], time: '08.10',
        title: 'ThreatPal: 3 versi platform menunggu validasi',
        body: 'LinkedIn, Facebook, dan X sudah disesuaikan. Validasi lalu beri otorisasi jadwal atau publikasi instan.',
        cta: 'Validasi', href: '/campaign', unread: true
      },
      {
        g: 'Hari ini', k: 'err', tags: ['act', 'pub'], time: '07.55',
        title: 'Gagal terbit ke X: token akses kedaluwarsa',
        body: '“Kami membuka posisi AI Engineer” tidak terbit di X. Hubungkan ulang akun, lalu AI akan mencoba lagi otomatis.',
        cta: 'Hubungkan ulang X', href: '/channels', unread: true
      },
      {
        g: 'Hari ini', k: 'ai', tags: ['ai'], time: '07.00',
        title: 'Memori AI diperbarui dengan 3 pembelajaran baru',
        body: 'Dari 9 postingan bulan ini: carousel LinkedIn dan slot pagi 07.00–08.30 WIB berperforma paling baik.',
        cta: 'Lihat insight', href: '/analytics', unread: true
      },
      {
        g: 'Kemarin', k: 'pub', tags: ['pub'], time: '19.05',
        title: '“Catatan CEO: belajar dari pilot Meetpal” terbit',
        body: 'Publikasi instan ke LinkedIn dan Medium berhasil.',
        cta: '', href: '', unread: false
      },
      {
        g: 'Kemarin', k: 'ai', tags: ['ai'], time: '16.20',
        title: 'Konten master “Memimpin tim di era AI agent” disimpan sebagai draft',
        body: 'Anda menyimpan di Tahap 3. Lanjutkan kapan saja dari Konten & Draft.',
        cta: 'Lanjutkan', href: '/drafts', unread: false
      },
      {
        g: 'Kemarin', k: 'sys', tags: ['sys'], time: '10.00',
        title: 'Pengingat: “Meetpal: notulen otomatis” terbit Selasa 10.00',
        body: 'Empat platform terjadwal. Ubah atau batalkan dari Planner sebelum waktunya.',
        cta: 'Buka Planner', href: '/planner', unread: false
      },
      {
        g: 'Minggu ini', k: 'pub', tags: ['pub'], time: 'Jum, 2 Okt',
        title: '“Selamat Hari Batik Nasional” terbit instan ke 4 platform',
        body: 'LinkedIn, Instagram, Facebook, dan Threads.',
        cta: '', href: '', unread: false
      },
      {
        g: 'Minggu ini', k: 'sys', tags: ['sys'], time: 'Kam, 1 Okt',
        title: 'Brand Voice “Corporate Brand” diperbarui',
        body: 'Kata wajib “Sovereignty” ditambahkan. AI memakai versi terbaru untuk konten berikutnya.',
        cta: 'Lihat Brand Voice', href: '/brand-voice', unread: false
      }
    ];

    for (const n of notifs) {
      await pool.query(`
        INSERT INTO notifications (
          group_label, category_key, category_tags, time_str, title, body, cta_label, cta_href, is_unread
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [n.g, n.k, JSON.stringify(n.tags), n.time, n.title, n.body, n.cta, n.href, n.unread]);
    }

    const prefDefs = [
      { k: 'act', l: 'Perlu persetujuan', email: true, tg: true },
      { k: 'ai', l: 'AI selesai bekerja', email: false, tg: true },
      { k: 'pub', l: 'Status publikasi', email: true, tg: false },
      { k: 'sys', l: 'Pengingat & sistem', email: true, tg: false }
    ];
    for (const p of prefDefs) {
      await pool.query(`
        INSERT INTO notification_preferences (category_key, label, send_email, send_telegram)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (category_key) DO NOTHING
      `, [p.k, p.l, p.email, p.tg]);
    }
  }

  // Check AI Memory Insights & Recommendations (Tahap 5)
  const memCheck = await pool.query('SELECT COUNT(*) FROM ai_memory_insights');
  if (parseInt(memCheck.rows[0].count, 10) === 0) {
    console.log('[Database] 🌱 Seeding AI Memory insights & recommendations...');
    const memories = [
      {
        t: 'Carousel LinkedIn menghasilkan engagement tertinggi',
        e: 'Rata-rata 2,1× likes dibanding single image · 4 postingan',
        d: '+34% engagement', st: 'STAGE_2'
      },
      {
        t: 'Slot pagi 07.00–08.30 WIB paling banyak dilihat',
        e: 'Berlaku di LinkedIn dan Instagram · 9 postingan',
        d: '+18% views', st: 'STAGE_2'
      },
      {
        t: 'Caption dibuka dengan pertanyaan lebih sering dibagikan',
        e: 'Shares naik pada 3 dari 4 postingan berpola ini',
        d: '+24% shares', st: 'STAGE_1'
      }
    ];
    for (const m of memories) {
      await pool.query(`
        INSERT INTO ai_memory_insights (title, evidence, impact_delta, target_stage)
        VALUES ($1, $2, $3, $4)
      `, [m.t, m.e, m.d, m.st]);
    }

    const recs = [
      { st: 'Tahap 2 · Rencana', t: 'Jadwalkan postingan LinkedIn dan Instagram pada 07.00–08.30 WIB.', app: true },
      { st: 'Tahap 2 · Rencana', t: 'Jadikan carousel sebagai format utama di LinkedIn untuk Leadership Thought.', app: false },
      { st: 'Tahap 1 · Strategi', t: 'Buka caption dengan pertanyaan yang relevan dengan persona untuk mendorong shares.', app: false }
    ];
    for (const r of recs) {
      await pool.query(`
        INSERT INTO ai_recommendations (target_stage, recommendation_text, is_applied)
        VALUES ($1, $2, $3)
      `, [r.st, r.t, r.app]);
    }
  }

  // Check Post Performance Metrics (Closed-Loop Analytics Real Data)
  const metricCheck = await pool.query('SELECT COUNT(*) FROM post_performance_metrics');
  if (parseInt(metricCheck.rows[0].count, 10) === 0) {
    console.log('[Database] 🌱 Seeding Post Performance Metrics for Closed-Loop Analytics...');
    const postsRes = await pool.query('SELECT id, channels, status FROM scheduled_posts');
    for (const row of postsRes.rows) {
      if (row.status === 'terbit' || row.status === 'terjadwal') {
        const chs: string[] = Array.isArray(row.channels) ? row.channels : JSON.parse(row.channels || '["li"]');
        const baseSeed = Number(row.id) * 137;
        for (let i = 0; i < chs.length; i++) {
          const ch = chs[i];
          const mult = ch === 'li' ? 1.8 : ch === 'ig' ? 1.4 : ch === 'x' ? 1.1 : 0.9;
          const views = Math.round(((baseSeed % 900) + 1200 + i * 310) * mult);
          const likes = Math.round(views * 0.048);
          const shares = Math.round(views * 0.009);
          await pool.query(`
            INSERT INTO post_performance_metrics (post_id, channel_key, views_count, likes_count, shares_count)
            VALUES ($1, $2, $3, $4, $5)
          `, [row.id, ch, views, likes, shares]);
        }
      }
    }
  }
}
