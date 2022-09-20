/* istanbul ignore file */

import { RpcUri } from '../../../../routes/chains/openapi/api-rpc-uri';
import { faker } from '@faker-js/faker';
import { RpcUriAuthentication } from '../rpc-uri-authentication.entity';

export default function (
  authentication?: RpcUriAuthentication,
  value?: string,
): RpcUri {
  return <RpcUri>{
    authentication: authentication ?? RpcUriAuthentication.NoAuthentication,
    value: value ?? faker.internet.url(),
  };
}
