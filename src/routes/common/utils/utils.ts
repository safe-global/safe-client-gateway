export function isHex(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('0x');
}

export const shortenAddress = (address: string, length = 4): string => {
  if (!address) {
    return '';
  }

  const visibleCharactersLength = length + 2 * 2;

  if (address.length < visibleCharactersLength) {
    return address;
  }

  return `${address.slice(0, length + 2)}...${address.slice(-length)}`;
};
