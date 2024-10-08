import type { CreateOutreachDto } from '@/domain/targeted-messaging/entities/create-outreach.dto.entity';
import type { CreateTargetedSafesDto } from '@/domain/targeted-messaging/entities/create-targeted-safes.dto.entity';
import type { Outreach } from '@/domain/targeted-messaging/entities/outreach.entity';
import type { Submission } from '@/domain/targeted-messaging/entities/submission.entity';
import type { TargetedSafe } from '@/domain/targeted-messaging/entities/targeted-safe.entity';

export const ITargetedMessagingDatasource = Symbol(
  'ITargetedMessagingDatasource',
);

export interface ITargetedMessagingDatasource {
  createOutreach(createOutreachDto: CreateOutreachDto): Promise<Outreach>;

  createTargetedSafes(
    createTargetedSafesDto: CreateTargetedSafesDto,
  ): Promise<Array<TargetedSafe>>;

  getTargetedSafe(args: {
    outreachId: number;
    safeAddress: `0x${string}`;
  }): Promise<TargetedSafe>;

  createSubmission(args: {
    targetedSafe: TargetedSafe;
    signerAddress: `0x${string}`;
  }): Promise<Submission>;

  getSubmission(args: {
    targetedSafe: TargetedSafe;
    signerAddress: `0x${string}`;
  }): Promise<Submission>;
}
