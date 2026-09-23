// SPDX-License-Identifier: FSL-1.1-MIT
import { registerHooks } from 'node:module';
import path from 'node:path';

/**
 * The `paths` aliases of tsconfig.json, most specific prefix first.
 */
const MODULE_ALIASES: ReadonlyArray<{ prefix: string; directory: string }> = [
  { prefix: '@/abis/', directory: 'abis' },
  { prefix: '@/', directory: 'src' },
];

/**
 * Maps an aliased specifier such as `@/config/configuration` to its file
 * under {@link root}, or returns `undefined` when the specifier uses no alias.
 */
export function resolveModuleAlias(
  specifier: string,
  root: string,
): string | undefined {
  const alias = MODULE_ALIASES.find(({ prefix }) =>
    specifier.startsWith(prefix),
  );
  if (!alias) {
    return undefined;
  }
  return path.join(root, alias.directory, specifier.slice(alias.prefix.length));
}

/**
 * Makes Node resolve the tsconfig.json aliases in the compiled output rooted
 * at {@link root}, for `require` and `import` alike.
 */
export function registerModuleAliases(root: string): void {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      return nextResolve(
        resolveModuleAlias(specifier, root) ?? specifier,
        context,
      );
    },
  });
}
