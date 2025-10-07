import { TypedDataSchema } from '@/domain/messages/entities/typed-data.entity';
import type { TypedData } from '@/domain/messages/entities/typed-data.entity';
import type { Address } from 'viem';

//TODO change the obj to actual data
/**
 * Type guard to check if an object is valid EIP-712 typed data.
 *
 * @param obj - The object to check
 * @returns True if the object conforms to the EIP-712 TypedData structure
 *
 */
const isEIP712TypedData = (obj: unknown): obj is TypedData => {
  return TypedDataSchema.safeParse(obj).success;
};

export function prepareMessage(args: {
  chainId: string;
  safeAddress: Address;
  // transactions: Array<DecodedTransactionData>;
  data: unknown;
}): string {
  const { data } = args;
  if (isEIP712TypedData(data)) {
    // const normalizedMsg = normalizeTypedData(data);
    // return JSON.stringify(normalizedMsg);
    return '';
  }
  // else {
  //   return JSON.stringify(
  //     generateTypedData({
  //       safeAddress,
  //       safeVersion: '1.3.0', // TODO: pass to module, taking into account that lower Safe versions don't have chainId in payload
  //       chainId: BigInt(chainId),
  //       data: {
  //         ...data.data,
  //         safeTxGas: data.data.safeTxGas,
  //         baseGas: data.data.baseGas,
  //         gasPrice: data.data.gasPrice,
  //       },
  //     }),
  //   );
  // }
  return '';
}
