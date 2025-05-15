import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { KilnDecoder } from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import { Erc4262Decoder } from '@/routes/transactions/decoders/erc4262-decoder.helper';
import {
  TransactionFinder,
  TransactionFinderModule,
} from '@/routes/transactions/helpers/transaction-finder.helper';
import { Injectable, Module } from '@nestjs/common';
import {
  ContractFunctionName,
  DecodeFunctionDataReturnType,
  erc4626Abi,
  getAbiItem,
  toFunctionSelector,
} from 'viem';

@Injectable()
export class KilnVaultHelper extends Erc4262Decoder {
  constructor(private readonly transactionFinder: TransactionFinder) {
    super();
  }

  public getVaultDepositTransaction(
    args: Pick<
      MultisigTransaction | ModuleTransaction,
      'to' | 'data' | 'value'
    >,
  ): {
    to?: `0x${string}`;
    data: `0x${string}`;
    assets: number;
  } | null {
    const decoded = this.getDecodedTransaction({
      functionName: 'deposit',
      transaction: args,
    });

    if (!decoded) {
      return null;
    }

    return {
      ...decoded.transaction,
      assets: Number(decoded.args[0]),
    };
  }

  public getVaultRedeemOrWithdrawTransaction(
    args: Pick<
      MultisigTransaction | ModuleTransaction,
      'to' | 'data' | 'value'
    >,
  ): {
    to?: `0x${string}`;
    data: `0x${string}`;
    assets: number;
  } | null {
    const decoded =
      // redeem = full withdrawal from Vault
      this.getDecodedTransaction({
        functionName: 'redeem',
        transaction: args,
      }) ??
      // withdraw = partial withdrawal from Vault
      this.getDecodedTransaction({
        functionName: 'withdraw',
        transaction: args,
      });

    if (!decoded) {
      return null;
    }

    return {
      ...decoded.transaction,
      assets: Number(decoded.args[0]),
    };
  }

  // TODO: Move to generic helper as it replaces a majority of ABI methods
  private getDecodedTransaction<
    TAbi extends typeof erc4626Abi,
    TFunctionName extends ContractFunctionName<TAbi>,
  >(args: {
    functionName: TFunctionName;
    transaction: Pick<
      MultisigTransaction | ModuleTransaction,
      'to' | 'data' | 'value'
    >;
  }): {
    transaction: {
      to?: `0x${string}`;
      data: `0x${string}`;
      value: string;
    };
    args: DecodeFunctionDataReturnType<TAbi, TFunctionName>['args'];
  } | null {
    if (!args.transaction.data || !args.transaction.value) {
      return null;
    }

    // On a type level, functionName can be a union {@link ContractFunctionName},
    // whereas the value is always a string. For type-safety, we extract the first
    // value of the union to use as the name instead of casting
    const name = Array.isArray(args.functionName)
      ? args.functionName[0]
      : args.functionName;

    const item = getAbiItem({
      abi: erc4626Abi,
      name,
    });
    const selector = toFunctionSelector(item);
    const transaction = this.transactionFinder.findTransaction(
      (transaction) => transaction.data.startsWith(selector),
      {
        to: args.transaction.to,
        data: args.transaction.data,
        value: args.transaction.value,
      },
    );

    if (!transaction) {
      return null;
    }

    const decoded = this.decodeFunctionData({
      data: transaction.data,
    });
    if (decoded.functionName !== args.functionName) {
      return null;
    }

    return {
      transaction,
      args: decoded.args,
    };
  }
}

@Module({
  imports: [TransactionFinderModule],
  providers: [Erc4262Decoder, KilnVaultHelper, KilnDecoder],
  exports: [KilnVaultHelper, KilnDecoder],
})
export class KilnVaultHelperModule {}
