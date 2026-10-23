export interface AIMemoryItem {
  id: string;
  title: string;
  lesson: string;
  impact: string;
  targetStage: 'STAGE_1' | 'STAGE_2';
  createdAt: Date;
}

export interface KPIStats {
  viewsTotal: string;
  likesTotal: string;
  sharesTotal: string;
  publishedCount: number;
}

export class AIMemoryAggregate {
  constructor(
    public readonly id: string,
    public title: string,
    public lesson: string,
    public impact: string,
    public targetStage: 'STAGE_1' | 'STAGE_2',
    public readonly createdAt: Date = new Date()
  ) {}

  public toDTO(): { title: string; lesson: string; impact: string } {
    return {
      title: this.title,
      lesson: this.lesson,
      impact: this.impact,
    };
  }
}

export interface IMemoryRepository {
  save(memory: AIMemoryAggregate): Promise<void>;
  findAll(): Promise<AIMemoryAggregate[]>;
  findByStage(stage: 'STAGE_1' | 'STAGE_2'): Promise<AIMemoryAggregate[]>;
}
