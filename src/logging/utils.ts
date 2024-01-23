import { Request } from 'express';
import { get } from 'lodash';

const HEADER_IP_ADDRESS = 'X-Real-IP';
const HEADER_SAFE_APP_USER_AGENT = 'Safe-App-User-Agent';

export function formatRouteLogMessage(
  statusCode: number,
  request: Request,
  startTimeMs: number,
  detail?: string,
): {
  chain_id: string | null;
  client_ip: string | null;
  method: string;
  response_time_ms: number;
  route: string;
  path: string;
  safe_app_user_agent: string | null;
  status_code: number;
  detail: string | null;
} {
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

export const asError = (thrown: unknown): Error => {
  if (thrown instanceof Error) {
    return thrown;
  }

  let message: string;

  if (typeof thrown === 'string') {
    message = thrown;
  } else {
    try {
      message = get(thrown, 'message') ?? JSON.stringify(thrown);
    } catch {
      message = String(thrown);
    }
  }

  return new Error(message);
};
