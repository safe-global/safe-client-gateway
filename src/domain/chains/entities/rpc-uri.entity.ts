import { RpcUriAuthentication } from '@/domain/chains/entities/rpc-uri-authentication.entity';

export interface RpcUri {
  authentication: RpcUriAuthentication;
  value: string;
}
