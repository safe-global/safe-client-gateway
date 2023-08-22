export interface RelayApi {
  getRelayCount(args: { chainId: string; address: string }): Promise<number>;

  relay(args: { chainId: string; data: string; to: string }): Promise<unknown>;
}
