import { PromiseRegistry } from './promise-registry';

describe('Promise Registry tests', () => {
  let promiseRegistry: PromiseRegistry<string>;
  let registry: Record<string, Promise<unknown>>;

  beforeEach(() => {
    registry = {};
    promiseRegistry = new PromiseRegistry(registry);
  });

  it('registration is successful', () => {
    const promise = Promise.resolve();

    promiseRegistry.register('foo', () => promise);

    expect(Object.keys(registry)).toEqual(['foo']);
  });

  it('promise is deleted upon successful completion', async () => {
    const promise = Promise.resolve();

    await promiseRegistry.register('foo', () => promise);

    expect(Object.keys(registry)).toEqual([]);
  });

  it('promise is deleted upon error completion', async () => {
    const promise = Promise.reject('random error');

    await promiseRegistry.register('foo', () => promise).catch(() => {});

    expect(Object.keys(registry)).toEqual([]);
  });

  it('ongoing promise with same key is returned', async () => {
    registry['foo'] = Promise.resolve('ongoing');
    const promise = Promise.resolve('new');

    const actual = await promiseRegistry.register('foo', () => promise);

    expect(actual).toBe('ongoing');
  });
});
