import { KilnDecoder } from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import {
  TransactionFinder,
  TransactionFinderModule,
} from '@/routes/transactions/helpers/transaction-finder.helper';
import { Injectable, Module } from '@nestjs/common';
import { toFunctionSelector } from 'viem';

@Injectable()
export class KilnNativeStakingHelper {
  // TODO: Extract from KilnAbi
  private static readonly DEPOSIT_SIGNATURE =
    'function deposit() external payable';
  private static readonly VALIDATORS_EXIT_SIGNATURE =
    'function requestValidatorsExit(bytes) external';
  private static readonly WITHDRAW_SIGNATURE =
    'function batchWithdrawCLFee(bytes) external';

  constructor(private readonly transactionFinder: TransactionFinder) {}

  public findDepositTransaction(args: {
    chainId: string;
    to?: `0x${string}`;
    data: `0x${string}`;
    value: string;
  }): { to?: `0x${string}`; data: `0x${string}`; value: string } | null {
    const selector = toFunctionSelector(
      KilnNativeStakingHelper.DEPOSIT_SIGNATURE,
    );
    return this.transactionFinder.findTransaction(
      (transaction) => transaction.data.startsWith(selector),
      args,
    );
  }

  public findValidatorsExitTransaction(args: {
    chainId: string;
    to?: `0x${string}`;
    data: `0x${string}`;
    value: string;
  }): { to?: `0x${string}`; data: `0x${string}`; value: string } | null {
    const selector = toFunctionSelector(
      KilnNativeStakingHelper.VALIDATORS_EXIT_SIGNATURE,
    );
    return this.transactionFinder.findTransaction(
      (transaction) => transaction.data.startsWith(selector),
      args,
    );
  }

  public findWithdrawTransaction(args: {
    chainId: string;
    to?: `0x${string}`;
    data: `0x${string}`;
    value: string;
  }): { to?: `0x${string}`; data: `0x${string}`; value: string } | null {
    const selector = toFunctionSelector(
      KilnNativeStakingHelper.WITHDRAW_SIGNATURE,
    );
    return this.transactionFinder.findTransaction(
      (transaction) => transaction.data.startsWith(selector),
      args,
    );
  }

  /**
   * Splits the public keys into an array of public keys.
   *
   * Each {@link KilnDecoder.KilnPublicKeyLength} characters represent a validator to withdraw, so the public keys
   * are split into an array of strings of length {@link KilnDecoder.KilnPublicKeyLength}.
   *
   * @param publicKeys - the public keys to split
   * @returns
   */
  public splitPublicKeys(publicKeys: `0x${string}`): `0x${string}`[] {
    // Remove initial `0x` of decoded `_publicKeys`
    const publicKeysString = publicKeys.slice(2);
    const publicKeysArray: `0x${string}`[] = [];
    for (
      let i = 0;
      i < publicKeysString.length;
      i += KilnDecoder.KilnPublicKeyLength
    ) {
      publicKeysArray.push(
        `0x${publicKeysString.slice(i, i + KilnDecoder.KilnPublicKeyLength)}`,
      );
    }
    return publicKeysArray;
  }
}

@Module({
  imports: [TransactionFinderModule],
  providers: [KilnNativeStakingHelper, KilnDecoder],
  exports: [KilnNativeStakingHelper, KilnDecoder],
})
export class KilnNativeStakingHelperModule {}
