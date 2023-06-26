/**
 * Faker v8.0.2
 * https://fakerjs.dev/
 *
 * Copyright 2022-2023 Faker and other contributors
 *
 * Released under the MIT license
 * https://github.com/faker-js/faker/blob/bbda1d7e2ce0b0bd33a3cc78458a73cd79e3eca0/LICENSE
 *
 * Date: 2021-06-21
 */

import { faker } from '@faker-js/faker';

/**
 * `faker.datatype.json` will be deprecated from version v9.0
 * The following is the implementation taken from version v8.0.2
 * @see https://github.com/faker-js/faker/blob/651d1a8cd11b2d562c7a6473b8a544b81d5fbb95/src/modules/datatype/index.ts#LL415C5-L424C41
 */

export function fakeJson(): string {
  const properties = ['foo', 'bar', 'bike', 'a', 'b', 'name', 'prop'];
  const returnObject: Record<string, string | number> = {};

  properties.forEach((prop) => {
    returnObject[prop] = faker.datatype.boolean()
      ? faker.string.sample()
      : faker.number.int();
  });

  return JSON.stringify(returnObject);
}
