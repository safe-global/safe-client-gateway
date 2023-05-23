export function getRouteUrl(request: any) {
  const protocol = request.get('X-Forwarded-Proto') ?? request.protocol;
  return new URL(`${protocol}://${request.get('Host')}${request.originalUrl}`);
}
