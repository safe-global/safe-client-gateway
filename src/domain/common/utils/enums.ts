export function getEnumKey<
  T extends { [key: string]: number | string; [key: number]: string },
>(enumObj: T, value: number): keyof T {
  const key = enumObj[value];
  if (typeof key !== 'string') {
    throw new Error(`Invalid enum value: ${value}`);
  }
  return key;
}
