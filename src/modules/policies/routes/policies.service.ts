// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type Address, isAddressEqual, zeroAddress } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { batched } from '@/domain/common/utils/batch';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import type { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '@/modules/auth/utils/assert-authenticated.utils';
import { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import { IDelegatesV3Repository } from '@/modules/delegate/domain/v3/delegates.v3.repository.interface';
import type {
  ActivePolicy,
  SpendingLimitToken,
} from '@/modules/policies/domain/entities/active-policy.entity';
import type { PolicyIndexerSafeAllowance } from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type { PendingPolicy } from '@/modules/policies/domain/entities/pending-policy.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '@/modules/policies/domain/entities/safe-ref.entity';
import { IPolicyIndexerRepository } from '@/modules/policies/domain/policy-indexer.repository.interface';
import {
  type TokenMetadataKey,
  tokenMetadataKey,
} from '@/modules/policies/domain/utils/token-metadata-key.utils';
import { PendingSpendingLimitMapper } from '@/modules/policies/routes/mappers/pending-spending-limit.mapper';
import { ProposerMapper } from '@/modules/policies/routes/mappers/proposer.mapper';
import { SpendingLimitMapper } from '@/modules/policies/routes/mappers/spending-limit.mapper';

import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import { assertMember } from '@/modules/spaces/domain/space-assert.utils';
import type { NativeToken } from '@/modules/tokens/domain/entities/token.entity';
import { ITokenRepository } from '@/modules/tokens/domain/token.repository.interface';
import { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';
import type { Caip10Address } from '@/validation/entities/schemas/caip-10-addresses.schema';

type SpacePolicyRequest = {
  spaceId: Space['id'];
  /** Narrows the read to a subset of the Space's Safes. */
  safes?: ReadonlyArray<Caip10Address>;
  /** The policy types to report. Required: naming none asks for nothing. */
  types: ReadonlyArray<PolicyType>;
  authPayload: AuthPayload;
};

@Injectable()
export class PoliciesService {
  /**
   * Safety cap on the number of pages read from a single Safe's transaction
   * queue to guard against an unbounded loop.
   */
  static readonly MAX_TRANSACTION_QUEUE_PAGES_TO_SCAN = 10;

  private readonly batchSize: number;
  private readonly maxPageSize: number;

  constructor(
    @Inject(IPolicyIndexerRepository)
    private readonly policyIndexerRepository: IPolicyIndexerRepository,
    @Inject(ISafeRepository)
    private readonly safeRepository: ISafeRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(IMembersRepository)
    private readonly membersRepository: IMembersRepository,
    @Inject(IDelegatesV3Repository)
    private readonly delegatesV3Repository: IDelegatesV3Repository,
    @Inject(ITokenRepository)
    private readonly tokenRepository: ITokenRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    private readonly spendingLimitMapper: SpendingLimitMapper,
    private readonly proposerMapper: ProposerMapper,
    private readonly pendingSpendingLimitMapper: PendingSpendingLimitMapper,
  ) {
    this.batchSize =
      this.configurationService.getOrThrow<number>('policies.batchSize');

    this.maxPageSize = this.safeRepository.getTransactionQueueMaxPageSize();
  }

  /**
   * The policies in effect on every Safe of the Space, in one request.
   * `safes` narrows that set of Safes from the Space - it can only ever be a subset.
   */
  public async getSpaceActivePolicies(
    request: SpacePolicyRequest,
  ): Promise<Array<ActivePolicy>> {
    const spaceSafes = await this.spaceSafes(request);

    return await this.resolveActivePolicies(spaceSafes, request.types);
  }

  /**
   * The spending-limit changes in the transaction queue of every Safe of the
   * Space, or the requested subset of them.
   */
  public async getSpacePendingPolicies(
    request: SpacePolicyRequest,
  ): Promise<Array<PendingPolicy>> {
    const spaceSafes = await this.spaceSafes(request);

    return await this.resolvePendingPolicies(spaceSafes, request.types);
  }

  /**
   * The Safes of the Space, or the requested subset of them.
   *
   * @throws {UnprocessableEntityException} when a requested Safe is not in the
   * Space - silently narrowing to nothing would look like a Space whose Safes
   * hold no policies.
   */
  private async spaceSafes(
    request: SpacePolicyRequest,
  ): Promise<Array<SafeRef>> {
    const userId = getAuthenticatedUserIdOrFail(request.authPayload);
    await assertMember(this.membersRepository, request.spaceId, userId);

    const safesInSpace = (
      await this.spaceSafesRepository.findBySpaceId(request.spaceId)
    ).map((safe) => ({
      chainId: safe.chainId,
      address: safe.address,
    }));

    const requested = request.safes;

    // If no specific Safes requested in Space, return all.
    if (!requested) {
      return safesInSpace;
    }

    const safeNotInSpace = requested.find(
      (requestedSafe) =>
        !safesInSpace.some((safe) => this.compareSafes(safe, requestedSafe)),
    );

    if (safeNotInSpace) {
      throw new UnprocessableEntityException(
        `Safe ${safeNotInSpace.chainId}:${safeNotInSpace.address} is not in this space`,
      );
    }

    // Narrowing filters the Space's own Safes rather than mapping the request,
    // so a Safe asked for twice - repeated outright, or in another casing - is
    // still read once and its policies reported once.
    return safesInSpace.filter((safe) =>
      requested.some((wanted) => this.compareSafes(safe, wanted)),
    );
  }

  private compareSafes(a: SafeRef, b: SafeRef): boolean {
    return a.chainId === b.chainId && isAddressEqual(a.address, b.address);
  }

  /**
   * The policies in effect on every Safe of {@link safes}.
   *
   * `types` is the set of policy types to report. The query parameter that
   * feeds it is required and rejects an empty value, so a caller wanting
   * everything names everything - which is why nothing here has to decide what
   * an unfiltered request would have meant.
   */
  private async resolveActivePolicies(
    safes: ReadonlyArray<SafeRef>,
    types: ReadonlyArray<PolicyType>,
  ): Promise<Array<ActivePolicy>> {
    const spendingLimitsRequested = types.includes(PolicyType.SpendingLimit);
    const proposersRequested = types.includes(PolicyType.Proposer);

    if (
      safes.length === 0 ||
      !(spendingLimitsRequested || proposersRequested)
    ) {
      return [];
    }

    const state = spendingLimitsRequested
      ? await this.policyIndexerRepository.getState({ safes })
      : null;
    const enabledModulesPerSafe = spendingLimitsRequested
      ? await this.enabledModulesPerSafe(safes)
      : null;
    const tokenMetadata = state
      ? await this.getTokenMetadata(state.allowances)
      : new Map<TokenMetadataKey, SpendingLimitToken>();
    const delegatesPerSafe = proposersRequested
      ? await this.delegatesPerSafe(safes)
      : null;

    const policies: Array<ActivePolicy> = [];

    for (const [index, safe] of safes.entries()) {
      if (state && enabledModulesPerSafe) {
        const enabledModules = enabledModulesPerSafe[index];

        // A Safe whose enabled modules could not be read is skipped.
        if (enabledModules) {
          policies.push(
            ...this.spendingLimitMapper.map({
              safe,
              allowances: this.getAllowancesBySafe(state.allowances, safe),
              enabledModules,
              tokenMetadata,
            }),
          );
        }
      }

      if (delegatesPerSafe) {
        const delegates = delegatesPerSafe[index];

        // A Safe whose delegates could not be read is skipped.
        if (delegates) {
          policies.push(...this.proposerMapper.map({ safe, delegates }));
        }
      }
    }

    return policies;
  }

  /**
   * The metadata of every token referenced by an allowance in
   * {@link allowances}, keyed by {@link tokenMetadataKey} so the mapper can
   * look up each allowance's token without fetching it again.
   *
   * The native currency (`address(0)`) has no ERC20 metadata to fetch: the
   * transaction service's token endpoint only indexes ERC20/ERC721 and 404s on
   * the zero address, so it is represented as a `NativeToken` built from the
   * chain's own config (`chain.nativeCurrency`) instead of one read through
   * `ITokenRepository`.
   *
   */
  private async getTokenMetadata(
    allowances: ReadonlyArray<PolicyIndexerSafeAllowance>,
  ): Promise<Map<TokenMetadataKey, SpendingLimitToken>> {
    const nativeTokens = await this.fetchNativeTokens(
      this.nativeCurrencyChainIds(allowances),
    );
    const erc20Tokens = await this.fetchErc20Tokens(
      this.erc20TokensToFetch(allowances),
    );

    return new Map([...nativeTokens, ...erc20Tokens]);
  }

  private isNativeCurrency(allowance: PolicyIndexerSafeAllowance): boolean {
    return isAddressEqual(allowance.token, zeroAddress);
  }

  /** The distinct chains a native-currency allowance in {@link allowances} is on. */
  private nativeCurrencyChainIds(
    allowances: ReadonlyArray<PolicyIndexerSafeAllowance>,
  ): Array<string> {
    return [
      ...new Set(
        allowances
          .filter((allowance) => this.isNativeCurrency(allowance))
          .map((allowance) => allowance.chainId),
      ),
    ];
  }

  /**
   * The distinct `(chainId, address)` pairs an ERC20 allowance in
   * {@link allowances} references.
   */
  private erc20TokensToFetch(
    allowances: ReadonlyArray<PolicyIndexerSafeAllowance>,
  ): Array<{ chainId: string; address: Address }> {
    // Keyed by the same `chainId:address` the fetched token is later stored
    // under, so an allowance repeating a token - another spender, another
    // Safe, same chain - collapses to the one pair fetched here.
    const byKey = new Map<
      TokenMetadataKey,
      { chainId: string; address: Address }
    >();
    for (const allowance of allowances) {
      if (this.isNativeCurrency(allowance)) {
        continue;
      }
      const pair = { chainId: allowance.chainId, address: allowance.token };
      byKey.set(tokenMetadataKey(pair), pair);
    }
    return [...byKey.values()];
  }

  private async fetchNativeTokens(
    chainIds: ReadonlyArray<string>,
  ): Promise<Map<TokenMetadataKey, SpendingLimitToken>> {
    const tokens = new Map<TokenMetadataKey, SpendingLimitToken>();

    const results = await batched(chainIds, this.batchSize, (chainId) =>
      this.chainsRepository.getChain(chainId),
    );
    results.forEach((result, index) => {
      const chainId = chainIds[index];
      if (result.status !== 'fulfilled') {
        this.loggingService.debug({
          message: "Could not read a chain's native currency",
          chainId,
          error: asError(result.reason).message,
        });
        return;
      }
      const nativeToken: NativeToken = {
        type: 'NATIVE_TOKEN',
        address: zeroAddress,
        ...result.value.nativeCurrency,
        // Not a Transaction Service token-list membership - the native
        // currency is trusted by definition.
        trusted: true,
      };
      tokens.set(
        tokenMetadataKey({ chainId, address: zeroAddress }),
        nativeToken,
      );
    });

    return tokens;
  }

  private async fetchErc20Tokens(
    pairs: ReadonlyArray<{ chainId: string; address: Address }>,
  ): Promise<Map<TokenMetadataKey, SpendingLimitToken>> {
    const tokens = new Map<TokenMetadataKey, SpendingLimitToken>();

    const results = await batched(pairs, this.batchSize, (pair) =>
      this.tokenRepository.getToken(pair),
    );
    results.forEach((result, index) => {
      const pair = pairs[index];
      if (result.status !== 'fulfilled') {
        this.loggingService.debug({
          message: 'Could not read a token',
          chainId: pair.chainId,
          address: pair.address,
          error: asError(result.reason).message,
        });
        return;
      }
      if (result.value.type === 'ERC721') {
        this.loggingService.debug({
          message:
            "An allowance's token resolved to an ERC721, not a fungible token",
          chainId: pair.chainId,
          address: pair.address,
        });
        return;
      }
      tokens.set(tokenMetadataKey(pair), result.value);
    });

    return tokens;
  }

  /**
   * The pending spending-limit changes of every Safe of {@link safes}.
   *
   * `spending-limit` is the only pending type supported currently - a proposer is
   * off-chain and requires no Safe transaction, so it never has a queued state.
   *
   * Concurrency is capped at `policies.batchSize`. A Safe
   * whose queue could not be read is skipped rather than failing the whole
   * request.
   */
  private async resolvePendingPolicies(
    safes: ReadonlyArray<SafeRef>,
    types: ReadonlyArray<PolicyType>,
  ): Promise<Array<PendingPolicy>> {
    if (safes.length === 0 || !types.includes(PolicyType.SpendingLimit)) {
      return [];
    }

    const settled = await batched(safes, this.batchSize, (safe) =>
      this.pendingPoliciesForSafe(safe),
    );

    const policies: Array<PendingPolicy> = [];

    for (const [index, result] of settled.entries()) {
      if (result.status === 'fulfilled') {
        policies.push(...result.value);
        continue;
      }

      const safe = safes[index];
      this.loggingService.warn({
        message: 'Could not read the transaction queue of a Safe',
        chainId: safe.chainId,
        safeAddress: safe.address,
        error: asError(result.reason).message,
      });
    }

    return policies;
  }

  /**
   * The pending spending-limit changes found in one Safe's transaction queue.
   *
   * Reads the whole queue per Safe, capped at
   * {@link PoliciesService.MAX_TRANSACTION_QUEUE_PAGES_TO_SCAN} pages as a safety valve
   * against a runaway queue.
   */
  private async pendingPoliciesForSafe(
    safe: SafeRef,
  ): Promise<Array<PendingPolicy>> {
    const safeInfo = await this.safeRepository.getSafe({
      chainId: safe.chainId,
      address: safe.address,
    });

    const transactions: Array<MultisigTransaction> = [];
    let next: string | null = null;

    for (
      let page = 0;
      page < PoliciesService.MAX_TRANSACTION_QUEUE_PAGES_TO_SCAN;
      page++
    ) {
      const queue = await this.safeRepository.getTransactionQueue({
        chainId: safe.chainId,
        safe: safeInfo,
        limit: this.maxPageSize,
        offset: page * this.maxPageSize,
      });
      transactions.push(...queue.results);
      next = queue.next;

      if (!next) {
        break;
      }
    }

    if (next) {
      this.loggingService.warn({
        message: 'Truncated a Safe transaction queue at the page cap',
        chainId: safe.chainId,
        safeAddress: safe.address,
        pages: PoliciesService.MAX_TRANSACTION_QUEUE_PAGES_TO_SCAN,
      });
    }

    return this.pendingSpendingLimitMapper.map({
      safe,
      transactions,
    });
  }

  /**
   * The delegates of every Safe of {@link safes}, index-aligned with it.
   *
   * The Safes are independent reads, so they go out concurrently rather than
   * one at a time. Concurrency is capped at `policies.batchSize`. A Safe
   * whose delegates could not be read is reported as `null` rather than
   * failing the whole request - the caller skips just that Safe's proposer
   * policy instead.
   */
  private async delegatesPerSafe(
    safes: ReadonlyArray<SafeRef>,
  ): Promise<Array<Array<Delegate> | null>> {
    const settled = await batched(safes, this.batchSize, (safe) =>
      this.delegates(safe),
    );

    return settled.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      const safe = safes[index];
      this.loggingService.warn({
        message: 'Could not read delegates of a Safe',
        chainId: safe.chainId,
        safeAddress: safe.address,
        error: asError(result.reason).message,
      });
      return null;
    });
  }

  /**
   * The addresses registered as delegates of the Safe - what a proposer grant
   * is.
   */
  private async delegates(safe: SafeRef): Promise<Array<Delegate>> {
    const { results } = await this.delegatesV3Repository.getDelegates({
      chainId: safe.chainId,
      safeAddress: safe.address,
      limit: this.maxPageSize,
    });

    return results;
  }

  /**
   * The enabled modules of every Safe of {@link safes}, index-aligned with it.
   *
   * Concurrency is capped at `policies.batchSize`. Unlike
   * {@link delegatesPerSafe}, a Safe whose modules could not be read is
   * reported as `null` rather than failing the whole request - the caller
   * skips just that Safe's spending-limit policies instead.
   */
  private async enabledModulesPerSafe(
    safes: ReadonlyArray<SafeRef>,
  ): Promise<Array<ReadonlyArray<Address> | null>> {
    const settled = await batched(safes, this.batchSize, (safe) =>
      this.enabledModules(safe),
    );

    return settled.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      const safe = safes[index];
      this.loggingService.warn({
        message: 'Could not read enabled modules of a Safe',
        chainId: safe.chainId,
        safeAddress: safe.address,
        error: asError(result.reason).message,
      });
      return null;
    });
  }

  /**
   * The modules the Safe has enabled, which is what turns a configured
   * module policy into an enforced one.
   *
   * Read from the Safe rather than the indexer: enablement lives in the Safe's
   * own storage, and CGW already serves it.
   */
  private async enabledModules(safe: SafeRef): Promise<ReadonlyArray<Address>> {
    const { modules } = await this.safeRepository.getSafe({
      chainId: safe.chainId,
      address: safe.address,
    });

    return modules ?? [];
  }

  /**
   * The allowance rows belonging to {@link safe}.
   *
   * One indexer read covers every Safe of a request, so an unscoped read would
   * report another Safe's policies on this one.
   */
  private getAllowancesBySafe(
    allowances: ReadonlyArray<PolicyIndexerSafeAllowance>,
    safe: SafeRef,
  ): Array<PolicyIndexerSafeAllowance> {
    return allowances.filter(
      (allowance) =>
        allowance.chainId === safe.chainId &&
        isAddressEqual(allowance.safe, safe.address),
    );
  }
}
