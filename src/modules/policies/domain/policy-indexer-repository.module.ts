// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '#/datasources/errors/http-error-factory';
import { SafeInternalNetworkModule } from '#/datasources/network/safe-internal.network.module';
import { PolicyIndexerApi } from '#/modules/policies/datasources/policy-indexer-api.service';
import { PolicyIndexerRepository } from '#/modules/policies/domain/policy-indexer.repository';
import { IPolicyIndexerRepository } from '#/modules/policies/domain/policy-indexer.repository.interface';

/**
 * Standalone module for {@link IPolicyIndexerRepository} so that
 * {@link EventCacheHelperModule} can consume it without importing the full
 * {@link PoliciesModule} (which also registers {@link SpacePoliciesController}
 * and forward-imports {@link SpacesModule}, {@link UsersModule} and
 * {@link AuthModule}).
 */
@Module({
  imports: [SafeInternalNetworkModule],
  providers: [
    HttpErrorFactory,
    PolicyIndexerApi,
    { provide: IPolicyIndexerRepository, useClass: PolicyIndexerRepository },
  ],
  exports: [IPolicyIndexerRepository],
})
export class PolicyIndexerRepositoryModule {}
