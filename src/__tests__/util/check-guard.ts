export const checkGuardIsApplied = (
  guard: abstract new (...args: Array<any>) => unknown,
  fn: (...args: Array<any>) => unknown,
): void => {
  const guards: Array<() => void> = Reflect.getMetadata('__guards__', fn);
  expect(guards?.length ?? 0).toBeGreaterThan(0);
  guards.some((g) => expect(g.name).toBe(guard.name));
};
