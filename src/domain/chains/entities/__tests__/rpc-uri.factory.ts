import { faker } from '@faker-js/faker';
import { RpcUriAuthentication } from '../rpc-uri-authentication.entity';
import { RpcUri } from '../rpc-uri.entity';

export default function (
  authentication?: RpcUriAuthentication,
  value?: string,
): RpcUri {
  return <RpcUri>{
    authentication: authentication ?? RpcUriAuthentication.NoAuthentication,
    value: value ?? faker.internet.url(),
  };
}
