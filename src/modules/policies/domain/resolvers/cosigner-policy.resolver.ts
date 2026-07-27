// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import type { CosignerPolicyData } from '@/modules/policies/domain/entities/active-policy.entity';
import type { PolicyConfirmation } from '@/modules/policies/domain/entities/policy-confirmation.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import { PolicyTokenService } from '@/modules/policies/domain/policy-token.service';
import {
  namedAddress,
  type PolicyResolver,
  type PolicyResolverContext,
  type ResolvedPolicy,
} from '@/modules/policies/domain/resolvers/policy-resolver.interface';
import { policyId } from '@/modules/policies/domain/utils/policy-access.utils';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

/**
 * `data` of a `CoSignerPolicy` confirmation, as decoded by the Transaction
 * Service: `address cosigner = abi.decode(data, (address))`.
 */
const CosignerPolicyParametersSchema = z.object({
  cosigner: AddressSchema,
});

/**
 * Builds the cosigner rules of a Safe.
 *
 * One rule per access: the token is the access target and the cosigner comes
 * from the decoded `data`. Read-only for now - the wallet has no builder for
 * this policy yet.
 */
@Injectable()
export class CosignerPolicyResolver implements PolicyResolver {
  public readonly type = PolicyType.Cosigner;

  constructor(
    private readonly policyTokenService: PolicyTokenService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  public async resolve(
    context: PolicyResolverContext,
  ): Promise<Array<ResolvedPolicy>> {
    const resolved = await Promise.all(
      context.confirmations.map((confirmation) =>
        this.resolveOne(confirmation, context),
      ),
    );

    return resolved.filter(
      (policy): policy is ResolvedPolicy => policy !== null,
    );
  }

  private async resolveOne(
    confirmation: PolicyConfirmation,
    context: PolicyResolverContext,
  ): Promise<ResolvedPolicy | null> {
    const parameters = CosignerPolicyParametersSchema.safeParse(
      confirmation.dataDecoded?.parameters,
    );

    if (!parameters.success) {
      // Without the cosigner address the rule carries no information, so the
      // item is dropped rather than rendered empty.
      this.loggingService.warn({
        message: 'Could not read CoSignerPolicy cosigner',
        safe: confirmation.safe,
        policy: confirmation.policy,
        transactionHash: confirmation.transactionHash,
      });
      return null;
    }

    const data: CosignerPolicyData = {
      rules: [
        {
          token: await this.policyTokenService.getTokenInfo({
            chainId: context.chainId,
            address: confirmation.target,
          }),
          cosigner: namedAddress(parameters.data.cosigner, context.names),
          thresholdAmount: null,
        },
      ],
    };

    return {
      id: policyId([confirmation]),
      type: this.type,
      data,
      sources: [confirmation],
    };
  }
}
