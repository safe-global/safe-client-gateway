import { faker } from '@faker-js/faker';
import type { CsvOptions } from './csv-export.service';
import { CsvExportService } from './csv-export.service';
import { Writable } from 'stream';

describe('CsvExportService', () => {
  let service: CsvExportService;

  beforeEach(() => {
    service = new CsvExportService();
  });

  async function collectCsv<T extends Record<string, unknown>>(
    data: Array<T>,
    options: CsvOptions = {},
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

    await service.exportToCsv(data, writable, options);
    return Buffer.concat(chunks).toString('utf8');
  }

  it('derives columns from the first object and writes header + rows', async () => {
    const name = faker.person.firstName();
    const age = faker.number.int();
    const data: Array<Record<string, string | number>> = [
      { name, age },
      { name, age },
    ];

    const csv = await collectCsv(data);

    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toBe('name,age');
    expect(lines[1]).toBe(`${name},${age}`);
    expect(lines[2]).toBe(`${name},${age}`);
  });

  it('derives columns from the first object when columns is provided as an empty array', async () => {
    const name = faker.person.firstName();
    const age = faker.number.int();
    const data: Array<Record<string, string | number>> = [
      { name, age },
      { name, age },
    ];

    const csv = await collectCsv(data, { columns: [] });

    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toBe('name,age');
    expect(lines[1]).toBe(`${name},${age}`);
    expect(lines[2]).toBe(`${name},${age}`);
  });

  it('uses explicit columns and preserves their order', async () => {
    const name = faker.person.firstName();
    const age = faker.number.int();
    const data: Array<Record<string, string | number>> = [
      { name, age },
      { name, age },
    ];

    const csv = await collectCsv(data, { columns: ['age', 'name'] });

    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toBe('age,name');
    expect(lines[1]).toBe(`${age},${name}`);
    expect(lines[2]).toBe(`${age},${name}`);
  });

  it('writes only header when data is empty but columns provided', async () => {
    const data: Array<Record<string, string>> = [];
    const col = faker.string.alpha({ length: 3 });

    const csv = await collectCsv(data, { columns: [col, col] });
    expect(csv.trim()).toBe(`${col},${col}`);
  });

  it('omits header when header=false', async () => {
    const val = faker.number.int();
    const data: Array<Record<string, number>> = [{ a: val, b: val }];

    const csv = await collectCsv(data, { header: false });
    expect(csv.trim()).toBe(`${val},${val}`);
  });

  it('handles empty data array + no headers', async () => {
    const data: Array<Record<string, string>> = [];
    const csv = await collectCsv(data);
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

    const csv = await collectCsv(data);
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
      columns: ['name', 'details.age', 'details.active'],
    });

    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toBe('name,details.age,details.active');
    expect(lines[1]).toBe(`${name},${age},${active ? '1' : ''}`);
  });

  it('handles custom casting', async () => {
    const data: Array<Record<string, boolean>> = [
      { isActive: true },
      { isActive: false },
    ];

    const csv = await collectCsv(data, {
      cast: {
        boolean: (value: boolean) => (value ? 'true' : 'false'),
      },
    });
    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toBe('isActive');
    expect(lines[1]).toBe('true');
    expect(lines[2]).toBe('false');
  });

  it('ignores values that are not specified in columns', async () => {
    const id = faker.number.int();
    const name = faker.person.firstName();
    const age = faker.number.int();
    const data: Array<Record<string, string | number>> = [{ id, name, age }];

    const csv = await collectCsv(data, { columns: ['id', 'name'] });
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

    await expect(service.exportToCsv(data, writableWithError)).rejects.toThrow(
      errorMessage,
    );
  });

  it('reject invalid data types (that csv-stringify rejects)', async () => {
    const data = [
      {
        name: faker.person.firstName(),
        invalidValue: Symbol(faker.string.alpha({ length: 5 })),
      },
    ];

    await expect(collectCsv(data)).rejects.toThrow();
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
    const result = await collectCsv(largeData);
    const endTime = Date.now();

    const lines = result.trim().split(/\r?\n/);

    expect(lines.length).toBe(10001);
    expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
  });
});
