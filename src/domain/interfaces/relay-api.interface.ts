export const IRelayApi = Symbol('IRelayApi');

export interface IRelayApi {
  getRelayCount(args: { chainId: string; address: string }): Promise<number>;

  relay(args: {
    chainId: string;
    to: string;
    data: string;
    gasLimit?: string;
  }): Promise<{ taskId: string }>;
}
