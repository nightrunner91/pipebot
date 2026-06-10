const express = require('express');
const { logInfo, logError } = require('../utils/logger');
const { formatPipelineMessageWithKeyboard } = require('../services/gitlab');
const { sendPipelineNotification, trackNotification } = require('../bot');
const { findRepoConfig, validateWebhookSecret, shouldNotify, extractStageName, getDeployLink } = require('../utils/repo-config');
const { detectStageTransitions, createPayloadForStage, clearOldStates, trackJobDuration, getCumulativeDuration } = require('../utils/pipeline-state');
const { normalizeJobPayload } = require('../utils/job-normalizer');

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
    const webhookMode = (process.env.WEBHOOK_MODE || 'both').toLowerCase();

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

            const objectKind = payload.object_kind;

            if (objectKind === 'build') {
                const normalized = normalizeJobPayload(payload);
                const status = normalized.object_attributes.status;

                if (!['running', 'success', 'failed', 'canceled'].includes(status)) {
                    logInfo('Ignored: job status not processed', { status });
                    return res.status(200).send('OK');
                }

                const pipelineId = payload.pipeline_id;
                const stageName = payload.build_stage?.toLowerCase();
                const duration = payload.build_duration;

                if (duration && stageName && pipelineId && status !== 'running') {
                    trackJobDuration(pipelineId, stageName, duration);
                }

                if (!shouldNotify(repoConfig, normalized)) {
                    logInfo('Notification skipped by notifyRules', {
                        project: repoConfig.projectName,
                        stage: normalized.object_attributes.detailed_status.context,
                        status,
                    });
                    return res.status(200).send('OK');
                }

                const cumulativeDuration = getCumulativeDuration(pipelineId);
                if (cumulativeDuration !== null) {
                    normalized.object_attributes.duration = cumulativeDuration;
                }

                const stageNameForDeploy = normalized.object_attributes.detailed_status.context;
                const branchForDeploy = normalized.object_attributes.ref;
                const statusForDeploy = normalized.object_attributes.status;
                const deployLink = getDeployLink(repoConfig, stageNameForDeploy, branchForDeploy, statusForDeploy);
                const { message, reply_markup } = formatPipelineMessageWithKeyboard(normalized, repoConfig.style, repoConfig.projectName, deployLink);
                await sendPipelineNotification(bot, repoConfig.chatId, message, reply_markup);

                trackNotification({
                    projectName: repoConfig.projectName,
                    pipelineId: pipelineId,
                    stage: stageName,
                    status: status,
                });

                logInfo('Job notification sent', {
                    project: repoConfig.projectName,
                    stage: stageName,
                    status,
                    jobId: payload.build_id,
                });

                return res.status(200).send('OK');
            }

            if (objectKind !== 'pipeline') {
                logInfo('Ignored: unsupported event type', { objectKind });
                return res.status(200).send('OK');
            }

            if (webhookMode === 'jobs') {
                logInfo('Ignored: pipeline events disabled, jobs-only mode');
                return res.status(200).send('OK');
            }

            const status = payload.object_attributes?.status;
            if (['running', 'success', 'failed', 'canceled'].includes(status)) {
                const hasBuilds = payload.builds && Array.isArray(payload.builds) && payload.builds.length > 0;
                const transitions = detectStageTransitions(payload);

                if (transitions.length > 0) {
                    logInfo('Stage transitions detected', {
                        project: repoConfig.projectName,
                        count: transitions.length,
                        transitions: transitions.map((t) => `${t.stageName}: ${t.currentStatus}`),
                    });

                    for (const transition of transitions) {
                        const stagePayload = createPayloadForStage(payload, transition);
                        if (!stagePayload) {
                            logError('Failed to create stage payload', {
                                stage: transition.stageName,
                            });
                            continue;
                        }

                        logInfo('Processing transition', {
                            stage: transition.stageName,
                            status: transition.currentStatus,
                            payloadStatus: stagePayload.object_attributes?.status,
                            payloadBuildsStatus: stagePayload.builds?.[0]?.status,
                            payloadBuildsStage: stagePayload.builds?.[0]?.stage,
                        });

                        if (!shouldNotify(repoConfig, stagePayload)) {
                            logInfo('Notification skipped by notifyRules', {
                                project: repoConfig.projectName,
                                stage: transition.stageName,
                                status: transition.currentStatus,
                            });
                            continue;
                        }

                        const stageName = transition.stageName;
                        const branchForDeploy = payload.object_attributes?.ref;
                        const statusForDeploy = transition.currentStatus;
                        const deployLink = getDeployLink(repoConfig, stageName, branchForDeploy, statusForDeploy);
                        const { message, reply_markup } = formatPipelineMessageWithKeyboard(stagePayload, repoConfig.style, repoConfig.projectName, deployLink);
                        await sendPipelineNotification(bot, repoConfig.chatId, message, reply_markup);

                        trackNotification({
                            projectName: repoConfig.projectName,
                            pipelineId: payload.object_attributes?.id,
                            stage: stageName,
                            status: transition.currentStatus,
                        });
                    }
                } else if (!hasBuilds) {
                    if (!shouldNotify(repoConfig, payload)) {
                        logInfo('Notification skipped by notifyRules', {
                            project: repoConfig.projectName,
                            stage: extractStageName(payload),
                            status,
                        });
                        return res.status(200).send('OK');
                    }

                    const stageName = extractStageName(payload);
                    const branchForDeploy = payload.object_attributes?.ref;
                    const statusForDeploy = payload.object_attributes?.status;
                    const deployLink = getDeployLink(repoConfig, stageName, branchForDeploy, statusForDeploy);
                    const { message, reply_markup } = formatPipelineMessageWithKeyboard(payload, repoConfig.style, repoConfig.projectName, deployLink);
                    await sendPipelineNotification(bot, repoConfig.chatId, message, reply_markup);

                    trackNotification({
                        projectName: repoConfig.projectName,
                        pipelineId: payload.object_attributes?.id,
                        stage: stageName,
                        status: payload.object_attributes?.status,
                    });
                }
            }

            clearOldStates();

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
