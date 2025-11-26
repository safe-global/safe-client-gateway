import { TargetedMessagingDatasourceModule } from '@/modules/targeted-messaging/datasources/targeted-messaging.datasource.module';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { Outreach } from '@/modules/targeted-messaging/domain/entities/outreach.entity';
import { Submission } from '@/modules/targeted-messaging/domain/entities/submission.entity';
import { TargetedSafe } from '@/modules/targeted-messaging/domain/entities/targeted-safe.entity';
import { TargetedMessagingRepository } from '@/modules/targeted-messaging/domain/targeted-messaging.repository';
import { Module } from '@nestjs/common';
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

@Module({
  imports: [TargetedMessagingDatasourceModule, SafeRepositoryModule],
  providers: [
    {
      provide: ITargetedMessagingRepository,
      useClass: TargetedMessagingRepository,
    },
  ],
  exports: [ITargetedMessagingRepository],
})
export class TargetedMessagingRepositoryModule {}
