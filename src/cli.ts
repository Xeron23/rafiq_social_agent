import chalk from 'chalk';
import ora from 'ora';
import { input, select, confirm } from '@inquirer/prompts';
import { TenancyManager } from './services/tenancyService.js';
import { CampaignStrategyService } from './services/campaignStrategyService.js';
import { ContentPlanService } from './services/contentPlanService.js';
import { CanonicalContentEngine } from './services/canonicalContentService.js';
import { MultiPlatformAdapterEngine } from './adapters/multiPlatformAdapters.js';
import {
  PublishingSchedulerService,
  ClosedLoopAnalyticsService,
} from './services/publishingAndAnalyticsService.js';
import { Company, Project, Application, TenantContextScope } from './domain/tenancy.js';
import { ContentPlanItem } from './domain/contentPlan.js';
import { PostPerformanceMetric } from './domain/publishingAndAnalytics.js';

// Setup Mock Initial Workspace Context
const tenancy = new TenancyManager();
const campaignService = new CampaignStrategyService();
const planService = new ContentPlanService();
const canonicalEngine = new CanonicalContentEngine();
const adapterEngine = new MultiPlatformAdapterEngine();
const scheduler = new PublishingSchedulerService();
const analytics = new ClosedLoopAnalyticsService();

const company: Company = {
  id: 'a0000000-0000-0000-0000-000000000001',
  name: 'SaaS Alpha Corp',
  slug: 'saas-alpha',
  brandVoice: {
    tone: ['Authoritative', 'Engineering-First', 'Pragmatic'],
    primaryKeywords: ['Cloud', 'Kubernetes', 'SRE', 'FinOps'],
    negativeKeywords: ['cheap', 'hacky', 'quick-fix'],
    targetAudienceSummary: 'CTOs, Platform Leads, and VP of Engineering',
    guidelines: 'Prioritize data-driven arguments, architecture clarity, and zero-downtime best practices.',
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const project: Project = {
  id: 'c0000000-0000-0000-0000-000000000001',
  companyId: company.id,
  name: 'Multi-Cloud Resilience Suite',
  slug: 'resilience-suite',
  icpDescription: 'Enterprise Tech Leads & SREs scaling high-throughput distributed systems',
  contentPillars: ['Disaster Recovery', 'Zero-Downtime Deployment', 'Cluster Cost Optimization'],
  defaultGoals: ['Establish technical thought leadership', 'Drive enterprise demo signups'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const application: Application = {
  id: 'd0000000-0000-0000-0000-000000000001',
  projectId: project.id,
  companyId: company.id,
  name: 'Rafiq Cloud Social Engine',
  connectedPlatforms: ['x', 'linkedin', 'instagram', 'medium'],
  activeCampaignCount: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

tenancy.registerCompany(company);
tenancy.registerProject(project);
tenancy.registerApplication(application);

const scope: TenantContextScope = {
  companyId: company.id,
  projectId: project.id,
  applicationId: application.id,
};

function banner() {
  console.clear();
  console.log(chalk.bold.cyan('╔══════════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║            🚀 RAFIQ WORKER - CLOUD SOCIAL MEDIA AGENT CLI                ║'));
  console.log(chalk.bold.cyan('║          Interactive End-to-End Campaign & Autonomous Execution          ║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════════════════════════╝'));
  console.log(chalk.gray(`\n🏢 Context: [Company: ${company.name}] ➔ [Project: ${project.name}] ➔ [App: ${application.name}]\n`));
}

async function main() {
  banner();

  // STEP 1: CAMPAIGN INTENT
  console.log(chalk.bold.yellow('📌 TAHAP 1: FORMULASI STRATEGI & RISET PASAR'));
  const userIntent = await input({
    message: 'Jelaskan tujuan / topik kampanye yang ingin kamu buat:',
    default: 'Launch strategi Disaster Recovery & pencegahan global DNS outage untuk CTO',
  });

  const spinner1 = ora('Agen sedang melakukan riset tren industri & menyusun Campaign Brief...').start();
  const research = await campaignService.conductTrendResearch(project, project.contentPillars);
  const brief = await campaignService.formulateCampaignBrief({ company, project, application }, userIntent, research);
  spinner1.succeed(chalk.green('Campaign Brief & Riset Tren Berhasil Disintesis!'));

  console.log(chalk.white('\n📋 ' + chalk.bold('Campaign Summary:')));
  console.log(chalk.cyan(`   • Title   : `) + brief.title);
  console.log(chalk.cyan(`   • Target  : `) + brief.targetAudience);
  console.log(chalk.cyan(`   • Pillars : `) + brief.selectedPillars.join(', '));
  console.log(chalk.cyan(`   • Key Trend Insight: `) + (research.keyInsights[0] || '-'));
  console.log('');

  // STEP 2: CONTENT PLAN MATRIX
  console.log(chalk.bold.yellow('📌 TAHAP 2: GENERASI CONTENT PLAN MATRIX'));
  const itemCountInput = await input({
    message: 'Berapa jumlah batch topik konten yang ingin dibuat dalam matriks (1-5)?',
    default: '3',
  });
  const itemCount = parseInt(itemCountInput, 10) || 3;

  const spinner2 = ora(`Menghasilkan ${itemCount} jadwal topik konten dalam Content Plan Matrix...`).start();
  const matrix = await planService.generateMatrix(brief, application, itemCount);
  spinner2.succeed(chalk.green('Content Plan Matrix Berhasil Dibuat!'));

  function displayMatrixTable() {
    console.log('\n' + chalk.bold.underline('MATRIKS PERENCANAAN KONTEN (Batch Plan Grid):'));
    matrix.items.forEach((item: ContentPlanItem) => {
      console.log(
        chalk.blue(`[#${item.sequenceNumber}] `) +
        chalk.yellow(`[${item.scheduledDate}] `) +
        chalk.green(`[${item.contentPillar}] `) +
        chalk.white.bold(item.topicTitle)
      );
      console.log(chalk.gray(`     Hook Angle : "${item.hookAngle}"`));
      console.log(chalk.gray(`     Platforms  : ${item.targetPlatforms.join(', ')} | Status: ${chalk.bold(item.status)}`));
      console.log('');
    });
  }

  displayMatrixTable();

  // STEP 3: MACRO-HITL APPROVAL GATE
  console.log(chalk.bold.yellow('📌 TAHAP 3: MACRO HUMAN-IN-THE-LOOP (HITL) APPROVAL GATE'));
  let isApproved = false;

  while (!isApproved) {
    const action = await select({
      message: 'Pilih aksi untuk Matriks Perencanaan:',
      choices: [
        { name: '✅ 1-Click Approve All (Setujui semua topik & langsung eksekusi agen)', value: 'approve' },
        { name: '✏️  Mutasi/Ubah salah satu topik via instruksi chat', value: 'mutate' },
        { name: '❌ Tolak / Minta revisi menyeluruh', value: 'reject' },
      ],
    });

    if (action === 'approve') {
      planService.updateMatrixApprovalStatus(matrix.id, 'approved');
      isApproved = true;
      console.log(chalk.green.bold('\n✔ Matriks DISETUJUI! Agen AI mengambil alih untuk eksekusi konten secara otonom.\n'));
    } else if (action === 'mutate') {
      const seqStr = await input({ message: 'Masukkan nomor sequence (#) topik yang mau diubah:' });
      const seq = parseInt(seqStr, 10);
      const instruction = await input({ message: 'Masukkan instruksi perubahan (misal: "ganti sudut pandang ke FinOps"): ' });

      const spinnerMutate = ora(`Mengubah topik #${seq}...`).start();
      await planService.mutateMatrixItem(matrix.id, seq, instruction);
      spinnerMutate.succeed(chalk.green(`Topik #${seq} berhasil dimutasi!`));
      displayMatrixTable();
    } else {
      console.log(chalk.red('\nMatriks ditolak. Proses dihentikan.'));
      process.exit(0);
    }
  }

  // STEP 4: CANONICAL CONTENT & MULTI-PLATFORM COMPILATION
  console.log(chalk.bold.yellow('📌 TAHAP 4 & 5: CANONICAL SYNTHESIS & MULTI-PLATFORM ADAPTERS'));
  const targetItem = matrix.items[0];
  console.log(chalk.cyan(`\nMemproses Topik #1: "${targetItem.topicTitle}"`));

  const spinner3 = ora('Menyusun Canonical Master Content (Single Source of Truth)...').start();
  const canonical = await canonicalEngine.synthesize(company, project, targetItem);
  spinner3.succeed(chalk.green('Canonical Master Content Selesai!'));

  console.log(chalk.white.bold('\n📖 Canonical Thesis: ') + chalk.italic(canonical.mainThesis));
  console.log(chalk.gray(`Hooks Tersedia : ${canonical.hooks.map(h => `[${h.type}] ${h.text}`).join(' | ')}`));

  const spinner4 = ora('Mengonversi deterministik ke platform spesifik (X <=280 chars, LinkedIn, IG, Medium)...').start();
  const compiled = await adapterEngine.compileAll(canonical, targetItem.targetPlatforms);
  spinner4.succeed(chalk.green('Multi-Platform Derivation Berhasil Tervalidasi Zod!'));

  // PREVIEW RESULTS
  console.log('\n' + chalk.bold.magenta('╔══════════════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.magenta('║                     HASIL MULTI-PLATFORM POSTINGS                        ║'));
  console.log(chalk.bold.magenta('╚══════════════════════════════════════════════════════════════════════════╝'));

  if (compiled.x) {
    console.log(chalk.bold.blue('\n🐦 [X / TWITTER POST] (Karakter tervalidasi <= 280):'));
    compiled.x.tweets.forEach((tw, idx) => {
      console.log(chalk.white(`   ${idx + 1}/ `) + chalk.cyan(tw));
    });
    console.log(chalk.gray(`   Hashtags: ${compiled.x.hashtags.map(t => '#' + t).join(' ')}`));
  }

  if (compiled.linkedin) {
    console.log(chalk.bold.blue('\n💼 [LINKEDIN POST]:'));
    console.log(chalk.bold.white(`   Headline: ${compiled.linkedin.headline}`));
    console.log(chalk.white(compiled.linkedin.body.split('\n').map(l => '   ' + l).join('\n')));
    console.log(chalk.yellow(`   Discussion CTA: ${compiled.linkedin.discussionPrompt}`));
    console.log(chalk.gray(`   Hashtags: ${compiled.linkedin.hashtags.map(t => '#' + t).join(' ')}`));
  }

  if (compiled.instagram) {
    console.log(chalk.bold.blue('\n📸 [INSTAGRAM CAROUSEL & CAPTION]:'));
    console.log(chalk.magenta(`   Visual Prompt: "${compiled.instagram.visualConceptPrompt}"`));
    console.log(chalk.cyan(`   Carousel Slides (${compiled.instagram.slideCount} slides):`));
    compiled.instagram.carouselSlides.forEach(s => {
      console.log(chalk.gray(`     Slide ${s.slideNumber}: [${s.title}] - ${s.body}`));
    });
    console.log(chalk.white(`   Caption: ${compiled.instagram.caption}`));
  }

  if (compiled.medium) {
    console.log(chalk.bold.blue('\n📝 [MEDIUM LONG-FORM ARTICLE]:'));
    console.log(chalk.bold.white(`   Title   : ${compiled.medium.title}`));
    console.log(chalk.gray(`   Subtitle: ${compiled.medium.subtitle}`));
    console.log(chalk.gray(`   Est Read: ${compiled.medium.estimatedReadTimeMinutes} min | Tags: ${compiled.medium.tags.join(', ')}`));
    console.log(chalk.white(`   Markdown Preview (first 250 chars):\n   ${compiled.medium.markdownContent.slice(0, 250)}...`));
  }

  // STEP 6: CLOUD SCHEDULER QUEUE
  console.log(chalk.bold.yellow('\n📌 TAHAP 6: CLOUD 24/7 MESSAGE QUEUE & DISPATCH'));
  const jobs = scheduler.enqueueCompiledPosts(
    application.id,
    targetItem.id,
    compiled,
    new Date(targetItem.scheduledDate)
  );

  console.log(chalk.green(`✔ Berhasil menjadwalkan ${jobs.length} pekerjaan posting di Cloud Queue.`));
  for (const j of jobs) {
    const res = await scheduler.executeJob(j.id);
    console.log(chalk.gray(`   ➔ Job ID: ${j.id.slice(0, 8)}... | Platform: [${j.platform.toUpperCase()}] | Status: ${chalk.green(res.status)}`));
  }

  // STEP 7: CLOSED-LOOP ANALYTICS DEMO
  console.log(chalk.bold.yellow('\n📌 TAHAP 7: CLOSED-LOOP ANALYTICS & STRATEGY FEEDBACK'));
  const mockMetrics: PostPerformanceMetric[] = [
    {
      jobId: jobs[0]?.id || crypto.randomUUID(),
      platform: 'linkedin',
      impressions: 5200,
      clicks: 410,
      engagements: 520,
      engagementRate: 0.1,
      topFeedbackTheme: 'Para VP of Engineering menyukai detail DNS TTL cache.',
    },
    {
      jobId: jobs[1]?.id || crypto.randomUUID(),
      platform: 'x',
      impressions: 9800,
      clicks: 650,
      engagements: 890,
      engagementRate: 0.09,
      topFeedbackTheme: 'Tweet single hook DNS outage memicu diskusi panjang.',
    },
  ];

  const spinner5 = ora('Menganalisis performa interaksi & menyusun saran strategi proaktif...').start();
  const feedback = await analytics.generateClosedLoopFeedback(mockMetrics, brief.title);
  spinner5.succeed(chalk.green('Closed-Loop Feedback Berhasil Disintesis!'));

  console.log(chalk.white('\n💡 ' + chalk.bold('Proactive Strategic Insights:')));
  console.log(chalk.cyan(`   • Summary : `) + feedback.overallSummary);
  console.log(chalk.green(`   • Top Pillars: `) + feedback.highestPerformingPillars.join(', '));
  console.log(chalk.yellow(`   • Actionable Advice:`));
  feedback.proactiveActionableAdvice.forEach(adv => console.log(chalk.gray(`     - ${adv}`)));
  console.log(chalk.magenta(`   • Next Sprint Topic Ideas:`));
  feedback.recommendedNextCampaignTopics.forEach(top => console.log(chalk.gray(`     - ${top}`)));

  console.log(chalk.bold.green('\n🎉 SELURUH LIFECYCLE SELESAI DENGAN SUKSES!\n'));
}

main().catch((err) => {
  console.error(chalk.red('Fatal Error in CLI:'), err);
});
