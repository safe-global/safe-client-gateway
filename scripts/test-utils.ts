import * as fs from 'fs';

/**
 * Shared test utilities for env scripts.
 * Provides type-safe mock factories to reduce boilerplate across spec files.
 */

/**
 * Create a mock fs.Stats object with all required properties.
 * Provides a complete structural match, avoiding `as unknown as fs.Stats`.
 *
 * @param isSymLink - Whether the mock stats should report as a symbolic link
 * @returns A mock fs.Stats object
 */
export function createMockStats(isSymLink: boolean): fs.Stats {
  const date = new Date(0);
  return {
    isFile: jest.fn().mockReturnValue(false),
    isDirectory: jest.fn().mockReturnValue(false),
    isBlockDevice: jest.fn().mockReturnValue(false),
    isCharacterDevice: jest.fn().mockReturnValue(false),
    isSymbolicLink: jest.fn().mockReturnValue(isSymLink),
    isFIFO: jest.fn().mockReturnValue(false),
    isSocket: jest.fn().mockReturnValue(false),
    dev: 0,
    ino: 0,
    mode: 0,
    nlink: 0,
    uid: 0,
    gid: 0,
    rdev: 0,
    size: 0,
    blksize: 0,
    blocks: 0,
    atimeMs: 0,
    mtimeMs: 0,
    ctimeMs: 0,
    birthtimeMs: 0,
    atime: date,
    mtime: date,
    ctime: date,
    birthtime: date,
  } as fs.Stats;
}

/**
 * Mock process.exit to throw an error instead of exiting.
 * This allows testing code paths that call process.exit() without terminating the test runner.
 * The thrown error message includes the exit code for assertions.
 *
 * @returns The jest SpyInstance for restoration in afterEach/cleanup
 *
 * @example
 * const exitSpy = mockProcessExit();
 * expect(() => someFunctionThatExits()).toThrow('process.exit: 1');
 * exitSpy.mockRestore();
 */
export function mockProcessExit(): jest.SpyInstance {
  return jest
    .spyOn(process, 'exit')
    .mockImplementation((code?: string | number | null) => {
      throw new Error(`process.exit: ${code}`);
    });
}

/**
 * Set up a content capture on a mocked fs.writeFileSync.
 * Returns an object whose `content` property updates when the mock is invoked with string data.
 *
 * @param mockFn - The mocked writeFileSync function (from jest.mocked(fs).writeFileSync)
 * @returns Object with a `content` property that holds the last written string
 *
 * @example
 * const written = captureWriteContent(mockFs.writeFileSync);
 * generateNewEnvFile();
 * expect(written.content).toContain('REQUIRED_VAR=');
 */
export function captureWriteContent(
  mockFn: jest.MockedFunction<typeof fs.writeFileSync>,
): { content: string } {
  const result = { content: '' };
  mockFn.mockImplementation(
    (_file: fs.PathOrFileDescriptor, data: string | NodeJS.ArrayBufferView) => {
      if (typeof data === 'string') {
        result.content = data;
      }
    },
  );
  return result;
}

/**
 * Set up a content capture on a mocked fs.appendFileSync.
 * Returns an object whose `content` property updates when the mock is invoked with string data.
 *
 * @param mockFn - The mocked appendFileSync function (from jest.mocked(fs).appendFileSync)
 * @returns Object with a `content` property that holds the last appended string
 *
 * @example
 * const appended = captureAppendContent(mockFs.appendFileSync);
 * updateEnvFile();
 * expect(appended.content).toContain('NEW_VAR=');
 */
export function captureAppendContent(
  mockFn: jest.MockedFunction<typeof fs.appendFileSync>,
): { content: string } {
  const result = { content: '' };
  mockFn.mockImplementation(
    (_file: fs.PathOrFileDescriptor, data: string | Uint8Array) => {
      if (typeof data === 'string') {
        result.content = data;
      }
    },
  );
  return result;
}
