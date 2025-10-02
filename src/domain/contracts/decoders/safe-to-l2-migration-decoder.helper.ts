import { Injectable } from '@nestjs/common';
import SafeToL2Migration from '@/abis/safe/v1.4.1/SafeToL2Migration.abi';
import { AbiDecoder } from '@/domain/contracts/decoders/abi-decoder.helper';
import type { Address, Hex } from 'viem';

@Injectable()
export class SafeToL2MigrationDecoder extends AbiDecoder<
  typeof SafeToL2Migration
> {
  constructor() {
    super(SafeToL2Migration);
  }

  /**
   * Decodes migrateToL2 function data
   *
   * @param {Hex} data - The encoded function data
   * @returns {Address} - The L2 singleton address
   * @throws {Error} - If decoding fails or not a migrateToL2 call
   */
  decodeMigrateToL2(data: Hex): Address {
    const decoded = this.decodeFunctionData({ data });

    if (decoded.functionName !== 'migrateToL2') {
      throw new Error('Not a migrateToL2 call');
    }

    return decoded.args[0];
  }
}
