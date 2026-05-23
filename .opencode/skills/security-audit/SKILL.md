# Security Audit Skill

A comprehensive security audit skill for Node.js webhook-based applications, specifically designed for the Pipeline Alert Bot (Telegram + GitLab webhooks).

## When to Use

Use this skill when:
- Preparing a Node.js application for production deployment
- Reviewing security of webhook endpoints
- Auditing secrets management, input validation, and error handling
- Checking for common Node.js/Express vulnerabilities

## Audit Checklist

### 1. Secrets & Environment Variables
- [ ] `.env` file is in `.gitignore` (never committed)
- [ ] `.env.example` exists with placeholder values (no real secrets)
- [ ] All sensitive values loaded via `process.env` (no hardcoded secrets)
- [ ] `package-lock.json` does not contain secrets
- [ ] No secrets logged or exposed in error responses

### 2. Webhook Security
- [ ] Webhook secret token validation (`X-Gitlab-Token` or signature verification)
- [ ] Secret comparison uses timing-safe comparison (`crypto.timingSafeEqual`)
- [ ] Webhook endpoint validates payload structure before processing
- [ ] Rate limiting on webhook endpoint to prevent DoS
- [ ] Payload size limits configured (`express.json({ limit: '...' })`)
- [ ] HTTPS enforced in production (or behind reverse proxy)

### 3. Input Validation & Sanitization
- [ ] All incoming webhook data validated/sanitized before use
- [ ] HTML escaping applied to user-controlled content in Telegram messages
- [ ] No raw user input passed to `eval()`, `exec()`, or similar
- [ ] JSON parsing has error handling (no crash on malformed JSON)
- [ ] URL construction from user input validated (no SSRF)

### 4. Express/Server Security
- [ ] `helmet` middleware for security headers (or equivalent)
- [ ] CORS configured (not wildcard `*` in production)
- [ ] No unnecessary routes exposed
- [ ] Health/diagnostics endpoint does not leak sensitive info
- [ ] Error responses do not include stack traces or internal details
- [ ] `express.json()` has size limit configured

### 5. Error Handling
- [ ] `uncaughtException` and `unhandledRejection` handlers present
- [ ] Errors logged without exposing sensitive data
- [ ] HTTP error responses are generic (no internal details)
- [ ] Graceful shutdown implemented (SIGTERM/SIGINT)

### 6. Dependency Security
- [ ] No known CVEs in dependencies (`npm audit`)
- [ ] Dependencies pinned to specific versions (not `*` or `latest`)
- [ ] No unnecessary dependencies
- [ ] `node_modules` in `.gitignore`

### 7. Telegram Bot Security
- [ ] Bot token validated before use
- [ ] Chat IDs validated (not accepting arbitrary chat IDs from input)
- [ ] Bot does not expose commands that could be abused
- [ ] `parse_mode: 'HTML'` content is properly escaped

### 8. Logging Security
- [ ] No secrets logged (tokens, passwords, keys)
- [ ] Log output does not include full webhook payloads with secrets
- [ ] Error logs do not expose stack traces to end users
- [ ] JSON log format is safe (no injection via log fields)

### 9. Deployment Security
- [ ] `NODE_ENV=production` set in production
- [ ] Non-root user in container (if Docker)
- [ ] Minimal permissions (no unnecessary file system access)
- [ ] Health check endpoint configured for orchestrator

### 10. Code Quality & Best Practices
- [ ] No `eval()`, `Function()`, or dynamic `require()` with user input
- [ ] No prototype pollution vectors
- [ ] No command injection vectors
- [ ] No path traversal vectors
- [ ] Proper use of `const`/`let` (no accidental globals)

## Severity Levels

- **CRITICAL**: Immediate exploitation risk (secret exposure, auth bypass, injection)
- **HIGH**: Significant risk (missing auth, no input validation, known CVEs)
- **MEDIUM**: Moderate risk (information disclosure, missing headers, no rate limiting)
- **LOW**: Minor improvements (logging improvements, defense in depth)

## Remediation Template

For each finding, provide:
1. **Location**: File and line number
2. **Severity**: CRITICAL/HIGH/MEDIUM/LOW
3. **Description**: What the issue is and how it could be exploited
4. **Fix**: Specific code change to resolve the issue

## Post-Audit Actions

After identifying issues:
1. Fix all CRITICAL and HIGH severity issues immediately
2. Fix MEDIUM issues before production deployment
3. Document LOW issues for future improvement
4. Run `npm audit` and fix any known vulnerabilities
5. Re-run the audit to confirm all issues are resolved
