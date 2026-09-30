// SPDX-License-Identifier: FSL-1.1-MIT
import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '@/modules/auth/auth.module';
import { AllowanceModuleDecoder } from '@/modules/contracts/domain/decoders/allowance-module-decoder.helper';
import { MultiSendDecoder } from '@/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafeDecoder } from '@/modules/contracts/domain/decoders/safe-decoder.helper';
import { DelegatesV3RepositoryModule } from '@/modules/delegate/domain/v3/delegates.v3.repository.interface';
import { PolicyIndexerRepositoryModule } from '@/modules/policies/domain/policy-indexer-repository.module';
import { PendingSpendingLimitMapper } from '@/modules/policies/routes/mappers/pending-spending-limit.mapper';
import { ProposerMapper } from '@/modules/policies/routes/mappers/proposer.mapper';
import { SpendingLimitMapper } from '@/modules/policies/routes/mappers/spending-limit.mapper';
import { PoliciesService } from '@/modules/policies/routes/policies.service';
import { SpacePoliciesController } from '@/modules/policies/routes/space-policies.controller';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { SpacesModule } from '@/modules/spaces/spaces.module';
import { UsersModule } from '@/modules/users/users.module';

/**
 * A policy reaches a Safe through one of three mechanisms - an enabled module,
 * the `SafePolicyGuard`, or an off-chain logic.
 */
@Module({
  imports: [
    PolicyIndexerRepositoryModule,
    SafeRepositoryModule,
    DelegatesV3RepositoryModule,
    // Space membership and the Safe-in-space check
    forwardRef(() => SpacesModule),
    forwardRef(() => UsersModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [SpacePoliciesController],
  providers: [
    PoliciesService,
    SpendingLimitMapper,
    ProposerMapper,
    PendingSpendingLimitMapper,
    AllowanceModuleDecoder,
    SafeDecoder,
    MultiSendDecoder,
  ],
})
export class PoliciesModule {}
