// SPDX-License-Identifier: FSL-1.1-MIT

import { randomUUID } from 'node:crypto';
import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type postgres from 'postgres';
import request from 'supertest';
import { type Address, getAddress } from 'viem';
import { TestDbFactory } from '#/__tests__/db.factory';
import {
  initTestApplication,
  TestAppProvider,
} from '#/__tests__/test-app.provider';
import { createTestModule } from '#/__tests__/testing-module';
import configuration from '#/config/entities/__tests__/configuration';
import { IJwtService } from '#/datasources/jwt/jwt.service.interface';
import { DB_MAX_SAFE_INTEGER } from '#/domain/common/constants';
import { nameBuilder } from '#/domain/common/entities/name.builder';
import { siweAuthPayloadDtoBuilder } from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { NotificationsRepositoryV2Module } from '#/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '#/modules/notifications/domain/v2/test.notification.repository.module';
import {
  MAX_TAGS_PER_CONTACT,
  MAX_TAGS_PER_WORKSPACE,
  TAG_COLORS,
  TAG_NAME_TAKEN_MESSAGE,
  WORKSPACE_TAG_LIMIT_MESSAGE,
} from '#/modules/spaces/domain/address-books/entities/address-book-tag.entity';
import { SpaceAuditEventType } from '#/modules/spaces/domain/audit/entities/space-audit-event.entity';
import type { SpaceAddressBookTagDto } from '#/modules/spaces/routes/address-books/entities/address-book-tags.dto.entity';
import type { SpaceAddressBookItemDto } from '#/modules/spaces/routes/address-books/entities/space-address-book.dto.entity';
import type { SpaceAuditLogEntryDto } from '#/modules/spaces/routes/audit/entities/space-audit-log.dto.entity';
import { SpacesCreationRateLimitGuard } from '#/modules/spaces/routes/guards/spaces-creation-rate-limit.guard';

