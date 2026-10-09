// SPDX-License-Identifier: FSL-1.1-MIT
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { AllowanceModuleDecoder } from '@/modules/contracts/domain/decoders/allowance-module-decoder.helper';
import { MultiSendDecoder } from '@/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafeDecoder } from '@/modules/contracts/domain/decoders/safe-decoder.helper';
import { DelegatesV3RepositoryModule } from '@/modules/delegate/domain/v3/delegates.v3.repository.interface';
import { PolicyConfigurationRequest } from '@/modules/policies/datasources/entities/policy-configuration-request.entity.db';
import { SafeGuardManagerDecoder } from '@/modules/policies/domain/contracts/decoders/safe-guard-manager-decoder.helper';
import { SafePolicyGuardDecoder } from '@/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import { PolicyConfigurationRequestsRepository } from '@/modules/policies/domain/policy-configuration-requests.repository';
import { IPolicyConfigurationRequestsRepository } from '@/modules/policies/domain/policy-configuration-requests.repository.interface';
import { PolicyIndexerRepositoryModule } from '@/modules/policies/domain/policy-indexer-repository.module';
import { SafePolicyGuardRepository } from '@/modules/policies/domain/safe-policy-guard.repository';
import { ISafePolicyGuardRepository } from '@/modules/policies/domain/safe-policy-guard.repository.interface';
import { GuardConfigurationMapper } from '@/modules/policies/routes/mappers/guard-configuration.mapper';
import { GuardPolicyMapper } from '@/modules/policies/routes/mappers/guard-policy.mapper';
import { GuardSetupMapper } from '@/modules/policies/routes/mappers/guard-setup.mapper';
import { PendingSpendingLimitMapper } from '@/modules/policies/routes/mappers/pending-spending-limit.mapper';
import { ProposerMapper } from '@/modules/policies/routes/mappers/proposer.mapper';
import { SpendingLimitMapper } from '@/modules/policies/routes/mappers/spending-limit.mapper';
import { PoliciesController } from '@/modules/policies/routes/policies.controller';
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
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([PolicyConfigurationRequest]),
    SafeRepositoryModule,
    DelegatesV3RepositoryModule,
    // Space membership and the Safe-in-space check
    forwardRef(() => SpacesModule),
    forwardRef(() => UsersModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [PoliciesController, SpacePoliciesController],
  providers: [
    PoliciesService,
    SpendingLimitMapper,
    ProposerMapper,
    PendingSpendingLimitMapper,
    GuardPolicyMapper,
    GuardSetupMapper,
    GuardConfigurationMapper,
    AllowanceModuleDecoder,
    SafeDecoder,
    MultiSendDecoder,
    SafePolicyGuardDecoder,
    SafeGuardManagerDecoder,
    {
      provide: IPolicyConfigurationRequestsRepository,
      useClass: PolicyConfigurationRequestsRepository,
    },
    {
      provide: ISafePolicyGuardRepository,
      useClass: SafePolicyGuardRepository,
    },
  ],
})
export class PoliciesModule {}
