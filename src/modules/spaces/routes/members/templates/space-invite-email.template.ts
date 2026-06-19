// SPDX-License-Identifier: FSL-1.1-MIT

import sanitizeHtml from 'sanitize-html';

// Escape all interpolated template values.
const ESCAPE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  disallowedTagsMode: 'escape',
};

export const SPACE_INVITE_EMAIL_SUBJECT =
  'You have been invited to a Safe workspace';

export const SPACE_INVITE_EMAIL_LOGO_URL =
  'https://app.safe.global/images/email/logo-monogram.png';

export const SPACE_INVITE_PATH = '/welcome/spaces';

type SpaceInviteEmailTemplateArgs = {
  name: string;
  email: string;
  workspaceName: string;
  actionUrl: string;
};

function getSpaceInviteEmailCopy(args: SpaceInviteEmailTemplateArgs): {
  preheader: string;
  headline: string;
  body: string;
  footerDisclosure: string;
  fallback: string;
} {
  return {
    preheader: `You've been invited to ${args.workspaceName} on Safe{Wallet}`,
    headline: `You've been invited to ${args.workspaceName}`,
    body: `Hi ${args.name}, you've been added to the ${args.workspaceName} workspace on Safe{Wallet}. Accept the invite to collaborate and view Safe Accounts with your team.`,
    footerDisclosure: `This invite was sent to ${args.email}. If unexpected, you can ignore it.`,
    fallback: 'Button not working? Open the invite in your browser',
  };
}

/**
 * Renders the HTML body for a space invite email.
 *
 * @param args.name - Invitee display name.
 * @param args.email - Invitee email address.
 * @param args.workspaceName - Workspace name shown in the email.
 * @param args.actionUrl - URL opened by the invite CTA.
 */
