import { Abi, decodeFunctionData } from 'viem';
import { Hex } from 'viem/types/misc';

/**
 * Argument mapper representation for a contract function.
 *
 * The generic parameter represents the expected type that should be returned
 * by the mapper.
 */
export type ContractFunctionArgsMapper<B> = {
  name: string;
  mapper: (args: readonly unknown[]) => B;
};

/**
 * Decodes the arguments of the {@link contractFunction} given the provided
 * {@link abi}.
 *
 * @param contractFunction - the contract function used to decode the arguments
 * @param abi - the abi of the contract use to check the function call
 * @param data - the data representing the function call
 */
export function decode<B>(
  contractFunction: ContractFunctionArgsMapper<B>,
  abi: readonly unknown[] | Abi,
  data: Hex,
): B {
  const { functionName, args } = decodeFunctionData({
    abi,
    data,
  });

  if (contractFunction.name != functionName || !args)
    throw Error(`Provided data is not a call to ${contractFunction.name}`);

  return contractFunction.mapper(args);
}

/**
 * Checks if a {@link data} can represent a call to a target with {@link abi}
 *
 * @param abi - the abi of the contract to check the function call with
 * @param data - the data containing the function call
 */
export function isCall(abi: readonly unknown[] | Abi, data: Hex): boolean {
  try {
    decodeFunctionData({
      abi,
      data,
    });
  } catch {
    return false;
  }

  return true;
}
