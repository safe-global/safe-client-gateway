// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';

// UTF-8 sample names: Latin, accented, CJK, and Cyrillic — all NFC-normalised,
// no control/format chars, no leading/trailing whitespace.
// Capped to 30 code points to respect NAME_MAX_LENGTH.
const SAMPLE_NAMES: Array<() => string> = [
  () => faker.person.firstName(),
  () => 'José',
  () => 'Müller',
  () => '山田太郎',
  () => 'Анна',
  () => '李',
];

export function nameBuilder(): string {
  const pick = faker.helpers.arrayElement(SAMPLE_NAMES)();
  // Trim to 30 code points to respect the default max.
  return [...pick].slice(0, 30).join('');
}
