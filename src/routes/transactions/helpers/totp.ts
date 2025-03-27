const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export const deriveTotpKey = async (args: {
  secret: string;
  hash: `0x${string}`;
}): Promise<string> => {
  // Decode Base32 secret into bytes
  const secretBytes = decodeBase32(args.secret.toUpperCase());

  // Convert hex string into bytes
  const hexBytes = new Uint8Array(
    args.hash.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
  );

  // Import key material for HKDF
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    hexBytes,
    { name: 'HKDF' },
    false,
    ['deriveBits'],
  );

  // Perform HKDF
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(secretBytes),
      info: new TextEncoder().encode('TOTP-key-derivation'),
    },
    keyMaterial,
    80, // 10 bytes * 8 bits per byte
  );

  // Convert derived bits to Base32
  const derivedKeyBytes = new Uint8Array(derivedBits);
  return encodeBase32(derivedKeyBytes).replace(/=/g, ''); // Remove padding
};

function decodeBase32(key: string): Array<number> {
  const bits = key
    .split('')
    .map((char) => ALPHABET.indexOf(char).toString(2).padStart(5, '0'))
    .join('');
  return bits.match(/.{1,8}/g)?.map((byte) => parseInt(byte, 2)) || [];
}

function encodeBase32(bytes: Array<number> | Uint8Array): string {
  let bits = '';
  for (let i = 0; i < bytes.length; i++) {
    bits += bytes[i].toString(2).padStart(8, '0');
  }
  return (
    bits
      .match(/.{1,5}/g)
      ?.map((chunk) => ALPHABET[parseInt(chunk.padEnd(5, '0'), 2)])
      .join('') || ''
  );
}
