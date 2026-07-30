// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { z } from 'zod';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import type {
  Erc20TransferPolicyData,
  PolicyRecipient,
} from '@/modules/policies/domain/entities/active-policy.entity';
import type { PolicyConfirmation } from '@/modules/policies/domain/entities/policy-confirmation.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import { PolicyTokenService } from '@/modules/policies/domain/policy-token.service';
import type {
  PolicyResolver,
  PolicyResolverContext,
  ResolvedPolicy,
} from '@/modules/policies/domain/resolvers/policy-resolver.interface';
import { policyId } from '@/modules/policies/domain/utils/policy-access.utils';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

/**
 * `data` of an `ERC20TransferPolicy` confirmation, as decoded by the Transaction
 * Service:
 *
 * ```solidity
 * struct RecipientData { address recipient; bool allowed; }
 * RecipientData[] recipientList = abi.decode(data, (RecipientData[]));
 * ```
 */
const Erc20TransferPolicyParametersSchema = z.object({
  recipients: z.array(
    z.object({
      recipient: AddressSchema,
      allowed: z.boolean(),
    }),
  ),
});

/**
 * Builds the token withdraw allowlist of a Safe.
 *
 * The access word of an `ERC20TransferPolicy` confirmation targets one token, so
 * confirmations are grouped per token: several accesses on the same token (e.g.
 * `transfer` and `transferFrom`) produce one allowlist entry, and the recipients
 * marked `allowed: false` are omitted - they are the removals.
 */
@Injectable()
export class Erc20TransferPolicyResolver implements PolicyResolver {
  public readonly type = PolicyType.Erc20Transfer;

  constructor(
    private readonly policyTokenService: PolicyTokenService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  public async resolve(
    context: PolicyResolverContext,
  ): Promise<Array<ResolvedPolicy>> {
    const perToken = this.groupByToken(context.confirmations);

    const allowlist = await Promise.all(
      [...perToken.values()].map(async (confirmations) => ({
        confirmations,
        token: await this.policyTokenService.getTokenInfo({
          chainId: context.chainId,
          address: confirmations[0].target,
        }),
        recipients: this.recipientsOf(confirmations),
      })),
    );

    // One item per token: the wallet renders the allowlist per token, and a
    // token whose recipients were all revoked is no longer a restriction.
    return allowlist
      .filter((entry) => entry.recipients.length > 0)
      .map(({ confirmations, token, recipients }) => {
        const data: Erc20TransferPolicyData = {
          allowlist: [{ token, recipients }],
        };

        return {
          id: policyId(confirmations),
          type: this.type,
          data,
          sources: confirmations,
        };
      });
  }

  private groupByToken(
    confirmations: Array<PolicyConfirmation>,
  ): Map<string, Array<PolicyConfirmation>> {
    const perToken = new Map<string, Array<PolicyConfirmation>>();

    for (const confirmation of confirmations) {
      const token = confirmation.target.toLowerCase();
      perToken.set(token, [...(perToken.get(token) ?? []), confirmation]);
    }

    return perToken;
  }

  /**
   * The allowed recipients across every access of a token, de-duplicated.
   */
  private recipientsOf(
    confirmations: Array<PolicyConfirmation>,
  ): Array<PolicyRecipient> {
    const allowed = new Map<string, Address>();

    for (const confirmation of confirmations) {
      for (const { recipient, allowed: isAllowed } of this.parameters(
        confirmation,
      )) {
        if (isAllowed) {
          allowed.set(recipient.toLowerCase(), recipient);
        } else {
          allowed.delete(recipient.toLowerCase());
        }
      }
    }

    return [...allowed.values()].map((address) => ({ address }));
  }

  private parameters(
    confirmation: PolicyConfirmation,
  ): z.infer<typeof Erc20TransferPolicyParametersSchema>['recipients'] {
    const result = Erc20TransferPolicyParametersSchema.safeParse(
      confirmation.dataDecoded?.parameters,
    );

    if (!result.success) {
      // Either the Transaction Service could not decode `data`, or its shape
      // changed. Neither should fail the request: the policy is reported without
      // recipients and the mismatch is logged.
      this.loggingService.warn({
        message: 'Could not read ERC20TransferPolicy recipients',
        safe: confirmation.safe,
        policy: confirmation.policy,
        transactionHash: confirmation.transactionHash,
      });
      return [];
    }

    return result.data.recipients;
  }
}
