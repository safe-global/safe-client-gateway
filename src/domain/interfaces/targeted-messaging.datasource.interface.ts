import type { CreateOutreachDto } from '@/modules/targeted-messaging/domain/entities/create-outreach.dto.entity';
import type { CreateTargetedSafesDto } from '@/modules/targeted-messaging/domain/entities/create-targeted-safes.dto.entity';
import type { Outreach } from '@/modules/targeted-messaging/domain/entities/outreach.entity';
import type { Submission } from '@/modules/targeted-messaging/domain/entities/submission.entity';
import type { TargetedSafe } from '@/modules/targeted-messaging/domain/entities/targeted-safe.entity';
import type { UpdateOutreachDto } from '@/modules/targeted-messaging/domain/entities/update-outreach.dto.entity';
import type { Address } from 'viem';

export const ITargetedMessagingDatasource = Symbol(
  'ITargetedMessagingDatasource',
);

export interface ITargetedMessagingDatasource {
  createOutreach(createOutreachDto: CreateOutreachDto): Promise<Outreach>;

  getOutreachOrFail(outreachId: number): Promise<Outreach>;

  updateOutreach(updateOutreachDto: UpdateOutreachDto): Promise<Outreach>;

  getUnprocessedOutreaches(): Promise<Array<Outreach>>;

  markOutreachAsProcessed(outreach: Outreach): Promise<Outreach>;

  createTargetedSafes(
    createTargetedSafesDto: CreateTargetedSafesDto,
  ): Promise<Array<TargetedSafe>>;

  getTargetedSafe(args: {
    outreachId: number;
    safeAddress: Address;
    chainId?: string;
  }): Promise<TargetedSafe>;

  createSubmission(args: {
    targetedSafe: TargetedSafe;
    signerAddress: Address;
  }): Promise<Submission>;

  getSubmission(args: {
    targetedSafe: TargetedSafe;
    signerAddress: Address;
  }): Promise<Submission>;
}
