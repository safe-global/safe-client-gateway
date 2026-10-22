// SPDX-License-Identifier: FSL-1.1-MIT
import {
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { type Hex, isAddressEqual } from 'viem';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '#/modules/auth/utils/assert-authenticated.utils';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafePolicyGuardDecoder } from '#/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import type { SafeRef } from '#/modules/policies/domain/entities/safe-ref.entity';
import { getSafePolicyGuardDeployments } from '#/modules/policies/domain/policy-deployments.constants';
import { IPolicyIndexerRepository } from '#/modules/policies/domain/policy-indexer.repository.interface';
import { ISafePolicyGuardConfigurationRequestsRepository } from '#/modules/policies/domain/safe-policy-guard-configuration-requests.repository.interface';
import { configurationRoot } from '#/modules/policies/domain/utils/policy-configuration-root.utils';
import type {
  CreatePolicyConfigurationRequestPayload,
  CreatePolicyConfigurationRequestResponse,
} from '#/modules/policies/routes/entities/create-policy-configuration-request.dto.entity';
import {
  queuedCalls,
  readQueue,
} from '#/modules/policies/routes/mappers/queued-calls.utils';
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
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    private readonly multiSendDecoder: MultiSendDecoder,
    private readonly safePolicyGuardDecoder: SafePolicyGuardDecoder,
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
    await this.assertSafeInSpace({ ...args, userId });

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
    const { roots } = await this.policyIndexerRepository.getState({
      safes: [args.safe],
      guardPolicyKinds: [],
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
        queuedCalls(transaction, this.multiSendDecoder).some(
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
