// SPDX-License-Identifier: FSL-1.1-MIT
describe('timezone test', () => {
  it('should have a UTC timezone', () => {
    expect(new Date().getTimezoneOffset()).toBe(0);
  });
});
