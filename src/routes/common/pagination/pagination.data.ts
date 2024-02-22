const QUERY_PARAM_CURSOR = 'cursor';
const QUERY_PARAM_LIMIT = 'limit';
const QUERY_PARAM_OFFSET = 'offset';

export class PaginationData {
  /**
   * Default pagination (limit and offset) values.
   * These values are intended to apply if no pagination data is present in the client request.
   * They limit the amount of items retrieved from provider services, and abstracts the clients
   * from pagination data management.
   *
   * Relying on pagination values returned by provider services is not feasible, since the
   * provider pagination data could have been customized depending on the use case.
   */
  public static readonly DEFAULT_LIMIT = 20;
  public static readonly DEFAULT_OFFSET = 0;

  constructor(
    readonly limit: number,
    readonly offset: number,
  ) {
    this.limit = isNaN(limit) ? PaginationData.DEFAULT_LIMIT : limit;
    this.offset = isNaN(offset) ? PaginationData.DEFAULT_OFFSET : offset;
  }

  /**
   * Extracts {@link PaginationData} from {@link url}. The url
   * must have a cursor query parameter to be extracted.
   *
   * This function should never fail. If the format is not the one
   * expected it assumes that the respective pagination data does
   * not exist
   *
   * @param url - url which contains the cursor query param
   */
  static fromCursor(url: Readonly<URL>): PaginationData {
    // If we don't have a cursor, assume no pagination data
    const cursorValue = url.searchParams.get(QUERY_PARAM_CURSOR) ?? '';
    const cursorSearchParams = new URLSearchParams(cursorValue);
    const limit = Number(cursorSearchParams.get(QUERY_PARAM_LIMIT) ?? NaN);
    const offset = Number(cursorSearchParams.get(QUERY_PARAM_OFFSET) ?? NaN);
    return new PaginationData(limit, offset);
  }

  /**
   * Extracts {@link PaginationData} from {@link url}. The url
   * must have a limit and/or offset query parameter(s) to be extracted.
   *
   * This function should never fail. If the format is not the one
   * expected it assumes that the respective pagination data does
   * not exist
   *
   * @param url - url which contains the limit and/or offset query param(s)
   */
  static fromLimitAndOffset(url: Readonly<URL>): PaginationData {
    const limit = Number(url.searchParams.get(QUERY_PARAM_LIMIT) ?? NaN);
    const offset = Number(url.searchParams.get(QUERY_PARAM_OFFSET) ?? NaN);
    return new PaginationData(limit, offset);
  }
}

/**
 * Returns a URL with a cursor containing the next page to be retrieved.
 * If no cursor is passed in {@link base} or it is invalid, a null reference will be returned.
 * If there are no items remaining, a null reference will be returned.
 *
 * @param base - The base url which should serve as reference
 * @param itemsCount - Total items count, useful to detect if a next page exists.
 */
export function buildNextPageURL(
  base: Readonly<URL | string>,
  itemsCount: number | null,
): Readonly<URL> | null {
  const baseUrl = new URL(base);
  const { limit, offset } = PaginationData.fromCursor(baseUrl);
  const hasNext = itemsCount && limit + offset < itemsCount;
  return hasNext
    ? setCursor(baseUrl, new PaginationData(limit, limit + offset))
    : null;
}

/**
 * Returns a URL with a cursor containing the previous page to be retrieved.
 * If no cursor is passed in {@link base} or it is invalid, a null reference will be returned.
 * If no previous items are found, a null reference will be returned.
 *
 * @param base - The base url which should serve as reference
 */
export function buildPreviousPageURL(
  base: Readonly<URL | string>,
): Readonly<URL> | null {
  const baseUrl = new URL(base);
  const { limit, offset } = PaginationData.fromCursor(baseUrl);
  const isFirst = offset === 0;
  return isFirst
    ? null
    : setCursor(
        baseUrl,
        new PaginationData(limit, limit <= offset ? offset - limit : 0),
      );
}

/**
 * Returns a URL with a cursor parameter added with the
 * pagination data from the {@link from} url
 *
 * This is useful whenever we want to map a pagination url (from)
 * to one of the Client Gateway (base)
 *
 * @param base - The base url which should serve as reference
 * @param from - The url from where to extract the pagination data from
 */
export function cursorUrlFromLimitAndOffset(
  base: Readonly<URL | string>,
  from: Readonly<URL | string | null>,
): Readonly<URL> | null {
  if (from == null) return null;
  const fromUrl = new URL(from);
  const paginationData = PaginationData.fromLimitAndOffset(fromUrl);
  return setCursor(base, paginationData);
}

/**
 * Returns a new {@link URL} with the cursor query parameter updated
 * with the data from {@link paginationData}
 *
 * If {@link url} does not have a cursor query param, it will be added
 *
 * @param url
 * @param paginationData
 */
function setCursor(
  url: Readonly<URL | string>,
  paginationData: PaginationData,
): URL {
  const modifiedURL = new URL(url);
  const cursorData = `${QUERY_PARAM_LIMIT}=${paginationData.limit}&${QUERY_PARAM_OFFSET}=${paginationData.offset}`;
  modifiedURL.searchParams.set(QUERY_PARAM_CURSOR, cursorData);
  return modifiedURL;
}
