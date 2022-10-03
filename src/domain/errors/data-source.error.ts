/**
 * Represents errors which originated from a DataSource.
 *
 * It optionally includes a {@link code} to identify the characteristics of
 * the error.
 *
 * {@link message} should contain no sensitive information as this error
 * can be exposed on the route level
 */
export class DataSourceError extends Error {
  constructor(readonly message: string, readonly code?: number) {
    super();
  }
}
