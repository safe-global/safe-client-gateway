// SPDX-License-Identifier: FSL-1.1-MIT

import {
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { type Address, isAddressEqual } from 'viem';
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
import { getSafePolicyGuardDeployments } from '#/modules/policies/domain/policy-deployments.constants';
import { IPolicyIndexerRepository } from '#/modules/policies/domain/policy-indexer.repository.interface';
import { ISafePolicyGuardRepository } from '#/modules/policies/domain/safe-policy-guard.repository.interface';
import {
  type ActiveRootsRule,
  EVERY_ROOT_ACTIVE,
  ISafePolicyGuardConfigurationRequestsRepository,
} from '#/modules/policies/domain/safe-policy-guard-configuration-requests.repository.interface';
import {
  isRootApplicable,
  pendingRootGuards,
} from '#/modules/policies/domain/utils/policy.utils';
import { configurationRoot } from '#/modules/policies/domain/utils/policy-configuration-root.utils';
import type {
  CreatePolicyConfigurationRequestPayload,
  CreatePolicyConfigurationRequestResponse,
} from '#/modules/policies/routes/entities/create-policy-configuration-request.dto.entity';
import { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import { assertMember } from '#/modules/spaces/domain/space-assert.utils';
import { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';

@Injectable()
export class PolicyConfigurationRequestsService {
  public constructor(
    @Inject(ISafePolicyGuardConfigurationRequestsRepository)
    private readonly configurationRequestsRepository: ISafePolicyGuardConfigurationRequestsRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(IPolicyIndexerRepository)
    private readonly policyIndexerRepository: IPolicyIndexerRepository,
    @Inject(ISafePolicyGuardRepository)
    private readonly safePolicyGuardRepository: ISafePolicyGuardRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

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

    await this.configurationRequestsRepository.create(
      {
        spaceId: args.spaceId,
        chainId: args.safe.chainId,
        safeAddress: args.safe.address,
        root,
        configurations: args.payload.configurations,
        createdBy: userId,
      },
      await this.activeRootsOf(args.safe),
    );

    return { root };
  }

  /**
   * Which stored roots still count toward the cap: on-chain roots until they
   * are applied, invalidated or expired, and drafts younger than the Safe's
   * `SafePolicyGuard` `DELAY + EXPIRY`. Every root counts when chain state
   * cannot be read.
   */
  private async activeRootsOf(safe: SafeRef): Promise<ActiveRootsRule> {
    try {
      const [{ roots }, { guard, moduleGuard }] = await Promise.all([
        this.policyIndexerRepository.getState({
          safes: [safe],
          guardPolicyKinds: [],
        }),
        this.safeRepository.getSafe(safe),
      ]);
      // Only a known deployment's DELAY and EXPIRY are trusted.
      const deployments = getSafePolicyGuardDeployments(safe.chainId);
      const policyGuard = [guard, moduleGuard].find(
        (slot): slot is Address =>
          !!slot && deployments.some((d) => isAddressEqual(d, slot)),
      );
      const guards = [
        ...new Set([
          ...pendingRootGuards(roots),
          ...(policyGuard ? [policyGuard] : []),
        ]),
      ];
      const [expiries, delay] = await Promise.all([
        Promise.all(
          guards.map(async (g) => {
            const expiry = await this.safePolicyGuardRepository.getExpiry({
              chainId: safe.chainId,
              guard: g,
            });
            return [g, expiry] as const;
          }),
        ).then((entries) => new Map(entries)),
        policyGuard
          ? this.safePolicyGuardRepository.getDelay({
              chainId: safe.chainId,
              guard: policyGuard,
            })
          : null,
      ]);
      const now = toSecondsTimestamp(new Date());

      const onChain = new Map(
        roots.map((root) => [
          root.root,
          isRootApplicable(root, expiries.get(root.guard), now),
        ]),
      );
      const expiry = policyGuard ? expiries.get(policyGuard) : undefined;
      return {
        onChain,
        draftsSince:
          delay === null || expiry === undefined
            ? null
            : new Date((now - delay - expiry) * 1_000),
      };
    } catch (error) {
      this.loggingService.warn({
        message: 'Could not read the active configuration roots of a Safe',
        chainId: safe.chainId,
        safeAddress: safe.address,
        error: asError(error).message,
      });
      return EVERY_ROOT_ACTIVE;
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
