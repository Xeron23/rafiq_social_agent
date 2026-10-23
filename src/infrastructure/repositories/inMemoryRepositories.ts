import { CampaignAggregate } from '../../domain/campaign/campaign.aggregate.js';
import { ICampaignRepository } from '../../domain/campaign/campaign.repository.js';
import { PostAggregate, IPostRepository, PostItemDTO } from '../../domain/planner/post.aggregate.js';
import { AIMemoryAggregate, IMemoryRepository } from '../../domain/analytics/memory.aggregate.js';
import { BrandVoiceProfileVO } from '../../domain/campaign/campaign.types.js';

export class InMemoryCampaignRepository implements ICampaignRepository {
  private campaigns: Map<string, CampaignAggregate> = new Map();

  async save(campaign: CampaignAggregate): Promise<void> {
    this.campaigns.set(campaign.id, campaign);
  }

  async findById(id: string): Promise<CampaignAggregate | null> {
    return this.campaigns.get(id) || null;
  }

  async findAll(): Promise<CampaignAggregate[]> {
    return Array.from(this.campaigns.values());
  }

  async delete(id: string): Promise<boolean> {
    return this.campaigns.delete(id);
  }
}

export class InMemoryPostRepository implements IPostRepository {
  private posts: Map<number, PostAggregate> = new Map();

  constructor() {
    this.seedInitial();
  }

  private seedInitial() {
    const seeds: PostItemDTO[] = [
      { id: 1, d: 1, t: '09.00', title: 'Hari Kesaktian Pancasila: nilai yang kami pegang dalam membangun AI', short: 'Hari Kesaktian Pancasila', type: 'Konten Hari Besar', s: 'terbit', ch: ['li','ig','fb'], cap: 'Selamat Hari Kesaktian Pancasila. Bagi kami, membangun AI berarti membangun teknologi yang adil, berdaulat, dan berpihak pada bangsa.', when: 'Rab, 1 Okt · 09.00' },
      { id: 2, d: 6, t: '08.30', title: 'Kedaulatan AI dimulai dari data yang kita kelola sendiri', short: 'Kedaulatan AI dimulai dari data', type: 'Leadership Thought', s: 'terbit', ch: ['li','x','th','md'], cap: 'Sovereignty bukan jargon. Ia dimulai dari keputusan sederhana: di mana data organisasi Anda disimpan, dan siapa yang memegang kendalinya.', when: 'Sen, 6 Okt · 08.30' },
      { id: 3, d: 8, t: '11.00', title: 'Teaser: rapat yang terdokumentasi tanpa mencatat manual', short: 'Teaser Meetpal', type: 'Promosi Produk', s: 'terbit', ch: ['li','ig','fb'], cap: 'Berapa jam tim Anda habiskan untuk menulis notulen? Sesuatu yang baru akan hadir minggu depan.', when: 'Rab, 8 Okt · 11.00' },
      { id: 4, d: 13, t: '10.00', title: 'Meetpal: notulen otomatis dalam hitungan menit', short: 'Meetpal: notulen otomatis', type: 'Promosi Produk', s: 'terjadwal', ch: ['li','ig','fb','th'], cap: 'Meetpal merekam, mentranskrip, dan merangkum rapat Anda — lengkap dengan daftar tindak lanjut. Data tetap di infrastruktur Anda.', when: 'Sen, 13 Okt · 10.00' },
      { id: 5, d: 15, t: '08.30', title: 'Responsible AI bukan slogan, melainkan proses', short: 'Responsible AI bukan slogan', type: 'Leadership Thought', s: 'terjadwal', ch: ['li','x','md'], cap: 'Tiga pertanyaan yang selalu kami ajukan sebelum sebuah model masuk produksi.', when: 'Rab, 15 Okt · 08.30' },
      { id: 6, d: 20, t: '10.00', title: 'ThreatPal: pemantauan ancaman siber 24/7 untuk enterprise', short: 'ThreatPal: pantau ancaman 24/7', type: 'Promosi Produk', s: 'menunggu', ch: ['li','fb','x'], cap: 'Serangan tidak mengenal jam kantor. ThreatPal memantau dan memprioritaskan ancaman agar tim keamanan fokus pada yang penting.', stage: 'Tahap 4 · Validasi per platform', when: 'Sen, 20 Okt · 10.00' },
      { id: 7, d: 22, t: '07.00', title: 'Selamat Hari Santri Nasional', short: 'Hari Santri Nasional', type: 'Konten Hari Besar', s: 'terjadwal', ch: ['li','ig','fb','th','x'], cap: 'Selamat Hari Santri Nasional. Ilmu, adab, dan teknologi — tiga bekal generasi yang membangun negeri.', when: 'Rab, 22 Okt · 07.00' },
      { id: 8, d: 27, t: '08.30', title: 'Memimpin tim di era AI agent', short: 'Memimpin tim di era AI agent', type: 'Leadership Thought', s: 'draft', ch: ['li','md'], cap: 'Draf tulisan panjang CEO tentang peran pemimpin ketika sebagian pekerjaan dijalankan AI agent.', when: 'Sen, 27 Okt · 08.30' },
      { id: 9, d: 28, t: '07.00', title: 'Sumpah Pemuda: bersatu untuk kedaulatan digital', short: 'Sumpah Pemuda', type: 'Konten Hari Besar', s: 'menunggu', ch: ['li','ig','fb','th','x'], cap: 'Satu nusa, satu bangsa, satu bahasa — dan kini, satu tekad untuk berdaulat atas teknologi kita sendiri.', stage: 'Tahap 2 · Rencana mingguan', when: 'Rab, 28 Okt · 07.00' }
    ];

    seeds.forEach(s => {
      this.posts.set(
        s.id,
        new PostAggregate(
          s.id,
          s.d,
          s.t,
          s.title,
          s.short,
          s.type,
          s.s,
          s.ch,
          s.cap,
          s.stage,
          s.when,
          s.campaign
        )
      );
    });
  }

