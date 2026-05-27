# <p align="center">Pipebot</p>

<p align="center">
  <strong>Real-time GitLab CI/CD pipeline notifications delivered to Telegram.</strong>
</p>

<p align="center">
  <strong><img src="https://flagcdn.com/w20/us.png" width="20"> English</strong> | <a href="README.ru.md"><img src="https://flagcdn.com/w20/ru.png" width="20"> Russian</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.1.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/License-ISC-green?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18-6da55f?style=for-the-badge&logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/Express-5.2.1-000000?style=for-the-badge&logo=express" alt="Express">
  <img src="https://img.shields.io/badge/Telegraf-4.16.3-2CA5E0?style=for-the-badge&logo=telegram" alt="Telegraf">
  <img src="https://img.shields.io/badge/GitLab-FC6D26?style=for-the-badge&logo=gitlab" alt="GitLab">
</p>

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Multi-Repository Mode](#multi-repository-mode)
  - [Notification Rules](#notification-rules)
  - [Deploy Links](#deploy-links)
  - [Alert Styles](#alert-styles)
  - [Config File Tool](#config-file-tool)
- [GitLab Webhook Setup](#gitlab-webhook-setup)
- [Deployment](#deployment)
- [Usage](#usage)
  - [Running Locally](#running-locally)
  - [Webhook Endpoint](#webhook-endpoint)
  - [Diagnostics Endpoint](#diagnostics-endpoint)
- [Testing](#testing)
- [Development](#development)
- [License](#license)

## Project Overview

**pipebot** is a lightweight, production-ready webhook relay that bridges GitLab CI/CD pipeline events to Telegram group chats. It receives pipeline webhooks from GitLab, formats them into readable notifications, and sends them to designated Telegram chats in real time. The bot supports **multi-repository mode**, allowing you to monitor multiple GitLab projects and route alerts to different Telegram groups. 

## Features

- **Multi-repository support** - Monitor many GitLab projects and route alerts to different Telegram chats
- **Stage-aware notifications** - Per-stage alerts with stage name headers, transition tracking, and configurable filtering via `notifyRules`
- **Customizable alerts** - Per-repo display names, three message styles (card, tree, minimal), and custom deploy link buttons
- **Inline keyboard** - Quick-access buttons for pipeline, commit, and repository links in every notification
- **Secure & production-ready** - Timing-safe webhook validation, rate limiting, security headers, payload size limits, structured logging with sensitive data sanitization
- **Flexible deployment** - Configurable port with automatic fallback, bot runs via long polling alongside the Express webhook server
- **Diagnostics endpoint** - Health check endpoint that reports configuration status without exposing secrets
- **Zero-downtime startup** - Bot initializes independently from the webhook server; missing credentials do not block server startup

## Tech Stack

| Technology | Purpose |
|---|---|
| [Node.js](https://nodejs.org/) >= 18 | JavaScript runtime |
| [Express 5](https://expressjs.com/) | Webhook HTTP server |
| [Telegraf](https://telegraf.js.org/) | Telegram Bot API client |
| [dotenv](https://github.com/motdotla/dotenv) | Environment variable loading |

## Project Structure

```
pipebot/
├── src/
│   ├── index.js              # Entry point: config, initialization, multi-port startup
│   ├── bot/
│   │   └── index.js          # Telegraf bot creation and message dispatch
│   ├── server/
│   │   └── index.js          # Express server: routes, webhook validation, payload routing, rate limiting
│   ├── services/
│   │   ├── gitlab.js         # GitLab payload formatting entry point
│   │   └── message-builder.js # Message templates (card, tree, minimal) and HTML escaping
│   └── utils/
│       ├── logger.js         # Structured JSON logging (INFO/ERROR) with sensitive data sanitization
│       ├── repo-config.js    # Multi-repository config parser, routing, and notification filtering
│       └── pipeline-state.js # Stage transition detection and pipeline state tracking
├── config/
│   └── repos.config.js       # Readable repository configuration (not committed)
├── scripts/
│   └── build-config.js       # CLI tool to generate env-ready REPOSITORY_CONFIG
├── test/
│   ├── fixtures/             # Sample GitLab webhook payloads
│   │   ├── pipeline-running.json
│   │   ├── pipeline-success.json
│   │   ├── pipeline-failed.json
│   │   └── pipeline-canceled.json
│   ├── test-unit.js          # Unit tests for message formatting
│   ├── test-repo-config.js   # Multi-repository config tests
│   ├── test-pipeline-state.js # Pipeline state tracking tests
│   ├── test-webhooks.js      # Webhook integration tests
│   ├── test-security.js      # Security validation tests
│   ├── test-telegram.js      # Telegram bot tests
│   └── test-visual.js        # Visual output tests
├── index.js                  # Root entry point (re-exports src/index.js)
├── package.json              # Dependencies and npm scripts
└── .env                      # Environment variables (not committed)
```

## Getting Started

### Prerequisites

- Node.js >= 18
- npm (bundled with Node.js)
- A Telegram bot token from [@BotFather](https://t.me/botfather)
- One or more Telegram group/channel IDs for notifications
- Access to GitLab project webhook settings

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-org/pipebot.git
   cd pipebot
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file:

   ```bash
   cp .env.example .env   # or create .env manually
   ```

### Quick Start

1. Fill in your `.env` file with the required credentials (see [Configuration](#configuration)).
2. Start the application:

   ```bash
   npm start
   ```

3. Configure GitLab webhooks pointing to your server URL (see [GitLab Webhook Setup](#gitlab-webhook-setup)).
4. Trigger a pipeline in GitLab and watch the notification appear in Telegram.

## Configuration

### Environment Variables

Create a `.env` file in the project root with the following variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Yes | -- | Bot token obtained from [@BotFather](https://t.me/botfather) |
| `REPOSITORY_CONFIG` | Yes | -- | JSON array mapping GitLab projects to Telegram chats (see below) |
| `ALERT_STYLE` | No | `card` | Global fallback message format: `card`, `tree`, or `minimal` |
| `PORT` | No | `3000` | Primary port for the webhook server |

> [!IMPORTANT]
> Never commit your `.env` file. It is listed in `.gitignore` and should only exist locally or in your deployment platform's secret store.

### Multi-Repository Mode

The `REPOSITORY_CONFIG` variable defines which GitLab projects to monitor and where to send their alerts. It is a JSON array of repository entries:

```json
[
  {
    "projectId": 123,
    "projectName": "My Awesome API",
    "chatId": "-1001234567890",
    "secret": "webhook-secret-for-repo-1",
    "style": "card"
  },
  {
    "projectId": 456,
    "projectName": "Frontend App",
    "chatId": "-1009876543210",
    "secret": "webhook-secret-for-repo-2",
    "style": "tree"
  }
]
```

**Fields per repository entry:**

| Field | Required | Description |
|---|---|---|
| `projectId` | Yes | GitLab project ID (numeric, found in Settings > General) |
| `projectName` | No | Custom display name for alerts (overrides GitLab project name) |
| `chatId` | Yes | Telegram chat/group ID to send alerts to |
| `secret` | No | Webhook secret token (must match GitLab webhook settings) |
| `style` | No | Alert style: `card`, `tree`, or `minimal` (falls back to `ALERT_STYLE`) |
| `notifyRules` | No | Per-stage notification filtering rules (see [Notification Rules](#notification-rules)) |
| `deployLinks` | No | Per-stage custom action buttons for notifications (see [Deploy Links](#deploy-links)) |

In your `.env` file, the JSON must be on a **single line**:

```env
REPOSITORY_CONFIG=[{"projectId":123,"projectName":"My API","chatId":"-1001234567890","secret":"secret1","style":"card"},{"projectId":456,"projectName":"Frontend","chatId":"-1009876543210","secret":"secret2","style":"tree"}]
```

### Notification Rules

The `notifyRules` field lets you control which pipeline statuses trigger notifications for each stage. This is useful for reducing noise -- for example, only getting alerts for failed tests or successful deployments.

```json
{
  "projectId": 123,
  "projectName": "My API",
  "chatId": "-1001234567890",
  "notifyRules": {
    "build":  { "send": ["success", "failed", "running"], "ignore": ["canceled", "pending", "manual"] },
    "deploy": { "send": ["success", "failed"], "ignore": [] },
    "test":   { "send": ["failed"], "ignore": [] }
  }
}
```

**How it works:**

- `send` is a **whitelist** -- only these statuses trigger a notification for that stage.
- `ignore` is a **blacklist** -- these statuses are skipped even if they would otherwise be sent.
- If a stage is **not listed** in `notifyRules`, all its events are sent (backward compatible).
- If `notifyRules` is **not present** at all, all events are sent (default behavior).
- `send` **takes priority**: if a status is in both `send` and `ignore`, it is sent.
- Valid statuses: `success`, `failed`, `running`, `canceled`, `pending`, `manual`.
- The stage name is extracted from the GitLab payload (`builds[].stage`, `detailed_status.context`, or `stages`). If the stage cannot be determined, it is treated as `"unknown"` in `repo-config.js` or `"pipeline"` in `message-builder.js` -- if `"unknown"` is not in `notifyRules`, the event is sent.

### Deploy Links

The `deployLinks` field adds a custom full-width button at the bottom of the notification keyboard. Each stage can have its own link with a custom name:

```json
{
  "projectId": 123,
  "projectName": "My API",
  "chatId": "-1001234567890",
  "deployLinks": {
    "build":  { "url": "", "name": "" },
    "deploy": { "url": "https://my-api.example.com", "name": "Open Site" },
    "test":   { "url": "https://my-api.example.com/swagger", "name": "View Swagger" }
  }
}
```

- Each stage can have its own link with `url` and `name`.
- Links are optional -- if a stage has no `url`, no button is shown for it.
- The button appears on its own row at the very bottom, after the Pipeline/Commit/View repository buttons.
- If `deployLinks` is not configured for the repo or the current stage, behavior is unchanged.

### Alert Styles

The `style` field (per repo) or `ALERT_STYLE` (global fallback) controls how pipeline notifications appear in Telegram:

| Style | Description |
|---|---|
| `card` | Clean card layout with bold labels and monospaced values.|
| `tree` | Structured list with tree-style connectors (`├─` / `└─`).|
| `minimal` | Compact format with inline badges separated by label.|

All styles include an inline keyboard with buttons linking to the pipeline, commit, and repository. When `deployLinks` is configured, an additional custom button appears at the bottom.

**Stage-aware headers:** All notification styles include the pipeline stage name in the header line:

```
🔄 Running [build]
❌ Failed [deploy]
✅ Passed [test]
```

The stage name is extracted from the GitLab payload (`builds[].stage`, `detailed_status.context`, or `stages`). If none are available, it falls back to `[pipeline]`.

### Config File Tool

Instead of writing inline JSON in `.env`, you can use the config file tool for a cleaner workflow:

1. Edit `config/repos.config.js` -- a readable JS object format for all your repositories.
2. Generate the env-ready JSON:

   ```bash
   # Print JSON to stdout
   npm run config:build

   # Print in REPOSITORY_CONFIG= format
   npm run config:build -- --env

   # Write directly to .env
   npm run config:write
   ```

### GitLab Webhook Setup

Configure a webhook **for each repository** you want to monitor:

1. Open your GitLab project and navigate to **Settings > Webhooks**.
2. Set the **URL** to your deployed endpoint:

   ```
   https://your-domain.com/api/webhook/gitlab
   ```

3. Set the **Secret token** to the `secret` value from the corresponding entry in `REPOSITORY_CONFIG`.
4. Under **Trigger**, check **Pipeline events**.
5. Keep **Enable SSL verification** enabled for production deployments.
6. Click **Add webhook** and test using the **Test > Pipeline events** dropdown.

> [!NOTE]
> All repositories use the same webhook endpoint. The bot routes alerts to the correct Telegram chat based on the `projectId` in the incoming payload.
>
> The bot only processes pipeline events with statuses: `running`, `success`, `failed`, and `canceled`. Other events are acknowledged but ignored.

### Deployment

The application can be deployed to any platform that supports Node.js (Railway, Render, Fly.io, Docker, VPS, etc.):

1. Set the required environment variables in your platform's configuration:
   - `TELEGRAM_BOT_TOKEN` -- your bot token
   - `REPOSITORY_CONFIG` -- single-line JSON array of repository mappings
   - `ALERT_STYLE` -- optional global fallback style (default: `card`)
   - `PORT` -- the port your platform assigns (default: `3000`)
2. Set the start command to:

   ```bash
   node src/index.js
   ```

3. Deploy. The server will bind to `0.0.0.0` on the configured port.

> [!NOTE]
> Make sure your deployment platform exposes the webhook endpoint publicly over HTTPS. GitLab requires SSL verification for webhooks in production.

## Usage

### Running Locally

```bash
npm start
```

Expected output:

```json
{"level":"INFO","timestamp":"2026-05-22T12:00:00.000Z","message":"Telegram bot initialized successfully","context":{}}
{"level":"INFO","timestamp":"2026-05-22T12:00:00.000Z","message":"Loaded 2 repository configuration(s)","context":{}}
{"level":"INFO","timestamp":"2026-05-22T12:00:00.000Z","message":"Starting webhook server...","context":{}}
{"level":"INFO","timestamp":"2026-05-22T12:00:00.000Z","message":"Webhook server listening on 0.0.0.0:3000","context":{}}
```

### Webhook Endpoint

- **URL**: `POST /api/webhook/gitlab`
- **Headers**: `X-Gitlab-Token: <repo-secret>`
- **Body**: GitLab pipeline event payload (JSON, max 50kb)
- **Response**: `200 OK` on success, `400 Bad Request` if payload is invalid JSON, `401 Unauthorized` if the secret does not match, `404` if no repository config matches the project, `413 Payload Too Large` if payload exceeds 50kb, `429 Too Many Requests` if rate limit exceeded, `500 Internal Server Error` on processing error, `503 Service Unavailable` if bot is not initialized

### Diagnostics Endpoint

- **URL**: `GET /`
- **Response**: JSON object with server status and timestamp

```json
{
  "status": "running",
  "timestamp": "2026-05-26T20:53:57.063Z"
}
```

## Testing

Run the full test suite:

```bash
npm test
```

This executes five test suites in sequence:

| Script | Description |
|---|---|
| `npm run test:unit` | Unit tests for message formatting, duration parsing, and stage formatting |
| `npm run test:repo-config` | Multi-repository config parsing and routing tests |
| `npm run test:pipeline-state` | Pipeline state tracking and stage transition detection tests |
| `npm run test:webhooks` | Webhook integration tests with sample payloads |
| `npm run test:security` | Security validation tests (token verification, input sanitization) |

Tests use fixture files in `test/fixtures/` that simulate real GitLab pipeline event payloads.

## Development

### Available Scripts

| Command | Description |
|---|---|
| `npm start` | Start the application |
| `npm test` | Run all tests |
| `npm run test:unit` | Run unit tests only |
| `npm run test:repo-config` | Run repository config tests only |
| `npm run test:pipeline-state` | Run pipeline state tests only |
| `npm run test:webhooks` | Run webhook tests only |
| `npm run test:security` | Run security tests only |
| `npm run test:telegram` | Run Telegram bot tests only |
| `npm run config:build` | Print env-ready REPOSITORY_CONFIG JSON to stdout |
| `npm run config:write` | Write REPOSITORY_CONFIG to .env |

### Adding a New Alert Style

1. Open `src/services/message-builder.js`.
2. Create a new formatter function (e.g., `formatCompactStyle(data)`).
3. Add a case in the `buildMessage()` switch statement.
4. Add corresponding tests in `test/test-unit.js` using an existing or new fixture.
5. Run `npm test` to verify.

### Logging

The application uses structured JSON logging via `src/utils/logger.js`. All log entries include a `level`, `timestamp`, `message`, and optional `context`. Errors additionally include `error` and `stack` fields. Sensitive data (tokens, secrets, passwords) is automatically sanitized in logs. Logs are written to `stdout` (INFO) and `stderr` (ERROR) for easy integration with log aggregators.

## License

This project is licensed under the [ISC License](LICENSE).

---

<p align="center">
  Built with ❤ by <a href="https://t.me/nightrunner91">nightrunner91</a>
</p>
