import { CampaignAggregate } from './campaign.aggregate.js';

export interface ICampaignRepository {
  save(campaign: CampaignAggregate): Promise<void>;
  findById(id: string): Promise<CampaignAggregate | null>;
  findAll(): Promise<CampaignAggregate[]>;
  delete(id: string): Promise<boolean>;
}
