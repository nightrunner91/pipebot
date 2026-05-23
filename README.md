# <p align="center">Pipeline Alertbot</p>

<p align="center">
  <strong>Real-time GitLab CI/CD pipeline notifications delivered to Telegram.</strong>
</p>

<p align="center">
  <strong><img src="https://flagcdn.com/w20/us.png" width="20"> English</strong> | <a href="README.ru.md"><img src="https://flagcdn.com/w20/ru.png" width="20"> Russian</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.0.0-blue?style=for-the-badge" alt="Version">
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
  - [Alert Styles](#alert-styles)
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

**Pipeline Alertbot** is a lightweight, production-ready webhook relay that bridges GitLab CI/CD pipeline events to Telegram group chats. It receives pipeline webhooks from GitLab, formats them into readable notifications, and sends them to designated Telegram chats in real time. The bot supports **multi-repository mode**, allowing you to monitor multiple GitLab projects and route alerts to different Telegram groups. 

## Features

- **Multi-repository support** - Monitor many GitLab projects and route alerts to different Telegram chats
- **Custom project names** - Override GitLab project names with your own display names in alerts
- **Per-repo alert styles** - Each repository can use a different notification format (card, badge, or minimal)
- **Real-time pipeline alerts** - Receive instant notifications for running, successful, failed, and canceled pipelines
- **Inline keyboard buttons** - Quick-access links to the pipeline, commit, and repository directly in Telegram
- **Secure webhook validation** - Validates incoming requests using per-repository secret tokens
- **Flexible port configuration** - Binds to `0.0.0.0` with configurable port via `PORT` environment variable
- **Graceful error handling** - Global uncaught exception and unhandled rejection handlers prevent silent crashes
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
pipeline-alertbot/
├── src/
│   ├── index.js              # Entry point: config, initialization, multi-port startup
│   ├── bot/
│   │   └── index.js          # Telegraf bot creation and message dispatch
│   ├── server/
│   │   └── index.js          # Express server: routes, webhook validation, payload routing
│   ├── services/
│   │   ├── gitlab.js         # GitLab payload formatting entry point
│   │   └── message-builder.js # Message templates (card, badge, minimal) and HTML escaping
│   └── utils/
│       ├── logger.js         # Structured JSON logging (INFO/ERROR)
│       └── repo-config.js    # Multi-repository config parser and routing logic
├── test/
│   ├── fixtures/             # Sample GitLab webhook payloads
│   │   ├── pipeline-running.json
│   │   ├── pipeline-success.json
│   │   ├── pipeline-failed.json
│   │   └── pipeline-canceled.json
│   ├── test-unit.js          # Unit tests for message formatting
│   ├── test-repo-config.js   # Multi-repository config tests
│   ├── test-webhooks.js      # Webhook integration tests
│   └── test-security.js      # Security validation tests
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
   git clone https://github.com/your-org/pipeline-alertbot.git
   cd pipeline-alertbot
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
| `ALERT_STYLE` | No | `card` | Global fallback message format: `card`, `badge`, or `minimal` |
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
    "style": "badge"
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
| `style` | No | Alert style: `card`, `badge`, or `minimal` (falls back to `ALERT_STYLE`) |

In your `.env` file, the JSON must be on a **single line**:

```env
REPOSITORY_CONFIG=[{"projectId":123,"projectName":"My API","chatId":"-1001234567890","secret":"secret1","style":"card"},{"projectId":456,"projectName":"Frontend","chatId":"-1009876543210","secret":"secret2","style":"badge"}]
```

### Alert Styles

The `style` field (per repo) or `ALERT_STYLE` (global fallback) controls how pipeline notifications appear in Telegram:

| Style | Description | Example Output |
|---|---|---|
| `card` | Clean card layout with bold labels and monospaced values | Status header, project name, branch, commit, author, duration |
| `badge` | Structured list with tree-style connectors and a "View in GitLab" link | Badge header, tree-formatted fields, commit message, inline link |
| `minimal` | Compact single-line format with inline metadata | Status + project, inline branch/commit/author, "Open Pipeline" link |

All styles include an inline keyboard with buttons linking to the pipeline, commit, and repository.

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
- **Body**: GitLab pipeline event payload (JSON)
- **Response**: `200 OK` on success, `401 Unauthorized` if the secret does not match, `404` if no repository config matches the project, `500` if bot is not initialized

### Diagnostics Endpoint

- **URL**: `GET /`
- **Response**: JSON object with server status and configuration presence (no secrets exposed)

```json
{
  "status": "running",
  "env": {
    "PORT": 3000,
    "HAS_TELEGRAM_BOT_TOKEN": true,
    "HAS_TELEGRAM_GROUP_ID": false,
    "HAS_GITLAB_WEBHOOK_SECRET": false,
    "HAS_REPOSITORY_CONFIG": true,
    "ALERT_STYLE": "card"
  },
  "botInitialized": true,
  "registeredRepositories": 2
}
```

## Testing

Run the full test suite:

```bash
npm test
```

This executes four test suites in sequence:

| Script | Description |
|---|---|
| `npm run test:unit` | Unit tests for message formatting, duration parsing, and stage formatting |
| `npm run test:repo-config` | Multi-repository config parsing and routing tests |
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
| `npm run test:webhooks` | Run webhook tests only |
| `npm run test:security` | Run security tests only |

### Adding a New Alert Style

1. Open `src/services/message-builder.js`.
2. Create a new formatter function (e.g., `formatCompactStyle(data)`).
3. Add a case in the `buildMessage()` switch statement.
4. Add corresponding tests in `test/test-unit.js` using an existing or new fixture.
5. Run `npm test` to verify.

### Logging

The application uses structured JSON logging via `src/utils/logger.js`. All log entries include a `level`, `timestamp`, `message`, and optional `context`. Errors additionally include `error` and `stack` fields. Logs are written to `stdout` (INFO) and `stderr` (ERROR) for easy integration with log aggregators.

## License

This project is licensed under the [ISC License](LICENSE).

---

<p align="center">
  Built with ❤ by <a href="https://t.me/nightrunner91">nightrunner91</a>
</p>
