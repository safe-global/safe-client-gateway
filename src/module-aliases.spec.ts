// SPDX-License-Identifier: FSL-1.1-MIT

import path from 'node:path';
import { faker } from '@faker-js/faker';
import { resolveModuleAlias } from '@/module-aliases';

function modulePath(): string {
  return faker.helpers
    .multiple(() => faker.lorem.slug(), { count: { min: 1, max: 4 } })
    .join('/');
}

describe('resolveModuleAlias', () => {
  const root = faker.system.directoryPath();

  it('maps @/abis/* to the abis directory under the root', () => {
    const modulePathSegment = modulePath();

    expect(resolveModuleAlias(`@/abis/${modulePathSegment}`, root)).toBe(
      path.join(root, 'abis', modulePathSegment),
    );
  });

  it('maps @/* to the src directory under the root', () => {
    const modulePathSegment = modulePath();

    expect(resolveModuleAlias(`@/${modulePathSegment}`, root)).toBe(
      path.join(root, 'src', modulePathSegment),
    );
  });

  it.each([
    ['a bare package', faker.lorem.slug()],
    ['a scoped package', `@${faker.lorem.slug()}/${faker.lorem.slug()}`],
    ['a relative path', `./${modulePath()}`],
    ['a node builtin', `node:${faker.lorem.word()}`],
  ])('leaves %s untouched', (_, specifier) => {
    expect(resolveModuleAlias(specifier, root)).toBeUndefined();
  });
});
