import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { RpcUri } from '@/modules/chains/domain/entities/rpc-uri.entity';
import { RpcUriAuthentication } from '@/modules/chains/domain/entities/rpc-uri-authentication.entity';

export function rpcUriBuilder(): IBuilder<RpcUri> {
  return new Builder<RpcUri>()
    .with('authentication', RpcUriAuthentication.NoAuthentication)
    .with('value', faker.internet.url({ appendSlash: false }));
}
