---
name: telegram-bot-expert
description: Strict guidelines, architecture patterns, and best practices for developing high-quality, production-ready Telegram bots.
---

## Core Principles for Telegram Bot Development

When building or modifying the Telegram bot, you MUST adhere to the following architectural and implementation standards.

### 1. Architecture & Code Organization
- **Modular Design:** Never place all logic in a single file. Strictly separate concerns:
  - `handlers/`: For Telegram message and callback query routing.
  - `services/` or `core/`: For business logic and external API integrations.
  - `database/`: For models, schemas, and queries.
  - `utils/`: For helpers, formatters, and constants.
- **Configuration Management:** Use environment variables (via a `.env` file) for all secrets, tokens (`TELEGRAM_BOT_TOKEN`), database URIs, and admin IDs. Never hardcode credentials.

### 2. Concurrency & Asynchronous Execution
- **Non-Blocking I/O:** Telegram bots must handle multiple users concurrently. Always use `async`/`await` for network requests, database queries, and Telegram API calls.
- **No Blocking Calls:** Strictly avoid synchronous blocking operations (e.g., `time.sleep`, synchronous file reads, or synchronous HTTP clients) within event handlers.

### 3. Reliability & Error Handling
- **Global Error Catcher:** Implement a top-level error handler to catch unhandled exceptions. This prevents the bot process from crashing and allows you to log the stack trace.
- **Admin Alerts:** Automatically send critical error notifications and stack traces to a designated admin Telegram ID.
- **User-Facing Graceful Failures:** If a handler crashes, gracefully inform the user ("An unexpected error occurred. Please try again later.") rather than failing silently.
- **Graceful Shutdown:** Catch termination signals (`SIGINT`, `SIGTERM`) to cleanly close database connections and finish processing active requests before exiting.

### 4. User Experience & Interface (UX)
- **State Management (FSM):** Use Finite State Machines for multi-step user interactions (e.g., registration flows, complex forms).
- **Immediate Feedback:** For operations taking longer than 1 second, immediately use `sendChatAction` (e.g., 'typing...') to show the bot is processing.
- **Inline Keyboards:** Prefer Inline Keyboards over Reply Keyboards for menus and settings to keep the chat history clean.
- **Pagination:** If returning long lists of data, implement inline keyboard pagination instead of sending giant walls of text.

### 5. Performance & Security
- **Rate Limiting (Anti-Spam):** Use middleware to throttle rapid requests from the same user to prevent bot abuse and avoid hitting Telegram's API rate limits.
- **Database Pooling:** Use connection pools for database access rather than opening a new connection per query.
- **Input Validation:** Sanitize and validate all user inputs, especially when saving to the database or passing to external APIs.

### 6. Logging
- **Structured Logging:** Log all significant events (command execution, errors, API failures). Include timestamps, user IDs, and context.
- **No Sensitive Data in Logs:** Ensure tokens, passwords, and PII (Personally Identifiable Information) are never written to logs.

---
**Note:** When generating code, follow these principles strictly using the specific framework and language chosen for the project (e.g., Python/Aiogram, Node.js/Telegraf).
