// SPDX-License-Identifier: FSL-1.1-MIT
import { forwardRef, Module } from '@nestjs/common';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { AuthModule } from '@/modules/auth/auth.module';
import { PolicyIndexerApi } from '@/modules/policies/datasources/policy-indexer-api.service';
import { PolicyIndexerRepository } from '@/modules/policies/domain/policy-indexer.repository';
import { IPolicyIndexerRepository } from '@/modules/policies/domain/policy-indexer.repository.interface';

import { GuardPolicyMapper } from '@/modules/policies/routes/mappers/guard-policy.mapper';
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
    SafeRepositoryModule,
    // Space membership and the Safe-in-space check
    forwardRef(() => SpacesModule),
    forwardRef(() => UsersModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [SpacePoliciesController],
  providers: [
    HttpErrorFactory,
    PolicyIndexerApi,
    PoliciesService,
    SpendingLimitMapper,
    GuardPolicyMapper,
    { provide: IPolicyIndexerRepository, useClass: PolicyIndexerRepository },
  ],
  exports: [IPolicyIndexerRepository],
})
export class PoliciesModule {}
