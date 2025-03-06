export function getApprovedHashSignature(owner: `0x${string}`): `0x${string}` {
  return ('0x000000000000000000000000' +
    owner.slice(2) +
    '0000000000000000000000000000000000000000000000000000000000000000' +
    '01') as `0x${string}`;
}

export function getContractSignature(owner: `0x${string}`): `0x${string}` {
  return ('0x000000000000000000000000' +
    owner.slice(2) +
    '0000000000000000000000000000000000000000000000000000000000000000' +
    '00') as `0x${string}`;
}

export function adjustEthSignSignature(
  signature: `0x${string}`,
): `0x${string}` {
  const v = parseInt(signature.slice(-2), 16);
  return (signature.slice(0, 130) + (v + 4).toString(16)) as `0x${string}`;
}