export function renderSpaceInviteEmailHtml(
  args: SpaceInviteEmailTemplateArgs,
): string {
  const copy = getSpaceInviteEmailCopy(args);
  const html = {
    name: sanitizeHtml(args.name, ESCAPE_OPTIONS),
    workspaceName: sanitizeHtml(args.workspaceName, ESCAPE_OPTIONS),
    actionUrl: sanitizeHtml(args.actionUrl, ESCAPE_OPTIONS),
    preheader: sanitizeHtml(copy.preheader, ESCAPE_OPTIONS),
    headline: sanitizeHtml(copy.headline, ESCAPE_OPTIONS),
    footerDisclosure: sanitizeHtml(copy.footerDisclosure, ESCAPE_OPTIONS),
  };

  return [
    '<!DOCTYPE html>',
    '<html lang="en" xmlns="http://www.w3.org/1999/xhtml">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <meta http-equiv="X-UA-Compatible" content="IE=edge">',
    '  <meta name="color-scheme" content="light">',
    '  <meta name="supported-color-schemes" content="light">',
    `  <title>You're invited to ${html.workspaceName}</title>`,
    '  <style>',
    "    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');",
    '    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }',
    '    img { border: 0; line-height: 100%; outline: none; text-decoration: none; }',
    '    @media only screen and (max-width: 640px) {',
    '      .container { width: 100% !important; }',
    '      .card-pad { padding: 32px 24px !important; }',
    '    }',
    '  </style>',
    '</head>',
    '<body style="margin:0; padding:0; background-color:#F5F5F5; font-family:\'DM Sans\', Helvetica, Arial, sans-serif;">',
    `  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${html.preheader}</div>`,
    '  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F5F5;">',
    '    <tr>',
    '      <td align="center" style="padding:48px 16px;">',
    '        <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0" style="width:560px; max-width:560px;">',
    '          <tr>',
    '            <td class="card-pad" style="background-color:#FFFFFF; border-radius:24px; padding:48px;">',
    '              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">',
    '                <tr>',
    '                  <td align="center" style="padding:16px 0 32px 0;">',
    `                    <img src="${SPACE_INVITE_EMAIL_LOGO_URL}" width="56" height="56" alt="Safe" style="display:block; width:56px; height:56px;">`,
    '                  </td>',
    '                </tr>',
    '                <tr>',
    `                  <td align="center" style="font-family:'DM Sans', Helvetica, Arial, sans-serif; font-size:24px; line-height:120%; font-weight:700; color:#1A1A1A; padding-bottom:16px;">${html.headline}</td>`,
    '                </tr>',
    '                <tr>',
    `                  <td align="center" style="font-family:'DM Sans', Helvetica, Arial, sans-serif; font-size:16px; line-height:24px; color:#636669; padding-bottom:32px;">Hi ${html.name}, you've been added to the <strong style="font-weight:500; color:#1A1A1A;">${html.workspaceName}</strong> workspace on Safe&#123;Wallet&#125;. Accept the invite to collaborate and view Safe Accounts with your team.</td>`,
    '                </tr>',
    '                <tr>',
    '                  <td align="center" style="padding-bottom:8px;">',
    '                    <table role="presentation" cellpadding="0" cellspacing="0">',
    '                      <tr>',
    '                        <td align="center" style="background-color:#121312; border-radius:10px;">',
    `                          <a href="${html.actionUrl}" target="_blank" style="display:inline-block; padding:14px 32px; font-family:'DM Sans', Helvetica, Arial, sans-serif; font-size:16px; line-height:24px; font-weight:500; color:#FFFFFF; text-decoration:none; border-radius:10px;">Accept invite</a>`,
    '                        </td>',
    '                      </tr>',
    '                    </table>',
    '                  </td>',
    '                </tr>',
    '              </table>',
    '            </td>',
    '          </tr>',
    '          <tr>',
    '            <td align="center" style="padding:32px 24px 0 24px;">',
    '              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">',
    '                <tr>',
    `                  <td align="center" style="font-family:'DM Sans', Helvetica, Arial, sans-serif; font-size:14px; line-height:22px; color:#636669; padding-bottom:4px;">${html.footerDisclosure}</td>`,
    '                </tr>',
    '                <tr>',
    `                  <td align="center" style="font-family:'DM Sans', Helvetica, Arial, sans-serif; font-size:14px; line-height:22px; color:#636669; padding-bottom:24px;">Button not working? <a href="${html.actionUrl}" target="_blank" style="color:#636669; text-decoration:underline;">Open the invite in your browser</a></td>`,
    '                </tr>',
    '                <tr>',
    '                  <td align="center" style="font-family:\'DM Sans\', Helvetica, Arial, sans-serif; font-size:14px; line-height:22px; color:#A1A3A7;">',
    '                    <a href="https://app.safe.global/privacy" target="_blank" style="color:#A1A3A7; text-decoration:none;">Privacy policy</a>',
    '                    &nbsp;&nbsp;&nbsp;',
    '                    <a href="https://app.safe.global/terms" target="_blank" style="color:#A1A3A7; text-decoration:none;">Terms of service</a>',
    '                    &nbsp;&nbsp;&nbsp;',
    '                    <a href="https://help.safe.global" target="_blank" style="color:#A1A3A7; text-decoration:none;">Support</a>',
    '                  </td>',
    '                </tr>',
    '              </table>',
    '            </td>',
    '          </tr>',
    '        </table>',
    '      </td>',
    '    </tr>',
    '  </table>',
    '</body>',
    '</html>',
  ].join('\n');
}

/**
 * Renders the plain-text body for a space invite email.
 *
 * @param args.name - Invitee display name.
 * @param args.email - Invitee email address.
 * @param args.workspaceName - Workspace name shown in the email.
 * @param args.actionUrl - URL opened by the invite CTA.
 */
export function renderSpaceInviteEmailText(
  args: SpaceInviteEmailTemplateArgs,
): string {
  const copy = getSpaceInviteEmailCopy(args);

  return [
    copy.headline,
    copy.body,
    'Accept invite:',
    args.actionUrl,
    copy.footerDisclosure,
    `${copy.fallback}: ${args.actionUrl}`,
    'Privacy policy: https://app.safe.global/privacy',
    'Terms of service: https://app.safe.global/terms',
    'Support: https://help.safe.global',
  ].join('\n\n');
}
