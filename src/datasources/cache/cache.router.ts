import { CacheDir } from './entities/cache-dir.entity';

export class CacheRouter {
  private static readonly ALL_TRANSACTIONS_KEY = 'all_transactions';
  private static readonly BACKBONE_KEY = 'backbone';
  private static readonly BALANCES_KEY = 'balances';
  private static readonly CHAIN_KEY = 'chain';
  private static readonly CHAINS_KEY = 'chains';
  private static readonly COLLECTIBLES_KEY = 'collectibles';
  private static readonly CONTRACT_KEY = 'contract';
  private static readonly CREATION_TRANSACTION_KEY = 'creation_transaction';
  private static readonly DELEGATES_KEY = 'delegates';
  private static readonly EXCHANGE_FIAT_CODES_KEY = 'exchange_fiat_codes';
  private static readonly EXCHANGE_RATES_KEY = 'exchange_rates';
  private static readonly INCOMING_TRANSFERS_KEY = 'incoming_transfers';
  private static readonly MASTER_COPIES_KEY = 'master_copies';
  private static readonly MESSAGE_KEY = 'message';
  private static readonly MESSAGES_KEY = 'messages';
  private static readonly MODULE_TRANSACTION_KEY = 'module_transaction';
  private static readonly MODULE_TRANSACTIONS_KEY = 'module_transactions';
  private static readonly MULTISIG_TRANSACTION_KEY = 'multisig_transaction';
  private static readonly MULTISIG_TRANSACTIONS_KEY = 'multisig_transactions';
  private static readonly OWNERS_SAFE_KEY = 'owner_safes';
  private static readonly SAFE_APPS_KEY = 'safe_apps';
  private static readonly SAFE_KEY = 'safe';
  private static readonly TOKEN_KEY = 'token';
  private static readonly TOKENS_KEY = 'tokens';
  private static readonly TRANSFER_KEY = 'transfer';
  private static readonly TRANSFERS_KEY = 'transfers';

  static getBalancesCacheKey(chainId: string, safeAddress: string): string {
    return `${chainId}_${CacheRouter.BALANCES_KEY}_${safeAddress}`;
  }

  static getBalanceCacheDir(
    chainId: string,
    safeAddress: string,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): CacheDir {
    return new CacheDir(
      CacheRouter.getBalancesCacheKey(chainId, safeAddress),
      `${trusted}_${excludeSpam}`,
    );
  }

  static getSafeCacheDir(chainId: string, safeAddress: string): CacheDir {
    return new CacheDir(
      `${chainId}_${CacheRouter.SAFE_KEY}_${safeAddress}`,
      '',
    );
  }

  static getSafeCacheKey(chainId: string, safeAddress: string): string {
    return `${chainId}_${CacheRouter.SAFE_KEY}_${safeAddress}`;
  }

