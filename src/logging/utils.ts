const HEADER_IP_ADDRESS = 'X-Real-IP';
const HEADER_SAFE_APP_USER_AGENT = 'Safe-App-User-Agent';

export function formatRouteLogMessage(
  statusCode: number,
  request: any,
  startTimeMs: number,
  detail?: string,
) {
  const clientIp = request.header(HEADER_IP_ADDRESS) ?? null;
  const safe_app_user_agent =
    request.header(HEADER_SAFE_APP_USER_AGENT) ?? null;
  const chainId = request.params['chainId'] ?? null;

  return {
    chain_id: chainId,
    client_ip: clientIp,
    method: request.method,
    response_time_ms: performance.now() - startTimeMs,
    route: request.route.path,
    path: request.url,
    safe_app_user_agent: safe_app_user_agent,
    status_code: statusCode,
    detail: detail ?? null,
  };
}
