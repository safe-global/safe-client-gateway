// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { type Hex, isAddressEqual, zeroAddress } from 'viem';
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
import type { SafeRef } from '#/modules/policies/domain/entities/safe-ref.entity';
import {
  getPolicyTypeOfContract,
  getSafePolicyGuardDeployments,
} from '#/modules/policies/domain/policy-deployments.constants';
import { IPolicyIndexerRepository } from '#/modules/policies/domain/policy-indexer.repository.interface';
import { ISafePolicyGuardConfigurationRequestsRepository } from '#/modules/policies/domain/safe-policy-guard-configuration-requests.repository.interface';
import {
  GUARD_POLICY_TYPES,
  guardPolicyKindsOf,
  isRootApplicable,
} from '#/modules/policies/domain/utils/policy.utils';
import { configurationRoot } from '#/modules/policies/domain/utils/policy-configuration-root.utils';
import type {
  CreatePolicyConfigurationRequestPayload,
  CreatePolicyConfigurationRequestResponse,
} from '#/modules/policies/routes/entities/create-policy-configuration-request.dto.entity';
import { PolicyConfigurationRequestVerifier } from '#/modules/policies/routes/helpers/policy-configuration-request-verifier.helper';
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
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(PolicyConfigurationRequestVerifier)
    private readonly verifier: PolicyConfigurationRequestVerifier,
  ) {
    this.maxPerSpaceSafe = this.configurationService.getOrThrow<number>(
      'policies.maxConfigurationRequestsPerSpaceSafe',
    );
  }

  /**
   * Stores the configurations of a request once an owner backs their root: a
   * queued Safe transaction requesting it on the Safe's policy guard, signed
   * by a current owner.
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

    const root = configurationRoot(args.payload.configurations);
    this.assertKnownPolicies({
      chainId: args.safe.chainId,
      configurations: args.payload.configurations,
    });
    await this.verifier.verify({
      safe: args.safe,
      root,
      safeTxHash: args.payload.safeTxHash,
      signature: args.payload.signature,
    });
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
   * Deletes a stored request in any state. Only the stored configurations go;
   * a root requested on-chain stays there until invalidated.
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
    const stored = await this.configurationRequestsRepository.findRootsBySafe({
      spaceId: args.spaceId,
      safe: args.safe,
    });
    if (!stored.includes(root)) {
      throw new HttpExceptionNoLog(
        'No configuration request is stored for this root',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.configurationRequestsRepository.delete({
      spaceId: args.spaceId,
      safe: args.safe,
      root,
    });
  }

  /**
   * The chain must have a policy engine, and each policy must be a known
   * contract or the zero address, which removes a policy.
   */
  private assertKnownPolicies(args: {
    chainId: string;
    configurations: CreatePolicyConfigurationRequestPayload['configurations'];
  }): void {
    if (getSafePolicyGuardDeployments(args.chainId).length === 0) {
      throw new HttpExceptionNoLog(
        `Policies are not supported on chain ${args.chainId}`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const unknownPolicy = args.configurations.find(
      ({ policy }) =>
        !isAddressEqual(policy, zeroAddress) &&
        getPolicyTypeOfContract(args.chainId, policy) === null,
    );
    if (unknownPolicy) {
      throw new HttpExceptionNoLog(
        `Unknown policy contract ${unknownPolicy.policy} on chain ${args.chainId}`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
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
