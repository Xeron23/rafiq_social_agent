import { v4 as uuidv4 } from 'uuid';
import {
  ChatSessionRecord,
  ChatSessionState,
  ChatIntentType,
  ChatMessageResponse,
  ChatWidgetPayload
} from '../domain/chatOrchestrator.js';
import { TenancyManager } from './tenancyService.js';
import { CampaignStrategyService } from './campaignStrategyService.js';
import { ContentPlanService } from './contentPlanService.js';
import { CanonicalContentEngine } from './canonicalContentService.js';
import { MultiPlatformAdapterEngine } from '../adapters/multiPlatformAdapters.js';
import { PublishingSchedulerService, ClosedLoopAnalyticsService } from './publishingAndAnalyticsService.js';
import { SocialPlatformType } from '../domain/tenancy.js';

export class ChatOrchestratorService {
  private sessions: Map<string, ChatSessionRecord> = new Map();

  constructor(
    private tenancyManager: TenancyManager,
    private campaignStrategyService: CampaignStrategyService,
    private contentPlanService: ContentPlanService,
    private canonicalContentEngine: CanonicalContentEngine,
    private multiPlatformAdapterEngine: MultiPlatformAdapterEngine,
    private publishingSchedulerService: PublishingSchedulerService,
    private closedLoopAnalyticsService: ClosedLoopAnalyticsService
  ) {}

