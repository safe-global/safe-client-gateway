export function getRouteUrl(request: any) {
  return new URL(
    `${request.protocol}://${request.get('Host')}${request.originalUrl}`,
  );
}