describe('AddressBooksController tags', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;

  const testDatabaseName = `test_${randomUUID().replaceAll('-', '')}`;
  const testDbFactory = new TestDbFactory();
  let testDatabase: postgres.Sql;

  beforeAll(async () => {
    testDatabase = await testDbFactory.createTestDatabase(testDatabaseName);

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      db: {
        ...defaultConfiguration.db,
        connection: {
          ...defaultConfiguration.db.connection,
          postgres: {
            ...defaultConfiguration.db.connection.postgres,
            database: testDatabaseName,
          },
        },
      },
      features: {
        ...defaultConfiguration.features,
        auth: true,
        users: true,
      },
    });

    const moduleFixture = await createTestModule({
      config: testConfiguration,
      overridePostgresV2: false,
      cacheKeyPrefix: testDatabaseName,
      guards: [
        {
          originalGuard: SpacesCreationRateLimitGuard,
          testGuard: { canActivate: (): true => true },
        },
      ],
      modules: [
        {
          originalModule: NotificationsRepositoryV2Module,
          testModule: TestNotificationsRepositoryV2Module,
        },
      ],
    });

    jwtService = moduleFixture.get<IJwtService>(IJwtService);
    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterAll(async () => {
    await app?.close();
    await testDbFactory.destroyTestDatabase(testDatabase);
  });

  describe('tags', () => {
    it('a member sets up to 3 tags on a contact; GET returns them with colours and counts', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await createActiveMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const { mockAddress } = await createAddressBookItem({
        spaceId,
        adminAccessToken: accessToken,
      });
      const tagNames = fakeTagNames(MAX_TAGS_PER_CONTACT);

      const { body } = await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({ items: [{ address: mockAddress, tags: tagNames }] })
        .expect(200);

      expect(body.tags).toEqual(
        tagNames.map((name) => ({
          id: expect.any(Number),
          name,
          color: expect.any(String),
          contactCount: 1,
        })),
      );
      const colors = body.tags.map((tag: SpaceAddressBookTagDto) => tag.color);
      for (const color of colors) {
        expect(TAG_COLORS).toContain(color);
      }
      expect(new Set(colors).size).toBe(MAX_TAGS_PER_CONTACT);
      expect(tagIdsOf(body.data, mockAddress)).toEqual(
        sortedIds(body.tags.map((tag: SpaceAddressBookTagDto) => tag.id)),
      );
      const { body: book } = await getAddressBook({
        spaceId,
        accessToken: memberAccessToken,
      });
      expect(book).toEqual(body);
    });

    it('a member creates a tag with no contacts; the same name again, in any case, answers 409', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await createActiveMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const [name] = fakeTagNames(1);

      const { body } = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({ name })
        .expect(201);

      expect(body.tags).toEqual([
        {
          id: expect.any(Number),
          name,
          color: expect.any(String),
          contactCount: 0,
        },
      ]);
      expect(TAG_COLORS).toContain(body.tags[0].color);

      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({ name: name.toUpperCase() })
        .expect(409)
        .expect(({ body: error }) =>
          expect(error).toMatchObject({
            statusCode: 409,
            message: TAG_NAME_TAKEN_MESSAGE,
          }),
        );

      const { body: after } = await getAddressBook({ spaceId, accessToken });
      expect(after.tags).toEqual(body.tags);
    });

    it('a member tags several contacts in one request', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await createActiveMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const [first, second] = await createAddressBookItems({
        spaceId,
        adminAccessToken: accessToken,
        count: 2,
      });
      const [shared, firstOnly] = fakeTagNames(2);

      const { body } = await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({
          items: [
            { address: first, tags: [shared, firstOnly] },
            { address: second, tags: [shared] },
          ],
        })
        .expect(200);

      const sharedTag = tagNamed(body.tags, shared);
      const firstOnlyTag = tagNamed(body.tags, firstOnly);
      expect(body.tags).toHaveLength(2);
      expect(sharedTag.contactCount).toBe(2);
      expect(firstOnlyTag.contactCount).toBe(1);
      expect(tagIdsOf(body.data, first)).toEqual(
        sortedIds([sharedTag.id, firstOnlyTag.id]),
      );
      expect(tagIdsOf(body.data, second)).toEqual([sharedTag.id]);
    });

    it('rejects a 4th tag on a contact with 422 and keeps the stored tags', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { mockAddress } = await createAddressBookItem({
        spaceId,
        adminAccessToken: accessToken,
      });
      const tagNames = fakeTagNames(MAX_TAGS_PER_CONTACT + 1);
      const { body: before } = await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          items: [
            {
              address: mockAddress,
              tags: tagNames.slice(0, MAX_TAGS_PER_CONTACT),
            },
          ],
        })
        .expect(200);

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ items: [{ address: mockAddress, tags: tagNames }] })
        .expect(422)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            statusCode: 422,
            message: `A contact can have at most ${MAX_TAGS_PER_CONTACT} tags`,
          }),
        );

      const { body: after } = await getAddressBook({ spaceId, accessToken });
      expect(after).toEqual(before);
    });

    it('rejects a disallowed tag name with 422 and keeps the stored tags', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { mockAddress } = await createAddressBookItem({
        spaceId,
        adminAccessToken: accessToken,
      });
      const { body: before } = await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ items: [{ address: mockAddress, tags: fakeTagNames(1) }] })
        .expect(200);

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ items: [{ address: mockAddress, tags: ['Signer'] }] })
        .expect(422)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            statusCode: 422,
            message:
              "'Signer' is added automatically and can't be used as a tag name",
          }),
        );

      const { body: after } = await getAddressBook({ spaceId, accessToken });
      expect(after).toEqual(before);
    });

    it('rejects renaming a tag to a disallowed name with 422 and keeps its name', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { mockAddress } = await createAddressBookItem({
        spaceId,
        adminAccessToken: accessToken,
      });
      const [tagName] = fakeTagNames(1);
      const { body: before } = await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ items: [{ address: mockAddress, tags: [tagName] }] })
        .expect(200);
      const tag = tagNamed(before.tags, tagName);

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}/address-book/tags/${tag.id}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ name: 'workspace safe' })
        .expect(422)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            statusCode: 422,
            message:
              "'workspace safe' is added automatically and can't be used as a tag name",
          }),
        );

      const { body: after } = await getAddressBook({ spaceId, accessToken });
      expect(after).toEqual(before);
    });

    it('rejects the same address twice in one request with 422', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { mockAddress } = await createAddressBookItem({
        spaceId,
        adminAccessToken: accessToken,
      });
      const [firstTag, secondTag] = fakeTagNames(2);

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          items: [
            { address: mockAddress, tags: [firstTag] },
            { address: mockAddress.toLowerCase(), tags: [secondTag] },
          ],
        })
        .expect(422)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            statusCode: 422,
            message: 'Each address can appear only once',
          }),
        );

      const { body } = await getAddressBook({ spaceId, accessToken });
      expect(body.tags).toEqual([]);
      expect(tagIdsOf(body.data, mockAddress)).toEqual([]);
    });

    it('rejects a 9th tag in the workspace with 400 and the limit message, changing no contact in the batch', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await createActiveMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const tagNames = fakeTagNames(MAX_TAGS_PER_WORKSPACE + 1);
      const workspaceTags = tagNames.slice(0, MAX_TAGS_PER_WORKSPACE);
      const extraTag = tagNames[MAX_TAGS_PER_WORKSPACE];
      // The workspace's tags spread over as few contacts as the per-contact
      // limit allows, plus one untagged contact.
      const tagSets = Array.from(
        { length: Math.ceil(MAX_TAGS_PER_WORKSPACE / MAX_TAGS_PER_CONTACT) },
        (_, index) =>
          workspaceTags.slice(
            index * MAX_TAGS_PER_CONTACT,
            (index + 1) * MAX_TAGS_PER_CONTACT,
          ),
      );
      const addresses = await createAddressBookItems({
        spaceId,
        adminAccessToken: accessToken,
        count: tagSets.length + 1,
      });
      const untagged = addresses[tagSets.length];
      const { body: before } = await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({
          items: tagSets.map((tags, index) => ({
            address: addresses[index],
            tags,
          })),
        })
        .expect(200);
      expect(before.tags).toHaveLength(MAX_TAGS_PER_WORKSPACE);

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({
          items: [
            // Valid on its own: an existing tag on an untagged contact.
            { address: untagged, tags: [workspaceTags[0]] },
            { address: addresses[0], tags: [extraTag] },
          ],
        })
        .expect(400)
        .expect({
          statusCode: 400,
          message: WORKSPACE_TAG_LIMIT_MESSAGE,
          error: 'Bad Request',
        });

      const { body: after } = await getAddressBook({
        spaceId,
        accessToken: memberAccessToken,
      });
      expect(after).toEqual(before);
    });

    it('returns 403 for a pending (invited) member and for a non-member', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { mockAddress } = await createAddressBookItem({
        spaceId,
        adminAccessToken: accessToken,
      });
      const [tagName, otherTagName] = fakeTagNames(2);
      const { body: before } = await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ items: [{ address: mockAddress, tags: [tagName] }] })
        .expect(200);
      const { id: tagId } = tagNamed(before.tags, tagName);
      const { memberAccessToken: pendingMemberAccessToken } =
        await createPendingMember({ spaceId, adminAccessToken: accessToken });
      const { accessToken: nonMemberAccessToken } = await createSpace();
      const forbidden = {
        statusCode: 403,
        message: 'User is not a member of this workspace',
        error: 'Forbidden',
      };

      for (const callerAccessToken of [
        pendingMemberAccessToken,
        nonMemberAccessToken,
      ]) {
        await request(app.getHttpServer())
          .put(`/v1/spaces/${spaceId}/address-book/tags`)
          .set('Cookie', [`access_token=${callerAccessToken}`])
          .send({ items: [{ address: mockAddress, tags: [otherTagName] }] })
          .expect(403)
          .expect(forbidden);
        await request(app.getHttpServer())
          .patch(`/v1/spaces/${spaceId}/address-book/tags/${tagId}`)
          .set('Cookie', [`access_token=${callerAccessToken}`])
          .send({ name: otherTagName })
          .expect(403)
          .expect(forbidden);
        await request(app.getHttpServer())
          .delete(`/v1/spaces/${spaceId}/address-book/tags/${tagId}`)
          .set('Cookie', [`access_token=${callerAccessToken}`])
          .expect(403)
          .expect(forbidden);
      }

      const { body: after } = await getAddressBook({ spaceId, accessToken });
      expect(after).toEqual(before);
    });

    it('returns 404 when an address is not in the book, changing no contact in the batch', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await createActiveMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const { mockAddress } = await createAddressBookItem({
        spaceId,
        adminAccessToken: accessToken,
      });
      const [tagName] = fakeTagNames(1);

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({
          items: [
            { address: mockAddress, tags: [tagName] },
            {
              address: getAddress(faker.finance.ethereumAddress()),
              tags: [tagName],
            },
          ],
        })
        .expect(404)
        .expect({
          statusCode: 404,
          message: 'Address book item not found.',
          error: 'Not Found',
        });

      const { body } = await getAddressBook({
        spaceId,
        accessToken: memberAccessToken,
      });
      expect(body.tags).toEqual([]);
      expect(tagIdsOf(body.data, mockAddress)).toEqual([]);
    });

    it("PUT /address-book without tags keeps the contact's tags", async () => {
      const { spaceId, accessToken } = await createSpace();
      const { mockAddress, mockChainIds } = await createAddressBookItem({
        spaceId,
        adminAccessToken: accessToken,
      });
      const { body: tagged } = await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ items: [{ address: mockAddress, tags: fakeTagNames(2) }] })
        .expect(200);
      const newName = nameBuilder();

      const { body } = await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          items: [
            { name: newName, address: mockAddress, chainIds: mockChainIds },
          ],
        })
        .expect(200);

      expect(body.data).toEqual([
        expect.objectContaining({ address: mockAddress, name: newName }),
      ]);
      expect(tagIdsOf(body.data, mockAddress)).toEqual(
        tagIdsOf(tagged.data, mockAddress),
      );
      expect(body.tags).toEqual(tagged.tags);
      const { body: book } = await getAddressBook({ spaceId, accessToken });
      expect(book).toEqual(body);
    });

    it("approving a member's request for an existing address keeps its tags", async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await createActiveMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const { mockAddress } = await createAddressBookItem({
        spaceId,
        adminAccessToken: accessToken,
      });
      const { body: tagged } = await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({ items: [{ address: mockAddress, tags: fakeTagNames(2) }] })
        .expect(200);
      const requestedName = nameBuilder();
      const { body: addressBookRequest } = await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({
          name: requestedName,
          address: mockAddress,
          chainIds: [faker.string.numeric()],
        })
        .expect(201);

      await request(app.getHttpServer())
        .put(
          `/v1/spaces/${spaceId}/address-book/requests/${addressBookRequest.id}/approve`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      const { body } = await getAddressBook({ spaceId, accessToken });
      expect(body.data).toEqual([
        expect.objectContaining({ address: mockAddress, name: requestedName }),
      ]);
      expect(tagIdsOf(body.data, mockAddress)).toEqual(
        tagIdsOf(tagged.data, mockAddress),
      );
      expect(body.tags).toEqual(tagged.tags);
    });

    it('PUT /address-book with tags sets them (admin)', async () => {
      const { spaceId, accessToken } = await createSpace();
      const existing = await createAddressBookItem({
        spaceId,
        adminAccessToken: accessToken,
      });
      const [keptTagName, addedTagName] = fakeTagNames(2);
      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          items: [{ address: existing.mockAddress, tags: [keptTagName] }],
        })
        .expect(200);
      const newContact = {
        name: nameBuilder(),
        address: getAddress(faker.finance.ethereumAddress()),
        chainIds: faker.helpers.multiple(() => faker.string.numeric(), {
          count: { min: 1, max: 5 },
        }),
      };

      const { body } = await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          items: [
            { ...newContact, tags: [keptTagName, addedTagName] },
            // No `tags`: the contact keeps the tags it has.
            {
              name: nameBuilder(),
              address: existing.mockAddress,
              chainIds: existing.mockChainIds,
            },
          ],
        })
        .expect(200);

      const keptTag = tagNamed(body.tags, keptTagName);
      const addedTag = tagNamed(body.tags, addedTagName);
      expect(body.tags).toHaveLength(2);
      expect(keptTag.contactCount).toBe(2);
      expect(addedTag.contactCount).toBe(1);
      expect(tagIdsOf(body.data, newContact.address)).toEqual(
        sortedIds([keptTag.id, addedTag.id]),
      );
      expect(tagIdsOf(body.data, existing.mockAddress)).toEqual([keptTag.id]);

      // An empty list clears the contact's tags; the unused tag is kept.
      const { body: cleared } = await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ items: [{ ...newContact, tags: [] }] })
        .expect(200);

      expect(tagIdsOf(cleared.data, newContact.address)).toEqual([]);
      expect(cleared.tags).toEqual(
        expect.arrayContaining([
          { ...keptTag, contactCount: 1 },
          { ...addedTag, contactCount: 0 },
        ]),
      );
      expect(cleared.tags).toHaveLength(2);
    });

    it('an admin PUT /address-book whose tag step fails keeps nothing of it: no contact, no tag, no audit event', async () => {
      const { spaceId, accessToken } = await createSpace();
      const tagNames = fakeTagNames(MAX_TAGS_PER_WORKSPACE + 1);
      // One short of the limit, spread over as few contacts as allowed.
      const existingTags = tagNames.slice(0, MAX_TAGS_PER_WORKSPACE - 1);
      const newTagNames = tagNames.slice(MAX_TAGS_PER_WORKSPACE - 1);
      const tagSets = Array.from(
        { length: Math.ceil(existingTags.length / MAX_TAGS_PER_CONTACT) },
        (_, index) =>
          existingTags.slice(
            index * MAX_TAGS_PER_CONTACT,
            (index + 1) * MAX_TAGS_PER_CONTACT,
          ),
      );
      const fakeContact = (): {
        name: string;
        address: Address;
        chainIds: Array<string>;
      } => ({
        name: nameBuilder(),
        address: getAddress(faker.finance.ethereumAddress()),
        chainIds: faker.helpers.multiple(() => faker.string.numeric(), {
          count: { min: 1, max: 5 },
        }),
      });
      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ items: tagSets.map((tags) => ({ ...fakeContact(), tags })) })
        .expect(200);
      const { body: before } = await getAddressBook({ spaceId, accessToken });
      expect(before.tags).toHaveLength(existingTags.length);
      const upsertedEvents = (): request.Test =>
        request(app.getHttpServer())
          .get(`/v1/spaces/${spaceId}/audit-log`)
          .query({
            event_type: SpaceAuditEventType.ADDRESS_BOOK_UPSERTED,
            sort_direction: 'asc',
          })
          .set('Cookie', [`access_token=${accessToken}`])
          .expect(200);
      const { body: eventsBefore } = await upsertedEvents();
      expect(eventsBefore.results).toHaveLength(1);
      const newContact = fakeContact();

      // The contact insert succeeds, then the second new tag finds no colour.
      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ items: [{ ...newContact, tags: newTagNames }] })
        .expect(400)
        .expect({
          statusCode: 400,
          message: WORKSPACE_TAG_LIMIT_MESSAGE,
          error: 'Bad Request',
        });

      const { body: after } = await getAddressBook({ spaceId, accessToken });
      expect(after).toEqual(before);
      expect(
        after.data.map((item: SpaceAddressBookItemDto) => item.address),
      ).not.toContain(newContact.address);
      expect(after.tags).toHaveLength(existingTags.length);
      const { body: eventsAfter } = await upsertedEvents();
      expect(eventsAfter.results).toEqual(eventsBefore.results);
    });

    it('a member still cannot rename a contact (403 on PUT /address-book)', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await createActiveMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const { mockName, mockAddress, mockChainIds } =
        await createAddressBookItem({
          spaceId,
          adminAccessToken: accessToken,
        });

      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({
          items: [
            {
              name: nameBuilder(),
              address: mockAddress,
              chainIds: mockChainIds,
              tags: fakeTagNames(1),
            },
          ],
        })
        .expect(403)
        .expect({
          statusCode: 403,
          message: 'User is not an admin of this workspace',
          error: 'Forbidden',
        });

      const { body } = await getAddressBook({
        spaceId,
        accessToken: memberAccessToken,
      });
      expect(body.data).toEqual([
        expect.objectContaining({
          address: mockAddress,
          name: mockName,
          tagIds: [],
        }),
      ]);
      expect(body.tags).toEqual([]);
    });

    it('renames a tag; renaming to an existing name merges', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await createActiveMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const [first, second] = await createAddressBookItems({
        spaceId,
        adminAccessToken: accessToken,
        count: 2,
      });
      const [renamedTagName, otherTagName, newTagName] = fakeTagNames(3);
      const { body: tagged } = await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({
          items: [
            { address: first, tags: [renamedTagName, otherTagName] },
            { address: second, tags: [renamedTagName] },
          ],
        })
        .expect(200);
      const renamedTag = tagNamed(tagged.tags, renamedTagName);
      const otherTag = tagNamed(tagged.tags, otherTagName);

      // A plain rename keeps the tag's id, colour and contacts.
      const { body: afterRename } = await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}/address-book/tags/${renamedTag.id}`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({ name: newTagName })
        .expect(200);

      expect(afterRename.tags).toEqual(
        expect.arrayContaining([{ ...renamedTag, name: newTagName }, otherTag]),
      );
      expect(afterRename.tags).toHaveLength(2);
      expect(afterRename.data).toEqual(tagged.data);

      // Renaming to another tag's name (in any case) merges into that tag,
      // which keeps its spelling and colour.
      const { body: afterMerge } = await request(app.getHttpServer())
        .patch(`/v1/spaces/${spaceId}/address-book/tags/${renamedTag.id}`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({ name: otherTagName.toUpperCase() })
        .expect(200);

      expect(afterMerge.tags).toEqual([{ ...otherTag, contactCount: 2 }]);
      expect(tagIdsOf(afterMerge.data, first)).toEqual([otherTag.id]);
      expect(tagIdsOf(afterMerge.data, second)).toEqual([otherTag.id]);
      const { body: book } = await getAddressBook({
        spaceId,
        accessToken: memberAccessToken,
      });
      expect(book).toEqual(afterMerge);
    });

    it('PATCH and DELETE with a tag id from another workspace return 404', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { mockAddress } = await createAddressBookItem({
        spaceId,
        adminAccessToken: accessToken,
      });
      const [tagName, otherTagName] = fakeTagNames(2);
      const { body: before } = await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ items: [{ address: mockAddress, tags: [tagName] }] })
        .expect(200);
      const { id: tagId } = tagNamed(before.tags, tagName);
      const { spaceId: otherSpaceId, accessToken: otherAccessToken } =
        await createSpace();
      const notFound = {
        statusCode: 404,
        message: 'Tag not found.',
        error: 'Not Found',
      };

      await request(app.getHttpServer())
        .patch(`/v1/spaces/${otherSpaceId}/address-book/tags/${tagId}`)
        .set('Cookie', [`access_token=${otherAccessToken}`])
        .send({ name: otherTagName })
        .expect(404)
        .expect(notFound);
      await request(app.getHttpServer())
        .delete(`/v1/spaces/${otherSpaceId}/address-book/tags/${tagId}`)
        .set('Cookie', [`access_token=${otherAccessToken}`])
        .expect(404)
        .expect(notFound);

      const { body: after } = await getAddressBook({ spaceId, accessToken });
      expect(after).toEqual(before);
    });

    it('DELETE answers 400 for a non-numeric tag id and 422 for one beyond the safe integer range', async () => {
      const { spaceId, accessToken } = await createSpace();

      await request(app.getHttpServer())
        .delete(
          `/v1/spaces/${spaceId}/address-book/tags/${faker.string.alpha(8)}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(400);
      await request(app.getHttpServer())
        .delete(
          `/v1/spaces/${spaceId}/address-book/tags/${faker.string.numeric({ length: 20, allowLeadingZeros: false })}`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(422);
    });

    it.each([0, DB_MAX_SAFE_INTEGER + 1])(
      'PATCH and DELETE answer 422 for tag id %i, outside the int column range',
      async (tagId) => {
        const { spaceId, accessToken } = await createSpace();

        await request(app.getHttpServer())
          .patch(`/v1/spaces/${spaceId}/address-book/tags/${tagId}`)
          .set('Cookie', [`access_token=${accessToken}`])
          .send({ name: fakeTagNames(1)[0] })
          .expect(422);
        await request(app.getHttpServer())
          .delete(`/v1/spaces/${spaceId}/address-book/tags/${tagId}`)
          .set('Cookie', [`access_token=${accessToken}`])
          .expect(422);
      },
    );

    it('deletes a tag and it disappears from every contact', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await createActiveMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const [first, second] = await createAddressBookItems({
        spaceId,
        adminAccessToken: accessToken,
        count: 2,
      });
      const [deletedTagName, keptTagName] = fakeTagNames(2);
      const { body: tagged } = await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({
          items: [
            { address: first, tags: [deletedTagName, keptTagName] },
            { address: second, tags: [deletedTagName] },
          ],
        })
        .expect(200);
      const deletedTag = tagNamed(tagged.tags, deletedTagName);
      const keptTag = tagNamed(tagged.tags, keptTagName);

      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/address-book/tags/${deletedTag.id}`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .expect(204);

      const { body } = await getAddressBook({
        spaceId,
        accessToken: memberAccessToken,
      });
      expect(body.tags).toEqual([keptTag]);
      expect(body.data).toHaveLength(2);
      expect(tagIdsOf(body.data, first)).toEqual([keptTag.id]);
      expect(tagIdsOf(body.data, second)).toEqual([]);
    });

    it('routes tag requests to the tag handlers, not to the contact or request routes', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { memberAccessToken } = await createActiveMember({
        spaceId,
        adminAccessToken: accessToken,
      });
      const [first, second] = await createAddressBookItems({
        spaceId,
        adminAccessToken: accessToken,
        count: 2,
      });
      const [tagName] = fakeTagNames(1);
      const { body: tagged } = await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .send({
          items: [
            { address: first, tags: [tagName] },
            { address: second, tags: [tagName] },
          ],
        })
        .expect(200);
      const { id: tagId } = tagNamed(tagged.tags, tagName);

      // A member may delete a tag but not a contact: a 204 here comes from the
      // tag handler, and both contacts are still in the book.
      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/address-book/tags/${tagId}`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .expect(204);
      const { body: afterTagDelete } = await getAddressBook({
        spaceId,
        accessToken,
      });
      expect(afterTagDelete.tags).toEqual([]);
      expect(afterTagDelete.data).toHaveLength(2);

      // DELETE /address-book/:address still deletes a contact.
      await request(app.getHttpServer())
        .delete(`/v1/spaces/${spaceId}/address-book/${first}`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);
      const { body: afterContactDelete } = await getAddressBook({
        spaceId,
        accessToken,
      });
      expect(afterContactDelete.data).toEqual([
        expect.objectContaining({ address: second, tagIds: [] }),
      ]);

      // The requests routes still answer with their own shape.
      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/address-book/requests`)
        .set('Cookie', [`access_token=${memberAccessToken}`])
        .expect(200)
        .expect({ spaceUuid: spaceId, data: [] });
    });

    it('a contact rename by an admin records no tag audit event', async () => {
      const { spaceId, accessToken } = await createSpace();
      const { mockAddress, mockChainIds } = await createAddressBookItem({
        spaceId,
        adminAccessToken: accessToken,
      });
      const tagNames = fakeTagNames(2);
      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book/tags`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ items: [{ address: mockAddress, tags: tagNames }] })
        .expect(200);

      // Renamed once without tags and once repeating the stored tags.
      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          items: [
            {
              name: nameBuilder(),
              address: mockAddress,
              chainIds: mockChainIds,
            },
          ],
        })
        .expect(200);
      await request(app.getHttpServer())
        .put(`/v1/spaces/${spaceId}/address-book`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({
          items: [
            {
              name: nameBuilder(),
              address: mockAddress,
              chainIds: mockChainIds,
              tags: tagNames,
            },
          ],
        })
        .expect(200);

      const eventTypes = [
        SpaceAuditEventType.ADDRESS_BOOK_UPSERTED,
        SpaceAuditEventType.ADDRESS_BOOK_TAGS_UPDATED,
        SpaceAuditEventType.ADDRESS_BOOK_TAG_RENAMED,
        SpaceAuditEventType.ADDRESS_BOOK_TAG_DELETED,
      ];
      const { body } = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/audit-log`)
        .query({ event_type: eventTypes.join(','), sort_direction: 'asc' })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);
      expect(
        body.results.map((entry: SpaceAuditLogEntryDto) => entry.eventType),
      ).toEqual([
        SpaceAuditEventType.ADDRESS_BOOK_UPSERTED, // created
        SpaceAuditEventType.ADDRESS_BOOK_TAGS_UPDATED, // tagged
        SpaceAuditEventType.ADDRESS_BOOK_UPSERTED, // renamed
        SpaceAuditEventType.ADDRESS_BOOK_UPSERTED, // renamed, same tags
      ]);
    });
  });

  // Utility functions

  const createSpace = async (): Promise<{
    spaceId: string;
    accessToken: string;
    signerAddress: string;
    userId: number;
  }> => {
    const authPayloadDto = siweAuthPayloadDtoBuilder().build();
    const walletToken = jwtService.sign(authPayloadDto);
    const userWithWalletResponse = await request(app.getHttpServer())
      .post('/v1/users/wallet')
      .set('Cookie', [`access_token=${walletToken}`])
      .expect(201);
    const userId: number = userWithWalletResponse.body.id;
    // Sign as the user that was just created, so `sub` matches the database.
    const accessToken = jwtService.sign({
      ...authPayloadDto,
      sub: userId.toString(),
    });
    const createSpaceResponse = await request(app.getHttpServer())
      .post('/v1/spaces')
      .set('Cookie', [`access_token=${accessToken}`])
      .send({ name: nameBuilder() })
      .expect(201);
    return {
      spaceId: createSpaceResponse.body.uuid,
      accessToken,
      signerAddress: authPayloadDto.signer_address as string,
      userId,
    };
  };

  const createPendingMember = async (args: {
    spaceId: string;
    adminAccessToken: string;
  }): Promise<{ memberAccessToken: string }> => {
    const memberAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
    const member = {
      role: 'MEMBER',
      name: faker.person.firstName(),
      address: memberAuthPayloadDto.signer_address,
    };
    const inviteResponse = await request(app.getHttpServer())
      .post(`/v1/spaces/${args.spaceId}/members/invite`)
      .set('Cookie', [`access_token=${args.adminAccessToken}`])
      .send({ users: [member] })
      .expect(201);
    // Sign as the invited user, so `sub` matches the database.
    const memberAccessToken = jwtService.sign({
      ...memberAuthPayloadDto,
      sub: inviteResponse.body[0].userId.toString(),
    });
    return { memberAccessToken };
  };

  const createActiveMember = async (args: {
    spaceId: string;
    adminAccessToken: string;
  }): Promise<{ memberAccessToken: string }> => {
    const memberName = faker.person.firstName();
    const memberAuthPayloadDto = siweAuthPayloadDtoBuilder().build();
    const inviteResponse = await request(app.getHttpServer())
      .post(`/v1/spaces/${args.spaceId}/members/invite`)
      .set('Cookie', [`access_token=${args.adminAccessToken}`])
      .send({
        users: [
          {
            role: 'MEMBER',
            name: memberName,
            address: memberAuthPayloadDto.signer_address,
          },
        ],
      })
      .expect(201);
    const memberAccessToken = jwtService.sign(
      siweAuthPayloadDtoBuilder()
        .with('sub', inviteResponse.body[0].userId.toString())
        .build(),
    );
    await request(app.getHttpServer())
      .post(`/v1/spaces/${args.spaceId}/members/accept`)
      .set('Cookie', [`access_token=${memberAccessToken}`])
      .send({ name: memberName })
      .expect(201);
    return { memberAccessToken };
  };

  const createAddressBookItem = async (args: {
    spaceId: string;
    adminAccessToken: string;
    address?: Address;
  }): Promise<{
    mockName: string;
    mockAddress: Address;
    mockChainIds: Array<string>;
  }> => {
    const mockAddress =
      args?.address ?? getAddress(faker.finance.ethereumAddress());
    const mockName = nameBuilder();
    const mockChainIds = faker.helpers.multiple(() => faker.string.numeric(), {
      count: { min: 1, max: 5 },
    });

    await request(app.getHttpServer())
      .put(`/v1/spaces/${args.spaceId}/address-book`)
      .set('Cookie', [`access_token=${args.adminAccessToken}`])
      .send({
        items: [
          {
            name: mockName,
            address: mockAddress,
            chainIds: mockChainIds,
          },
        ],
      })
      .expect(200);

    return { mockName, mockAddress, mockChainIds };
  };

  /** One contact per request, like {@link createAddressBookItem}. */
  const createAddressBookItems = async (args: {
    spaceId: string;
    adminAccessToken: string;
    count: number;
  }): Promise<Array<Address>> => {
    const addresses: Array<Address> = [];
    for (let i = 0; i < args.count; i++) {
      const { mockAddress } = await createAddressBookItem(args);
      addresses.push(mockAddress);
    }
    return addresses;
  };

  const getAddressBook = (args: {
    spaceId: string;
    accessToken: string;
  }): request.Test =>
    request(app.getHttpServer())
      .get(`/v1/spaces/${args.spaceId}/address-book`)
      .set('Cookie', [`access_token=${args.accessToken}`])
      .expect(200);

  /** Distinct (case-insensitively) tag names. */
  const fakeTagNames = (count: number): Array<string> =>
    faker.helpers.uniqueArray(
      () =>
        faker.string.alpha({ length: { min: 3, max: 20 }, casing: 'lower' }),
      count,
    );

  const tagNamed = (
    tags: Array<SpaceAddressBookTagDto>,
    name: string,
  ): SpaceAddressBookTagDto => {
    const tag = tags.find((candidate) => candidate.name === name);
    if (!tag) {
      throw new Error(`No tag named ${name}`);
    }
    return tag;
  };

  const sortedIds = (ids: Array<number>): Array<number> =>
    [...ids].sort((a, b) => a - b);

  const tagIdsOf = (
    items: Array<SpaceAddressBookItemDto>,
    address: Address,
  ): Array<number> => {
    const item = items.find((candidate) => candidate.address === address);
    if (!item) {
      throw new Error(`No contact with address ${address}`);
    }
    return sortedIds(item.tagIds);
  };
});
