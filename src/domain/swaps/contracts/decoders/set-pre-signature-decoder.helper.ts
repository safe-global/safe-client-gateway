import { Injectable } from '@nestjs/common';
import { AbiDecoder } from '@/domain/contracts/decoders/abi-decoder.helper';
import { getFunctionSelector, isHex, parseAbi } from 'viem';

export const abi = parseAbi([
  'function setPreSignature(bytes calldata orderUid, bool signed)',
]);

@Injectable()
export class SetPreSignatureDecoder extends AbiDecoder<typeof abi> {
  private readonly setPreSignatureFunctionSelector: `0x${string}`;

  constructor() {
    super(abi);
    this.setPreSignatureFunctionSelector = getFunctionSelector(abi[0]);
  }

  /**
   * Gets the Order UID associated with the provided transaction data.
   *
   * @param data - the transaction data for the setPreSignature call
   * @returns {`0x${string}`} the order UID or null if the data does not represent a setPreSignature transaction
   */
  getOrderUid(data: `0x${string}`): `0x${string}` | null {
    if (!data.startsWith(this.setPreSignatureFunctionSelector)) return null;
    const { functionName, args } = this.decodeFunctionData({ data });
    if (functionName !== 'setPreSignature') return null;
    if (!args || !args[0] || typeof args[0] !== 'string' || !isHex(args[0]))
      return null;
    return args[0];
  }
}
