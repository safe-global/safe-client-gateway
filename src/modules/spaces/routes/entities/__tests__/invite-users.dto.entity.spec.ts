// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { InviteUsersDtoSchema } from '@/modules/spaces/routes/entities/invite-users.dto.entity';

const walletInviteItem = (): Record<string, unknown> => ({
  type: 'wallet',
  address: getAddress(faker.finance.ethereumAddress()),
  role: 'MEMBER',
  name: faker.person.firstName(),
});

const emailInviteItem = (): Record<string, unknown> => ({
  type: 'email',
  email: faker.internet.email(),
  role: 'MEMBER',
  name: faker.person.firstName(),
});

describe('InviteUsersDtoSchema', () => {
  it('should validate a wallet invite with explicit type', () => {
    const result = InviteUsersDtoSchema.safeParse({
      users: [walletInviteItem()],
    });

    expect(result.success).toBe(true);
  });

  it('should validate an email invite with explicit type', () => {
    const result = InviteUsersDtoSchema.safeParse({
      users: [emailInviteItem()],
    });

    expect(result.success).toBe(true);
  });

  it('should validate a mixed batch of wallet and email invites', () => {
    const result = InviteUsersDtoSchema.safeParse({
      users: [walletInviteItem(), emailInviteItem()],
    });

    expect(result.success).toBe(true);
  });

  it('should infer type=wallet for legacy clients sending address without type', () => {
    const legacy = walletInviteItem();
    delete legacy.type;

    const result = InviteUsersDtoSchema.safeParse({ users: [legacy] });

    expect(result.success).toBe(true);
    expect(result.success && result.data.users[0].type).toBe('wallet');
  });

  it('should reject an email-shaped item that omits `type`', () => {
    const legacy = emailInviteItem();
    delete legacy.type;

    const result = InviteUsersDtoSchema.safeParse({ users: [legacy] });

    expect(result.success).toBe(false);
  });

  it('should normalize email to lowercase via EmailAddressSchema', () => {
    const result = InviteUsersDtoSchema.safeParse({
      users: [{ ...emailInviteItem(), email: 'Mixed.Case@Example.COM' }],
    });

    expect(result.success).toBe(true);
    if (result.success && result.data.users[0].type === 'email') {
      expect(result.data.users[0].email).toBe('mixed.case@example.com');
    }
  });

  it('should reject an invalid email format', () => {
    const result = InviteUsersDtoSchema.safeParse({
      users: [{ ...emailInviteItem(), email: 'not-an-email' }],
    });

    expect(result.success).toBe(false);
  });

  it('should reject an empty users array', () => {
    const result = InviteUsersDtoSchema.safeParse({ users: [] });

    expect(result.success).toBe(false);
  });

  it('should reject an item with neither address nor email', () => {
    const result = InviteUsersDtoSchema.safeParse({
      users: [{ role: 'MEMBER', name: faker.person.firstName() }],
    });

    expect(result.success).toBe(false);
  });

  it('should reject an item missing the role field', () => {
    const wallet = walletInviteItem();
    delete wallet.role;

    const result = InviteUsersDtoSchema.safeParse({ users: [wallet] });

    expect(result.success).toBe(false);
  });

  it('should reject a wallet item missing the address', () => {
    const wallet = walletInviteItem();
    delete wallet.address;

    const result = InviteUsersDtoSchema.safeParse({ users: [wallet] });

    expect(result.success).toBe(false);
  });

  it('should reject a wallet item with an invalid address', () => {
    const result = InviteUsersDtoSchema.safeParse({
      users: [{ ...walletInviteItem(), address: 'not-an-address' }],
    });

    expect(result.success).toBe(false);
  });

  it('should reject an email item missing the email', () => {
    const email = emailInviteItem();
    delete email.email;

    const result = InviteUsersDtoSchema.safeParse({ users: [email] });

    expect(result.success).toBe(false);
  });

  it('should reject an email exceeding 255 characters', () => {
    const longEmail = `${'a'.repeat(251)}@b.co`;
    const result = InviteUsersDtoSchema.safeParse({
      users: [{ ...emailInviteItem(), email: longEmail }],
    });

    expect(result.success).toBe(false);
  });

  it('should reject an unknown type value', () => {
    const result = InviteUsersDtoSchema.safeParse({
      users: [{ ...walletInviteItem(), type: 'admin' }],
    });

    expect(result.success).toBe(false);
  });

  it('should reject an item missing the name field', () => {
    const wallet = walletInviteItem();
    delete wallet.name;

    const result = InviteUsersDtoSchema.safeParse({ users: [wallet] });

    expect(result.success).toBe(false);
  });

  it('should reject a name exceeding 255 characters', () => {
    const result = InviteUsersDtoSchema.safeParse({
      users: [{ ...walletInviteItem(), name: 'a'.repeat(256) }],
    });

    expect(result.success).toBe(false);
  });

  it('should reject an invalid role value', () => {
    const result = InviteUsersDtoSchema.safeParse({
      users: [{ ...walletInviteItem(), role: 'OWNER' }],
    });

    expect(result.success).toBe(false);
  });

  it('should reject a body missing the users field', () => {
    const result = InviteUsersDtoSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it('should reject a body where users is not an array', () => {
    const result = InviteUsersDtoSchema.safeParse({ users: 'not-an-array' });

    expect(result.success).toBe(false);
  });

  it('should reject a wallet item that also carries an email field (strict)', () => {
    const result = InviteUsersDtoSchema.safeParse({
      users: [{ ...walletInviteItem(), email: faker.internet.email() }],
    });

    expect(result.success).toBe(false);
  });

  it('should reject an email item that also carries an address field (strict)', () => {
    const result = InviteUsersDtoSchema.safeParse({
      users: [
        {
          ...emailInviteItem(),
          address: getAddress(faker.finance.ethereumAddress()),
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
