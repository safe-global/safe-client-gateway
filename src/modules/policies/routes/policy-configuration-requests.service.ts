// SPDX-License-Identifier: FSL-1.1-MIT
import {
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { isAddressEqual, zeroAddress } from 'viem';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '#/modules/auth/utils/assert-authenticated.utils';
import type { SafeRef } from '#/modules/policies/domain/entities/safe-ref.entity';
import { getPolicyTypeOfContract } from '#/modules/policies/domain/policy-deployments.constants';
import { ISafePolicyGuardConfigurationRequestsRepository } from '#/modules/policies/domain/safe-policy-guard-configuration-requests.repository.interface';
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
  public constructor(
    @Inject(ISafePolicyGuardConfigurationRequestsRepository)
    private readonly configurationRequestsRepository: ISafePolicyGuardConfigurationRequestsRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
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

    this.assertKnownPolicies({
      chainId: args.safe.chainId,
      configurations: args.payload.configurations,
    });

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

  /** Each policy must be a known contract or the zero address, which removes a policy. */
  private assertKnownPolicies(args: {
    chainId: string;
    configurations: CreatePolicyConfigurationRequestPayload['configurations'];
  }): void {
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
