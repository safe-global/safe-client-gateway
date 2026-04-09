<!--
  SPDX-License-Identifier: FSL-1.1-MIT
 -->

# Migrate from nest build to bun runtime — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the app directly with `bun src/main.ts` instead of `nest build && tsc-alias` → `bun dist/src/main.js`, eliminating the compilation step entirely.

**Architecture:** Three-phase migration: (1) fix all type-only imports so Bun's per-file transpiler can resolve them, (2) break 31 circular dependencies that work in CJS but fail in Bun's ESM evaluation, (3) update build scripts, Dockerfile, and dev tooling. The circular dep fixes follow established patterns — extracting NestJS Module classes from interface files, adding `z.lazy()` for recursive Zod schemas, and moving shared types out of module files.

**Tech Stack:** Bun 1.3.11+, NestJS 11, TypeORM, Zod, TypeScript 5.9

---

## Pre-requisite: Understanding

Bun transpiles TypeScript per-file (like `isolatedModules`). This means:

1. `import { SomeInterface }` fails if `SomeInterface` is only an interface/type (erased at transpile time). Must use `import type`.
2. Circular dependencies that work in CJS (partial module objects) fail in ESM (TDZ — temporal dead zone). Especially with `emitDecoratorMetadata` which emits class references at module load time.

---

### Task 1: Update build scripts and remove build dependencies

**Files:**

- Modify: `package.json`
- Modify: `Dockerfile`
- Modify: `.vscode/launch.json`
- Modify: `eslint.config.mjs`

- [ ] **Step 1: Update package.json scripts**

```jsonc
// Replace these scripts:
"build": "bun generate-abis",
"start": "bun src/main.ts",
"start:dev": "bun --watch src/main.ts",
"start:debug": "bun --inspect --watch src/main.ts",
"start:prod": "bun src/main.ts",
"typeorm": "bun ./node_modules/typeorm/cli -d ./src/config/entities/orm.config.ts",
"migration:create": "bun ./node_modules/typeorm/cli migration:create ./migrations/${0}",
```

- [ ] **Step 2: Remove tsc-alias and tsconfig-paths**

Run: `bun remove tsc-alias tsconfig-paths`

- [ ] **Step 3: Update ESLint config for inline type imports**

In `eslint.config.mjs`, change:

```js
'@typescript-eslint/consistent-type-imports': [
  'error',
  { fixStyle: 'inline-type-imports' },
],
```

- [ ] **Step 4: Update Dockerfile**

Replace the production stage to copy source instead of dist:

```dockerfile
#
# BUILD CONTAINER
#
ARG BUN_VERSION=1.3.11
FROM oven/bun:${BUN_VERSION}-alpine AS base
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=bun:bun package.json bun.lock tsconfig*.json ./
COPY --chown=bun:bun scripts/generate-abis.js ./scripts/generate-abis.js
COPY --chown=bun:bun assets ./assets
COPY --chown=bun:bun migrations ./migrations
COPY --chown=bun:bun src ./src
RUN bun install --frozen-lockfile \
     && bun run build \
     && rm -rf ./node_modules \
     && bun install --frozen-lockfile --production

#
# PRODUCTION CONTAINER
#
FROM oven/bun:${BUN_VERSION}-alpine AS production
WORKDIR /app
USER bun

ARG VERSION
ARG BUILD_NUMBER

ENV APPLICATION_VERSION=${VERSION} \
    APPLICATION_BUILD_NUMBER=${BUILD_NUMBER} \
    NODE_ENV=production

COPY --chown=bun:bun --from=base /app/abis ./abis
COPY --chown=bun:bun --from=base /app/node_modules ./node_modules
COPY --chown=bun:bun --from=base /app/src ./src
COPY --chown=bun:bun --from=base /app/tsconfig*.json ./
COPY --chown=bun:bun --from=base /app/assets ./assets
COPY --chown=bun:bun --from=base /app/migrations ./migrations
CMD [ "bun", "src/main.ts" ]
```

