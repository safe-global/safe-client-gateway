// SPDX-License-Identifier: FSL-1.1-MIT

// `unit` specs share a module cache within a worker (`isolate: false`), so any
// global state a spec file changes carries over to the next file that worker
// runs. Undo what a spec can leave behind once its file finishes.
afterAll(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
