// SPDX-License-Identifier: FSL-1.1-MIT
import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * Serves a minimal HTML consent page that simulates the Google OAuth consent
 * screen. Only registered when {@link ExternalAuthModule} is loaded (i.e.
 * when `FF_EMAIL_AUTH` is enabled with the mock provider).
 *
 * Query parameters:
 * - `state`        — OAuth state value forwarded to the callback.
 * - `redirect_uri` — Callback URL the consent page redirects to after sign-in.
 * - `auto`         — When `"true"`, skips the form and redirects immediately
 *                    (useful for Cypress / Playwright E2E tests).
 * - `email`        — Pre-filled email address (default: `mock@example.com`).
 */
@ApiTags('auth')
@Controller({ path: 'auth/mock', version: '1' })
export class MockConsentController {
  @ApiOperation({
    summary: 'Get mock consent page',
    description:
      'Serves a minimal HTML consent page that simulates the Google OAuth consent screen.',
  })
  @ApiOkResponse({
    description: 'Mock consent page served successfully',
  })
  @Get('consent')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getConsentPage(
    @Query('state') state: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('auto') auto?: string,
    @Query('email') email?: string,
  ): string {
    const targetEmail = email ?? 'mock@example.com';
    const callbackUrl = `${redirectUri}?code=mock_${encodeURIComponent(targetEmail)}&state=${encodeURIComponent(state)}`;

    if (auto === 'true') {
      return `<html><head><meta http-equiv="refresh" content="0;url=${callbackUrl}"></head><body></body></html>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Mock Google Sign-In</title>
  <style>
    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f8f9fa; }
    .card { text-align: center; max-width: 400px; width: 100%; padding: 40px; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.12); }
    h2 { margin-top: 0; }
    .notice { color: #666; font-size: 14px; line-height: 1.5; }
    label { display: block; text-align: left; margin-bottom: 4px; font-size: 14px; }
    input[type=email] { padding: 8px 12px; width: 100%; box-sizing: border-box; font-size: 16px; border: 1px solid #ccc; border-radius: 4px; }
    .field { margin: 24px 0; }
    a.btn { display: inline-block; padding: 12px 24px; background: #4285F4; color: #fff; text-decoration: none; border-radius: 4px; font-size: 16px; }
    a.btn:hover { background: #3367d6; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Mock Google Sign-In</h2>
    <p class="notice">This is a mock consent screen served by CGW.<br>It only exists when the mock auth provider is active.</p>
    <div class="field">
      <label for="email">Sign in as:</label>
      <input id="email" type="email" value="${targetEmail}" />
    </div>
    <a id="sign-in-btn" class="btn" href="${callbackUrl}">Sign in with Mock Google</a>
  </div>
  <script>
    (function () {
      var emailInput = document.getElementById('email');
      var btn = document.getElementById('sign-in-btn');
      var redirectUri = ${JSON.stringify(redirectUri)};
      var state = ${JSON.stringify(state)};
      emailInput.addEventListener('input', function () {
        btn.href = redirectUri + '?code=mock_' + encodeURIComponent(emailInput.value) + '&state=' + encodeURIComponent(state);
      });
    })();
  </script>
</body>
</html>`;
  }
}
