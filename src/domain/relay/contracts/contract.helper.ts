import {
  ContractFunctionArgsMapper,
  decode,
  isCall,
} from '@/domain/relay/entities/contract-function.entity';
import { Hex } from 'viem/types/misc';
import { Abi } from 'viem';

/**
 * The {@link ContractHelper} is an abstraction which, given a contract ABI,
 * provides functionality to query and decode interactions done with that ABI
 */
export abstract class ContractHelper {
  protected abstract readonly abi: readonly unknown[] | Abi;

  /**
   * Decodes the function {@link data} using the specified {@link argsMapper}.
   *
   * An error is thrown in the following conditions:
   *
   * - the {@link argsMapper} function name does not match the function call set in
   * {@link data}
   * - the provided {@link argsMapper} throws an error (e.g.: unexpected arg format).
   *
   * @param argsMapper - the mapper to be used to decode the args provided in {@link data}
   * @param data - the data to be used for decoding the arguments
   */
  decode<B>(argsMapper: ContractFunctionArgsMapper<B>, data: Hex): B {
    return decode(argsMapper, this.abi, data);
  }

  /**
   * Checks if the provided {@link data} represents *any* function call
   * targeting the provided ABI.
   *
   * @param data - the data to be used to check if the function call is part of
   * the provided ABI
   */
  isCall(data: Hex): boolean {
    return isCall(this.abi, data);
  }
}
