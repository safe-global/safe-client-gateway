import { RpcUriAuthentication } from './rpc-uri-authentication.entity';

export interface RpcUri {
  authentication: RpcUriAuthentication;
  value: string;
}
