// SPDX-License-Identifier: FSL-1.1-MIT

import {
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type Address, isAddressEqual, zeroAddress } from 'viem';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { batched } from '#/domain/common/utils/batch';
import { toSecondsTimestamp } from '#/domain/common/utils/time';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { asError } from '#/logging/utils';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '#/modules/auth/utils/assert-authenticated.utils';
import { IChainsRepository } from '#/modules/chains/domain/chains.repository.interface';
import type { Delegate } from '#/modules/delegate/domain/entities/delegate.entity';
import { IDelegatesV3Repository } from '#/modules/delegate/domain/v3/delegates.v3.repository.interface';
import type { ActivePolicy } from '#/modules/policies/domain/entities/active-policy.entity';
import type {
  PolicyIndexerConfigurationRoot,
  PolicyIndexerGuardEnforcedPolicy,
} from '#/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import type {
  PendingGuardConfiguration,
  PendingPolicy,
  PendingQueuedPolicy,
} from '#/modules/policies/domain/entities/pending-policy.entity';
import { PolicyType } from '#/modules/policies/domain/entities/policy-type.entity';
import type { SafeRef } from '#/modules/policies/domain/entities/safe-ref.entity';
import type { StoredPolicyConfiguration } from '#/modules/policies/domain/entities/stored-policy-configuration.entity';
import type {
  Token,
  TokenReference,
} from '#/modules/policies/domain/entities/token.entity';
import { IPolicyIndexerRepository } from '#/modules/policies/domain/policy-indexer.repository.interface';
import { ISafePolicyGuardConfigurationRequestsRepository } from '#/modules/policies/domain/safe-policy-guard-configuration-requests.repository.interface';
import {
  GUARD_POLICY_TYPES,
  guardPolicyKindsOf,
} from '#/modules/policies/domain/utils/policy.utils';
import {
  type TokenMetadataKey,
  tokenMetadataKey,
} from '#/modules/policies/domain/utils/token-metadata-key.utils';
import { GuardConfigurationMapper } from '#/modules/policies/routes/mappers/guard-configuration.mapper';
import { GuardPolicyMapper } from '#/modules/policies/routes/mappers/guard-policy.mapper';
import { GuardSetupMapper } from '#/modules/policies/routes/mappers/guard-setup.mapper';
import { PendingSpendingLimitMapper } from '#/modules/policies/routes/mappers/pending-spending-limit.mapper';
import { ProposerMapper } from '#/modules/policies/routes/mappers/proposer.mapper';
import { SpendingLimitMapper } from '#/modules/policies/routes/mappers/spending-limit.mapper';

