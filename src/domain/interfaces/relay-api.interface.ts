export const IRelayApi = Symbol('IRelayApi');

export interface IRelayApi {
  relay(args: {
    chainId: string;
    to: string;
    data: string;
    gasLimit: bigint | null;
  }): Promise<{ taskId: string }>;

  getRelayCount(args: { chainId: string; address: string }): Promise<number>;

  setRelayCount(args: {
    chainId: string;
    address: string;
    count: number;
  }): Promise<void>;
}
