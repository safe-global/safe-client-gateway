// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import {
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  sanitizeName,
} from '@/domain/common/schemas/name.schema';

// UTF-8 sample names: Latin, accented, and Cyrillic — all NFC-normalised,
// no control/format chars, no leading/trailing whitespace.
// Each is at least NAME_MIN_LENGTH code points to satisfy the default min.
const SAMPLE_NAMES: Array<() => string> = [
  () => faker.person.fullName(),
  () => 'José',
  () => 'Müller',
  () => '山田太郎',
  () => 'Анна',
];

export function nameBuilder(): string {
  // Sanitize so output is invariant under sanitizeName, independent of Faker.
  const pick = sanitizeName(faker.helpers.arrayElement(SAMPLE_NAMES)());
  // Pad to the min and trim to the max to respect the default bounds.
  const padded =
    pick.length < NAME_MIN_LENGTH ? pick.padEnd(NAME_MIN_LENGTH, 'x') : pick;
  // Truncating to the max can cut right after a space and re-introduce trailing
  // whitespace, so sanitize again to keep the result a fixed point of sanitizeName.
  return sanitizeName([...padded].slice(0, NAME_MAX_LENGTH).join(''));
}
