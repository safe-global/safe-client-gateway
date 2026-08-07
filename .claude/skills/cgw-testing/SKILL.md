---
name: cgw-testing
description: Use when writing, changing, or debugging any test in safe-client-gateway - unit (*.spec.ts), integration (*.integration.spec.ts), or e2e - AND whenever a change to production code needs its tests updated, which is nearly every change, even when the request never mentions tests. Covers the builders-plus-faker rule (no literal fixtures), vi.fn() and MockedObject<T> mocking conventions, FakeConfigurationService, the mandatory initTestApplication(app) Fastify harness (never bare app.init()), seeded faker, and what CI actually runs. Triggers on "write a test", "add tests", "test failing", "fixture", "mock", "builder", "spec file", "vitest", and on any casting or typing question whose subject is a spec file ("as unknown in these tests", "as never", "how do I type this mock") - the test-mock cast idiom lives here, not in cgw-best-practices.
---

# CGW Testing

Read **[docs/agents/testing.md](../../../docs/agents/testing.md)** before writing or changing a test. This skill is a loader; the doc is the content.

Two rules that break things immediately if missed:

1. **Never `await app.init()` alone.** The platform is Fastify; route contexts only get their lifecycle hooks once `.ready()` resolves. Use:

   ```typescript
   app = await new TestAppProvider().provide(moduleFixture);
   await initTestApplication(app);
   ```

   from `@/__tests__/test-app.provider`. A supertest request after bare `init()` crashes inside Fastify's hook runner and hangs until timeout.

2. **Test data comes from builders + faker.** No literal fixtures. Enum members, taxonomy strings, and assertion-boundary values are the exception.

Also load **cgw-remarks** when writing specs — R-001 through R-008 are the eight test remarks this repo raises most often (redundant `as unknown` casts, `as never`, mocking config instead of `FakeConfigurationService`, literal test data, `.mock.calls` assertions, bare `rejects.toThrow()`).
