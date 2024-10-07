import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { BeaconChainExplorerUriTemplate } from '@/domain/chains/entities/beacon-chain-explorer-uri-template.entity';

export function beaconChainExplorerUriTemplateBuilder(): IBuilder<BeaconChainExplorerUriTemplate> {
  const explorerUrl = faker.internet.url({ appendSlash: false });
  return new Builder<BeaconChainExplorerUriTemplate>().with(
    'publicKey',
    `${explorerUrl}/{{publicKey}}`,
  );
}
