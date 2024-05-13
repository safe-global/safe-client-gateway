export type AlertsRegistration = {
  address: `0x${string}`;
  chainId: string;
  // {chainId}:{safeAddress}:{moduleAddress}
  displayName?: `${string}:${string}:${string}`;
};
