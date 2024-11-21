import { faker } from '@faker-js/faker/.';

// Note: regular expression is simplified because faker has limited support for regex.
// https://fakerjs.dev/api/helpers#fromregexp
export const addressBookItemNameSimpleRegex = /[a-zA-Z0-9]{18,40}/i;

export function addressBookItemNameBuilder(): string {
  return faker.helpers.fromRegExp(addressBookItemNameSimpleRegex);
}
