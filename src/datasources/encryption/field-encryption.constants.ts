// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * Additional authenticated data (AAD) for each encrypted field.
 *
 * Binding ciphertext to a stable, per-field context means a value encrypted for
 * one column cannot be transplanted into another (decryption fails the GCM auth
 * check). The reader always knows the field, so the AAD is reconstructable.
 *
 * These strings are part of the on-disk contract: changing one makes existing
 * ciphertext for that field undecryptable. Treat them as immutable.
 */
export const FieldEncryptionAad = {
  SPACE_NAME: 'spaces.name',
  USER_EMAIL: 'users.email',
  MEMBER_NAME: 'members.name',
  MEMBER_ALIAS: 'members.alias',
  ADDRESS_BOOK_ITEM_NAME: 'space_address_book_items.name',
  ADDRESS_BOOK_REQUEST_NAME: 'address_book_requests.name',
  // Names copied into immutable audit payloads (jsonb). A single context is used
  // for every name field within the payload.
  SPACE_AUDIT_NAME: 'space_audit_log.payload.name',
} as const;
