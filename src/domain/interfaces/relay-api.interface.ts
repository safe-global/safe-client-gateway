import { RelayPayload } from '@/domain/relay/limit-addresses.mapper';

export const IRelayApi = Symbol('IRelayApi');

export interface IRelayApi {
  getRelayCount(args: { chainId: string; address: string }): Promise<number>;

  relay(args: RelayPayload): Promise<{ taskId: string }>;
}
