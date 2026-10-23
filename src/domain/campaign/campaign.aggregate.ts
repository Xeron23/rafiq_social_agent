import {
  CampaignType,
  CampaignLifecycleStatus,
  ChannelKey,
  StrategyVO,
  ContentPlanWeekVO,
  CanonicalContentVO,
  PlatformVariantsVO,
  BrandVoiceProfileVO,
} from './campaign.types.js';
import {
  IDomainEvent,
  CampaignCreatedEvent,
  StrategyGeneratedEvent,
  StrategyApprovedEvent,
  ContentPlanGeneratedEvent,
  ContentPlanApprovedEvent,
  SynthesisCompletedEvent,
  CampaignAuthorizedEvent,
} from './campaign.events.js';

export class CampaignAggregate {
  private _domainEvents: IDomainEvent[] = [];

  constructor(
    public readonly id: string,
    public name: string,
    public readonly type: CampaignType,
    public targetChannels: ChannelKey[],
    public brandVoice: BrandVoiceProfileVO,
    public status: CampaignLifecycleStatus = 'DRAFT',
    public step: number = 0,
    public strategy?: StrategyVO,
    public contentPlan?: ContentPlanWeekVO[],
    public canonicalContent?: CanonicalContentVO,
    public platformVariants: Partial<PlatformVariantsVO> = {},
    public customCaptions: Partial<PlatformVariantsVO> = {},
    public revisionHistory: Array<{ stage: number; feedback: string; at: Date }> = [],
    public readonly createdAt: Date = new Date(),
    public updatedAt: Date = new Date()
  ) {}

  public static create(params: {
    id: string;
    name: string;
    type: CampaignType;
    targetChannels: ChannelKey[];
    brandVoice: BrandVoiceProfileVO;
  }): CampaignAggregate {
    const campaign = new CampaignAggregate(
      params.id,
      params.name,
      params.type,
      params.targetChannels,
      params.brandVoice,
      'DRAFT',
      0
    );
    campaign.recordEvent(new CampaignCreatedEvent(campaign.id));
    return campaign;
  }

  // --- TAHAP 1: STRATEGY & CONCEPT (HITL GATE 1) ---
  public setStrategyGenerated(strategy: StrategyVO): void {
    this.strategy = strategy;
    this.name = strategy.name || this.name;
    this.status = 'STRATEGY_AWAITING_HITL';
    this.step = 1;
    this.updatedAt = new Date();
    this.recordEvent(new StrategyGeneratedEvent(this.id));
  }

  public approveStrategy(feedback?: string): void {
    if (this.status !== 'STRATEGY_AWAITING_HITL' && this.status !== 'STRATEGY_APPROVED') {
      throw new Error(`Cannot approve strategy when status is ${this.status}`);
    }
    this.status = 'STRATEGY_APPROVED';
    this.step = 1;
    this.updatedAt = new Date();
    if (feedback) {
      this.revisionHistory.push({ stage: 1, feedback, at: new Date() });
    }
    this.recordEvent(new StrategyApprovedEvent(this.id));
  }

  public requestStrategyRevision(feedback: string): void {
    this.revisionHistory.push({ stage: 1, feedback, at: new Date() });
    this.status = 'STRATEGY_GENERATING';
    this.updatedAt = new Date();
  }

  // --- TAHAP 2: CONTENT PLANNING MATRIX (HITL GATE 2) ---
  public setContentPlanGenerated(weeks: ContentPlanWeekVO[]): void {
    if (this.status !== 'STRATEGY_APPROVED' && this.status !== 'PLAN_GENERATING' && this.status !== 'PLAN_AWAITING_HITL') {
      throw new Error(`Strategy must be approved before planning content (current status: ${this.status})`);
    }
    this.contentPlan = weeks;
    this.status = 'PLAN_AWAITING_HITL';
    this.step = 2;
    this.updatedAt = new Date();
    this.recordEvent(new ContentPlanGeneratedEvent(this.id));
  }

  public approveContentPlan(feedback?: string): void {
    if (this.status !== 'PLAN_AWAITING_HITL' && this.status !== 'PLAN_APPROVED') {
      throw new Error(`Cannot approve content plan when status is ${this.status}`);
    }
    this.status = 'PLAN_APPROVED';
    this.step = 2;
    this.updatedAt = new Date();
    if (feedback) {
      this.revisionHistory.push({ stage: 2, feedback, at: new Date() });
    }
    this.recordEvent(new ContentPlanApprovedEvent(this.id));
  }

  public requestPlanRevision(feedback: string): void {
    this.revisionHistory.push({ stage: 2, feedback, at: new Date() });
    this.status = 'PLAN_GENERATING';
    this.updatedAt = new Date();
  }

  // --- TAHAP 3 & 4: CANONICAL CONTENT & PLATFORM VARIANTS (HITL GATE 3 & 4) ---
  public setSynthesisCompleted(
    canonical: CanonicalContentVO,
    variants: PlatformVariantsVO,
    updatedContentPlan?: ContentPlanWeekVO[]
  ): void {
    if (this.status !== 'PLAN_APPROVED' && this.status !== 'SYNTHESIS_GENERATING' && this.status !== 'SYNTHESIS_AWAITING_HITL') {
      throw new Error(`Content plan must be approved before synthesis (current status: ${this.status})`);
    }
    this.canonicalContent = canonical;
    this.platformVariants = variants;
    if (updatedContentPlan) {
      this.contentPlan = updatedContentPlan;
    }
    this.status = 'SYNTHESIS_AWAITING_HITL';
    this.step = 3;
    this.updatedAt = new Date();
    this.recordEvent(new SynthesisCompletedEvent(this.id));
  }

  public approveCanonical(feedback?: string): void {
    if (this.status !== 'SYNTHESIS_AWAITING_HITL' && this.status !== 'AUTHORIZED') {
      throw new Error(`Cannot approve canonical content when status is ${this.status}`);
    }
    this.status = 'SYNTHESIS_AWAITING_HITL';
    this.step = 4;
    this.updatedAt = new Date();
    if (feedback) {
      this.revisionHistory.push({ stage: 3, feedback, at: new Date() });
    }
  }

  public requestCanonicalRevision(feedback: string): void {
    this.revisionHistory.push({ stage: 3, feedback, at: new Date() });
    this.status = 'SYNTHESIS_GENERATING';
    this.updatedAt = new Date();
  }

  public updatePlatformCopy(channel: ChannelKey, newCopy: string): void {
    this.customCaptions[channel] = newCopy;
    this.updatedAt = new Date();
  }

  public authorize(scheduleMode: 'planner' | 'instant'): void {
    if (this.status !== 'SYNTHESIS_AWAITING_HITL' && this.status !== 'AUTHORIZED') {
      throw new Error(`Cannot authorize campaign when status is ${this.status}`);
    }
    this.status = 'AUTHORIZED';
    this.step = 4;
    this.updatedAt = new Date();
    this.recordEvent(new CampaignAuthorizedEvent(this.id, scheduleMode));
  }

  // Domain Event Management
  public pullDomainEvents(): IDomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  private recordEvent(event: IDomainEvent): void {
    this._domainEvents.push(event);
  }
}
