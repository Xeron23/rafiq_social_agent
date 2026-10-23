import { ChannelKey } from '../campaign/campaign.types.js';

export type PostStatus = 'terbit' | 'terjadwal' | 'menunggu' | 'draft' | 'gagal';

export interface PostItemDTO {
  id: number;
  d: number;
  t: string;
  title: string;
  short: string;
  type: string;
  s: PostStatus;
  ch: ChannelKey[];
  cap: string;
  stage?: string;
  when?: string;
  campaign?: string;
  st?: number;
  platformVariants?: Partial<Record<ChannelKey, string>>;
}

export class PostAggregate {
  constructor(
    public readonly id: number,
    public dayOfMonth: number,
    public timeStr: string,
    public title: string,
    public shortTitle: string,
    public type: string,
    public status: PostStatus,
    public channels: ChannelKey[],
    public caption: string,
    public stage?: string,
    public whenStr?: string,
    public campaignId?: string,
    public campaignName?: string,
    public stageNumber: number = 4,
    public platformVariants?: Partial<Record<ChannelKey, string>>
  ) {}

  public publishInstant(): void {
    this.status = 'terbit';
    this.stage = 'Dipublikasikan Instan';
  }

  public schedule(day: number, time: string): void {
    this.dayOfMonth = day;
    this.timeStr = time;
    this.status = 'terjadwal';
    this.stage = 'Terjadwal di Kalender';
  }

  public toDTO(): PostItemDTO {
    return {
      id: this.id,
      d: this.dayOfMonth,
      t: this.timeStr,
      title: this.title,
      short: this.shortTitle,
      type: this.type,
      s: this.status,
      ch: this.channels,
      cap: this.caption,
      stage: this.stage,
      when: this.whenStr,
      campaign: this.campaignName || this.campaignId,
      st: this.stageNumber,
      platformVariants: this.platformVariants,
    };
  }
}

export interface IPostRepository {
  save(post: PostAggregate): Promise<void>;
  findById(id: number): Promise<PostAggregate | null>;
  findAll(): Promise<PostAggregate[]>;
  saveBatch(posts: PostAggregate[]): Promise<void>;
}
