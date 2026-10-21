// SPDX-License-Identifier: FSL-1.1-MIT
import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Hex } from 'viem';
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
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import { assertMember } from '#/modules/spaces/domain/space-assert.utils';
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
    await this.assertSafeInSpace({ ...args, userId });

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
   * Rejects a new root once the Safe holds the maximum number of active ones:
   * stored roots that are not applied, invalidated or expired on-chain.
   * Re-submitting a stored root is always accepted.
   */
  private async assertBelowCap(args: {
    spaceId: Space['id'];
    safe: SafeRef;
    root: Hex;
  }): Promise<void> {
    const stored = await this.configurationRequestsRepository.findBySafes({
      spaceId: args.spaceId,
      safes: [args.safe],
    });
    if (stored.some(({ root }) => root === args.root)) {
      return;
    }

    const closed = await this.closedRootsOf(args.safe);
    const active = stored.filter(({ root }) => !closed.has(root));
    if (active.length >= this.maxPerSpaceSafe) {
      throw new BadRequestException(
        `This Safe only allows a maximum of ${this.maxPerSpaceSafe} active policy configuration requests in this space.`,
      );
    }
  }

  /**
   * The Safe's roots that can no longer be applied. None when the indexer
   * cannot be read, so every stored root counts.
   */
  private async closedRootsOf(safe: SafeRef): Promise<Set<Hex>> {
    try {
      // Roots are only read along with at least one guard kind.
      const { roots } = await this.policyIndexerRepository.getState({
        safes: [safe],
        guardPolicyKinds: guardPolicyKindsOf(GUARD_POLICY_TYPES),
      });
      const now = toSecondsTimestamp(new Date());
      return new Set(
        roots
          .filter((root) => !isRootApplicable(root, now))
          .map(({ root }) => root),
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

  private async assertSafeInSpace(args: {
    spaceId: Space['id'];
    safe: SafeRef;
    userId: number;
  }): Promise<void> {
    await assertMember(this.membersRepository, args.spaceId, args.userId);

    const isInSpace = await this.spaceSafesRepository.existsInSpace({
      spaceId: args.spaceId,
      chainId: args.safe.chainId,
      address: args.safe.address,
    });
    if (!isInSpace) {
      throw new ForbiddenException();
    }
  }
}
