export function getRouteUrl(request: any): URL {
  const protocol = request.get('X-Forwarded-Proto') ?? request.protocol;
  return new URL(`${protocol}://${request.get('Host')}${request.originalUrl}`);
}
