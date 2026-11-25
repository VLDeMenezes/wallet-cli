# wallet-cli

An open-source CLI for streamlining wallet-backend development workflows. It currently provides two commands: generating TypeScript types from an OpenAPI specification and sending signed test webhooks.

## Requirements

- Node.js
- npm

## Getting started

Clone the repository, install its dependencies, and build the CLI:

```bash
npm install
npm run build
```

Run the CLI from the repository with:

```bash
node dist/index.js --help
```

## Commands

### `sync-api`

Fetches an OpenAPI JSON document, saves a local copy, and generates TypeScript types from it.

```bash
node dist/index.js sync-api \
  --url https://example.com/api-json \
  --out ./generated/wallet-api.ts \
  --spec-out ./generated/openapi.json
```

Options:

| Option                  | Description                              | Default                                                                               |
| ----------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `-u, --url <url>`       | URL of the OpenAPI JSON document         | `WALLET_SWAGGER_URL`, or `https://beland-backend-production-e86c.up.railway.app/docs` |
| `-o, --out <path>`      | Path for the generated TypeScript types  | `./generated/wallet-api.ts`                                                           |
| `-s, --spec-out <path>` | Path for the saved OpenAPI JSON document | `./generated/openapi.json`                                                            |

The URL must return JSON, not the Swagger UI page. Set `WALLET_SWAGGER_URL` to your backend's OpenAPI JSON endpoint to change the default.

### `webhook`

Builds and sends a test webhook, signed with HMAC-SHA256. The shared secret is required. Supported events are `deposit.settled`, `transfer.settled`, and `transfer.failed`.

```bash
WALLET_WEBHOOK_SECRET=your-local-secret \
  node dist/index.js webhook deposit.settled \
  --url http://localhost:3000/webhooks/psp \
  --user-id usr_demo_001 \
  --amount 50.00 \
  --currency EUR
```

Options:

| Option                  | Description                           | Default                                                       |
| ----------------------- | ------------------------------------- | ------------------------------------------------------------- |
| `-u, --url <url>`       | Webhook endpoint URL                  | `WALLET_WEBHOOK_URL`, or `http://localhost:3000/webhooks/psp` |
| `-s, --secret <secret>` | Shared HMAC secret                    | `WALLET_WEBHOOK_SECRET`                                       |
| `--user-id <id>`        | Test user ID                          | `usr_demo_001`                                                |
| `--tx-id <id>`          | Transaction ID                        | Generated for each request                                    |
| `--amount <amount>`     | Transaction amount                    | Event-specific test amount                                    |
| `--currency <code>`     | Currency code                         | `EUR`                                                         |
| `--reason <reason>`     | Failure reason for `transfer.failed`  | `INSUFFICIENT_FUNDS`                                          |
| `--header-name <name>`  | Request header used for the signature | `X-Wallet-Signature`                                          |

The command also sends an `X-Webhook-Id` header. Use a test endpoint and test credentials when experimenting.

## Development

Source code is in `src/`. After making changes, run `npm run build` to compile the CLI and generate its type declarations.

## Build and Develop BY VLDM
