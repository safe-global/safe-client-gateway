import { BlockExplorerUriTemplate } from '../block-explorer-uri-template.entity';
import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';

export function blockExplorerUriTemplateBuilder(): IBuilder<BlockExplorerUriTemplate> {
  return Builder.new<BlockExplorerUriTemplate>()
    .with('address', faker.finance.ethereumAddress())
    .with('txHash', faker.datatype.hexadecimal())
    .with('api', faker.internet.url());
}
