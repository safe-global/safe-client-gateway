// SPDX-License-Identifier: FSL-1.1-MIT
import swc from 'unplugin-swc';
import { configDefaults, defineConfig } from 'vitest/config';

// Fresh plugin instances per project. NestJS relies on `emitDecoratorMetadata`
// for dependency injection, which Vite's default Oxc transform drops, so every
// project is transformed with SWC (legacy decorators + decorator metadata).
// `oxc: false` disables that default transform (unplugin-swc only disables the
// legacy esbuild path, which no longer has any effect).
const plugins = (): Array<ReturnType<typeof swc.vite>> => [
  swc.vite({
    jsc: {
      parser: {
        syntax: 'typescript',
        decorators: true,
        dynamicImport: true,
      },
      transform: {
        legacyDecorator: true,
        decoratorMetadata: true,
      },
      target: 'es2022',
      keepClassNames: true,
    },
    module: { type: 'es6' },
    sourceMaps: true,
  }),
];

const sharedExclude = [...configDefaults.exclude];

export default defineConfig({
  plugins: plugins(),
  oxc: false,
  // Resolves the `@/*` and `@/abis/*` path aliases straight from tsconfig.json.
  resolve: { tsconfigPaths: true },
  test: {
    // Coverage is configured once at the root and aggregates across all projects.
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,js}'],
      exclude: [
        '**/index.ts',
        '**/__tests__/**/*.builder.{ts,js}',
        '**/__tests__/**/*.factory.{ts,js}',
        '**/*.e2e-spec.ts',
        '**/*.integration.spec.ts',
      ],
    },
    projects: [
      {
        plugins: plugins(),
        oxc: false,
        resolve: { tsconfigPaths: true },
        test: {
          name: 'unit',
          globals: true,
          environment: 'node',
          env: { TZ: 'UTC' },
          include: ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'],
          exclude: [
            ...sharedExclude,
            '**/*.integration.spec.ts',
            '**/*.e2e-spec.ts',
          ],
        },
      },
      {
        plugins: plugins(),
        oxc: false,
        resolve: { tsconfigPaths: true },
        test: {
          name: 'integration',
          globals: true,
          environment: 'node',
          env: { TZ: 'UTC' },
          include: ['src/**/*.integration.spec.ts'],
          exclude: sharedExclude,
          setupFiles: ['./test/e2e-setup.ts'],
          testTimeout: 60000,
        },
      },
      {
        plugins: plugins(),
        oxc: false,
        resolve: { tsconfigPaths: true },
        test: {
          name: 'e2e',
          globals: true,
          environment: 'node',
          env: { TZ: 'UTC' },
          include: ['src/**/*.e2e-spec.ts'],
          exclude: sharedExclude,
          setupFiles: ['./test/e2e-setup.ts'],
          testTimeout: 40000,
        },
      },
    ],
  },
});
