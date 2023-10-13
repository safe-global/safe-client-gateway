import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { BlockExplorerUriTemplate } from '@/domain/chains/entities/block-explorer-uri-template.entity';

export function blockExplorerUriTemplateBuilder(): IBuilder<BlockExplorerUriTemplate> {
  return Builder.new<BlockExplorerUriTemplate>()
    .with('address', faker.finance.ethereumAddress())
    .with('txHash', faker.string.hexadecimal())
    .with('api', faker.internet.url({ appendSlash: false }));
}
