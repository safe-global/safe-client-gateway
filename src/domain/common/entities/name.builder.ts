// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import {
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
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
  const pick = faker.helpers.arrayElement(SAMPLE_NAMES)();
  // Pad to the min and trim to the max to respect the default bounds.
  const padded =
    pick.length < NAME_MIN_LENGTH ? pick.padEnd(NAME_MIN_LENGTH, 'x') : pick;
  return [...padded].slice(0, NAME_MAX_LENGTH).join('');
}
