import crypto from 'crypto';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';

export class CacheRouter {
  private static readonly ACCOUNT_DATA_SETTINGS_KEY = 'account_data_settings';
  private static readonly ACCOUNT_DATA_TYPES_KEY = 'account_data_types';
  private static readonly ACCOUNT_KEY = 'account';
  private static readonly ALL_TRANSACTIONS_KEY = 'all_transactions';
  private static readonly AUTH_NONCE_KEY = 'auth_nonce';
  private static readonly BACKBONE_KEY = 'backbone';
  private static readonly CHAIN_KEY = 'chain';
  private static readonly CHAINS_KEY = 'chains';
  private static readonly CONTRACT_KEY = 'contract';
  private static readonly TRUSTED_FOR_DELEGATE_CALL_CONTRACTS_KEY =
    'trusted_contracts';
  private static readonly COUNTERFACTUAL_SAFE_KEY = 'counterfactual_safe';
  private static readonly COUNTERFACTUAL_SAFES_KEY = 'counterfactual_safes';
  private static readonly CREATION_TRANSACTION_KEY = 'creation_transaction';
  private static readonly DECODED_DATA_KEY = 'decoded_data';
  private static readonly DECODED_DATA_CONTRACTS_KEY = 'decoded_data_contracts';
  private static readonly DELEGATES_KEY = 'delegates';
  private static readonly FIREBASE_OAUTH2_TOKEN_KEY = 'firebase_oauth2_token';
  private static readonly INCOMING_TRANSFERS_KEY = 'incoming_transfers';
  private static readonly INDEXING_KEY = 'indexing';
  private static readonly MESSAGE_KEY = 'message';
  private static readonly MESSAGES_KEY = 'messages';
  private static readonly MODULE_TRANSACTION_KEY = 'module_transaction';
  private static readonly MODULE_TRANSACTIONS_KEY = 'module_transactions';
  private static readonly MULTISIG_TRANSACTION_KEY = 'multisig_transaction';
  private static readonly MULTISIG_TRANSACTIONS_KEY = 'multisig_transactions';
  private static readonly NATIVE_COIN_PRICE_KEY = 'native_coin_price';
  private static readonly OWNERS_SAFE_KEY = 'owner_safes';
  private static readonly RATE_LIMIT_KEY = 'rate_limit';
  private static readonly RELAY_KEY = 'relay';
  private static readonly RPC_REQUESTS_KEY = 'rpc_requests';
  private static readonly SAFE_APPS_KEY = 'safe_apps';
  private static readonly SAFE_BALANCES_KEY = 'safe_balances';
  private static readonly SAFE_COLLECTIBLES_KEY = 'safe_collectibles';
  private static readonly SAFE_EXISTS_KEY = 'safe_exists';
  private static readonly SAFE_FIAT_CODES_KEY = 'safe_fiat_codes';
  private static readonly SAFE_KEY = 'safe';
  private static readonly SINGLETONS_KEY = 'singletons';
  private static readonly STAKING_DEDICATED_STAKING_STATS_KEY =
    'staking_dedicated_staking_stats';
  private static readonly STAKING_DEFI_VAULT_STATS_KEY =
    'staking_defi_vault_stats';
  private static readonly STAKING_DEFI_VAULT_STAKES_KEY =
    'staking_defi_vault_stakes';
  private static readonly STAKING_DEFI_MORPHO_EXTRA_REWARDS_KEY =
    'staking_defi_morpho_extra_rewards';
  private static readonly STAKING_DEPLOYMENTS_KEY = 'staking_deployments';
  private static readonly STAKING_NETWORK_STATS_KEY = 'staking_network_stats';
  private static readonly STAKING_POOLED_STAKING_STATS_KEY =
    'staking_pooled_staking_stats';
  private static readonly STAKING_STAKES_KEY = 'staking_stakes';
  private static readonly STAKING_TRANSACTION_STATUS_KEY =
    'staking_transaction_status';
  private static readonly TARGETED_MESSAGING_OUTREACHES =
    'targeted_messaging_outreaches';
  private static readonly TARGETED_MESSAGING_OUTREACH_FILE_PROCESSOR_LOCK =
    'targeted_messaging_outreach_file_processor_lock';
  private static readonly TARGETED_MESSAGING_SUBMISSION_KEY =
    'targeted_messaging_submission';
  private static readonly TARGETED_MESSAGING_TARGETED_SAFE_KEY =
    'targeted_messaging_targeted_safe';
  private static readonly TOKEN_KEY = 'token';
  private static readonly TOKEN_PRICE_KEY = 'token_price';
  private static readonly TOKENS_KEY = 'tokens';
  private static readonly TRANSFER_KEY = 'transfer';
  private static readonly TRANSFERS_KEY = 'transfers';
  private static readonly UNSUPPORTED_CHAIN_EVENT = 'unsupported_chain_event';
  private static readonly ZERION_BALANCES_KEY = 'zerion_balances';
  private static readonly ZERION_COLLECTIBLES_KEY = 'zerion_collectibles';
  private static readonly ORM_QUERY_CACHE_KEY = 'orm_query_cache';

