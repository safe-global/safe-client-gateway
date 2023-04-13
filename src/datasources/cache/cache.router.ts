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
  private static readonly INCOMING_TRANSFERS_KEY = 'incoming_transfers';
  private static readonly MASTER_COPIES_KEY = 'master-copies';
  private static readonly MESSAGE_KEY = 'message';
  private static readonly MESSAGES_KEY = 'messages';
  private static readonly MODULE_TRANSACTIONS_KEY = 'module_transactions';
  private static readonly MULTISIG_TRANSACTION_KEY = 'multisig_transaction';
  private static readonly MULTISIG_TRANSACTIONS_KEY = 'multisig_transactions';
  private static readonly OWNERS_SAFE_KEY = 'owner_safes';
  private static readonly SAFE_APPS_KEY = 'safe_apps';
  private static readonly SAFE_KEY = 'safe';
  private static readonly TOKEN_KEY = 'token';
  private static readonly TOKENS_KEY = 'tokens';
  private static readonly TRANSFERS_KEY = 'transfers';

  static getBalanceCacheDir(
    chainId: string,
    safeAddress: string,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${safeAddress}_${CacheRouter.BALANCES_KEY}`,
      `${trusted}_${excludeSpam}`,
    );
  }

  static getSafeCacheDir(chainId: string, safeAddress: string): CacheDir {
    return new CacheDir(
      `${chainId}_${safeAddress}_${CacheRouter.SAFE_KEY}`,
      '',
    );
  }

  static getContractCacheDir(
    chainId: string,
    contractAddress: string,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${CacheRouter.CONTRACT_KEY}`,
      contractAddress,
    );
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
      `${chainId}_${safeAddress}_${CacheRouter.COLLECTIBLES_KEY}`,
      `${limit}_${offset}_${trusted}_${excludeSpam}`,
    );
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
      `${chainId}_${CacheRouter.DELEGATES_KEY}`,
      `${safeAddress}_${delegate}_${delegator}_${label}_${limit}_${offset}`,
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
      `${chainId}_${safeAddress}_${CacheRouter.TRANSFERS_KEY}`,
      `${onlyErc20}_${onlyErc721}_${limit}_${offset}`,
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
      `${chainId}_${safeAddress}_${CacheRouter.MODULE_TRANSACTIONS_KEY}`,
      `${to}_${module}_${limit}_${offset}`,
    );
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
      `${chainId}_${safeAddress}_${CacheRouter.INCOMING_TRANSFERS_KEY}`,
      `${executionDateGte}_${executionDateLte}_${to}_${value}_${tokenAddress}_${limit}_${offset}`,
    );
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
    limit?: number,
    offset?: number,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${safeAddress}_${CacheRouter.MULTISIG_TRANSACTIONS_KEY}`,
      `${ordering}_${executed}_${trusted}_${executionDateGte}_${executionDateLte}_${to}_${value}_${nonce}_${limit}_${offset}`,
    );
  }

  static getMultisigTransactionCacheDir(
    chainId: string,
    safeTransactionHash: string,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${safeTransactionHash}_${CacheRouter.MULTISIG_TRANSACTION_KEY}`,
      '',
    );
  }

  static getCreationTransactionCacheDir(
    chainId: string,
    safeAddress: string,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${safeAddress}_${CacheRouter.CREATION_TRANSACTION_KEY}`,
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
      `${chainId}_${safeAddress}_${CacheRouter.ALL_TRANSACTIONS_KEY}`,
      `${ordering}_${executed}_${queued}_${limit}_${offset}`,
    );
  }

  static getTokenCacheDir(chainId: string, address: string): CacheDir {
    return new CacheDir(`${chainId}_${CacheRouter.TOKEN_KEY}`, address);
  }

  static getTokensCacheDir(
    chainId: string,
    limit?: number,
    offset?: number,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${CacheRouter.TOKENS_KEY}`,
      `${limit}_${offset}`,
    );
  }

  static getSafesByOwnerCacheDir(
    chainId: string,
    ownerAddress: string,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${ownerAddress}_${CacheRouter.OWNERS_SAFE_KEY}`,
      '',
    );
  }

  static getMessageByHashCacheDir(
    chainId: string,
    messageHash: string,
  ): CacheDir {
    return new CacheDir(
      `${chainId}_${messageHash}_${CacheRouter.MESSAGE_KEY}`,
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
      `${chainId}_${safeAddress}_${CacheRouter.MESSAGES_KEY}`,
      `${limit}_${offset}`,
    );
  }

  static getChainsCacheDir(limit?: number, offset?: number): CacheDir {
    return new CacheDir(CacheRouter.CHAINS_KEY, `${limit}_${offset}`);
  }

  static getChainCacheDir(chainId: string): CacheDir {
    return new CacheDir(`${chainId}_${CacheRouter.CHAIN_KEY}`, '');
  }

  static getSafeAppsCacheDir(
    chainId?: string,
    clientUrl?: string,
    url?: string,
  ): CacheDir {
    return new CacheDir(
      CacheRouter.SAFE_APPS_KEY,
      `${chainId}_${clientUrl}_${url}`,
    );
  }
}
