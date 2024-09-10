import { AbiDecoder } from '@/domain/contracts/decoders/abi-decoder.helper';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';
import { Inject, Injectable } from '@nestjs/common';

export const KilnAbi = [
  {
    inputs: [],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes', name: '_publicKeys', type: 'bytes' }],
    name: 'requestValidatorsExit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes', name: '_publicKeys', type: 'bytes' }],
    name: 'batchWithdrawCLFee',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export type KilnRequestValidatorsExitParameters = {
  name: '_publicKeys';
  type: 'bytes';
  value: `0x${string}`;
  valueDecoded: null;
};
export type KilnBatchWithdrawCLFeeParameters =
  KilnRequestValidatorsExitParameters;

@Injectable()
export class KilnDecoder extends AbiDecoder<typeof KilnAbi> {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    super(KilnAbi);
  }

  decodeDeposit(
    data: `0x${string}`,
  ): { method: string; parameters: [] } | null {
    if (!this.helpers.isDeposit(data)) {
      return null;
    }
    try {
      const decoded = this.decodeFunctionData({ data });
      if (decoded.functionName !== 'deposit') {
        throw new Error('Data is not of deposit type');
      }
      return {
        method: decoded.functionName,
        parameters: [],
      };
    } catch (e) {
      this.loggingService.debug(e);
      return null;
    }
  }

  decodeValidatorsExit(data: `0x${string}`): {
    method: string;
    parameters: KilnRequestValidatorsExitParameters[];
  } | null {
    if (!this.helpers.isRequestValidatorsExit(data)) {
      return null;
    }
    try {
      const decoded = this.decodeFunctionData({ data });
      if (decoded.functionName !== 'requestValidatorsExit') {
        throw new Error('Data is not of requestValidatorsExit type');
      }
      return {
        method: decoded.functionName,
        parameters: [
          {
            name: '_publicKeys',
            type: 'bytes',
            value: decoded.args[0],
            valueDecoded: null,
          },
        ],
      };
    } catch (e) {
      this.loggingService.debug(e);
      return null;
    }
  }

  decodeBatchWithdrawCLFee(data: `0x${string}`): {
    method: string;
    parameters: KilnBatchWithdrawCLFeeParameters[];
  } | null {
    if (!this.helpers.isBatchWithdrawCLFee(data)) {
      return null;
    }
    try {
      const decoded = this.decodeFunctionData({ data });
      if (decoded.functionName !== 'batchWithdrawCLFee') {
        throw new Error('Data is not of batchWithdrawCLFee type');
      }
      return {
        method: decoded.functionName,
        parameters: [
          {
            name: '_publicKeys',
            type: 'bytes',
            value: decoded.args[0],
            valueDecoded: null,
          },
        ],
      };
    } catch (e) {
      this.loggingService.debug(e);
      return null;
    }
  }
}