- [ ] **Step 5: Update .vscode/launch.json**

Change the "Launch Program" config:

```json
{
  "type": "bun",
  "request": "launch",
  "name": "Launch Program",
  "program": "${workspaceFolder}/src/main.ts",
  "console": "integratedTerminal"
  // ... keep env vars
}
```

Remove `outFiles` and `skipFiles`.

- [ ] **Step 6: Update TypeORM entity/migration paths**

In `src/config/entities/orm.config.ts`, change:

```ts
entities: ['src/**/entities/*.entity.db.ts'],
```

In `src/config/entities/postgres.config.ts`, change:

```ts
migrations: ['migrations/*.ts'],
```

- [ ] **Step 7: Commit**

```bash
git add package.json bun.lock Dockerfile .vscode/launch.json eslint.config.mjs src/config/entities/orm.config.ts src/config/entities/postgres.config.ts
git commit -m "chore: update build scripts for direct Bun TypeScript execution"
```

---

### Task 2: Fix type-only imports (automated)

Bun erases interfaces/types at transpile time. Any `import { SomeInterface }` where `SomeInterface` is only an interface or type alias (no value export with the same name) must use `import type` or inline `type` keyword.

**Files:**

- Modify: ~278 source files (automated via script)
- Modify: handful of files with external package type imports (manual)

- [ ] **Step 1: Run the automated type-import fixer script**

This script builds a map of `{filePath → Set<typeOnlyExportNames>}` and adds `type` to the relevant import specifiers. It resolves `@/` path aliases to actual files and only marks imports as type-only when the source file has no value export with the same name.

Save the following as `scripts/fix-type-imports.ts` and run with `bun scripts/fix-type-imports.ts`:

