// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { MockConsentController } from '@/modules/auth/routes/mock-consent.controller';

describe('MockConsentController', () => {
  let controller: MockConsentController;

  beforeEach(() => {
    controller = new MockConsentController();
  });

  describe('getConsentPage — interactive mode (default)', () => {
    it('should return an HTML page containing the default email and a sign-in link', () => {
      const state = faker.string.alphanumeric(32);
      const redirectUri = 'http://localhost:3000/v1/auth/google/callback';

      const html = controller.getConsentPage(state, redirectUri);

      expect(html).toContain('mock@example.com');
      expect(html).toContain('Sign in with Mock Google');
      expect(html).toContain(
        `${redirectUri}?code=mock_${encodeURIComponent('mock@example.com')}&state=${encodeURIComponent(state)}`,
      );
    });

    it('should pre-fill the provided email', () => {
      const state = faker.string.alphanumeric(32);
      const email = faker.internet.email();
      const redirectUri = 'http://localhost:3000/v1/auth/google/callback';

      const html = controller.getConsentPage(state, redirectUri, undefined, email);

      expect(html).toContain(email);
      expect(html).toContain(
        `${redirectUri}?code=mock_${encodeURIComponent(email)}&state=${encodeURIComponent(state)}`,
      );
    });

    it('should not include a meta-refresh tag in interactive mode', () => {
      const state = faker.string.alphanumeric(32);
      const redirectUri = faker.internet.url();

      const html = controller.getConsentPage(state, redirectUri);

      expect(html).not.toContain('http-equiv="refresh"');
    });
  });

  describe('getConsentPage — auto-redirect mode (?auto=true)', () => {
    it('should return a page with a meta-refresh redirect to the callback URL', () => {
      const state = faker.string.alphanumeric(32);
      const redirectUri = 'http://localhost:3000/v1/auth/google/callback';

      const html = controller.getConsentPage(state, redirectUri, 'true');

      expect(html).toContain('http-equiv="refresh"');
      expect(html).toContain(
        `${redirectUri}?code=mock_${encodeURIComponent('mock@example.com')}&state=${encodeURIComponent(state)}`,
      );
    });

    it('should include the provided email in the auto-redirect URL', () => {
      const state = faker.string.alphanumeric(32);
      const email = faker.internet.email();
      const redirectUri = 'http://localhost:3000/v1/auth/google/callback';

      const html = controller.getConsentPage(state, redirectUri, 'true', email);

      expect(html).toContain(
        `${redirectUri}?code=mock_${encodeURIComponent(email)}&state=${encodeURIComponent(state)}`,
      );
    });

    it('should not render the sign-in form in auto-redirect mode', () => {
      const state = faker.string.alphanumeric(32);
      const redirectUri = faker.internet.url();

      const html = controller.getConsentPage(state, redirectUri, 'true');

      expect(html).not.toContain('Sign in with Mock Google');
      expect(html).not.toContain('<form');
    });
  });
});
