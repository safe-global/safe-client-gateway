import { faker } from '@faker-js/faker/.';

// Note: regular expression is simplified because faker has limited support for regex.
// https://fakerjs.dev/api/helpers#fromregexp
export const accountNameSimpleRegex = /[a-zA-Z0-9]{12,20}/i;

export function accountNameBuilder(): string {
  return faker.helpers.fromRegExp(accountNameSimpleRegex);
}
