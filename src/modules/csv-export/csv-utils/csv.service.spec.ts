import { faker } from '@faker-js/faker';
import type { CsvOptions } from './csv.service';
import { CsvService } from './csv.service';
import { Readable, Writable } from 'stream';

type MaybeArray<T> = T | Array<T>;
type AsyncOrSyncIterable<T> = Iterable<T> | AsyncIterable<T>;
type DataSource = AsyncOrSyncIterable<MaybeArray<Record<string, unknown>>>;

describe('CsvExportService', () => {
  let service: CsvService;

  beforeEach(() => {
    service = new CsvService();
  });

  async function collectCsv(
    data: DataSource,
    options: CsvOptions,
  ): Promise<string> {
    const chunks: Array<Buffer> = [];
    const writable = new Writable({
      write(chunk, _, cb): void {
        chunks.push(
          Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string),
        );
        cb();
      },
    });

    await service.toCsv(
      Readable.from(data, { objectMode: true }),
      writable,
      options,
    );
    return Buffer.concat(chunks).toString('utf8');
  }

  describe('CSV generation', () => {
    it('writes header + rows and preserves the order', async () => {
      const name = faker.person.firstName();
      const age = faker.number.int();
      const data: Array<Record<string, string | number>> = [
        { name, age },
        { name, age },
      ];

      const csv = await collectCsv(data, {
        columns: [{ key: 'age' }, { key: 'name' }],
      });

      const lines = csv.trim().split(/\r?\n/);
      expect(lines[0]).toBe('age,name');
      expect(lines[1]).toBe(`${age},${name}`);
      expect(lines[2]).toBe(`${age},${name}`);
    });

    it('handles empty columns array by showing no data', async () => {
      const name = faker.person.firstName();
      const age = faker.number.int();
      const data: Array<Record<string, string | number>> = [
        { name, age },
        { name, age },
      ];

      const csv = await collectCsv(data, { columns: [] });

      const lines = csv.trim().split(/\r?\n/);
      expect(lines.length).toBe(1);
      expect(lines[0]).toBe('');
    });

    it('writes only header when data is empty', async () => {
      const data: Array<Record<string, string>> = [];
      const col = faker.string.alpha({ length: 3 });

      const csv = await collectCsv(data, {
        columns: [{ key: col }, { key: col }],
      });
      expect(csv.trim()).toBe(`${col},${col}`);
    });

    it('omits header when header=false', async () => {
      const val = faker.number.int();
      const data: Array<Record<string, number>> = [{ a: val, b: val }];

      const csv = await collectCsv(data, {
        columns: [{ key: 'a' }, { key: 'b' }],
        header: false,
      });
      expect(csv.trim()).toBe(`${val},${val}`);
    });

    it('handles empty data array + no headers', async () => {
      const data: Array<Record<string, string>> = [];
      const csv = await collectCsv(data, { columns: [] });
      expect(csv.trim()).toBe('');
    });

    it('handles objects with mixed types', async () => {
      const name = faker.person.firstName();
      const age = faker.number.int();
      const activeTrue = faker.datatype.boolean(1.0);
      const activeFalse = faker.datatype.boolean(0.0);
      const tag = faker.string.alpha({ length: 4 });
      const val = faker.string.alpha({ length: 3 });

      const data: Array<
        Record<string, string | number | boolean | object | Array<string>>
      > = [
        {
          name,
          age,
          active: activeTrue,
          tags: [tag, tag],
          details: { foo: val },
        },
        {
          name,
          age,
          active: activeFalse,
          tags: [],
          details: { bar: val },
        },
      ];

      const csv = await collectCsv(data, {
        columns: [
          { key: 'name' },
          { key: 'age' },
          { key: 'active' },
          { key: 'tags' },
          { key: 'details' },
        ],
      });
      const lines = csv.trim().split(/\r?\n/);
      expect(lines.length).toBe(3);
      expect(lines[0]).toBe('name,age,active,tags,details');
      /* eslint-disable no-useless-escape */
      expect(lines[1]).toBe(
        `${name},${age},1,\"[\"\"${tag}\"\",\"\"${tag}\"\"]\",\"{\"\"foo\"\":\"\"${val}\"\"}\"`,
      );
      expect(lines[2]).toBe(
        `${name},${age},,[],\"{\"\"bar\"\":\"\"${val}\"\"}\"`,
      );
      /* eslint-enable no-useless-escape */
    });

    it('handles nested objects', async () => {
      const name = faker.person.firstName();
      const age = faker.number.int();
      const active = faker.datatype.boolean();
      const data: Array<Record<string, string | object>> = [
        {
          name,
          details: { age, active },
        },
      ];

      const csv = await collectCsv(data, {
        columns: [
          { key: 'name' },
          { key: 'details.age' },
          { key: 'details.active' },
        ],
      });

      const lines = csv.trim().split(/\r?\n/);
      expect(lines[0]).toBe('name,details.age,details.active');
      expect(lines[1]).toBe(`${name},${age},${active ? '1' : ''}`);
    });

    it('handles custom casting', async () => {
      const date1 = faker.date.past();
      const date2 = faker.date.recent();
      const data: Array<Record<string, boolean | Date>> = [
        { isActive: true, createdAt: date1 },
        { isActive: false, createdAt: date2 },
      ];

      const csv = await collectCsv(data, {
        columns: [{ key: 'isActive' }, { key: 'createdAt' }],
        cast: {
          boolean: (value: boolean) => (value ? 'true' : 'false'),
          date: (value: Date) => value.toISOString(),
        },
      });
      const lines = csv.trim().split(/\r?\n/);
      expect(lines[0]).toBe('isActive,createdAt');
      expect(lines[1]).toBe(`true,${date1.toISOString()}`);
      expect(lines[2]).toBe(`false,${date2.toISOString()}`);
    });

    it('ignores values that are not specified in columns', async () => {
      const id = faker.number.int();
      const name = faker.person.firstName();
      const age = faker.number.int();
      const data: Array<Record<string, string | number>> = [{ id, name, age }];

      const csv = await collectCsv(data, {
        columns: [{ key: 'id' }, { key: 'name' }],
      });
      const lines = csv.trim().split(/\r?\n/);
      expect(lines[0]).toBe('id,name');
      expect(lines[1]).toBe(`${id},${name}`);
    });

    it('handles stream write errors', async () => {
      const data = [
        {
          name: faker.person.firstName(),
          age: faker.number.int(),
        },
      ];
      const errorMessage = faker.string.alpha({ length: 10 });

      const writableWithError = new Writable({
        write(_chunk, _encoding, callback): void {
          callback(new Error(errorMessage));
        },
      });

      await expect(
        service.toCsv(Readable.from(data), writableWithError, {
          columns: [{ key: 'name' }, { key: 'age' }],
        }),
      ).rejects.toThrow(errorMessage);
    });

    it('reject invalid data types (that csv-stringify rejects)', async () => {
      const data = [
        {
          name: faker.person.firstName(),
          invalidValue: Symbol(faker.string.alpha({ length: 5 })),
        },
      ];

      await expect(
        collectCsv(data, {
          columns: [{ key: 'name' }, { key: 'invalidValue' }],
        }),
      ).rejects.toThrow();
    });

    it('handles large datasets efficiently', async () => {
      const largeData = Array.from({ length: 10000 }, () => ({
        id: faker.number.int({ min: 1, max: 100000 }),
        name: faker.person.fullName(),
        email: faker.internet.email(),
        age: faker.number.int({ min: 18, max: 80 }),
        active: faker.datatype.boolean(),
      }));

      const startTime = Date.now();
      const result = await collectCsv(largeData, {
        columns: [
          { key: 'id' },
          { key: 'name' },
          { key: 'email' },
          { key: 'age' },
          { key: 'active' },
        ],
      });
      const endTime = Date.now();

      const lines = result.trim().split(/\r?\n/);

      expect(lines.length).toBe(10001);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('handles object-based column configuration with key and header', async () => {
      const name = faker.person.firstName();
      const age = faker.number.int();
      const email = faker.internet.email();
      const data = [
        { name, age, email },
        { name, age, email },
      ];

      const csv = await collectCsv(data, {
        columns: [
          { key: 'name', header: 'Full Name' },
          { key: 'age', header: 'Years Old' },
          { key: 'email', header: 'Email Address' },
        ],
      });

      const lines = csv.trim().split(/\r?\n/);
      expect(lines[0]).toBe('Full Name,Years Old,Email Address');
      expect(lines[1]).toBe(`${name},${age},${email}`);
      expect(lines[2]).toBe(`${name},${age},${email}`);
    });

    it('handles object columns with custom ordering', async () => {
      const id = faker.number.int();
      const name = faker.person.firstName();
      const email = faker.internet.email();
      const data = [{ id, name, email }];

      const csv = await collectCsv(data, {
        columns: [
          { key: 'email', header: 'Contact Email' },
          { key: 'name', header: 'Name' },
          { key: 'id', header: 'Identifier' },
        ],
      });

      const lines = csv.trim().split(/\r?\n/);
      expect(lines[0]).toBe('Contact Email,Name,Identifier');
      expect(lines[1]).toBe(`${email},${name},${id}`);
    });

    it('handles object columns with subset of data fields', async () => {
      const id = faker.number.int();
      const name = faker.person.firstName();
      const age = faker.number.int();
      const email = faker.internet.email();
      const data = [{ id, name, age, email }];

      const csv = await collectCsv(data, {
        columns: [
          { key: 'name', header: 'Full Name' },
          { key: 'email', header: 'Email Address' },
        ],
      });

      const lines = csv.trim().split(/\r?\n/);
      expect(lines[0]).toBe('Full Name,Email Address');
      expect(lines[1]).toBe(`${name},${email}`);
    });

    it('handles object columns with nested property access', async () => {
      const name = faker.person.firstName();
      const age = faker.number.int();
      const city = faker.location.city();
      const data = [
        {
          name,
          details: { age, address: { city } },
        },
      ];

      const csv = await collectCsv(data, {
        columns: [
          { key: 'name', header: 'Name' },
          { key: 'details.age', header: 'Age' },
          { key: 'details.address.city', header: 'City' },
        ],
      });

      const lines = csv.trim().split(/\r?\n/);
      expect(lines[0]).toBe('Name,Age,City');
      expect(lines[1]).toBe(`${name},${age},${city}`);
    });

    it('handles object columns with missing data properties', async () => {
      const name = faker.person.firstName();
      const data = [{ name }];

      const csv = await collectCsv(data, {
        columns: [
          { key: 'name', header: 'Name' },
          { key: 'age', header: 'Age' },
          { key: 'email', header: 'Email' },
        ],
      });

      const lines = csv.trim().split(/\r?\n/);
      expect(lines[0]).toBe('Name,Age,Email');
      expect(lines[1]).toBe(`${name},,`);
    });
  });

  describe('CSV Readable stream', () => {
    it('handles regular iterables (Sets)', async () => {
      const name = faker.person.firstName();
      const age = faker.number.int();

      const dataSet = new Set([
        { name, age },
        { name, age },
      ]);

      const csv = await collectCsv(dataSet, {
        columns: [{ key: 'name' }, { key: 'age' }],
      });

      const lines = csv.trim().split(/\r?\n/);
      expect(lines[0]).toBe('name,age');
      expect(lines[1]).toBe(`${name},${age}`);
      expect(lines[2]).toBe(`${name},${age}`);
    });

    it('handles async iterables (generators)', async () => {
      const name = faker.person.firstName();
      const age = faker.number.int();

      async function* generateData(): AsyncGenerator<
        Record<string, string | number>,
        void,
        unknown
      > {
        yield { name, age };
        await new Promise((resolve) => setTimeout(resolve, 10));
        yield { name, age };
      }

      const csv = await collectCsv(generateData(), {
        columns: [{ key: 'name' }, { key: 'age' }],
      });

      const lines = csv.trim().split(/\r?\n/);
      expect(lines[0]).toBe('name,age');
      expect(lines[1]).toBe(`${name},${age}`);
      expect(lines[2]).toBe(`${name},${age}`);
    });
  });
});
