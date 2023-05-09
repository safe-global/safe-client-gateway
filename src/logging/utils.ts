const HEADER_IP_ADDRESS = 'X-Real-IP';

export function formatRouteLogMessage(
  statusCode: number,
  request: any,
  startTimeMs: number,
  detail?: string,
) {
  const clientIp = request.header(HEADER_IP_ADDRESS) ?? null;

  return {
    client_ip: clientIp,
    method: request.method,
    response_time_ms: performance.now() - startTimeMs,
    route: request.route.path,
    path: request.url,
    status_code: statusCode,
    detail: detail ?? null,
  };
}