  static getAuthNonceCacheKey(nonce: string): string {
    return `${CacheRouter.AUTH_NONCE_KEY}_${nonce}`;
  }

  static getAuthNonceCacheDir(nonce: string): CacheDir {
    return new CacheDir(CacheRouter.getAuthNonceCacheKey(nonce), '');
  }

  static getBalancesCacheKey(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): string {
    return `${args.chainId}_${CacheRouter.SAFE_BALANCES_KEY}_${args.safeAddress}`;
  }

  static getBalancesCacheDir(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getBalancesCacheKey(args),
      `${args.trusted}_${args.excludeSpam}`,
    );
  }

  static getZerionBalancesCacheKey(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): string {
    return `${args.chainId}_${CacheRouter.ZERION_BALANCES_KEY}_${args.safeAddress}`;
  }

  static getZerionBalancesCacheDir(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    fiatCode: string;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getZerionBalancesCacheKey(args),
      args.fiatCode,
    );
  }

  static getZerionCollectiblesCacheKey(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): string {
    return `${args.chainId}_${CacheRouter.ZERION_COLLECTIBLES_KEY}_${args.safeAddress}`;
  }

  static getZerionCollectiblesCacheDir(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    limit?: number;
    offset?: number;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getZerionCollectiblesCacheKey(args),
      `${args.limit}_${args.offset}`,
    );
  }

  static getRateLimitCacheKey(prefix: string): string {
    return `${prefix}_${CacheRouter.RATE_LIMIT_KEY}`;
  }

  static getSafeCacheDir(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): CacheDir {
    return new CacheDir(CacheRouter.getSafeCacheKey(args), '');
  }

  static getSafeCacheKey(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): string {
    return `${args.chainId}_${CacheRouter.SAFE_KEY}_${args.safeAddress}`;
  }

  static getIsSafeCacheDir(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): CacheDir {
    return new CacheDir(CacheRouter.getIsSafeCacheKey(args), '');
  }

  static getIsSafeCacheKey(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): string {
    return `${args.chainId}_${CacheRouter.SAFE_EXISTS_KEY}_${args.safeAddress}`;
  }

  static getContractCacheDir(args: {
    chainId: string;
    contractAddress: `0x${string}`;
  }): CacheDir {
    return new CacheDir(
      `${args.chainId}_${CacheRouter.CONTRACT_KEY}_${args.contractAddress}`,
      '',
    );
  }

  static getTrustedForDelegateCallContractsCacheKey(chainId: string): string {
    return `${chainId}_${CacheRouter.TRUSTED_FOR_DELEGATE_CALL_CONTRACTS_KEY}`;
  }

  static getTrustedForDelegateCallContractsCacheDir(chainId: string): CacheDir {
    return new CacheDir(
      CacheRouter.getTrustedForDelegateCallContractsCacheKey(chainId),
      '',
    );
  }

  static getBackboneCacheDir(chainId: string): CacheDir {
    return new CacheDir(`${chainId}_${CacheRouter.BACKBONE_KEY}`, '');
  }

  static getSingletonsCacheDir(chainId: string): CacheDir {
    return new CacheDir(`${chainId}_${CacheRouter.SINGLETONS_KEY}`, '');
  }

  static getCollectiblesCacheDir(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    limit?: number;
    offset?: number;
    trusted?: boolean;
    excludeSpam?: boolean;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getCollectiblesKey(args),
      `${args.limit}_${args.offset}_${args.trusted}_${args.excludeSpam}`,
    );
  }

  static getCollectiblesKey(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): string {
    return `${args.chainId}_${CacheRouter.SAFE_COLLECTIBLES_KEY}_${args.safeAddress}`;
  }

  static getDelegatesCacheKey(args: {
    chainId: string;
    safeAddress?: `0x${string}`;
  }): string {
    return `${args.chainId}_${CacheRouter.DELEGATES_KEY}_${args.safeAddress}`;
  }

  static getDelegatesCacheDir(args: {
    chainId: string;
    safeAddress?: `0x${string}`;
    delegate?: `0x${string}`;
    delegator?: `0x${string}`;
    label?: string;
    limit?: number;
    offset?: number;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getDelegatesCacheKey(args),
      `${args.delegate}_${args.delegator}_${args.label}_${args.limit}_${args.offset}`,
    );
  }

  static getFirebaseOAuth2TokenCacheDir(): CacheDir {
    return new CacheDir(CacheRouter.FIREBASE_OAUTH2_TOKEN_KEY, '');
  }

  static getTransferCacheDir(args: {
    chainId: string;
    transferId: string;
  }): CacheDir {
    return new CacheDir(
      `${args.chainId}_${CacheRouter.TRANSFER_KEY}_${args.transferId}`,
      '',
    );
  }

  static getTransfersCacheDir(args: {
    chainId: string;
    safeAddress: string;
    onlyErc20: boolean;
    onlyErc721: boolean;
    limit?: number;
    offset?: number;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getTransfersCacheKey(args),
      `${args.onlyErc20}_${args.onlyErc721}_${args.limit}_${args.offset}`,
    );
  }

  static getTransfersCacheKey(args: {
    chainId: string;
    safeAddress: string;
  }): string {
    return `${args.chainId}_${CacheRouter.TRANSFERS_KEY}_${args.safeAddress}`;
  }

  static getModuleTransactionCacheDir(args: {
    chainId: string;
    moduleTransactionId: string;
  }): CacheDir {
    return new CacheDir(
      `${args.chainId}_${CacheRouter.MODULE_TRANSACTION_KEY}_${args.moduleTransactionId}`,
      '',
    );
  }

  static getModuleTransactionsCacheDir(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    to?: string;
    txHash?: string;
    module?: string;
    limit?: number;
    offset?: number;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getModuleTransactionsCacheKey(args),
      `${args.to}_${args.module}_${args.txHash}_${args.limit}_${args.offset}`,
    );
  }

  static getModuleTransactionsCacheKey(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): string {
    return `${args.chainId}_${CacheRouter.MODULE_TRANSACTIONS_KEY}_${args.safeAddress}`;
  }

  static getIncomingTransfersCacheDir(args: {
    chainId: string;
    safeAddress: string;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: string;
    value?: string;
    tokenAddress?: string;
    txHash?: string;
    limit?: number;
    offset?: number;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getIncomingTransfersCacheKey(args),
      `${args.executionDateGte}_${args.executionDateLte}_${args.to}_${args.value}_${args.tokenAddress}_${args.txHash}_${args.limit}_${args.offset}`,
    );
  }

  static getIncomingTransfersCacheKey(args: {
    chainId: string;
    safeAddress: string;
  }): string {
    return `${args.chainId}_${CacheRouter.INCOMING_TRANSFERS_KEY}_${args.safeAddress}`;
  }

  static getIndexingCacheDir(chainId: string): CacheDir {
    return new CacheDir(`${chainId}_${CacheRouter.INDEXING_KEY}`, '');
  }

  static getMultisigTransactionsCacheDir(args: {
    chainId: string;
    safeAddress: string;
    ordering?: string;
    executed?: boolean;
    trusted?: boolean;
    executionDateGte?: string;
    executionDateLte?: string;
    to?: string;
    value?: string;
    nonce?: string;
    nonceGte?: number;
    limit?: number;
    offset?: number;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getMultisigTransactionsCacheKey(args),
      `${args.ordering}_${args.executed}_${args.trusted}_${args.executionDateGte}_${args.executionDateLte}_${args.to}_${args.value}_${args.nonce}_${args.nonceGte}_${args.limit}_${args.offset}`,
    );
  }

  static getMultisigTransactionsCacheKey(args: {
    chainId: string;
    safeAddress: string;
  }): string {
    return `${args.chainId}_${CacheRouter.MULTISIG_TRANSACTIONS_KEY}_${args.safeAddress}`;
  }

  static getMultisigTransactionCacheDir(args: {
    chainId: string;
    safeTransactionHash: string;
  }): CacheDir {
    return new CacheDir(CacheRouter.getMultisigTransactionCacheKey(args), '');
  }

  static getMultisigTransactionCacheKey(args: {
    chainId: string;
    safeTransactionHash: string;
  }): string {
    return `${args.chainId}_${CacheRouter.MULTISIG_TRANSACTION_KEY}_${args.safeTransactionHash}`;
  }

  static getCreationTransactionCacheDir(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): CacheDir {
    return new CacheDir(
      `${args.chainId}_${CacheRouter.CREATION_TRANSACTION_KEY}_${args.safeAddress}`,
      '',
    );
  }

  static getDecodedDataCacheKey(args: {
    chainId: string;
    data: `0x${string}`;
    to: `0x${string}`;
  }): string {
    return `${args.chainId}_${CacheRouter.DECODED_DATA_KEY}_${args.data}_${args.to}`;
  }

  static getDecodedDataCacheDir(args: {
    chainId: string;
    data: `0x${string}`;
    to: `0x${string}`;
  }): CacheDir {
    return new CacheDir(CacheRouter.getDecodedDataCacheKey(args), '');
  }

  static getDecodedDataContractsCacheKey(args: {
    chainIds: Array<string>;
    address: `0x${string}`;
    limit?: number;
    offset?: number;
  }): string {
    return `${args.chainIds.sort().join('_')}_${CacheRouter.DECODED_DATA_CONTRACTS_KEY}_${args.address}`;
  }

  static getDecodedDataContractsCacheDir(args: {
    chainIds: Array<string>;
    address: `0x${string}`;
    limit?: number;
    offset?: number;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getDecodedDataContractsCacheKey(args),
      `${args.limit}_${args.offset}`,
    );
  }

  static getAllTransactionsCacheDir(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    ordering?: string;
    executed?: boolean;
    queued?: boolean;
    limit?: number;
    offset?: number;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getAllTransactionsKey(args),
      `${args.ordering}_${args.executed}_${args.queued}_${args.limit}_${args.offset}`,
    );
  }

  static getAllTransactionsKey(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): string {
    return `${args.chainId}_${CacheRouter.ALL_TRANSACTIONS_KEY}_${args.safeAddress}`;
  }

  static getTokenCacheDir(args: {
    chainId: string;
    address: string;
  }): CacheDir {
    return new CacheDir(
      `${args.chainId}_${CacheRouter.TOKEN_KEY}_${args.address}`,
      '',
    );
  }

  static getTokensCacheKey(chainId: string): string {
    return `${chainId}_${CacheRouter.TOKENS_KEY}`;
  }

  static getTokensCacheDir(args: {
    chainId: string;
    limit?: number;
    offset?: number;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getTokensCacheKey(args.chainId),
      `${args.limit}_${args.offset}`,
    );
  }

  static getSafesByOwnerCacheDir(args: {
    chainId: string;
    ownerAddress: `0x${string}`;
  }): CacheDir {
    return new CacheDir(
      `${args.chainId}_${CacheRouter.OWNERS_SAFE_KEY}_${args.ownerAddress}`,
      '',
    );
  }

  static getMessageByHashCacheKey(args: {
    chainId: string;
    messageHash: string;
  }): string {
    return `${args.chainId}_${CacheRouter.MESSAGE_KEY}_${args.messageHash}`;
  }

  static getMessageByHashCacheDir(args: {
    chainId: string;
    messageHash: string;
  }): CacheDir {
    return new CacheDir(this.getMessageByHashCacheKey(args), '');
  }

  static getMessagesBySafeCacheKey(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): string {
    return `${args.chainId}_${CacheRouter.MESSAGES_KEY}_${args.safeAddress}`;
  }

  static getMessagesBySafeCacheDir(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    limit?: number;
    offset?: number;
  }): CacheDir {
    return new CacheDir(
      this.getMessagesBySafeCacheKey(args),
      `${args.limit}_${args.offset}`,
    );
  }

  static getChainsCacheKey(): string {
    return CacheRouter.CHAINS_KEY;
  }

  static getChainsCacheDir(args: {
    limit?: number;
    offset?: number;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getChainsCacheKey(),
      `${args.limit}_${args.offset}`,
    );
  }

  static getChainCacheKey(chainId: string): string {
    return `${chainId}_${CacheRouter.CHAIN_KEY}`;
  }

  static getChainCacheDir(chainId: string): CacheDir {
    return new CacheDir(CacheRouter.getChainCacheKey(chainId), '');
  }

  static getRelayKey(args: {
    chainId: string;
    address: `0x${string}`;
  }): string {
    return `${args.chainId}_${CacheRouter.RELAY_KEY}_${args.address}`;
  }

  static getRelayCacheDir(args: {
    chainId: string;
    address: `0x${string}`;
  }): CacheDir {
    return new CacheDir(CacheRouter.getRelayKey(args), '');
  }

  static getSafeAppsKey(chainId: string): string {
    return `${chainId}_${CacheRouter.SAFE_APPS_KEY}`;
  }

  static getSafeAppsCacheDir(args: {
    chainId?: string;
    clientUrl?: string;
    onlyListed?: boolean;
    url?: string;
  }): CacheDir {
    return new CacheDir(
      `${args.chainId}_${CacheRouter.SAFE_APPS_KEY}`,
      `${args.clientUrl}_${args.onlyListed}_${args.url}`,
    );
  }

  static getNativeCoinPriceCacheDir(args: {
    nativeCoinId: string;
    fiatCode: string;
  }): CacheDir {
    return new CacheDir(
      `${args.nativeCoinId}_${CacheRouter.NATIVE_COIN_PRICE_KEY}_${args.fiatCode}`,
      '',
    );
  }

  static getTokenPriceCacheDir(args: {
    chainName: string;
    fiatCode: string;
    tokenAddress: string;
  }): CacheDir {
    return new CacheDir(
      `${args.chainName}_${CacheRouter.TOKEN_PRICE_KEY}_${args.tokenAddress}_${args.fiatCode}`,
      '',
    );
  }

  static getPriceFiatCodesCacheDir(): CacheDir {
    return new CacheDir(CacheRouter.SAFE_FIAT_CODES_KEY, '');
  }

  static getAccountCacheDir(address: `0x${string}`): CacheDir {
    return new CacheDir(`${CacheRouter.ACCOUNT_KEY}_${address}`, '');
  }

  static getAccountDataTypesCacheDir(): CacheDir {
    return new CacheDir(CacheRouter.ACCOUNT_DATA_TYPES_KEY, '');
  }

  static getAccountDataSettingsCacheDir(address: `0x${string}`): CacheDir {
    return new CacheDir(
      `${CacheRouter.ACCOUNT_DATA_SETTINGS_KEY}_${address}`,
      '',
    );
  }

  static getCounterfactualSafeCacheDir(
    chainId: string,
    predictedAddress: `0x${string}`,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${CacheRouter.COUNTERFACTUAL_SAFE_KEY}_${predictedAddress}`,
      '',
    );
  }

  static getCounterfactualSafesCacheDir(address: `0x${string}`): CacheDir {
    return new CacheDir(
      `${CacheRouter.COUNTERFACTUAL_SAFES_KEY}_${address}`,
      '',
    );
  }

  static getRpcRequestsKey(chainId: string): string {
    return `${chainId}_${CacheRouter.RPC_REQUESTS_KEY}`;
  }

  static getRpcRequestsCacheDir(args: {
    chainId: string;
    method: string;
    params: string;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getRpcRequestsKey(args.chainId),
      `${args.method}_${args.params}`,
    );
  }

  static getStakingDeploymentsCacheDir(
    cacheType: 'earn' | 'staking',
  ): CacheDir {
    return new CacheDir(this.STAKING_DEPLOYMENTS_KEY, cacheType);
  }

  static getStakingNetworkStatsCacheDir(
    cacheType: 'earn' | 'staking',
  ): CacheDir {
    return new CacheDir(this.STAKING_NETWORK_STATS_KEY, cacheType);
  }

  static getStakingDedicatedStakingStatsCacheDir(
    cacheType: 'earn' | 'staking',
  ): CacheDir {
    return new CacheDir(this.STAKING_DEDICATED_STAKING_STATS_KEY, cacheType);
  }

  static getStakingPooledStakingStatsCacheDir(args: {
    cacheType: 'earn' | 'staking';
    pool: `0x${string}`;
  }): CacheDir {
    return new CacheDir(
      `${this.STAKING_POOLED_STAKING_STATS_KEY}_${args.pool}`,
      args.cacheType,
    );
  }

  static getStakingDefiVaultStatsCacheDir(args: {
    cacheType: 'earn' | 'staking';
    chainId: string;
    vault: `0x${string}`;
  }): CacheDir {
    return new CacheDir(
      `${args.chainId}_${this.STAKING_DEFI_VAULT_STATS_KEY}_${args.vault}`,
      args.cacheType,
    );
  }

  static getStakingDefiVaultStakesCacheDir(args: {
    cacheType: 'earn' | 'staking';
    chainId: string;
    safeAddress: `0x${string}`;
    vault: `0x${string}`;
  }): CacheDir {
    return new CacheDir(
      `${args.chainId}_${this.STAKING_DEFI_VAULT_STAKES_KEY}_${args.safeAddress}_${args.vault}`,
      args.cacheType,
    );
  }

  static getStakingDefiMorphoExtraRewardsCacheDir(args: {
    cacheType: 'earn' | 'staking';
    chainId: string;
    safeAddress: `0x${string}`;
  }): CacheDir {
    return new CacheDir(
      `${args.chainId}_${this.STAKING_DEFI_MORPHO_EXTRA_REWARDS_KEY}_${args.safeAddress}`,
      args.cacheType,
    );
  }

  /**
   * Calculated the chain/Safe-specific cache key of {@link Stake}.
   *
   * @param {string} args.chainId - Chain ID
   * @param {string} args.safeAddress - Safe address
   * @returns {string} - Cache key
   */
  static getStakingStakesCacheKey(args: {
    chainId: string;
    safeAddress: `0x${string}`;
  }): string {
    return `${args.chainId}_${CacheRouter.STAKING_STAKES_KEY}_${args.safeAddress}`;
  }

  /**
   * Calculate cache directory for staking stakes.
   *
   * Note: This function hashes the validators' public keys to keep the
   * cache field short and deterministic. Redis and other cache systems
   * may experience performance degradation with long fields.
   *
   * @param {string} args.cacheType - Cache type (earn or staking)
   * @param {string} args.chainId - Chain ID
   * @param {string} args.safeAddress - Safe address
   * @param {string} args.validatorsPublicKeys - Array of validators public keys
   * @returns {@link CacheDir} - Cache directory
   */
  static getStakingStakesCacheDir(args: {
    cacheType: 'earn' | 'staking';
    chainId: string;
    safeAddress: `0x${string}`;
    validatorsPublicKeys: Array<`0x${string}`>;
  }): CacheDir {
    const hash = crypto.createHash('sha256');
    hash.update(args.validatorsPublicKeys.join('_'));
    return new CacheDir(
      CacheRouter.getStakingStakesCacheKey(args),
      `${args.cacheType}_${hash.digest('hex')}`,
    );
  }

  static getUnsupportedChainEventCacheKey(chainId: string): string {
    return `${chainId}_${this.UNSUPPORTED_CHAIN_EVENT}`;
  }

  static getStakingTransactionStatusCacheDir(args: {
    cacheType: 'earn' | 'staking';
    chainId: string;
    txHash: `0x${string}`;
  }): CacheDir {
    return new CacheDir(
      `${args.chainId}_${CacheRouter.STAKING_TRANSACTION_STATUS_KEY}_${args.txHash}`,
      args.cacheType,
    );
  }

  static getTargetedSafeCacheKey(outreachId: number): string {
    return `${CacheRouter.TARGETED_MESSAGING_TARGETED_SAFE_KEY}_${outreachId}`;
  }

  static getTargetedSafeCacheDir(args: {
    outreachId: number;
    safeAddress: `0x${string}`;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getTargetedSafeCacheKey(args.outreachId),
      args.safeAddress,
    );
  }

  static getSubmissionCacheKey(outreachId: number): string {
    return `${CacheRouter.TARGETED_MESSAGING_SUBMISSION_KEY}_${outreachId}`;
  }

  static getSubmissionCacheDir(args: {
    outreachId: number;
    safeAddress: `0x${string}`;
    signerAddress: `0x${string}`;
  }): CacheDir {
    return new CacheDir(
      CacheRouter.getSubmissionCacheKey(args.outreachId),
      `${args.safeAddress}_${args.signerAddress}`,
    );
  }

  static getOutreachesCacheDir(): CacheDir {
    return new CacheDir(CacheRouter.TARGETED_MESSAGING_OUTREACHES, '');
  }

  static getOutreachFileProcessorCacheKey(): string {
    return CacheRouter.TARGETED_MESSAGING_OUTREACH_FILE_PROCESSOR_LOCK;
  }

  static getOutreachFileProcessorCacheDir(): CacheDir {
    return new CacheDir(CacheRouter.getOutreachFileProcessorCacheKey(), '');
  }

  /**
   * Gets the in-memory cache key for the given cacheDir.
   */
  static getMemoryKey(cacheDir: CacheDir): string {
    return `${cacheDir.key}:${cacheDir.field}`;
  }

  /**
   * Gets Redis cache key for the ORM query cache.
   *
   * @param {string} prefix - Prefix for the cache key
   * @param {string} chainId - Chain ID
   * @param {string} safeAddress - Safe address
   *
   * @returns {string} - Cache key
   */
  static getOrnCacheKey(
    prefix: string,
    chainId: string,
    safeAddress: `0x${string}`,
  ): string {
    return `${CacheRouter.ORM_QUERY_CACHE_KEY}:${prefix}:${chainId}:${safeAddress}`;
  }
}
