// SPDX-License-Identifier: FSL-1.1-MIT
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { AuthModule } from '@/modules/auth/auth.module';
import { PolicyConfigurationRequest } from '@/modules/policies/datasources/entities/policy-configuration-request.entity.db';
import { PoliciesRepository } from '@/modules/policies/domain/policies.repository';
import { IPoliciesRepository } from '@/modules/policies/domain/policies.repository.interface';
import { PolicyCacheModule } from '@/modules/policies/domain/policy-cache.module';
import { PolicyCatalogueService } from '@/modules/policies/domain/policy-catalogue.service';
import { PolicyConfigurationRequestsRepository } from '@/modules/policies/domain/policy-configuration-requests.repository';
import { IPolicyConfigurationRequestsRepository } from '@/modules/policies/domain/policy-configuration-requests.repository.interface';
import { PolicyDeploymentsService } from '@/modules/policies/domain/policy-deployments.service';
import { PolicyTokenService } from '@/modules/policies/domain/policy-token.service';
import { AllowPolicyResolver } from '@/modules/policies/domain/resolvers/allow-policy.resolver';
import { CosignerPolicyResolver } from '@/modules/policies/domain/resolvers/cosigner-policy.resolver';
import { Erc20TransferPolicyResolver } from '@/modules/policies/domain/resolvers/erc20-transfer-policy.resolver';
import type { PolicyResolver } from '@/modules/policies/domain/resolvers/policy-resolver.interface';
import { POLICY_RESOLVERS } from '@/modules/policies/policies.constants';
import { PoliciesController } from '@/modules/policies/routes/policies.controller';
import { PoliciesService } from '@/modules/policies/routes/policies.service';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { SpacesModule } from '@/modules/spaces/spaces.module';
import { TokensModule } from '@/modules/tokens/tokens.module';
import { UsersModule } from '@/modules/users/users.module';

@Module({
  imports: [
    PostgresDatabaseModuleV2,
    TypeOrmModule.forFeature([PolicyConfigurationRequest]),
    TransactionApiManagerModule,
    PolicyCacheModule,
    SafeRepositoryModule,
    TokensModule,
    // Space membership, the Safe-in-space check and address book names
    forwardRef(() => SpacesModule),
    forwardRef(() => UsersModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [PoliciesController],
  providers: [
    PoliciesService,
    PolicyCatalogueService,
    PolicyDeploymentsService,
    PolicyTokenService,
    Erc20TransferPolicyResolver,
    AllowPolicyResolver,
    CosignerPolicyResolver,
    {
      provide: IPoliciesRepository,
      useClass: PoliciesRepository,
    },
    {
      provide: IPolicyConfigurationRequestsRepository,
      useClass: PolicyConfigurationRequestsRepository,
    },
    {
      // Registering a resolver here is all it takes to support a new
      // guard-enforced policy type.
      provide: POLICY_RESOLVERS,
      useFactory: (
        erc20Transfer: Erc20TransferPolicyResolver,
        cosigner: CosignerPolicyResolver,
        allow: AllowPolicyResolver,
      ): ReadonlyArray<PolicyResolver> => [erc20Transfer, cosigner, allow],
      inject: [
        Erc20TransferPolicyResolver,
        CosignerPolicyResolver,
        AllowPolicyResolver,
      ],
    },
  ],
  exports: [IPoliciesRepository, IPolicyConfigurationRequestsRepository],
})
export class PoliciesModule {}
