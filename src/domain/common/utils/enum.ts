import type { ValueTransformer } from 'typeorm';

export function getEnumKey<
  T extends { [key: string]: number | string; [key: number]: string },
>(enumObj: T, value: number): keyof T {
  const key = enumObj[value];
  if (typeof key !== 'string') {
    throw new Error(`Invalid enum value: ${value}`);
  }
  return key;
}

export const databaseEnumTransformer = <
  T extends { [key: string]: number | string; [key: number]: string },
>(
  enumObj: T,
): ValueTransformer => {
  return {
    to: (value: keyof typeof enumObj) => enumObj[value],
    from: (value: number): keyof T => getEnumKey(enumObj, value),
  };
};
