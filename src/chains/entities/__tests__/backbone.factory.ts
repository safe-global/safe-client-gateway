import { faker } from '@faker-js/faker';
import { Backbone } from '../backbone.entity';

export default function (
  name?: string,
  version?: string,
  api_version?: string,
  secure?: boolean,
  host?: string,
  headers?: string[],
  settings?: Record<string, string>,
): Backbone {
  return <Backbone>{
    name: name || faker.random.word(),
    version: version || faker.system.semver(),
    api_version: api_version || faker.system.semver(),
    secure: secure || faker.datatype.boolean(),
    host: host || faker.internet.url(),
    headers: headers || faker.datatype.array(),
    settings: settings || JSON.parse(faker.datatype.json()),
  };
}
