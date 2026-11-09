// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable, Module } from '@nestjs/common';
import { decodeFunctionData } from 'viem';
import type { ModuleTransaction } from '#/modules/safe/domain/entities/module-transaction.entity';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import { KilnDecoder } from '#/modules/staking/domain/contracts/decoders/kiln-decoder.helper';
import {
  type Erc4626VaultCall,
  type Erc4626VaultMethod,
  Erc4626VaultMethods,
} from '#/modules/transactions/domain/entities/erc4626-vault.entity';
import {
  ERC4626_VAULT_SELECTORS,
  erc4626VaultAbi,
} from '#/modules/transactions/routes/decoders/erc4626-vault.abi';
import {
  TransactionFinder,
  TransactionFinderModule,
} from '#/modules/transactions/routes/helpers/transaction-finder.helper';

@Injectable()
export class KilnVaultHelper {
  constructor(private readonly transactionFinder: TransactionFinder) {}

  public getVaultDepositTransaction(
    args: Pick<
      MultisigTransaction | ModuleTransaction,
      'to' | 'data' | 'value'
    >,
  ):
    | (Pick<Erc4626VaultCall, 'to' | 'data' | 'value'> & {
        assets: bigint;
      })
    | null {
    const call = this.findVaultCall({
      transaction: args,
      methods: ['deposit'],
    });

    if (call?.method !== 'deposit') {
      return null;
    }

    return {
      to: call.to,
      data: call.data,
      value: call.value,
      assets: call.assets,
    };
  }

  public getVaultRedeemOrWithdrawTransaction(
    args: Pick<
      MultisigTransaction | ModuleTransaction,
      'to' | 'data' | 'value'
    >,
  ): Extract<Erc4626VaultCall, { method: 'redeem' | 'withdraw' }> | null {
    const call = this.findVaultCall({
      transaction: args,
      // redeem = full withdrawal (in shares), withdraw = partial (in assets)
      methods: ['redeem', 'withdraw'],
    });

    if (call?.method === 'redeem' || call?.method === 'withdraw') {
      return call;
    }

    return null;
  }

  /**
   * Finds and decodes an ERC-4626 call, made directly or batched in a MultiSend.
   *
   * @param args.transaction - transaction to search
   * @param args.methods - vault methods to look for, all of them by default
   * @returns the decoded call, or null if none is found
   */
  public findVaultCall(args: {
    transaction: Pick<
      MultisigTransaction | ModuleTransaction,
      'to' | 'data' | 'value'
    >;
    methods?: ReadonlyArray<Erc4626VaultMethod>;
  }): Erc4626VaultCall | null {
    const { to, data, value } = args.transaction;
    if (!(data && value)) {
      return null;
    }

    const selectors = (args.methods ?? Erc4626VaultMethods).flatMap(
      (method) => ERC4626_VAULT_SELECTORS[method],
    );
    const transaction = this.transactionFinder.findTransaction(
      (transaction) => {
        return selectors.some((selector) => {
          return transaction.data.startsWith(selector);
        });
      },
      { to, data, value },
    );

    if (!transaction) {
      return null;
    }

    return this.decodeVaultCall(transaction);
  }

  private decodeVaultCall(
    transaction: Pick<Erc4626VaultCall, 'to' | 'data' | 'value'>,
  ): Erc4626VaultCall | null {
    const decoded = decodeFunctionData({
      abi: erc4626VaultAbi,
      data: transaction.data,
    });

    switch (decoded.functionName) {
      case 'deposit': {
        const [assets, receiver] = decoded.args;
        const referral = decoded.args.length === 3 ? decoded.args[2] : null;
        return {
          ...transaction,
          method: 'deposit',
          assets,
          receiver,
          referral,
        };
      }
      case 'mint': {
        const [shares, receiver] = decoded.args;
        const referral = decoded.args.length === 3 ? decoded.args[2] : null;
        return { ...transaction, method: 'mint', shares, receiver, referral };
      }
      case 'withdraw': {
        const [assets, receiver, owner] = decoded.args;
        return { ...transaction, method: 'withdraw', assets, receiver, owner };
      }
      case 'redeem': {
        const [shares, receiver, owner] = decoded.args;
        return { ...transaction, method: 'redeem', shares, receiver, owner };
      }
      default: {
        return null;
      }
    }
  }
}

@Module({
  imports: [TransactionFinderModule],
  providers: [KilnVaultHelper, KilnDecoder],
  exports: [KilnVaultHelper, KilnDecoder],
})
export class KilnVaultHelperModule {}