  static getContractCacheDir(
    chainId: string,
    contractAddress: string,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${CacheRouter.CONTRACT_KEY}_${contractAddress}`,
      '',
    );
  }

  static getContractsCachePattern(): string {
    return `*_${CacheRouter.CONTRACT_KEY}_*`;
  }

  static getBackboneCacheDir(chainId: string): CacheDir {
    return new CacheDir(`${chainId}_${CacheRouter.BACKBONE_KEY}`, '');
  }

  static getMasterCopiesCacheDir(chainId: string): CacheDir {
    return new CacheDir(`${chainId}_${CacheRouter.MASTER_COPIES_KEY}`, '');
  }

  static getCollectiblesCacheDir(
    chainId: string,
    safeAddress: string,
    limit?: number,
    offset?: number,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${CacheRouter.COLLECTIBLES_KEY}_${safeAddress}`,
      `${limit}_${offset}_${trusted}_${excludeSpam}`,
    );
  }

  static getCollectiblesKey(chainId: string, safeAddress: string) {
    return `${chainId}_${CacheRouter.COLLECTIBLES_KEY}_${safeAddress}`;
  }

  static getDelegatesCacheDir(
    chainId: string,
    safeAddress?: string,
    delegate?: string,
    delegator?: string,
    label?: string,
    limit?: number,
    offset?: number,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${CacheRouter.DELEGATES_KEY}_${safeAddress}`,
      `${delegate}_${delegator}_${label}_${limit}_${offset}`,
    );
  }

  static getTransferCacheDir(chainId: string, transferId: string): CacheDir {
    return new CacheDir(
      `${chainId}_${CacheRouter.TRANSFER_KEY}_${transferId}`,
      '',
    );
  }

  static getTransfersCacheDir(
    chainId: string,
    safeAddress: string,
    onlyErc20: boolean,
    onlyErc721: boolean,
    limit?: number,
    offset?: number,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${CacheRouter.TRANSFERS_KEY}_${safeAddress}`,
      `${onlyErc20}_${onlyErc721}_${limit}_${offset}`,
    );
  }

  static getTransfersCacheKey(chainId: string, safeAddress: string) {
    return `${chainId}_${CacheRouter.TRANSFERS_KEY}_${safeAddress}`;
  }

  static getModuleTransactionCacheDir(
    chainId: string,
    moduleTransactionId: string,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${CacheRouter.MODULE_TRANSACTION_KEY}_${moduleTransactionId}`,
      '',
    );
  }

  static getModuleTransactionsCacheDir(
    chainId: string,
    safeAddress: string,
    to?: string,
    module?: string,
    limit?: number,
    offset?: number,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${CacheRouter.MODULE_TRANSACTIONS_KEY}_${safeAddress}`,
      `${to}_${module}_${limit}_${offset}`,
    );
  }

  static getModuleTransactionsCacheKey(
    chainId: string,
    safeAddress: string,
  ): string {
    return `${chainId}_${CacheRouter.MODULE_TRANSACTIONS_KEY}_${safeAddress}`;
  }

  static getIncomingTransfersCacheDir(
    chainId: string,
    safeAddress: string,
    executionDateGte?: string,
    executionDateLte?: string,
    to?: string,
    value?: string,
    tokenAddress?: string,
    limit?: number,
    offset?: number,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${CacheRouter.INCOMING_TRANSFERS_KEY}_${safeAddress}`,
      `${executionDateGte}_${executionDateLte}_${to}_${value}_${tokenAddress}_${limit}_${offset}`,
    );
  }

  static getIncomingTransfersCacheKey(
    chainId: string,
    safeAddress: string,
  ): string {
    return `${chainId}_${CacheRouter.INCOMING_TRANSFERS_KEY}_${safeAddress}`;
  }

  static getMultisigTransactionsCacheDir(
    chainId: string,
    safeAddress: string,
    ordering?: string,
    executed?: boolean,
    trusted?: boolean,
    executionDateGte?: string,
    executionDateLte?: string,
    to?: string,
    value?: string,
    nonce?: string,
    nonceGte?: number,
    limit?: number,
    offset?: number,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${CacheRouter.MULTISIG_TRANSACTIONS_KEY}_${safeAddress}`,
      `${ordering}_${executed}_${trusted}_${executionDateGte}_${executionDateLte}_${to}_${value}_${nonce}_${nonceGte}_${limit}_${offset}`,
    );
  }

  static getMultisigTransactionsCacheKey(
    chainId: string,
    safeAddress: string,
  ): string {
    return `${chainId}_${CacheRouter.MULTISIG_TRANSACTIONS_KEY}_${safeAddress}`;
  }

  static getMultisigTransactionCacheDir(
    chainId: string,
    safeTransactionHash: string,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${CacheRouter.MULTISIG_TRANSACTION_KEY}_${safeTransactionHash}`,
      '',
    );
  }

  static getMultisigTransactionCacheKey(
    chainId: string,
    safeTransactionHash: string,
  ): string {
    return `${chainId}_${CacheRouter.MULTISIG_TRANSACTION_KEY}_${safeTransactionHash}`;
  }

  static getCreationTransactionCacheDir(
    chainId: string,
    safeAddress: string,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${CacheRouter.CREATION_TRANSACTION_KEY}_${safeAddress}`,
      '',
    );
  }

  static getAllTransactionsCacheDir(
    chainId: string,
    safeAddress: string,
    ordering?: string,
    executed?: boolean,
    queued?: boolean,
    limit?: number,
    offset?: number,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${CacheRouter.ALL_TRANSACTIONS_KEY}_${safeAddress}`,
      `${ordering}_${executed}_${queued}_${limit}_${offset}`,
    );
  }

  static getTokenCacheDir(chainId: string, address: string): CacheDir {
    return new CacheDir(`${chainId}_${CacheRouter.TOKEN_KEY}_${address}`, '');
  }

  static getTokensCacheKey(chainId: string): string {
    return `${chainId}_${CacheRouter.TOKENS_KEY}`;
  }

  static getTokensCacheDir(
    chainId: string,
    limit?: number,
    offset?: number,
  ): CacheDir {
    return new CacheDir(
      CacheRouter.getTokensCacheKey(chainId),
      `${limit}_${offset}`,
    );
  }

  static getTokensCachePattern(chainId: string): string {
    return `${chainId}_${CacheRouter.TOKEN_KEY}_*`;
  }

  static getSafesByOwnerCacheDir(
    chainId: string,
    ownerAddress: string,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${CacheRouter.OWNERS_SAFE_KEY}_${ownerAddress}`,
      '',
    );
  }

  static getMessageByHashCacheDir(
    chainId: string,
    messageHash: string,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${CacheRouter.MESSAGE_KEY}_${messageHash}`,
      '',
    );
  }

  static getMessagesBySafeCacheDir(
    chainId: string,
    safeAddress: string,
    limit?: number,
    offset?: number,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${CacheRouter.MESSAGES_KEY}_${safeAddress}`,
      `${limit}_${offset}`,
    );
  }

  static getChainsCacheKey(): string {
    return CacheRouter.CHAINS_KEY;
  }

  static getChainsCacheDir(limit?: number, offset?: number): CacheDir {
    return new CacheDir(CacheRouter.getChainsCacheKey(), `${limit}_${offset}`);
  }

  static getChainCacheDir(chainId: string): CacheDir {
    return new CacheDir(`${chainId}_${CacheRouter.CHAIN_KEY}`, '');
  }

  static getChainsCachePattern(): string {
    return `*_${CacheRouter.CHAIN_KEY}$`;
  }

  static getSafeAppsCacheDir(
    chainId?: string,
    clientUrl?: string,
    url?: string,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${CacheRouter.SAFE_APPS_KEY}`,
      `${clientUrl}_${url}`,
    );
  }

  static getExchangeFiatCodesCacheDir(): CacheDir {
    return new CacheDir(CacheRouter.EXCHANGE_FIAT_CODES_KEY, '');
  }

  static getExchangeRatesCacheDir(): CacheDir {
    return new CacheDir(CacheRouter.EXCHANGE_RATES_KEY, '');
  }
}
