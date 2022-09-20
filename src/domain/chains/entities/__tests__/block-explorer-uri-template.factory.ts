/* istanbul ignore file */

import { BlockExplorerUriTemplate } from '../block-explorer-uri-template.entity';
import { faker } from '@faker-js/faker';

export default function (
  address?: string,
  txHash?: string,
  api?: string,
): BlockExplorerUriTemplate {
  return <BlockExplorerUriTemplate>{
    address: address ?? faker.internet.url(),
    txHash: txHash ?? faker.internet.url(),
    api: api ?? faker.internet.url(),
  };
}