```ts
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';

const ROOT = process.cwd();

const allFiles = execSync(
  'find src/ -name "*.ts" -not -path "*/node_modules/*"',
  { encoding: 'utf-8' },
)
  .trim()
  .split('\n')
  .filter(Boolean);

// Step 1: Build file-aware type-only map
const typeOnlyByFile = new Map<string, Set<string>>();

for (const relFile of allFiles) {
  const absFile = resolve(ROOT, relFile);
  const content = readFileSync(absFile, 'utf-8');
  const typeOnly = new Set<string>();

  for (const m of content.matchAll(/export\s+interface\s+(\w+)/g)) {
    const name = m[1];
    const hasValue = new RegExp(
      `export\\s+(?:const|let|var|function|class|enum)\\s+${name}\\b`,
    ).test(content);
    if (!hasValue) typeOnly.add(name);
  }

  for (const m of content.matchAll(/export\s+type\s+(\w+)\s*[=<]/g)) {
    const name = m[1];
    const hasValue = new RegExp(
      `export\\s+(?:const|let|var|function|class|enum)\\s+${name}\\b`,
    ).test(content);
    if (!hasValue) typeOnly.add(name);
  }

  if (typeOnly.size > 0) typeOnlyByFile.set(absFile, typeOnly);
}

// Step 2: External package type-only exports
const externalTypeOnly: Record<string, Set<string>> = {
  'cache-manager': new Set(['Cache']),
  viem: new Set([
    'Address',
    'Hash',
    'Hex',
    'Chain',
    'AbiParameterToPrimitiveType',
    'ContractFunctionName',
    'DecodeFunctionDataReturnType',
    'PrivateKeyAccount',
    'PublicClient',
    'TypedDataDomain',
  ]),
  express: new Set(['Request', 'Response', 'NextFunction', 'CookieOptions']),
  '@nestjs/common': new Set([
    'ArgumentsHost',
    'CallHandler',
    'CanActivate',
    'DynamicModule',
    'ExceptionFilter',
    'ExecutionContext',
    'INestApplication',
    'MiddlewareConsumer',
    'NestInterceptor',
    'NestModule',
    'OnApplicationBootstrap',
    'OnModuleDestroy',
    'OnModuleInit',
  ]),
  typeorm: new Set([
    'FindOptionsRelations',
    'FindOptionsSelect',
    'FindOptionsWhere',
    'LogLevel',
    'LogMessage',
    'LoggerOptions',
    'ObjectLiteral',
  ]),
  '@aws-sdk/client-s3': new Set([
    'CompleteMultipartUploadCommandOutput',
    'PutObjectCommandInput',
  ]),
  crypto: new Set(['UUID']),
  'csv-stringify': new Set(['ColumnOption', 'Options']),
};

function resolveImportPath(
  importPath: string,
  fromFile: string,
): string | null {
  if (importPath.startsWith('@/')) {
    const stripped = importPath.slice(2);
    for (const c of [
      resolve(ROOT, 'src', stripped + '.ts'),
      resolve(ROOT, 'src', stripped, 'index.ts'),
      resolve(ROOT, stripped + '.ts'),
    ]) {
      if (existsSync(c)) return c;
    }
    return null;
  }
  if (importPath.startsWith('.')) {
    const dir = dirname(fromFile);
    for (const c of [
      resolve(dir, importPath + '.ts'),
      resolve(dir, importPath, 'index.ts'),
    ]) {
      if (existsSync(c)) return c;
    }
    return null;
  }
  return null;
}

function getExternalPkgName(importPath: string): string {
  return importPath.startsWith('@')
    ? importPath.split('/').slice(0, 2).join('/')
    : importPath.split('/')[0];
}

// Step 3: Fix imports
let totalFixed = 0;

for (const relFile of allFiles) {
  const absFile = resolve(ROOT, relFile);
  let content = readFileSync(absFile, 'utf-8');
  let modified = false;

  const importRegex =
    /^(import\s+)(type\s+)?(\{[\s\S]*?\})\s*(from\s+['"]([^'"]+)['"];?\s*)$/gm;

  content = content.replace(
    importRegex,
    (match, importKw, typeKw, specBlock, fromClause, importPath) => {
      if (typeKw?.trim() === 'type') return match;

      const resolved = resolveImportPath(importPath, absFile);
      let typeOnlyNames: Set<string> | undefined;

      if (resolved) {
        typeOnlyNames = typeOnlyByFile.get(resolved);
      } else {
        // Check external packages — but NOT subpath exports (e.g. abitype/zod)
        const fullPkg = importPath;
        const basePkg = getExternalPkgName(importPath);
        // Only apply if the import path IS the base package (no subpath)
        if (fullPkg === basePkg || fullPkg === basePkg + '/index') {
          typeOnlyNames = externalTypeOnly[basePkg];
        }
      }

      if (!typeOnlyNames || typeOnlyNames.size === 0) return match;

      let changed = false;
      const newSpecBlock = specBlock.replace(
        /(?<!\btype\s)\b(\w+)(\s+as\s+\w+)?(\s*[,}])/g,
        (
          specMatch: string,
          name: string,
          asAlias: string | undefined,
          trail: string,
        ) => {
          if (typeOnlyNames!.has(name)) {
            changed = true;
            return `type ${name}${asAlias || ''}${trail}`;
          }
          return specMatch;
        },
      );

      if (changed) {
        modified = true;
        // If ALL specifiers are type, convert to `import type { ... }`
        const specNames = [
          ...newSpecBlock.matchAll(/(\w+)(?:\s+as\s+\w+)?\s*[,}]/g),
        ]
          .map((m) => m[1])
          .filter((n) => n !== 'type');
        const allType = specNames.every((n) =>
          new RegExp(`\\btype\\s+${n}\\b`).test(newSpecBlock),
        );
        if (allType && specNames.length > 0) {
          const cleaned = newSpecBlock.replace(/\btype\s+/g, '');
          return `${importKw}type ${cleaned} ${fromClause}`;
        }
        return `${importKw}${newSpecBlock} ${fromClause}`;
      }
      return match;
    },
  );

  if (modified) {
    writeFileSync(absFile, content);
    totalFixed++;
  }
}

console.log(`Type-only exports found in ${typeOnlyByFile.size} files`);
console.log(`Fixed imports in ${totalFixed} files`);
```