import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import { assertMember } from '#/modules/spaces/domain/space-assert.utils';
import type { NativeToken } from '#/modules/tokens/domain/entities/token.entity';
import { ITokenRepository } from '#/modules/tokens/domain/token.repository.interface';
import { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';
import type { Caip10Address } from '#/validation/entities/schemas/caip-10-addresses.schema';

type SpacePolicyRequest = {
  spaceId: Space['id'];
  /** Narrows the read to a subset of the Space's Safes. */
  safes?: ReadonlyArray<Caip10Address>;
  /** The policy types to report. Required: naming none asks for nothing. */
  types: ReadonlyArray<PolicyType>;
  authPayload: AuthPayload;
};

type Enforcers = {
  enabledModules: ReadonlyArray<Address>;
  transactionGuard: Address | null;
  moduleGuard: Address | null;
};

/**
 * What the guard items of a pending read are built from, read once for every
 * Safe of the request.
 */
type GuardState = {
  roots: ReadonlyArray<PolicyIndexerConfigurationRoot>;
  bindings: ReadonlyArray<PolicyIndexerGuardEnforcedPolicy>;
  stored: ReadonlyArray<StoredPolicyConfiguration>;
};

/**
 * One pending read, as each Safe of it sees it.
 */
type PendingRead = {
  types: ReadonlyArray<PolicyType>;
  spendingLimitsRequested: boolean;
  guardPoliciesRequested: boolean;
  /** `null` when guard policies are not requested, or could not be read. */
  guardState: GuardState | null;
  /** Unix seconds, the same for every Safe of the read. */
  now: number;
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
    @Inject(ISafePolicyGuardConfigurationRequestsRepository)
    private readonly configurationRequestsRepository: ISafePolicyGuardConfigurationRequestsRepository,
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
    private readonly guardPolicyMapper: GuardPolicyMapper,
    private readonly guardSetupMapper: GuardSetupMapper,
    private readonly guardConfigurationMapper: GuardConfigurationMapper,
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
   * The pending policy changes of every Safe of the Space, or the requested
   * subset of them.
   */
  public async getSpacePendingPolicies(
    request: SpacePolicyRequest,
  ): Promise<Array<PendingPolicy>> {
    const spaceSafes = await this.spaceSafes(request);

    return await this.resolvePendingPolicies(
      request.spaceId,
      spaceSafes,
      request.types,
    );
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
    const guardPolicyKinds = guardPolicyKindsOf(types);
    const guardPoliciesRequested = guardPolicyKinds.length > 0;

    if (
      safes.length === 0 ||
      !(spendingLimitsRequested || guardPoliciesRequested || proposersRequested)
    ) {
      return [];
    }

    // One indexer read serves both halves - it answers with the allowance rows
    // and the guard bindings alike - and so does the Safe read that follows it,
    // for the modules and the guard slot that say which of them are enforced.
    const indexerRequested = spendingLimitsRequested || guardPoliciesRequested;
    const state = indexerRequested
      ? await this.policyIndexerRepository.getState({
          safes,
          guardPolicyKinds,
        })
      : null;
    const enforcersPerSafe = indexerRequested
      ? await this.enforcersPerSafe(safes)
      : null;
    const tokenMetadata =
      state && spendingLimitsRequested
        ? await this.getTokenMetadata(state.allowances)
        : new Map<TokenMetadataKey, Token>();
    const delegatesPerSafe = proposersRequested
      ? await this.delegatesPerSafe(safes)
      : null;

    const policies: Array<ActivePolicy> = [];

    for (const [index, safe] of safes.entries()) {
      // A Safe whose modules and guard could not be read is skipped.
      const enforcers = enforcersPerSafe?.[index] ?? null;

      if (state && enforcers && spendingLimitsRequested) {
        policies.push(
          ...this.spendingLimitMapper.map({
            safe,
            allowances: state.allowances.filter((allowance) =>
              this.isScopedToSafe(allowance, safe),
            ),
            enabledModules: enforcers.enabledModules,
            tokenMetadata,
          }),
        );
      }

      if (delegatesPerSafe) {
        const delegates = delegatesPerSafe[index];

        // A Safe whose delegates could not be read is skipped.
        if (delegates) {
          policies.push(...this.proposerMapper.map({ safe, delegates }));
        }
      }

      if (state && enforcers && guardPoliciesRequested) {
        policies.push(
          ...this.guardPolicyMapper.map({
            safe,
            bindings: state.guardPolicyBindings.filter((binding) =>
              this.isScopedToSafe(binding, safe),
            ),
            transactionGuard: enforcers.transactionGuard,
            moduleGuard: enforcers.moduleGuard,
          }),
        );
      }
    }

    return policies;
  }

  private async getTokenMetadata(
    references: ReadonlyArray<TokenReference>,
  ): Promise<Map<TokenMetadataKey, Token>> {
    const nativeTokens = await this.fetchNativeTokens(
      this.nativeCurrencyChainIds(references),
    );
    const erc20Tokens = await this.fetchErc20Tokens(
      this.erc20TokensToFetch(references),
    );

    return new Map([...nativeTokens, ...erc20Tokens]);
  }

  private isNativeCurrency(reference: TokenReference): boolean {
    return isAddressEqual(reference.token, zeroAddress);
  }

  /** The distinct chains a native-currency reference in {@link references} is on. */
  private nativeCurrencyChainIds(
    references: ReadonlyArray<TokenReference>,
  ): Array<string> {
    return [
      ...new Set(
        references
          .filter((reference) => this.isNativeCurrency(reference))
          .map((reference) => reference.chainId),
      ),
    ];
  }

  /**
   * The distinct `(chainId, address)` pairs an ERC20 reference in
   * {@link references} names.
   */
  private erc20TokensToFetch(
    references: ReadonlyArray<TokenReference>,
  ): Array<{ chainId: string; address: Address }> {
    // Keyed by the same `chainId:address` the fetched token is later stored
    // under, so a reference repeating a token - another spender, another
    // Safe, same chain - collapses to the one pair fetched here.
    const byKey = new Map<
      TokenMetadataKey,
      { chainId: string; address: Address }
    >();
    for (const reference of references) {
      if (this.isNativeCurrency(reference)) {
        continue;
      }
      const pair = { chainId: reference.chainId, address: reference.token };
      byKey.set(tokenMetadataKey(pair), pair);
    }
    return [...byKey.values()];
  }

  private async fetchNativeTokens(
    chainIds: ReadonlyArray<string>,
  ): Promise<Map<TokenMetadataKey, Token>> {
    const tokens = new Map<TokenMetadataKey, Token>();

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
  ): Promise<Map<TokenMetadataKey, Token>> {
    const tokens = new Map<TokenMetadataKey, Token>();

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
   * The pending policy changes of every Safe of {@link safes}.
   *
   * A proposer is off-chain and needs no Safe transaction, so it never has a
   * pending state.
   *
   * Concurrency is capped at `policies.batchSize`. A Safe
   * whose queue could not be read is skipped rather than failing the whole
   * request.
   */
  private async resolvePendingPolicies(
    spaceId: Space['id'],
    safes: ReadonlyArray<SafeRef>,
    types: ReadonlyArray<PolicyType>,
  ): Promise<Array<PendingPolicy>> {
    const spendingLimitsRequested = types.includes(PolicyType.SpendingLimit);
    const guardPoliciesRequested = guardPolicyKindsOf(types).length > 0;

    if (
      safes.length === 0 ||
      !(spendingLimitsRequested || guardPoliciesRequested)
    ) {
      return [];
    }

    const read: PendingRead = {
      types,
      spendingLimitsRequested,
      guardPoliciesRequested,
      guardState: guardPoliciesRequested
        ? await this.guardStateOf(spaceId, safes)
        : null,
      now: toSecondsTimestamp(new Date()),
    };

    const settled = await batched(safes, this.batchSize, (safe) =>
      this.pendingPoliciesForSafe(safe, read),
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

    // Only queued spending-limit changes carry tokens; guard items pass through
    // unchanged and keep their position.
    const queued = policies.filter(
      (policy): policy is PendingQueuedPolicy =>
        policy.kind === 'queued-transaction',
    );
    const tokenMetadata = await this.getTokenMetadata(
      this.pendingSpendingLimitMapper.getTokenReferences(queued),
    );
    return policies.map((policy) =>
      policy.kind === 'queued-transaction'
        ? this.pendingSpendingLimitMapper.attachTokenMetadata(
            [policy],
            tokenMetadata,
          )[0]
        : policy,
    );
  }

  /**
   * The configuration roots, guard policy bindings and stored configurations of
   * every Safe of {@link safes}, read once for all of them.
   *
   * `null` when any of it cannot be read. The guard configuration items are
   * then left out, rather than failing the whole request; the guard setup items
   * do not need any of it and are still reported.
   */
  private async guardStateOf(
    spaceId: Space['id'],
    safes: ReadonlyArray<SafeRef>,
  ): Promise<GuardState | null> {
    try {
      const [state, stored] = await Promise.all([
        this.policyIndexerRepository.getState({
          safes,
          // Every guard kind, whatever was requested: a configuration that
          // removes a policy names no policy contract, so its type comes from
          // the binding it removes.
          guardPolicyKinds: guardPolicyKindsOf(GUARD_POLICY_TYPES),
        }),
        this.configurationRequestsRepository.findBySafes({ spaceId, safes }),
      ]);

      return {
        roots: state.roots,
        bindings: state.guardPolicyBindings,
        stored,
      };
    } catch (error) {
      this.loggingService.warn({
        message: 'Could not read the guard configurations of the Safes',
        spaceId,
        error: asError(error).message,
      });
      return null;
    }
  }

  /**
   * The pending policy changes of one Safe.
   *
   * Reads the whole queue per Safe, capped at
   * {@link PoliciesService.MAX_TRANSACTION_QUEUE_PAGES_TO_SCAN} pages as a safety valve
   * against a runaway queue.
   */
  private async pendingPoliciesForSafe(
    safe: SafeRef,
    read: PendingRead,
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

    const policies: Array<PendingPolicy> = [];

    if (read.spendingLimitsRequested) {
      policies.push(
        ...this.pendingSpendingLimitMapper.map({ safe, transactions }),
      );
    }

    if (read.guardPoliciesRequested) {
      policies.push(
        ...this.guardSetupMapper.map({
          safe,
          guard: safeInfo.guard,
          moduleGuard: safeInfo.moduleGuard,
          transactions,
        }),
      );
    }

    if (read.guardState) {
      policies.push(
        ...this.guardConfigurationsForSafe({
          safe,
          transactions,
          guardState: read.guardState,
          types: read.types,
          now: read.now,
        }),
      );
    }

    return policies;
  }

  /** The delayed guard configurations of one Safe. */
  private guardConfigurationsForSafe(args: {
    safe: SafeRef;
    transactions: ReadonlyArray<MultisigTransaction>;
    guardState: GuardState;
    types: ReadonlyArray<PolicyType>;
    now: number;
  }): Array<PendingGuardConfiguration> {
    const roots = args.guardState.roots.filter((root) =>
      this.isScopedToSafe(root, args.safe),
    );

    return this.guardConfigurationMapper.map({
      safe: args.safe,
      transactions: args.transactions,
      roots,
      stored: args.guardState.stored.filter((stored) =>
        this.compareSafes(
          { chainId: stored.chainId, address: stored.safeAddress },
          args.safe,
        ),
      ),
      bindings: args.guardState.bindings.filter((binding) =>
        this.isScopedToSafe(binding, args.safe),
      ),
      types: args.types,
      now: args.now,
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
   * The {@link enforcers} of every Safe of {@link safes}, index-aligned with it.
   *
   * Concurrency is capped at `policies.batchSize`. A Safe whose modules and
   * guard could not be read is reported as `null` rather than failing the
   * whole request - the caller skips just that Safe's spending-limit and guard
   * policies instead.
   */
  private async enforcersPerSafe(
    safes: ReadonlyArray<SafeRef>,
  ): Promise<Array<Enforcers | null>> {
    const settled = await batched(safes, this.batchSize, (safe) =>
      this.enforcers(safe),
    );

    return settled.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }

      const safe = safes[index];
      this.loggingService.warn({
        message: 'Could not read the modules and guards of a Safe',
        chainId: safe.chainId,
        safeAddress: safe.address,
        error: asError(result.reason).message,
      });
      return null;
    });
  }

  /**
   * What the Safe itself has switched on: the modules it has enabled and the
   * guards it has set, in the transaction and the module slot. These are what
   * turn a configured policy into an enforced one.
   *
   * Read from the Safe rather than the indexer: enablement lives in the Safe's
   * own storage, and CGW already serves it.
   */
  private async enforcers(safe: SafeRef): Promise<Enforcers> {
    const { modules, guard, moduleGuard } = await this.safeRepository.getSafe({
      chainId: safe.chainId,
      address: safe.address,
    });

    return {
      enabledModules: modules ?? [],
      transactionGuard: guard,
      moduleGuard,
    };
  }

  /**
   * Whether an indexer row - an allowance or a guard binding - belongs to
   * {@link safe}.
   *
   * One indexer read covers every Safe of a request, so an unscoped read would
   * report another Safe's policies on this one.
   */
  private isScopedToSafe(
    row: { chainId: string; safe: Address },
    safe: SafeRef,
  ): boolean {
    return (
      row.chainId === safe.chainId && isAddressEqual(row.safe, safe.address)
    );
  }
}
