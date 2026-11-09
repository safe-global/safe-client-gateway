// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { type Address, erc4626Abi } from 'viem';
import { IBlockchainApiManager } from '#/domain/interfaces/blockchain-api.manager.interface';
import type { ModuleTransaction } from '#/modules/safe/domain/entities/module-transaction.entity';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import type { Erc4626VaultTransaction } from '#/modules/transactions/domain/entities/erc4626-vault.entity';
import { findAllowlistedErc4626Vault } from '#/modules/transactions/domain/erc4626-vault.allowlist';
import { KilnVaultHelper } from '#/modules/transactions/routes/helpers/kiln-vault.helper';

/**
 * SPIKE: protocol-agnostic ERC-4626 mapping, independent of Kiln's API.
 * Not wired into `MultisigTransactionInfoMapper` nor registered in
 * TransactionsModule yet; it returns an internal shape, not a public txInfo.
 */
@Injectable()
export class Erc4626VaultTransactionMapper {
  constructor(
    private readonly kilnVaultHelper: KilnVaultHelper,
    @Inject(IBlockchainApiManager)
    private readonly blockchainApiManager: IBlockchainApiManager,
  ) {}

  /**
   * Decodes a call (direct or batched) to an allowlisted ERC-4626 vault.
   *
   * @returns the decoded vault call, or null if the transaction is not a vault
   * call or the vault is not allowlisted on the chain
   */
  public async mapVaultTransaction(args: {
    chainId: string;
    transaction: Pick<
      MultisigTransaction | ModuleTransaction,
      'to' | 'data' | 'value'
    >;
  }): Promise<Erc4626VaultTransaction | null> {
    const call = this.kilnVaultHelper.findVaultCall({
      transaction: args.transaction,
    });
    if (!call?.to) {
      return null;
    }

    const vault = findAllowlistedErc4626Vault({
      chainId: args.chainId,
      address: call.to,
    });
    if (!vault) {
      return null;
    }

    const assets =
      'assets' in call
        ? call.assets
        : await this.convertToAssets({
            chainId: args.chainId,
            vault: vault.address,
            shares: call.shares,
          });

    return {
      method: call.method,
      vault: {
        chainId: vault.chainId,
        address: vault.address,
        name: vault.name,
        protocol: vault.protocol,
      },
      asset: vault.asset,
      assets: assets.toString(),
      shares: 'shares' in call ? call.shares.toString() : null,
      receiver: call.receiver,
      owner: 'owner' in call ? call.owner : null,
      referral: 'referral' in call ? call.referral : null,
    };
  }

  // Current rate, so an estimate for a queued redeem/mint (the rate moves until
  // execution). Goes through the RPC-cached client.
  private async convertToAssets(args: {
    chainId: string;
    vault: Address;
    shares: bigint;
  }): Promise<bigint> {
    const client = await this.blockchainApiManager.getApi(args.chainId);
    return client.readContract({
      address: args.vault,
      abi: erc4626Abi,
      functionName: 'convertToAssets',
      args: [args.shares],
    });
  }
}
