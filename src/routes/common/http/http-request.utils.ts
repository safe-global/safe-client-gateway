// SPDX-License-Identifier: FSL-1.1-MIT
import type { IncomingHttpHeaders } from 'node:http';
import type { FastifyRequest } from 'fastify';

export type HttpRequest = FastifyRequest;

type HeaderReader = {
  get?: (name: string) => string | undefined;
  header?: (name: string) => string | undefined;
};

export type RequestLike = HeaderReader & {
  headers?: IncomingHttpHeaders;
  host?: string;
  hostname?: string;
  ip?: string;
  method?: string;
  originalUrl?: string;
  params?: unknown;
  path?: string;
  protocol?: string;
  route?: { path?: string };
  routeOptions?: { url?: string };
  url?: string;
};

function getHeaderFromCollection(
  headers: IncomingHttpHeaders | undefined,
  name: string,
): string | undefined {
  const value = headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function getHeader(
  request: RequestLike,
  name: string,
): string | undefined {
  return (
    request.header?.(name) ??
    request.get?.(name) ??
    getHeaderFromCollection(request.headers, name)
  );
}

export function getRequestPath(request: RequestLike): string {
  return request.originalUrl ?? request.url ?? '/';
}

export function getRoutePath(request: RequestLike): string {
  return (
    request.routeOptions?.url ??
    request.route?.path ??
    request.path ??
    getRequestPath(request).split('?')[0]
  );
}

export function getRouteParam(request: RequestLike, name: string): unknown {
  if (request.params && typeof request.params === 'object') {
    return (request.params as Record<string, unknown>)[name];
  }
  return undefined;
}

export function getRouteUrl(request: RequestLike): URL {
  const protocol =
    getHeader(request, 'X-Forwarded-Proto') ?? request.protocol ?? 'http';
  const host =
    getHeader(request, 'Host') ??
    request.host ??
    request.hostname ??
    'localhost';
  return new URL(`${protocol}://${host}${getRequestPath(request)}`);
}
