export class LimitReachedError extends Error {
  constructor() {
    super(`Rate limit reached`);
  }
}
