const express = require('express');
const { logInfo, logError } = require('../utils/logger');
const { formatPipelineMessageWithKeyboard } = require('../services/gitlab');
const { sendPipelineNotification } = require('../bot');
const { findRepoConfig, validateWebhookSecret } = require('../utils/repo-config');

const MAX_PAYLOAD_SIZE = '50kb';
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 100;

function createRateLimiter() {
    const requests = new Map();
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const now = Date.now();
        const windowStart = now - RATE_LIMIT_WINDOW_MS;

        if (!requests.has(ip)) {
            requests.set(ip, []);
        }

        const ipRequests = requests.get(ip).filter((ts) => ts > windowStart);
        requests.set(ip, ipRequests);

        if (ipRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
            logError('Rate limit exceeded', { ip });
            return res.status(429).send('Too Many Requests');
        }

        ipRequests.push(now);
        next();
    };
}

function addSecurityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.removeHeader('X-Powered-By');
    next();
}

function createServer(bot, config, repositories) {
    const app = express();
    const rateLimiter = createRateLimiter();

    app.use(addSecurityHeaders);
    app.use(express.json({ limit: MAX_PAYLOAD_SIZE }));
    app.use(rateLimiter);

    app.get('/', (req, res) => {
        res.status(200).json({
            status: 'running',
            timestamp: new Date().toISOString(),
        });
    });

    app.post('/api/webhook/gitlab', async (req, res) => {
        try {
            logInfo('Received webhook request from GitLab');

            if (!bot) {
                logError('Webhook processing failed: Telegram bot is not initialized');
                return res.status(503).send('Service Unavailable');
            }

            const payload = req.body;
            if (!payload || typeof payload !== 'object') {
                return res.status(400).send('Invalid payload');
            }

            const incomingSecret = req.headers['x-gitlab-token'];

            // Find the repository config based on the payload
            const repoConfig = findRepoConfig(repositories, payload);

            if (!repoConfig) {
                logError('No repository config found for webhook', { projectId: payload.project?.id });
                return res.status(404).send('Not Found');
            }

            // Validate secret against repo-specific secret (or fallback)
            if (!validateWebhookSecret(repoConfig, incomingSecret)) {
                logError('Unauthorized webhook attempt', { project: payload.project?.path_with_namespace });
                return res.status(401).send('Unauthorized');
            }

            logInfo('Webhook Payload Info', {
                kind: payload.object_kind,
                status: payload.object_attributes?.status,
                project: payload.project?.path_with_namespace,
            });

            if (payload.object_kind !== 'pipeline') {
                logInfo('Ignored: not a pipeline event');
                return res.status(200).send('OK');
            }

            const status = payload.object_attributes?.status;
            if (['running', 'success', 'failed', 'canceled'].includes(status)) {
                const { message, reply_markup } = formatPipelineMessageWithKeyboard(payload, repoConfig.style, repoConfig.projectName);
                await sendPipelineNotification(bot, repoConfig.chatId, message, reply_markup);
            }

            res.status(200).send('OK');
        } catch (error) {
            logError('Error processing webhook', error);
            res.status(500).send('Internal Server Error');
        }
    });

    app.use((req, res) => {
        res.status(404).send('Not Found');
    });

    app.use((err, req, res, next) => {
        if (err.type === 'entity.parse.failed') {
            logError('Invalid JSON in request body', err);
            return res.status(400).send('Invalid JSON');
        }
        if (err.type === 'entity.too.large') {
            logError('Request payload too large', err);
            return res.status(413).send('Payload Too Large');
        }
        logError('Unhandled server error', err);
        res.status(500).send('Internal Server Error');
    });

    return app;
}

module.exports = { createServer };