Expected output: `Fixed imports in ~278 files`

- [ ] **Step 2: Delete the script**

```bash
rm scripts/fix-type-imports.ts
```

- [ ] **Step 3: Run ESLint auto-fix to clean up formatting**

```bash
npx eslint --fix "{src,migrations}/**/*.ts"
```

- [ ] **Step 4: Run `npx prettier --write .` to normalize formatting**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: add explicit type imports for Bun per-file transpilation"
```

---

### Task 3: Extract NestJS Module classes from interface files

Six interface files bundle a `@Module` class alongside the Symbol/interface, creating circular deps with the implementation. Extract each Module class into its own file.

**Pattern:** For each interface file that has `@Module({ useClass: Impl })`:

1. Create `<name>.module.ts` with the Module class
2. Remove the Module class from the interface file
3. Update all consumers to import from the new module file

**Files:**

- Create: `src/domain/interfaces/transaction-api.manager.module.ts`
- Modify: `src/domain/interfaces/transaction-api.manager.interface.ts`
- Modify: consumers (3 files)
- Create: `src/modules/safe/domain/safe.repository.module.ts`
- Modify: `src/modules/safe/domain/safe.repository.interface.ts`
- Modify: consumers (5+ files)
- Create: `src/modules/delegate/domain/v2/delegates.v2.repository.module.ts`
- Modify: `src/modules/delegate/domain/v2/delegates.v2.repository.interface.ts`
- Modify: consumers (3 files)
- Create: `src/modules/delegate/domain/delegate.repository.module.ts`
- Modify: `src/modules/delegate/domain/delegate.repository.interface.ts`
- Modify: consumers (2 files)
- Create: `src/modules/csv-export/v1/datasources/export-api.manager.module.ts`
- Modify: `src/modules/csv-export/v1/datasources/export-api.manager.interface.ts`
- Modify: consumers (1 file)
- Create: `src/modules/queues/domain/queues-repository.module.ts`
- Modify: `src/modules/queues/domain/queues-repository.interface.ts`
- Modify: consumers (2 files)

- [ ] **Step 1: Extract TransactionApiManagerModule**

Create `src/domain/interfaces/transaction-api.manager.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TransactionApiManager } from '@/modules/transactions/datasources/transaction-api.manager';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { TxAuthNetworkModule } from '@/datasources/network/tx-auth.network.module';

@Module({
  imports: [ConfigApiModule, TxAuthNetworkModule],
  providers: [
    {
      provide: ITransactionApiManager,
      useClass: TransactionApiManager,
    },
  ],
  exports: [ITransactionApiManager],
})
export class TransactionApiManagerModule {}
```

Remove the `@Module` class and its imports (`Module`, `TransactionApiManager`, `ConfigApiModule`, `TxAuthNetworkModule`) from `src/domain/interfaces/transaction-api.manager.interface.ts`. Keep only:

```ts
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import type { IApiManager } from '@/domain/interfaces/api.manager.interface';

export const ITransactionApiManager = Symbol('ITransactionApiManager');

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ITransactionApiManager extends IApiManager<ITransactionApi> {}
```

Update consumers to import from the new module file:

- `src/modules/data-decoder/data-decoder.module.ts`
- `src/modules/safe/safe.module.ts`
- `src/modules/messages/messages.module.ts`
- Any other files importing `TransactionApiManagerModule`

Change: `from '@/domain/interfaces/transaction-api.manager.interface'` → `from '@/domain/interfaces/transaction-api.manager.module'`

- [ ] **Step 2: Repeat the same pattern for the other 5 interface files**

Apply the identical extraction for:

- `safe.repository.interface.ts` → `safe.repository.module.ts`
- `delegates.v2.repository.interface.ts` → `delegates.v2.repository.module.ts`
- `delegate.repository.interface.ts` → `delegate.repository.module.ts`
- `export-api.manager.interface.ts` → `export-api.manager.module.ts`
- `queues-repository.interface.ts` → `queues-repository.module.ts`

Each extraction follows the same pattern:

1. Create new module file with `@Module` class + imports
2. Strip module class from interface file
3. Update all consumer imports

- [ ] **Step 3: Verify no interface file has @Module anymore**

Run: `grep -rl "@Module" src/ --include="*.interface.ts"`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: extract NestJS Module classes from interface files

Breaks circular dependencies between interface and implementation
files by separating the @Module definition into its own file."
```

