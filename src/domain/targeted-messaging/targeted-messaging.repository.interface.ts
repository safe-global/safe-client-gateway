import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { SafeRepositoryModule } from '@/domain/safe/safe.repository.interface';
import { Submission } from '@/domain/targeted-messaging/entities/submission.entity';
import { TargetedSafe } from '@/domain/targeted-messaging/entities/targeted-safe.entity';
import { TargetedMessagingRepository } from '@/domain/targeted-messaging/targeted-messaging.repository';
import { Module } from '@nestjs/common';

export const ITargetedMessagingRepository = Symbol(
  'ITargetedMessagingRepository',
);

export interface ITargetedMessagingRepository {
  getTargetedSafe(args: {
    outreachId: number;
    safeAddress: `0x${string}`;
  }): Promise<TargetedSafe>;

  getSubmission(args: {
    chainId: string;
    targetedSafe: TargetedSafe;
    signerAddress: `0x${string}`;
  }): Promise<Submission>;

  createSubmission(args: {
    targetedSafe: TargetedSafe;
    signerAddress: `0x${string}`;
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
