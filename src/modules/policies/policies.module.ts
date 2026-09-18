// SPDX-License-Identifier: FSL-1.1-MIT
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { AuthModule } from '@/modules/auth/auth.module';
import { DelegatesV2RepositoryModule } from '@/modules/delegate/domain/v2/delegates.v2.repository.interface';
import { DelegatesV3RepositoryModule } from '@/modules/delegate/domain/v3/delegates.v3.repository.interface';
import { PolicyConfigurationRequest } from '@/modules/policies/datasources/entities/policy-configuration-request.entity.db';
import { PolicyIndexerApi } from '@/modules/policies/datasources/policy-indexer-api.service';
import { PolicyConfigurationRequestsRepository } from '@/modules/policies/domain/policy-configuration-requests.repository';
import { IPolicyConfigurationRequestsRepository } from '@/modules/policies/domain/policy-configuration-requests.repository.interface';
import { PolicyIndexerRepository } from '@/modules/policies/domain/policy-indexer.repository';
import { IPolicyIndexerRepository } from '@/modules/policies/domain/policy-indexer.repository.interface';
import { GuardPolicyMapper } from '@/modules/policies/routes/mappers/guard-policy.mapper';
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
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([PolicyConfigurationRequest]),
    SafeRepositoryModule,
    // The proposer grants, read from both delegates APIs
    DelegatesV2RepositoryModule,
    DelegatesV3RepositoryModule,
    // Space membership and the Safe-in-space check
    forwardRef(() => SpacesModule),
    forwardRef(() => UsersModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [PoliciesController, SpacePoliciesController],
  providers: [
    HttpErrorFactory,
    PolicyIndexerApi,
    PoliciesService,
    SpendingLimitMapper,
    ProposerMapper,
    GuardPolicyMapper,
    { provide: IPolicyIndexerRepository, useClass: PolicyIndexerRepository },
    {
      provide: IPolicyConfigurationRequestsRepository,
      useClass: PolicyConfigurationRequestsRepository,
    },
  ],
  exports: [IPolicyIndexerRepository, IPolicyConfigurationRequestsRepository],
})
export class PoliciesModule {}
