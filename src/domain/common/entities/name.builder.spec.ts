// SPDX-License-Identifier: FSL-1.1-MIT
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { NameSchema, sanitizeName } from '@/domain/common/schemas/name.schema';

describe('nameBuilder', () => {
  it('produces a value that is non-empty after sanitization', () => {
    for (let i = 0; i < 50; i++) {
      const name = nameBuilder();
      expect(sanitizeName(name).length).toBeGreaterThan(0);
    }
  });

  it('produces a value accepted by NameSchema and is idempotent under sanitization', () => {
    for (let i = 0; i < 50; i++) {
      const name = nameBuilder();
      expect(() => NameSchema.parse(name)).not.toThrow();
      // Round-trip idempotence: sanitizing again yields the same value
      expect(sanitizeName(name)).toBe(name);
    }
  });

  it('always produces a value of at most 30 code points', () => {
    for (let i = 0; i < 50; i++) {
      const name = nameBuilder();
      expect([...name].length).toBeLessThanOrEqual(30);
    }
  });

  it('produces non-ASCII output in at least some iterations (UTF-8 coverage)', () => {
    // The builder must include non-ASCII sample names (accented, CJK, Cyrillic, etc.)
    // so that over 50 iterations, at least one result contains a non-ASCII code point.
    const names = Array.from({ length: 50 }, () => nameBuilder());
    const hasNonAscii = names.some((name) =>
      [...name].some((ch) => ch.codePointAt(0)! > 127),
    );
    expect(hasNonAscii).toBe(true);
  });
});
