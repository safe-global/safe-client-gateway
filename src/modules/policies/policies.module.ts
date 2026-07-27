// SPDX-License-Identifier: FSL-1.1-MIT
import { forwardRef, Module } from '@nestjs/common';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { AuthModule } from '@/modules/auth/auth.module';
import { FeatureFlagsModule } from '@/modules/chains/feature-flags/feature-flags.module';
import { PoliciesRepository } from '@/modules/policies/domain/policies.repository';
import { IPoliciesRepository } from '@/modules/policies/domain/policies.repository.interface';
import { PolicyCatalogueService } from '@/modules/policies/domain/policy-catalogue.service';
import { PolicyDeploymentsService } from '@/modules/policies/domain/policy-deployments.service';
import { PolicyTokenService } from '@/modules/policies/domain/policy-token.service';
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
    TransactionApiManagerModule,
    SafeRepositoryModule,
    TokensModule,
    FeatureFlagsModule,
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
    CosignerPolicyResolver,
    {
      provide: IPoliciesRepository,
      useClass: PoliciesRepository,
    },
    {
      // Registering a resolver here is all it takes to support a new
      // guard-enforced policy type.
      provide: POLICY_RESOLVERS,
      useFactory: (
        erc20Transfer: Erc20TransferPolicyResolver,
        cosigner: CosignerPolicyResolver,
      ): ReadonlyArray<PolicyResolver> => [erc20Transfer, cosigner],
      inject: [Erc20TransferPolicyResolver, CosignerPolicyResolver],
    },
  ],
  exports: [IPoliciesRepository],
})
export class PoliciesModule {}
