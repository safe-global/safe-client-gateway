import { faker } from '@faker-js/faker';
import { RpcUriAuthentication } from '../rpc-uri-authentication.entity';
import { RpcUri } from '../rpc-uri.entity';
import { Builder, IBuilder } from '../../../../__tests__/builder';

export function rpcUriBuilder(): IBuilder<RpcUri> {
  return Builder.new<RpcUri>()
    .with('authentication', RpcUriAuthentication.NoAuthentication)
    .with('value', faker.internet.url());
}
