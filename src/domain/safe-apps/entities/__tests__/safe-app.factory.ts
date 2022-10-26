import { faker } from '@faker-js/faker';
import { SafeAppAccessControl } from '../safe-app-access-control.entity';
import { SafeAppProvider } from '../safe-app-provider.entity';
import { SafeApp } from '../safe-app.entity';
import safeAppAccessControlFactory from './safe-app-access-control.factory';
import safeAppProviderFactory from './safe-app-provider.factory';

export default function (
  id?: number,
  url?: string,
  name?: string,
  iconUrl?: string,
  description?: string,
  chainIds?: number[],
  provider?: SafeAppProvider,
  accessControl?: SafeAppAccessControl,
  tags?: string[],
): SafeApp {
  return <SafeApp>{
    id: id ?? faker.datatype.number(),
    url: url ?? faker.internet.url(),
    name: name ?? faker.random.word(),
    iconUrl: iconUrl ?? faker.internet.url(),
    description: description ?? faker.random.word(),
    chainIds: chainIds ?? [faker.datatype.number(), faker.datatype.number()],
    provider: provider ?? safeAppProviderFactory(),
    accessControl: accessControl ?? safeAppAccessControlFactory(),
    tags: tags ?? false,
  };
}
