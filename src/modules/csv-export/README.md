# CSV Export Module

This module generates a downloadable CSV file of Safe transactions.

## High-Level Flow

1. **Launch** – `CsvExportController` exposes:
   - `POST /v1/export/chains/:chainId/:safeAddress`  
     Creates an asynchronous job to export transactions for the specified Safe.
   - `GET /v1/export/:jobId/status`  
     Retrieves the status and result (download URL) of the export job.

2. **Job Queue** – `CsvExportService.registerExportJob` adds a job to the BullMQ
   queue named `csv-export` via `JobQueueService`. The job payload includes chain ID,
   Safe address, optional date filters, and pagination limits.

3. **Worker** – `CsvExportConsumer` listens to the `csv-export` queue.
   For each job:
   - Invokes `CsvExportService.export`.
   - Updates progress to BullMQ (enabling the controller’s status endpoint).
   - Retries failed job depending on the configured attempts count.

4. **Data Retrieval** – `CsvExportService.transactionPagesGenerator` streams
   transaction pages from the Safe Transaction Service:
   - `ExportApiManager` resolves an `ExportApi` for the requested chain.
   - `ExportApi.export` fetches paginated data from
     `/api/v1/safes/{safeAddress}/export/`, yielding `TransactionExport` records.

5. **CSV Generation** – `CsvService.toCsv` converts the streamed records to CSV
   using [`csv-stringify`](https://csv.js.org/stringify/) with `CSV_OPTIONS`:

   | Column Key        | Header Label     |
   | ----------------- | ---------------- |
   | `safe`            | Safe Address     |
   | `from`            | From Address     |
   | `to`              | To Address       |
   | `transactionHash` | Transaction Hash |
   | `contractAddress` | Contract Address |
   | `amount`          | Amount           |
   | `assetType`       | Asset Type       |
   | `assetSymbol`     | Asset Symbol     |
   | `proposedAt`      | Created at       |
   | `executedAt`      | Executed at      |
   | `proposerAddress` | Proposer Address |
   | `executorAddress` | Executor Address |
   | `note`            | Note             |

6. **Storage & URL** – `createUploadStream` decides between:
   - **AWS S3** (`CSV_EXPORT_FILE_STORAGE_TYPE=aws`):  
     Uses `ICloudStorageApiService.createUploadStream` with `Upload` to stream
     directly to S3. A signed download URL is generated via
     `getSignedUrl`.
   - **Local filesystem** (`CSV_EXPORT_FILE_STORAGE_TYPE=local`):  
     Writes to `csvExport.fileStorage.local.baseDir` and returns an absolute
     path.

   The download link is returned as `CsvExportJobResponse.downloadUrl`.

7. **Progress** – `reportProgress` reports up to 70 % during fetch/yield;
   `export` reports 90 % once streaming completes and 100 % after URL generation.

## Node.js Streams

The CSV export pipeline relies on Node.js streams to process large datasets efficiently:

- `Readable.from` wraps the async generator `transactionPagesGenerator`, producing a stream of `TransactionExport` objects​:codex-file-citation[codex-file-citation]{line_range_start=118 line_range_end=128 path=src/modules/csv-export/v1/csv-export.service.ts git_url="https://github.com/safe-global/safe-client-gateway/blob/COR-7/retrieve-paginated-transaction-data-and-decode-if-needed/src/modules/csv-export/v1/csv-export.service.ts#L118-L128"}​
- `CsvService.toCsv` uses `stream.pipeline` to pipe the readable stream through `csv-stringify` and into the destination writable stream​:codex-file-citation[codex-file-citation]{line_range_start=1 line_range_end=31 path=src/modules/csv-export/csv-utils/csv.service.ts git_url="https://github.com/safe-global/safe-client-gateway/blob/COR-7/retrieve-paginated-transaction-data-and-decode-if-needed/src/modules/csv-export/csv-utils/csv.service.ts#L1-L31"}​
- `createUploadStream` returns a `PassThrough` stream for AWS uploads or an `fs.createWriteStream` for local files, ensuring backpressure-aware writing to the chosen storage​:codex-file-citation[codex-file-citation]{line_range_start=240 line_range_end=258 path=src/modules/csv-export/v1/csv-export.service.ts git_url="https://github.com/safe-global/safe-client-gateway/blob/COR-7/retrieve-paginated-transaction-data-and-decode-if-needed/src/modules/csv-export/v1/csv-export.service.ts#L240-L258"}​

Streams allow the system to process data incrementally, avoiding high memory consumption and improving resilience during uploads.

## Configuration

Environment variables influencing CSV export:

| Variable                                                                                       | Purpose                     | Default                    |
| ---------------------------------------------------------------------------------------------- | --------------------------- | -------------------------- |
| `CSV_EXPORT_FILE_STORAGE_TYPE`                                                                 | `aws` or `local` storage    | `local`                    |
| `CSV_AWS_ACCESS_KEY_ID`, `CSV_AWS_SECRET_ACCESS_KEY`                                           | S3 credentials              | —                          |
| `CSV_AWS_STORAGE_BUCKET_NAME`                                                                  | S3 bucket name              | `safe-client-gateway`      |
| `CSV_AWS_S3_BASE_PATH`                                                                         | Base path within bucket     | `assets/csv-export`        |
| `CSV_EXPORT_LOCAL_BASE_DIR`                                                                    | Directory for local storage | `assets/csv-export`        |
| `CSV_EXPORT_SIGNED_URL_TTL_SECONDS`                                                            | Signed URL TTL              | `3600`                     |
| `CSV_EXPORT_QUEUE_REMOVE_ON_COMPLETE_*`, `CSV_EXPORT_QUEUE_REMOVE_ON_FAIL_*`                   | Job cleanup                 | see `configuration.ts`     |
| `CSV_EXPORT_QUEUE_BACKOFF_TYPE`, `CSV_EXPORT_QUEUE_BACKOFF_DELAY`, `CSV_EXPORT_QUEUE_ATTEMPTS` | Retry/backoff strategy      | `exponential`, `2000`, `3` |
| `CSV_EXPORT_QUEUE_CONCURRENCY`                                                                 | Worker concurrency          | `3`                        |

## Adding/Changing Columns

Edit `src/modules/csv-export/v1/entities/csv-export.options.ts`. Each `ColumnOption`
corresponds to a key in `TransactionExport` and defines the CSV header.

## Error Handling & Logging

- `DataSourceError` with `code === 404` is wrapped in `UnrecoverableError`, causing the job to fail without retries.
- `CsvExportConsumer` logs major job events (`completed`, `failed`, `progress`, `error`).

## Summary

The CSV export feature leverages BullMQ for background processing, streams
transaction data from the Safe Transaction Service, pipes it through
`csv-stringify`, and stores the output either in S3 or locally, returning a
download URL once finished. Node.js streams provide efficient, backpressure-aware
processing throughout the pipeline.