  public createSession(sessionId?: string): ChatSessionRecord {
    const id = sessionId || uuidv4();
    const session: ChatSessionRecord = {
      sessionId: id,
      state: 'UNINITIALIZED',
      history: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessions.set(id, session);
    return session;
  }

  public getSession(sessionId: string): ChatSessionRecord | undefined {
    return this.sessions.get(sessionId);
  }

  public async handleUserMessage(sessionId: string, userMessage: string): Promise<ChatMessageResponse> {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = this.createSession(sessionId);
    }

    session.history.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    const intent = this.classifyIntent(userMessage, session);
    let textResponse = '';
    let widget: ChatWidgetPayload = { type: 'NONE' };

    switch (intent) {
      case 'SETUP_CONTEXT': {
        const companyName = this.extractCompanyName(userMessage) || 'PT Bank Rakyat Indonesia (BRI)';
        const company = this.tenancyManager.createCompany(companyName, {
          tone: ['trustworthy', 'inclusive', 'modern', 'educational'],
          primaryKeywords: ['fintech', 'qris', 'umkm', 'brimo', 'keuangan digital'],
          negativeKeywords: ['judi', 'investasi bodong', 'pinjol ilegal'],
          targetAudienceSummary: 'UMKM Indonesia dan generasi digital-savvy yang membutuhkan layanan perbankan cepat dan aman.',
          guidelines: 'Wajib mematuhi regulasi perbankan OJK & BI. Jangan pernah meminta PIN/OTP.',
        });

        const project = this.tenancyManager.createProject(
          company.id,
          'BRImo Ecosystem & UMKM Empowerment',
          'Pelaku usaha kecil-menengah dan nasabah ritel perbankan digital.',
          ['Thought Leadership', 'Product Feature Demo', 'Fraud Education', 'Customer Success Story']
        );

        const app = this.tenancyManager.createApplication(
          project.id,
          company.id,
          'Social Engine Production',
          ['x', 'linkedin', 'instagram', 'medium']
        );

        session.scope = {
          companyId: company.id,
          projectId: project.id,
          applicationId: app.id,
        };
        session.state = 'CONTEXT_LOCKED';

        textResponse = `✅ **Konteks Perusahaan Berhasil Dikunci (Context Locked)**\n\n` +
          `• **Entity:** ${company.name}\n` +
          `• **Project:** ${project.name}\n` +
          `• **Brand Voice:** ${company.brandVoice.tone.join(', ')}\n` +
          `• **Pilar Utama:** ${project.contentPillars.join(', ')}\n` +
          `• **Compliance:** Regulasi Perbankan OJK & BI (Anti-Fraud & Privacy Protected)\n` +
          `• **Connected Platforms:** X (Twitter), LinkedIn, Instagram, Medium\n\n` +
          `*Status saat ini: Siap untuk konsultasi strategi pasar atau merumuskan kampanye publikasi.*`;

        widget = {
          type: 'CONTEXT_CARD',
          data: {
            company,
            project,
            application: app,
          }
        };
        break;
      }

      case 'ADVISORY_QUERY': {
        let company = session.scope ? this.tenancyManager.getCompany(session.scope.companyId) : undefined;
        let project = session.scope ? this.tenancyManager.getProject(session.scope.projectId) : undefined;

        if (!project) {
          project = {
            id: 'temp-proj',
            companyId: 'temp-comp',
            name: 'Fintech & Digital Banking UMKM',
            slug: 'fintech-umkm',
            icpDescription: 'UMKM Indonesia dan nasabah digital',
            contentPillars: ['QRIS Merchant', 'Anti-Phishing', 'Cashless Economy'],
            defaultGoals: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }

        const report = await this.campaignStrategyService.conductTrendResearch(project, project.contentPillars);

        textResponse = `📊 **Hasil Riset Pasar & Tren Terkini (Advisory Mode - No Queue Side-Effect)**\n\n` +
          `Berdasarkan penelusuran tren sosial dan industri untuk perbankan digital UMKM:\n\n` +
          report.trends.map((t, idx) => `${idx + 1}. **${t.topic}** (Relevance: ${(t.relevanceScore * 10).toFixed(0)}/10)\n   _${t.summary}_\n   *Keywords:* ${t.keywords.join(', ')}`).join('\n\n') +
          `\n\n*Catatan: Mode ini murni konsultasi strategis. Belum ada antrean postingan yang dibuat ke media sosial.*`;

        widget = {
          type: 'NONE',
          data: { report }
        };
        break;
      }

      case 'TRIGGER_CAMPAIGN_PLAN': {
        if (!session.scope) {
          // Auto-fallback context setup if not locked yet
          const fallbackCompany = this.tenancyManager.createCompany('PT Bank Rakyat Indonesia (BRI)', {
            tone: ['trustworthy', 'inclusive', 'modern'],
            targetAudienceSummary: 'UMKM dan digital banking users.',
          });
          const fallbackProj = this.tenancyManager.createProject(
            fallbackCompany.id,
            'BRImo UMKM',
            'Digital users',
            ['Thought Leadership', 'Product Demo', 'Security Education']
          );
          const fallbackApp = this.tenancyManager.createApplication(
            fallbackProj.id,
            fallbackCompany.id,
            'App Engine',
            ['x', 'linkedin', 'instagram', 'medium']
          );
          session.scope = {
            companyId: fallbackCompany.id,
            projectId: fallbackProj.id,
            applicationId: fallbackApp.id,
          };
        }

        const company = this.tenancyManager.getCompany(session.scope.companyId)!;
        const project = this.tenancyManager.getProject(session.scope.projectId)!;
        const application = this.tenancyManager.getApplication(session.scope.applicationId)!;

        const brief = await this.campaignStrategyService.formulateCampaignBrief(
          { company, project, application },
          userMessage
        );
        session.currentBrief = brief;

        const matrix = await this.contentPlanService.generateMatrix(
          brief,
          application,
          5
        );
        session.currentMatrix = matrix;
        session.state = 'PLANNING_MATRIX_READY';

        textResponse = `📋 **Content Plan Matrix Berhasil Dibuat (Macro-HITL Gate)**\n\n` +
          `Berikut rancangan jadwal dan topik konten kampanye **"${brief.title}"**:\n\n` +
          matrix.items.map((item, i) => `${i + 1}. **[${item.scheduledDate}] ${item.topicTitle}**\n   • Pilar: \`${item.contentPillar}\` | Channel: ${(item.targetPlatforms || []).join(', ')}\n   • Hook: _"${item.hookAngle}"_`).join('\n\n') +
          `\n\n🛑 **Macro Human-In-The-Loop Approval:**\n` +
          `Klik tombol **[Approve Matrix]** untuk menjadwalkan semua, atau balas chat ini jika ingin mengubah baris tertentu.`;

        widget = {
          type: 'CONTENT_PLAN_MATRIX',
          data: matrix,
        };
        break;
      }

      case 'TWEAK_CONTENT_PLAN': {
        if (!session.currentMatrix || session.currentMatrix.items.length === 0) {
          textResponse = 'Belum ada Content Plan Matrix yang aktif untuk disesuaikan. Silakan minta pembuatan campaign terlebih dahulu.';
          break;
        }

        // Apply mutation to item 2 / target item sequence
        const targetItem = session.currentMatrix.items[1] || session.currentMatrix.items[0];
        const updatedItem = await this.contentPlanService.mutateMatrixItem(
          session.currentMatrix.id,
          targetItem.sequenceNumber,
          userMessage
        );
        
        // Refresh updated matrix from service
        const updatedMatrix = this.contentPlanService.getMatrix(session.currentMatrix.id) || session.currentMatrix;
        session.currentMatrix = updatedMatrix;

        textResponse = `✏️ **Content Plan Matrix Diperbarui**\n\n` +
          `Topik pada item sequence #${targetItem.sequenceNumber} telah disesuaikan:\n` +
          `• **Topik Baru:** ${updatedItem.topicTitle}\n` +
          `• **Hook Baru:** _"${updatedItem.hookAngle}"_\n\n` +
          `Silakan tinjau kembali atau konfirmasi **[Approve Matrix]**.`;

        widget = {
          type: 'CONTENT_PLAN_MATRIX',
          data: updatedMatrix,
        };
        break;
      }

      case 'APPROVE_MACRO_PLAN': {
        if (!session.currentMatrix) {
          textResponse = 'Tidak ada Content Plan Matrix yang siap di-approve.';
          break;
        }

        const approvedMatrix = this.contentPlanService.updateMatrixApprovalStatus(
          session.currentMatrix.id,
          'approved'
        );
        session.currentMatrix = approvedMatrix;

        const company = this.tenancyManager.getCompany(session.scope!.companyId)!;
        const project = this.tenancyManager.getProject(session.scope!.projectId)!;

        // Autonomous Execution in Parallel: Canonical Synthesis + Platform Adapters + Cloud Queue
        const queuedJobs = [];
        const promises = approvedMatrix.items.map(async (item) => {
          const canonical = await this.canonicalContentEngine.synthesize(
            company,
            project,
            item
          );

          const platformPosts = await this.multiPlatformAdapterEngine.compileAll(
            canonical,
            item.targetPlatforms as SocialPlatformType[]
          );

          return this.publishingSchedulerService.enqueueCompiledPosts(
            session.scope!.applicationId,
            item.id,
            platformPosts,
            new Date(item.scheduledDate)
          );
        });

        const jobBatches = await Promise.all(promises);
        for (const batch of jobBatches) {
          queuedJobs.push(...batch);
        }

        session.state = 'CAMPAIGN_SCHEDULED_ACTIVE';

        textResponse = `🚀 **Macro Approval Sukses! Seluruh Postingan Terjadwal di Cloud**\n\n` +
          `Sistem telah mengeksekusi secara otonom:\n` +
          `1. **Canonical Engine:** Sintesis ${approvedMatrix.items.length} master content tanpa constraint bleed.\n` +
          `2. **Platform Adapters:** Mengonversi deterministik ke format X (Twitter ≤280 chars), LinkedIn, Instagram Carousel, & Medium.\n` +
          `3. **24/7 Cloud Queue:** ${queuedJobs.length} posting batch telah aktif dalam antrean cloud scheduler.\n\n` +
          `*Anda tidak perlu membiarkan perangkat tetap menyala. Background cloud engine akan mengeksekusi postingan sesuai jadwal.*`;

        widget = {
          type: 'QUEUE_CONFIRMATION',
          data: {
            queuedCount: queuedJobs.length,
            jobs: queuedJobs,
          }
        };
        break;
      }

      case 'FETCH_ANALYTICS': {
        const mockMetrics = [
          {
            jobId: 'j1',
            platform: 'linkedin' as const,
            impressions: 12500,
            engagements: 840,
            clicks: 340,
            engagementRate: 0.0672,
            topFeedbackTheme: 'Pujian atas edukasi anti-phishing yang aplikatif',
          },
          {
            jobId: 'j2',
            platform: 'x' as const,
            impressions: 8900,
            engagements: 420,
            clicks: 180,
            engagementRate: 0.0471,
            topFeedbackTheme: 'Tanya jawab seputar kecepatan pencairan settlement QRIS',
          }
        ];

        const feedback = await this.closedLoopAnalyticsService.generateClosedLoopFeedback(
          mockMetrics,
          session.currentBrief?.title || 'BRImo QRIS Campaign'
        );

        textResponse = `📈 **Closed-Loop Analytics & Proactive Evolution Report**\n\n` +
          `• **Executive Summary:** ${feedback.overallSummary}\n` +
          `• **Highest Performing Pillars:** \`${feedback.highestPerformingPillars.join(', ')}\`\n` +
          `• **Lowest Performing Pillars:** \`${feedback.lowestPerformingPillars.join(', ')}\`\n\n` +
          `💡 **Saran Proaktif untuk Kampanye Berikutnya:**\n` +
          feedback.proactiveActionableAdvice.map((advice: string, idx: number) => `${idx + 1}. ${advice}`).join('\n') +
          `\n\n📌 **Rekomendasi Topik Selanjutnya:**\n` +
          feedback.recommendedNextCampaignTopics.map((top: string, idx: number) => `• ${top}`).join('\n');

        widget = {
          type: 'ANALYTICS_DASHBOARD',
          data: feedback,
        };
        break;
      }

      default: {
        textResponse = `Halo! Saya adalah AI Autonomous Social Media Agent Anda. Konteks saat ini: **${session.state}**.\n\n` +
          `Anda dapat:\n` +
          `1. Melakukan setup konteks brand/perusahaan.\n` +
          `2. Bertanya riset dan tren industri (Advisory / Chat Biasa).\n` +
          `3. Meminta pembuatan kampanye konten baru (Macro-HITL Flow).\n` +
          `4. Memeriksa performa analitik postingan terkini.`;
        break;
      }
    }

    session.history.push({
      role: 'assistant',
      content: textResponse,
      timestamp: new Date(),
    });

    session.updatedAt = new Date();

    return {
      sessionId: session.sessionId,
      currentState: session.state,
      detectedIntent: intent,
      textResponse,
      widget,
      scope: session.scope,
      timestamp: new Date(),
    };
  }

  private classifyIntent(message: string, session: ChatSessionRecord): ChatIntentType {
    const lower = message.toLowerCase();

    if (lower.includes('hire') || lower.includes('perusahaan') || lower.includes('company') || lower.includes('konteks bri') || lower.includes('bank bri') || lower.includes('fokus untuk')) {
      return 'SETUP_CONTEXT';
    }

    if (lower.includes('approve') || lower.includes('setujui') || lower.includes('gas jadwalkan') || lower.includes('jadwalkan semua')) {
      return 'APPROVE_MACRO_PLAN';
    }

    if (lower.includes('ubah') || lower.includes('ganti topik') || lower.includes('tambahkan angle') || lower.includes('revisi')) {
      return 'TWEAK_CONTENT_PLAN';
    }

    if (lower.includes('campaign') || lower.includes('kampanye') || lower.includes('buatkan rencana') || lower.includes('jadwal 1 minggu') || lower.includes('buat konten')) {
      return 'TRIGGER_CAMPAIGN_PLAN';
    }

    if (lower.includes('analitik') || lower.includes('analytics') || lower.includes('metrik') || lower.includes('performa')) {
      return 'FETCH_ANALYTICS';
    }

    if (lower.includes('tren') || lower.includes('trend') || lower.includes('riset') || lower.includes('isu apa') || lower.includes('bagaimana sentimen')) {
      return 'ADVISORY_QUERY';
    }

    return 'GENERAL_CHAT';
  }

  private extractCompanyName(text: string): string | null {
    if (text.toLowerCase().includes('bri') || text.toLowerCase().includes('bank rakyat indonesia')) {
      return 'PT Bank Rakyat Indonesia (BRI)';
    }
    return null;
  }
}
