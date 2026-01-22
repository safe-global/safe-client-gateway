import { AbiDecoder } from '@/modules/contracts/domain/decoders/abi-decoder.helper';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { Inject, Injectable } from '@nestjs/common';
import { parseAbi } from 'viem';
import type { Address, Hex } from 'viem';

export const KilnAbi = parseAbi([
  'event DepositEvent(bytes pubkey, bytes withdrawal_credentials, bytes amount, bytes signature, bytes index)',
  'event Withdrawal(address indexed withdrawer, address indexed feeRecipient, bytes32 pubKeyRoot, uint256 rewards, uint256 nodeOperatorFee, uint256 treasuryFee)',
  'function deposit()',
  'function requestValidatorsExit(bytes _publicKeys)',
  'function batchWithdrawCLFee(bytes _publicKeys)',
]);

export type KilnRequestValidatorsExitParameters = {
  name: '_publicKeys';
  type: 'bytes';
  value: Address;
  valueDecoded: null;
};
export type KilnBatchWithdrawCLFeeParameters =
  KilnRequestValidatorsExitParameters;

@Injectable()
export class KilnDecoder extends AbiDecoder<typeof KilnAbi> {
  public static readonly KilnPublicKeyLength = 96;
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    super(KilnAbi);
  }

  decodeValidatorsExit(data: Hex): Hex | null {
    if (!this.helpers.isRequestValidatorsExit(data)) {
      return null;
    }
    try {
      const decoded = this.decodeFunctionData({ data });
      if (decoded.functionName !== 'requestValidatorsExit') {
        throw new Error('Data is not of requestValidatorsExit type');
      }
      return decoded.args[0];
    } catch (e) {
      this.loggingService.debug(e);
      return null;
    }
  }

  decodeBatchWithdrawCLFee(data: Hex): Hex | null {
    if (!this.helpers.isBatchWithdrawCLFee(data)) {
      return null;
    }
    try {
      const decoded = this.decodeFunctionData({ data });
      if (decoded.functionName !== 'batchWithdrawCLFee') {
        throw new Error('Data is not of batchWithdrawCLFee type');
      }
      return decoded.args[0];
    } catch (e) {
      this.loggingService.debug(e);
      return null;
    }
  }

  decodeDepositEvent(args: { data: Address; topics: Hex[] }): {
    pubkey: Address;
    withdrawal_credentials: Address;
    amount: Address;
    signature: Hex;
    index: Address;
  } | null {
    try {
      const decoded = this.decodeEventLog({
        ...args,
        topics: args.topics as [signature: Hex, ...args: Array<Address>],
      });
      if (decoded.eventName !== 'DepositEvent') {
        throw new Error('Data is not of DepositEvent type');
      }
      return decoded.args;
    } catch (e) {
      this.loggingService.debug(e);
      return null;
    }
  }

  decodeWithdrawal(args: { data: Address; topics: Hex[] }): {
    withdrawer: Address;
    feeRecipient: Address;
    pubKeyRoot: Address;
    rewards: bigint;
    nodeOperatorFee: bigint;
    treasuryFee: bigint;
  } | null {
    try {
      const decoded = this.decodeEventLog({
        ...args,
        topics: args.topics as [signature: Hex, ...args: Array<Address>],
      });
      if (decoded.eventName !== 'Withdrawal') {
        throw new Error('Data is not of Withdrawal type');
      }
      return decoded.args;
    } catch (e) {
      this.loggingService.debug(e);
      return null;
    }
  }
}
