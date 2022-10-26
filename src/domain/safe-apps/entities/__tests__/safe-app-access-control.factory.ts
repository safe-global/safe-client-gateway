import { faker } from '@faker-js/faker';
import { SafeAppAccessControl } from '../safe-app-access-control.entity';

export default function (type?: string): SafeAppAccessControl {
  return <SafeAppAccessControl>{
    type: type ?? faker.random.word(),
  };
}
