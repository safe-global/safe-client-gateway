import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { BeaconChainExplorerUriTemplate } from '@/domain/chains/entities/beacon-chain-explorer-uri-template.entity';

export function beaconChainExplorerUriTemplateBuilder(): IBuilder<BeaconChainExplorerUriTemplate> {
  const explorerUrl = faker.internet.url({ appendSlash: false });
  return new Builder<BeaconChainExplorerUriTemplate>().with(
    'publicKey',
    `${explorerUrl}/{{publicKey}}`,
  );
}
