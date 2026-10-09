// SPDX-License-Identifier: FSL-1.1-MIT
import { globSync, readFileSync } from 'node:fs';
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

// `#/*` imports resolve through package.json `imports`; the `source` condition
// maps them to the TypeScript sources instead of the compiled `dist` output.
// Vitest merges its own default server conditions into these.
const conditions = ['source'];
const resolve = { conditions };
const ssr = { resolve: { conditions } };

const sharedExclude = [...configDefaults.exclude];

const unitInclude = ['src/**/*.spec.ts', 'scripts/**/*.spec.ts'];
const unitExclude = [
  ...sharedExclude,
  '**/*.integration.spec.ts',
  '**/*.e2e-spec.ts',
];

// `unit` shares one module cache per worker (`isolate: false`), so a module is
// imported once rather than once per spec file. A spec that replaces a module
// with `vi.mock` needs its own registry, both for its mock to apply and to keep
// the mocked module out of the cache the other specs share, so such specs run
// in `unit-isolated` instead.
const moduleMockingSpecs = globSync(unitInclude, {
  exclude: unitExclude,
}).filter((file) => /\bvi\.(mock|doMock)\(/.test(readFileSync(file, 'utf8')));

const unitTest = {
  globals: true,
  environment: 'node' as const,
  // Unit tests mock all I/O, so they need no per-file process isolation.
  // `worker_threads` start far cheaper than the default `forks` pool's
  // child processes. Integration/e2e keep the default `forks` pool since
  // they touch real DB/Redis/AMQP.
  pool: 'threads' as const,
  env: { TZ: 'UTC' },
  clearMocks: true,
  setupFiles: ['./test/faker-setup.ts', './test/shared-module-cache-setup.ts'],
};

export default defineConfig({
  plugins: plugins(),
  oxc: false,
  resolve,
  ssr,
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
        resolve,
        ssr,
        test: {
          ...unitTest,
          name: 'unit',
          isolate: false,
          include: unitInclude,
          exclude: [...unitExclude, ...moduleMockingSpecs],
        },
      },
      {
        plugins: plugins(),
        oxc: false,
        resolve,
        ssr,
        test: {
          ...unitTest,
          name: 'unit-isolated',
          include: moduleMockingSpecs,
        },
      },
      {
        plugins: plugins(),
        oxc: false,
        resolve,
        ssr,
        test: {
          name: 'integration',
          globals: true,
          environment: 'node',
          isolate: false,
          env: { TZ: 'UTC' },
          clearMocks: true,
          include: ['src/**/*.integration.spec.ts'],
          exclude: sharedExclude,
          setupFiles: [
            './test/e2e-setup.ts',
            './test/faker-setup.ts',
            './test/shared-module-cache-setup.ts',
          ],
          testTimeout: 60000,
        },
      },
      {
        plugins: plugins(),
        oxc: false,
        resolve,
        ssr,
        test: {
          name: 'e2e',
          globals: true,
          environment: 'node',
          env: { TZ: 'UTC' },
          clearMocks: true,
          include: ['src/**/*.e2e-spec.ts'],
          exclude: sharedExclude,
          setupFiles: ['./test/e2e-setup.ts', './test/faker-setup.ts'],
          testTimeout: 40000,
        },
      },
    ],
  },
});
