// SPDX-License-Identifier: FSL-1.1-MIT
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresDatabaseModuleV2 } from '#/datasources/db/v2/postgres-database.module';
import { KmsEncryptionModule } from '#/datasources/kms/kms-encryption.module';
import { AuthModule } from '#/modules/auth/auth.module';
import { ChainsModule } from '#/modules/chains/chains.module';
import { AllowanceModuleDecoder } from '#/modules/contracts/domain/decoders/allowance-module-decoder.helper';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafeDecoder } from '#/modules/contracts/domain/decoders/safe-decoder.helper';
import { DelegatesV3RepositoryModule } from '#/modules/delegate/domain/v3/delegates.v3.repository.interface';
import { PolicyConfigurationRequest } from '#/modules/policies/datasources/entities/policy-configuration-request.entity.db';
import { SafeGuardManagerDecoder } from '#/modules/policies/domain/contracts/decoders/safe-guard-manager-decoder.helper';
import { SafePolicyGuardDecoder } from '#/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import { PolicyIndexerRepositoryModule } from '#/modules/policies/domain/policy-indexer-repository.module';
import { SafePolicyGuardConfigurationRequestsRepository } from '#/modules/policies/domain/safe-policy-guard-configuration-requests.repository';
import { ISafePolicyGuardConfigurationRequestsRepository } from '#/modules/policies/domain/safe-policy-guard-configuration-requests.repository.interface';
import { DelayedGuardPoliciesMapper } from '#/modules/policies/routes/mappers/delayed-guard-policies.mapper';
import { GuardInstallationMapper } from '#/modules/policies/routes/mappers/guard-installation.mapper';
import { GuardPolicyMapper } from '#/modules/policies/routes/mappers/guard-policy.mapper';
import { ImmediateGuardPoliciesMapper } from '#/modules/policies/routes/mappers/immediate-guard-policies.mapper';
import { PendingSpendingLimitMapper } from '#/modules/policies/routes/mappers/pending-spending-limit.mapper';
import { ProposerMapper } from '#/modules/policies/routes/mappers/proposer.mapper';
import { SpendingLimitMapper } from '#/modules/policies/routes/mappers/spending-limit.mapper';
import { PoliciesController } from '#/modules/policies/routes/policies.controller';
import { PoliciesService } from '#/modules/policies/routes/policies.service';
import { PolicyConfigurationRequestsService } from '#/modules/policies/routes/policy-configuration-requests.service';
import { SpacePoliciesController } from '#/modules/policies/routes/space-policies.controller';
import { SafeRepositoryModule } from '#/modules/safe/domain/safe.repository.interface';
import { SpaceEncryptionService } from '#/modules/spaces/domain/space-encryption.service';
import { SpacesModule } from '#/modules/spaces/spaces.module';
import { TokensModule } from '#/modules/tokens/tokens.module';
import { UsersModule } from '#/modules/users/users.module';

/**
 * A policy reaches a Safe through one of three mechanisms - an enabled module,
 * the `SafePolicyGuard`, or an off-chain logic.
 */
@Module({
  imports: [
    PolicyIndexerRepositoryModule,
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([PolicyConfigurationRequest]),
    KmsEncryptionModule,
    SafeRepositoryModule,
    DelegatesV3RepositoryModule,
    TokensModule,
    ChainsModule,
    // Space membership and the Safe-in-space check
    forwardRef(() => SpacesModule),
    forwardRef(() => UsersModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [PoliciesController, SpacePoliciesController],
  providers: [
    PoliciesService,
    PolicyConfigurationRequestsService,
    SpaceEncryptionService,
    SpendingLimitMapper,
    ProposerMapper,
    PendingSpendingLimitMapper,
    GuardPolicyMapper,
    GuardInstallationMapper,
    ImmediateGuardPoliciesMapper,
    DelayedGuardPoliciesMapper,
    AllowanceModuleDecoder,
    SafeDecoder,
    MultiSendDecoder,
    SafePolicyGuardDecoder,
    SafeGuardManagerDecoder,
    {
      provide: ISafePolicyGuardConfigurationRequestsRepository,
      useClass: SafePolicyGuardConfigurationRequestsRepository,
    },
  ],
})
export class PoliciesModule {}
