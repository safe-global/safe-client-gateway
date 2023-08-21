export function isHex(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('0x');
}