  async save(post: PostAggregate): Promise<void> {
    this.posts.set(post.id, post);
  }

  async saveBatch(posts: PostAggregate[]): Promise<void> {
    for (const p of posts) {
      this.posts.set(p.id, p);
    }
  }

  async findById(id: number): Promise<PostAggregate | null> {
    return this.posts.get(id) || null;
  }

  async findAll(): Promise<PostAggregate[]> {
    return Array.from(this.posts.values()).sort((a, b) => a.id - b.id);
  }
}

export class InMemoryMemoryRepository implements IMemoryRepository {
  private memories: AIMemoryAggregate[] = [];

  constructor() {
    this.seedInitial();
  }

  private seedInitial() {
    this.memories = [
      new AIMemoryAggregate(
        'mem-1',
        'Performa Carousel Teknis',
        'Format carousel pada topik "Kedaulatan Data" menghasilkan rasio simpan (saves) 2.4x lebih tinggi dibanding single image.',
        'Rekomendasi format otomatis diubah ke Carousel untuk topik arsitektur & kepemimpinan.',
        'STAGE_2'
      ),
      new AIMemoryAggregate(
        'mem-2',
        'Waktu Distribusi Optimal (WIB)',
        'Jendela penerbitan pukul 08.30 WIB di LinkedIn dan 10.00 WIB di Instagram mencatat engagement velocity tercepat dalam 2 jam pertama.',
        'Algoritma penjadwalan otomatis mengunci slot waktu ini sebagai prioritas tinggi.',
        'STAGE_2'
      ),
      new AIMemoryAggregate(
        'mem-3',
        'Lead Time Konten Hari Besar',
        'Campaign momen nasional membutuhkan persiapan minimal 7 hari sebelum hari-H untuk memaksimalkan penumpukan impresi awal.',
        'AI akan menyalakan pengingat otomatis H-10 sebelum tanggal peringatan.',
        'STAGE_1'
      )
    ];
  }

  async save(memory: AIMemoryAggregate): Promise<void> {
    this.memories.push(memory);
  }

  async findAll(): Promise<AIMemoryAggregate[]> {
    return this.memories;
  }

  async findByStage(stage: 'STAGE_1' | 'STAGE_2'): Promise<AIMemoryAggregate[]> {
    return this.memories.filter(m => m.targetStage === stage);
  }
}

// Brand Voice In-Memory Store
export class InMemoryBrandVoiceStore {
  private profile: BrandVoiceProfileVO = {
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
    guidelines: 'Gunakan tone optimis, visioner, dan berbasis kedaulatan bangsa. Jangan gunakan jargon kosong.'
  };

  getProfile(): BrandVoiceProfileVO {
    return { ...this.profile };
  }

  updateProfile(profile: Partial<BrandVoiceProfileVO>): BrandVoiceProfileVO {
    this.profile = { ...this.profile, ...profile };
    return { ...this.profile };
  }
}
