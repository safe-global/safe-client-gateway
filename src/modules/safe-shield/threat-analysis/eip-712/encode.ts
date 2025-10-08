/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import type {
  EIP712TypedData,
  TypedDataTypes,
  TypedMessageTypes,
} from './types';
import type { AbiParameter, Hex, HashTypedDataParameters } from 'viem';
import {
  keccak256,
  concat,
  encodeAbiParameters,
  getTypesForEIP712Domain,
  validateTypedData,
  hashDomain,
  toHex,
  isHex,
} from 'viem';

/** This file is fully copied from @safe-global/protocol-kit/
 * https://github.com/safe-global/safe-core-sdk/tree/main/packages/protocol-kit/src/utils/eip-712
 * in order to avoid adding the package as a dependency
 * and reduce the bundle size of the service.
 */

function encodeField({
  types,
  name,
  type,
  value,
}: {
  types: Record<string, Array<TypedDataTypes>>;
  name: string;
  type: string;
  value: any;
}): [type: AbiParameter, value: any] {
  if (types[type] !== undefined) {
    return [
      { type: 'bytes32' },
      keccak256(encodeData({ data: value, primaryType: type, types })),
    ];
  }

  if (type === 'bytes') {
    const prepend = value.length % 2 ? '0' : '';
    value = `0x${prepend + value.slice(2)}`;
    return [{ type: 'bytes32' }, keccak256(value)];
  }

  if (type === 'string') return [{ type: 'bytes32' }, keccak256(toHex(value))];

  if (type.lastIndexOf(']') === type.length - 1) {
    const parsedType = type.slice(0, type.lastIndexOf('['));
    const typeValuePairs = (value as Array<[AbiParameter, any]>).map((item) =>
      encodeField({
        name,
        type: parsedType,
        types,
        value: item,
      }),
    );
    return [
      { type: 'bytes32' },
      keccak256(
        encodeAbiParameters(
          typeValuePairs.map(([t]) => t),
          typeValuePairs.map(([, v]) => v),
        ),
      ),
    ];
  }

  return [{ type }, value];
}

function findTypeDependencies(
  {
    primaryType: primaryType_,
    types,
  }: {
    primaryType: string;
    types: Record<string, Array<TypedDataTypes>>;
  },
  results: Set<string> = new Set(),
): Set<string> {
  const match = primaryType_.match(/^\w*/u);
  const primaryType = match?.[0] || '';
  if (results.has(primaryType) || types[primaryType] === undefined) {
    return results;
  }

  results.add(primaryType);

  for (const field of types[primaryType]) {
    findTypeDependencies({ primaryType: field.type, types }, results);
  }
  return results;
}

function encodeType({
  primaryType,
  types,
}: {
  primaryType: string;
  types: Record<string, Array<TypedDataTypes>>;
}) {
  let result = '';
  const unsortedDeps = findTypeDependencies({ primaryType, types });
  unsortedDeps.delete(primaryType);

  const deps = [primaryType, ...Array.from(unsortedDeps).sort()];
  for (const type of deps) {
    result += `${type}(${types[type].map(({ name, type: t }) => `${t} ${name}`).join(',')})`;
  }

  return result;
}

function hashType({
  primaryType,
  types,
}: {
  primaryType: string;
  types: Record<string, Array<TypedDataTypes>>;
}) {
  const encodedHashType = toHex(encodeType({ primaryType, types }));
  return keccak256(encodedHashType);
}

function encodeData({
  data,
  primaryType,
  types,
}: {
  data: Record<string, unknown>;
  primaryType: string;
  types: Record<string, Array<TypedDataTypes>>;
}) {
  const encodedTypes: Array<AbiParameter> = [{ type: 'bytes32' }];
  const encodedValues: Array<unknown> = [hashType({ primaryType, types })];

  for (const field of types[primaryType]) {
    const [type, value] = encodeField({
      types,
      name: field.name,
      type: field.type,
      value: data[field.name],
    });
    encodedTypes.push(type);
    encodedValues.push(value);
  }

  return encodeAbiParameters(encodedTypes, encodedValues);
}

function hashStruct({
  data,
  primaryType,
  types,
}: {
  data: Record<string, unknown>;
  primaryType: string;
  types: Record<string, Array<TypedDataTypes>>;
}) {
  const encoded = encodeData({
    data,
    primaryType,
    types,
  });
  return keccak256(encoded);
}

function deducePrimaryType(types: TypedMessageTypes) {
  // In ethers the primaryType is assumed to be the first yielded by a forEach of the types keys
  // https://github.com/ethers-io/ethers.js/blob/a4b1d1f43fca14f2e826e3c60e0d45f5b6ef3ec4/src.ts/hash/typed-data.ts#L278C13-L278C20
  return Object.keys(types)[0];
}

function asHex(hex?: string): Hex {
  return isHex(hex) ? hex : `0x${hex}`;
}

function encodeTypedData(typedData: EIP712TypedData): string {
  typedData.primaryType = !typedData?.primaryType
    ? deducePrimaryType(typedData.types)
    : typedData?.primaryType;

  const {
    domain = {},
    message,
    primaryType,
  } = typedData as any as HashTypedDataParameters;
  const types = {
    EIP712Domain: getTypesForEIP712Domain({
      domain: domain as Record<string, unknown>,
    }),
    ...typedData.types,
  };

  // Need to do a runtime validation check on addresses, byte ranges, integer ranges, etc
  // as we can't statically check this with TypeScript.
  validateTypedData({
    domain: domain as any,
    message,
    primaryType: primaryType as any,
    types,
  });

  const parts: Array<Hex> = ['0x1901'];
  if (domain)
    parts.push(
      hashDomain({
        domain,
        types: types,
      }),
    );

  if (primaryType !== 'EIP712Domain')
    parts.push(
      hashStruct({
        data: message,
        primaryType: primaryType,
        types: types,
      }),
    );

  return concat(parts);
}

export function hashTypedData(typedData: EIP712TypedData): string {
  const data = encodeTypedData(typedData);
  return keccak256(asHex(data));
}
