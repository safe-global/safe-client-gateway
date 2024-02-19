export const IRelayApi = Symbol('IRelayApi');

export interface IRelayApi {
  relay(args: {
    chainId: string;
    to: string;
    data: string;
    gasLimit: string | null;
  }): Promise<{ taskId: string }>;
}
