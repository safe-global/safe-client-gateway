import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { BlockExplorerUriTemplate } from '@/domain/chains/entities/block-explorer-uri-template.entity';

export function blockExplorerUriTemplateBuilder(): IBuilder<BlockExplorerUriTemplate> {
  const explorerUrl = faker.internet.url({ appendSlash: false });
  return new Builder<BlockExplorerUriTemplate>()
    .with('address', `${explorerUrl}/address/{{address}}`)
    .with('txHash', `${explorerUrl}/tx/{{txHash}}`)
    .with(
      'api',
      `${explorerUrl}/api?module={{module}}&action={{action}}&address={{address}}&apiKey={{apiKey}}`,
    );
}
