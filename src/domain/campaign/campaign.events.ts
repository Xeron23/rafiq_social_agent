import { CampaignAggregate } from './campaign.aggregate.js';

export interface IDomainEvent {
  eventName: string;
  aggregateId: string;
  occurredOn: Date;
}

export class CampaignCreatedEvent implements IDomainEvent {
  public readonly eventName = 'CampaignCreated';
  constructor(public readonly aggregateId: string, public readonly occurredOn: Date = new Date()) {}
}

export class StrategyGeneratedEvent implements IDomainEvent {
  public readonly eventName = 'StrategyGenerated';
  constructor(public readonly aggregateId: string, public readonly occurredOn: Date = new Date()) {}
}

export class StrategyApprovedEvent implements IDomainEvent {
  public readonly eventName = 'StrategyApproved';
  constructor(public readonly aggregateId: string, public readonly occurredOn: Date = new Date()) {}
}

export class ContentPlanGeneratedEvent implements IDomainEvent {
  public readonly eventName = 'ContentPlanGenerated';
  constructor(public readonly aggregateId: string, public readonly occurredOn: Date = new Date()) {}
}

export class ContentPlanApprovedEvent implements IDomainEvent {
  public readonly eventName = 'ContentPlanApproved';
  constructor(public readonly aggregateId: string, public readonly occurredOn: Date = new Date()) {}
}

export class SynthesisCompletedEvent implements IDomainEvent {
  public readonly eventName = 'SynthesisCompleted';
  constructor(public readonly aggregateId: string, public readonly occurredOn: Date = new Date()) {}
}

export class CampaignAuthorizedEvent implements IDomainEvent {
  public readonly eventName = 'CampaignAuthorized';
  constructor(
    public readonly aggregateId: string,
    public readonly scheduleMode: 'planner' | 'instant',
    public readonly occurredOn: Date = new Date()
  ) {}
}
