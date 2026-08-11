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
import type { PolicyGroup } from '@/modules/policies/domain/entities/policy-group.entity';
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
 * Aggregation of this policy type:
 *
 * - the payloads **accumulate**. The policy contract upserts one recipient flag
 *   per entry, so the allowlist of an access is the fold of all its events in
 *   chain order: three transactions each allowing one recipient allow three
 *   recipients, and a later `allowed: false` revokes one.
 * - the access target is the token, so the accesses of one token (e.g. `transfer`
 *   and `transferFrom`) fold into a single allowlist entry.
 *
 * A token whose recipients have all been revoked is no longer a restriction and
 * is dropped.
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
    const perToken = this.groupByToken(context.groups);

    const resolved = await Promise.all(
      [...perToken.values()].map(async (groups) => ({
        groups,
        recipients: this.allowedRecipients(groups),
        token: await this.policyTokenService.getTokenInfo({
          chainId: context.chainId,
          address: groups[0].latest.target,
        }),
      })),
    );

    return resolved
      .filter(({ recipients }) => recipients.length > 0)
      .map(({ groups, recipients, token }) => {
        const data: Erc20TransferPolicyData = {
          allowlist: [{ token, recipients }],
        };

        return {
          id: policyId(groups.map((group) => group.access)),
          type: this.type,
          data,
          groups,
        };
      });
  }

  private groupByToken(
    groups: Array<PolicyGroup>,
  ): Map<string, Array<PolicyGroup>> {
    const perToken = new Map<string, Array<PolicyGroup>>();

    for (const group of groups) {
      const token = group.latest.target.toLowerCase();
      perToken.set(token, [...(perToken.get(token) ?? []), group]);
    }

    return perToken;
  }

  /**
   * Folds every event of every access of the token, in chain order, into the set
   * of currently allowed recipients.
   *
   * Keyed by lower-cased address so a recipient allowed and revoked in different
   * casings is one recipient, and reported checksummed.
   */
  private allowedRecipients(
    groups: Array<PolicyGroup>,
  ): Array<PolicyRecipient> {
    const allowed = new Map<string, Address>();

    for (const group of groups) {
      for (const confirmation of group.confirmations) {
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
      // changed. Neither should fail the request: the event contributes no
      // recipient and the mismatch is logged.
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