---

### Task 4: Extract shared types from module files

Three module files export types/interfaces needed by their services, creating circular deps.

**Files:**

- Create: `src/datasources/cache/cache.types.ts`
- Modify: `src/datasources/cache/cache.module.ts`
- Modify: `src/datasources/cache/redis.cache.service.ts`
- Create: `src/datasources/network/fetch-client.types.ts`
- Modify: `src/datasources/network/network.module.ts`
- Modify: `src/datasources/network/fetch.network.service.ts`
- Create: `src/datasources/jwt/jwt.types.ts`
- Modify: `src/datasources/jwt/jwt.module.ts`
- Modify: `src/datasources/jwt/jwt.service.ts`
- Create: `src/modules/queues/datasources/queue-consumer.interface.ts`
- Modify: `src/modules/queues/datasources/queues-api.module.ts`
- Modify: `src/modules/queues/datasources/queues-api.service.ts`
- Modify: `src/modules/queues/datasources/queues-api.shutdown.hook.ts`

- [ ] **Step 1: Extract RedisClientType from cache.module.ts**

Create `src/datasources/cache/cache.types.ts`:

```ts
import type { createClient } from 'redis';

export type RedisClientType = ReturnType<typeof createClient>;
```

In `cache.module.ts`: remove the `RedisClientType` export, import it from `./cache.types` if still needed locally.
In `redis.cache.service.ts`: change `import { RedisClientType } from '@/datasources/cache/cache.module'` → `import type { RedisClientType } from '@/datasources/cache/cache.types'`.

- [ ] **Step 2: Extract FetchClient/FetchClientToken from network.module.ts**

Create `src/datasources/network/fetch-client.types.ts` with the `FetchClient` type and `FetchClientToken` symbol.
Update `network.module.ts` and `fetch.network.service.ts` imports.

- [ ] **Step 3: Extract JwtClient from jwt.module.ts**

Create `src/datasources/jwt/jwt.types.ts` with the `JwtClient` type.
Update `jwt.module.ts` and `jwt.service.ts` imports.

- [ ] **Step 4: Extract QueueConsumer from queues-api.module.ts**

Create `src/modules/queues/datasources/queue-consumer.interface.ts`:

```ts
import type {
  AmqpConnectionManager,
  ChannelWrapper,
} from 'amqp-connection-manager';

export interface QueueConsumer {
  connection: AmqpConnectionManager;
  channel: ChannelWrapper;
}
```

Update `queues-api.module.ts`, `queues-api.service.ts`, `queues-api.shutdown.hook.ts` to import from the new file.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: extract shared types from module files to break circular deps"
```

---

### Task 5: Fix schema/entity circular dependencies

Two circular deps where schemas and entities/utils cross-reference each other.

**Files:**

- Modify: `src/modules/alerts/routes/entities/alert.dto.entity.ts`
- Modify: `src/modules/alerts/routes/entities/schemas/alerts.schema.ts`
- Create: `src/modules/alerts/routes/entities/event-type.entity.ts`
- Modify: `src/validation/entities/schemas/signature.schema.ts`
- Modify: `src/domain/common/utils/signatures.ts`

- [ ] **Step 1: Fix alert EventType cycle**

Extract `EventType` enum from `alert.dto.entity.ts` into `event-type.entity.ts`. Both `alert.dto.entity.ts` and `alerts.schema.ts` import from the new file.

- [ ] **Step 2: Fix signature cycle**

Move `SIGNATURE_HEX_LENGTH` (and related constants `R_OR_S_HEX_LENGTH`, `V_HEX_LENGTH`, `DYNAMIC_PART_LENGTH_FIELD_HEX_LENGTH`) from `signatures.ts` to `signature.schema.ts` (or a shared `signature.constants.ts`). This way `signatures.ts` imports from `signature.schema.ts` but not vice versa.

Update all other files that import these constants from `signatures.ts` to import from the new location.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: break schema/entity circular deps by extracting shared constants"
```

