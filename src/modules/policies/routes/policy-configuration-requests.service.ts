// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { type Hex, isAddressEqual } from 'viem';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';
import { toSecondsTimestamp } from '#/domain/common/utils/time';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { asError } from '#/logging/utils';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '#/modules/auth/utils/assert-authenticated.utils';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafePolicyGuardDecoder } from '#/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import type { SafeRef } from '#/modules/policies/domain/entities/safe-ref.entity';
import { getSafePolicyGuardDeployments } from '#/modules/policies/domain/policy-deployments.constants';
import { IPolicyIndexerRepository } from '#/modules/policies/domain/policy-indexer.repository.interface';
import { ISafePolicyGuardConfigurationRequestsRepository } from '#/modules/policies/domain/safe-policy-guard-configuration-requests.repository.interface';
import {
  GUARD_POLICY_TYPES,
  guardPolicyKindsOf,
  isRootApplicable,
} from '#/modules/policies/domain/utils/policy.utils';
import { configurationRoot } from '#/modules/policies/domain/utils/policy-configuration-root.utils';
import {
  queuedCalls,
  readQueue,
} from '#/modules/policies/domain/utils/queued-calls.utils';
import type {
  CreatePolicyConfigurationRequestPayload,
  CreatePolicyConfigurationRequestResponse,
} from '#/modules/policies/routes/entities/create-policy-configuration-request.dto.entity';
import { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import {
  assertMember,
  assertSafeInSpace,
} from '#/modules/spaces/domain/space-assert.utils';
import { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';

@Injectable()
export class PolicyConfigurationRequestsService {
  private readonly maxPerSpaceSafe: number;

  public constructor(
    @Inject(ISafePolicyGuardConfigurationRequestsRepository)
    private readonly configurationRequestsRepository: ISafePolicyGuardConfigurationRequestsRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(IPolicyIndexerRepository)
    private readonly policyIndexerRepository: IPolicyIndexerRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly safePolicyGuardDecoder: SafePolicyGuardDecoder,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.maxPerSpaceSafe = this.configurationService.getOrThrow<number>(
      'policies.maxConfigurationRequestsPerSpaceSafe',
    );
  }

  /**
   * Stores the configurations of a request. The root is recomputed from them
   * and has to match; it is not checked on-chain, as the wallet stores first.
   */
  public async create(args: {
    spaceId: Space['id'];
    safe: SafeRef;
    authPayload: AuthPayload;
    payload: CreatePolicyConfigurationRequestPayload;
  }): Promise<CreatePolicyConfigurationRequestResponse> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertMember(this.membersRepository, args.spaceId, userId);
    await assertSafeInSpace(this.spaceSafesRepository, {
      spaceId: args.spaceId,
      chainId: args.safe.chainId,
      address: args.safe.address,
    });

    // Stored as recomputed, so a retry in another casing hits the same row.
    const root = configurationRoot(args.payload.configurations);
    if (root !== args.payload.root.toLowerCase()) {
      throw new HttpExceptionNoLog(
        'The configurations do not hash to the given root',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    await this.assertBelowCap({ ...args, root });

    await this.configurationRequestsRepository.create({
      spaceId: args.spaceId,
      chainId: args.safe.chainId,
      safeAddress: args.safe.address,
      root,
      configurations: args.payload.configurations,
      createdBy: userId,
    });

    return { root };
  }

  /**
   * Deletes a draft: a stored root that is neither on-chain nor requested by
   * a queued transaction. Cancelling a requested root needs `invalidateRoot`.
   */
  public async delete(args: {
    spaceId: Space['id'];
    safe: SafeRef;
    authPayload: AuthPayload;
    root: Hex;
  }): Promise<void> {
    const userId = getAuthenticatedUserIdOrFail(args.authPayload);
    await assertMember(this.membersRepository, args.spaceId, userId);
    await assertSafeInSpace(this.spaceSafesRepository, {
      spaceId: args.spaceId,
      chainId: args.safe.chainId,
      address: args.safe.address,
    });

    const root: Hex = `0x${args.root.slice(2).toLowerCase()}`;
    const stored = await this.configurationRequestsRepository.findBySafes({
      spaceId: args.spaceId,
      safes: [args.safe],
    });
    if (!stored.some((request) => request.root === root)) {
      throw new HttpExceptionNoLog(
        'No configuration request is stored for this root',
        HttpStatus.NOT_FOUND,
      );
    }
    if (!(await this.isDraft({ safe: args.safe, root }))) {
      throw new HttpExceptionNoLog(
        'Only a draft configuration request can be deleted',
        HttpStatus.CONFLICT,
      );
    }

    await this.configurationRequestsRepository.delete({
      spaceId: args.spaceId,
      safe: args.safe,
      root,
    });
  }

  /**
   * Whether the root is a draft: neither on-chain nor requested by a queued
   * transaction.
   */
  private async isDraft(args: { safe: SafeRef; root: Hex }): Promise<boolean> {
    // Roots are only read along with at least one guard kind.
    const { roots } = await this.policyIndexerRepository.getState({
      safes: [args.safe],
      guardPolicyKinds: guardPolicyKindsOf(GUARD_POLICY_TYPES),
    });
    if (roots.some((onChain) => onChain.root === args.root)) {
      return false;
    }

    const knownGuards = [
      ...getSafePolicyGuardDeployments(args.safe.chainId),
      ...roots.map((onChain) => onChain.guard),
    ];
    // A truncated queue may hide a request, so it is not treated as a draft.
    const { transactions, truncated } = await readQueue({
      safeRepository: this.safeRepository,
      loggingService: this.loggingService,
      safe: args.safe,
    });
    return !(
      truncated ||
      transactions.some((transaction) =>
        queuedCalls({
          chainId: args.safe.chainId,
          transaction,
          multiSendDecoder: this.multiSendDecoder,
        }).some(
          (call) =>
            knownGuards.some((guard) => isAddressEqual(guard, call.to)) &&
            this.requestedRoot(call.data) === args.root,
        ),
      )
    );
  }

  /** The root a `requestConfiguration` call requests, lower-cased by viem. */
  private requestedRoot(data: Hex): Hex | null {
    if (!this.safePolicyGuardDecoder.helpers.isRequestConfiguration(data)) {
      return null;
    }
    try {
      const decoded = this.safePolicyGuardDecoder.decodeFunctionData({ data });
      return decoded.functionName === 'requestConfiguration'
        ? decoded.args[0]
        : null;
    } catch {
      return null;
    }
  }

  /**
   * Rejects a new root once the Safe holds the maximum number of active ones:
   * stored roots that are not applied, invalidated or expired on-chain.
   * Re-submitting a stored root is always accepted.
   */
  private async assertBelowCap(args: {
    spaceId: Space['id'];
    safe: SafeRef;
    root: Hex;
  }): Promise<void> {
    const stored = await this.configurationRequestsRepository.findRootsBySafe({
      spaceId: args.spaceId,
      safe: args.safe,
    });
    if (stored.includes(args.root)) {
      return;
    }

    const closed = await this.closedRootsOf(args.safe);
    const active = stored.filter((root) => !closed.has(root));
    if (active.length >= this.maxPerSpaceSafe) {
      throw new HttpExceptionNoLog(
        `This Safe only allows a maximum of ${this.maxPerSpaceSafe} active policy configuration requests in this space.`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * The Safe's roots that can no longer be applied on any guard. None when
   * the indexer cannot be read, so every stored root counts.
   */
  private async closedRootsOf(safe: SafeRef): Promise<Set<Hex>> {
    try {
      // Roots are only read along with at least one guard kind.
      const { roots } = await this.policyIndexerRepository.getState({
        safes: [safe],
        guardPolicyKinds: guardPolicyKindsOf(GUARD_POLICY_TYPES),
      });
      const now = toSecondsTimestamp(new Date());
      // One entry per guard and root: open on any guard keeps a root active.
      const open = new Set(
        roots
          .filter((root) => isRootApplicable(root, now))
          .map(({ root }) => root),
      );
      return new Set(
        roots.map(({ root }) => root).filter((root) => !open.has(root)),
      );
    } catch (error) {
      this.loggingService.warn({
        message: 'Could not read the configuration roots of a Safe',
        chainId: safe.chainId,
        safeAddress: safe.address,
        error: asError(error).message,
      });
      return new Set();
    }
  }
}
