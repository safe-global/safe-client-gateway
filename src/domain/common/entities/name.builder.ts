import { faker } from '@faker-js/faker/.';

// Note: regular expression is simplified because faker has limited support for regex.
// https://fakerjs.dev/api/helpers#fromregexp
export const nameSimpleRegex = /[a-zA-Z0-9]{12,30}/i;

export function nameBuilder(): string {
  return faker.helpers.fromRegExp(nameSimpleRegex);
}
