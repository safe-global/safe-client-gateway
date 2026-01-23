import type { Outreach } from '@/modules/targeted-messaging/domain/entities/outreach.entity';
import type { Submission } from '@/modules/targeted-messaging/domain/entities/submission.entity';
import type { TargetedSafe } from '@/modules/targeted-messaging/domain/entities/targeted-safe.entity';
import type { Address } from 'viem';

export const ITargetedMessagingRepository = Symbol(
  'ITargetedMessagingRepository',
);

export interface ITargetedMessagingRepository {
  getTargetedSafe(args: {
    outreachId: number;
    safeAddress: Address;
    chainId?: string;
  }): Promise<TargetedSafe>;

  addSafeToOutreach(args: {
    outreachId: number;
    safeAddress: Address;
  }): Promise<Array<TargetedSafe>>;

  getOutreachOrFail(outreachId: number): Promise<Outreach>;

  getSubmission(args: {
    chainId: string;
    targetedSafe: TargetedSafe;
    signerAddress: Address;
  }): Promise<Submission>;

  createSubmission(args: {
    targetedSafe: TargetedSafe;
    signerAddress: Address;
  }): Promise<Submission>;
}