---

### Task 6: Fix Zod schema circular references with z.lazy()

Several domain entities use direct Zod schema references in circular chains. Add `z.lazy()` where missing.

**Files:**

- Modify: `src/modules/wallets/domain/entities/wallet.entity.ts`
- Modify: `src/modules/notifications/datasources/entities/notification-subscription.entity.db.ts`

- [ ] **Step 1: Fix wallet.entity.ts**

Change line 12 from:

```ts
user: UserSchema,
```

To:

```ts
user: z.lazy(() => UserSchema),
```

Also add the explicit `z.ZodType` annotation (similar to how `user.entity.ts` does it) since `z.lazy()` changes the inferred type:

```ts
export const WalletSchema: z.ZodType<
  z.infer<typeof RowSchema> & {
    address: Address;
    user: User;
  }
> = RowSchema.extend({
  address: AddressSchema as z.ZodType<Address>,
  user: z.lazy(() => UserSchema),
});
```

You'll need to add `import type { User } from '@/modules/users/domain/entities/user.entity'` and `import { z } from 'zod'` (change from `import type { z }` to `import { z }`).

- [ ] **Step 2: Fix notification-subscription.entity.db.ts**

Change lines 25-27 from:

```ts
notification_subscription_notification_type: z.array(
  NotificationSubscriptionNotificationTypeSchema,
),
```

To:

```ts
notification_subscription_notification_type: z.array(
  z.lazy(() => NotificationSubscriptionNotificationTypeSchema),
),
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: add z.lazy() to break Zod schema circular references"
```

---

### Task 7: Fix interface files that reference concrete implementations

Two interface files use `Parameters<ConcreteClass['method']>` to extract parameter types.

**Files:**

- Modify: `src/modules/spaces/domain/spaces.repository.interface.ts`
- Modify: `src/modules/spaces/domain/space-safes.repository.interface.ts`

- [ ] **Step 1: Inline parameter types in spaces.repository.interface.ts**

Remove `import type { SpacesRepository }` from the file. Replace every `Parameters<SpacesRepository['methodName']>[0]` with the explicit inline type. Each method already has a sibling with the explicit type (e.g., `findOne` has the full signature, `findOneOrFail` uses `Parameters<>`).

For example, change:

```ts
findOneOrFail(
  args: Parameters<SpacesRepository['findOne']>[0],
): Promise<Space>;
```

To:

```ts
findOneOrFail(args: {
  where: Array<FindOptionsWhere<Space>> | FindOptionsWhere<Space>;
  select?: FindOptionsSelect<Space>;
  relations?: FindOptionsRelations<Space>;
}): Promise<Space>;
```

Apply the same to `findOrFail`, `findByUserIdOrFail`, `findOneByUserIdOrFail`.

- [ ] **Step 2: Inline parameter types in space-safes.repository.interface.ts**

Same pattern — read `space-safes.repository.interface.ts`, find all `Parameters<SpaceSafesRepository[...]>[0]` usages, replace with the explicit types from the sibling method signatures.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: inline parameter types in repository interfaces

Removes reverse dependency from interface to concrete implementation."
```

---

### Task 8: Verify and test

- [ ] **Step 1: Run `bun src/main.ts` and verify it starts**

```bash
bun src/main.ts &
APP_PID=$!
sleep 8
kill $APP_PID
```

If it fails with an `Export named 'X' not found` error: add the missing type to the import fixer's external list or fix the import manually.
If it fails with `Cannot access 'X' before initialization`: there's a circular dep not yet fixed — trace the chain and apply the appropriate pattern.

- [ ] **Step 2: Run tests**

```bash
bun run test:unit
```

- [ ] **Step 3: Run linting**

```bash
bun run lint
bun run format-check
```

- [ ] **Step 4: Run type checking**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Fix any issues found**

Iterate on failures until all checks pass.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: verify all tests pass with direct Bun TypeScript execution"
```

---

## Summary of circular dependency fixes

| #   | Cycle                                       | Fix                                                    | Task |
| --- | ------------------------------------------- | ------------------------------------------------------ | ---- |
| 1   | cache.module ↔ redis.cache.service          | Extract `RedisClientType` to `cache.types.ts`          | 4    |
| 2   | network.module ↔ fetch.network.service      | Extract `FetchClient`/token to `fetch-client.types.ts` | 4    |
| 3   | alert.dto.entity ↔ alerts.schema            | Extract `EventType` to own file                        | 5    |
| 4   | signature.schema ↔ signatures util          | Move constants to schema file                          | 5    |
| 5   | transaction-api.manager.interface ↔ manager | Extract Module to own file                             | 3    |
| 6   | delegates.v2.repository.interface ↔ repo    | Extract Module to own file                             | 3    |
| 7   | safe.repository.interface ↔ repo            | Extract Module to own file                             | 3    |
| 8   | jwt.module ↔ jwt.service                    | Extract `JwtClient` to `jwt.types.ts`                  | 4    |
| 9   | space.entity.db ↔ space-safes.entity.db     | TypeORM lazy arrows — safe, no fix                     | —    |
| 10  | space-safes.entity.db ↔ space-safe.entity   | Type-only imports — safe, no fix                       | —    |
| 11  | space chain (db→domain→db)                  | Type-only + z.lazy — safe, no fix                      | —    |
| 12  | space-safe.entity ↔ space.entity            | Already uses z.lazy — safe                             | —    |
| 13  | space.entity ↔ member.entity                | Already uses z.lazy — safe                             | —    |
| 14  | member.entity ↔ user.entity                 | Already uses z.lazy — safe                             | —    |
| 15  | member.entity.db ↔ space.entity.db          | TypeORM lazy arrows — safe, no fix                     | —    |
| 16  | users.entity.db ↔ member.entity.db          | TypeORM lazy arrows — safe, no fix                     | —    |
| 17  | users.entity.db ↔ wallets.entity.db         | TypeORM lazy arrows — safe, no fix                     | —    |
| 18  | auth.module ↔ users.module                  | Already uses forwardRef — safe                         | —    |
| 19  | auth→users→spaces chain                     | Already uses forwardRef — safe                         | —    |
| 20  | spaces.repository.interface ↔ repo          | Inline `Parameters<>` types                            | 7    |
| 21  | space-safes.repository.interface ↔ repo     | Inline `Parameters<>` types                            | 7    |
| 22  | users.module ↔ spaces.module                | Already uses forwardRef — safe                         | —    |
| 23  | export-api.manager.interface ↔ manager      | Extract Module to own file                             | 3    |
| 24  | delegate.repository.interface ↔ repo        | Extract Module to own file                             | 3    |
| 25  | queues-api.module ↔ service                 | Extract `QueueConsumer` to own file                    | 4    |
| 26  | queues-api.module ↔ shutdown.hook           | Extract `QueueConsumer` to own file                    | 4    |
| 27  | queues-repository.interface ↔ repo          | Extract Module to own file                             | 3    |
| 28  | notification-devices ↔ subscription         | TypeORM lazy arrows — safe, no fix                     | —    |
| 29  | notification-subscription ↔ sub-notif-type  | Add z.lazy() for Zod schema                            | 6    |
| 30  | notification-sub-type ↔ notification-type   | Already uses z.lazy — safe                             | —    |
| 31  | auth.module forwardRef check                | Already correct                                        | —    |

**Active fixes needed: 15 cycles across Tasks 3-7**
**Safe (no fix needed): 16 cycles**
