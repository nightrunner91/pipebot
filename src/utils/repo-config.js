const crypto = require('crypto');
const { logInfo, logError } = require('./logger');

function parseRepositoryConfig(envConfig, fallbackGroupId, fallbackSecret, fallbackStyle) {
    const repos = new Map();

    if (envConfig) {
        try {
            const parsed = typeof envConfig === 'string' ? JSON.parse(envConfig) : envConfig;

            if (Array.isArray(parsed)) {
                for (const repo of parsed) {
                    if (!repo.projectId) {
                        logError('Repository config entry missing projectId', { repo });
                        continue;
                    }
                    if (!repo.chatId) {
                        logError('Repository config entry missing chatId', { repo });
                        continue;
                    }

                    const key = `id:${repo.projectId}`;
                    repos.set(key, {
                        chatId: repo.chatId,
                        secret: repo.secret || null,
                        style: repo.style || fallbackStyle || 'card',
                        projectId: repo.projectId,
                        projectName: repo.projectName || null,
                    });

                    logInfo(`Registered repository config: ${key} -> chat ${repo.chatId}`);
                }
            } else if (typeof parsed === 'object') {
                for (const [key, value] of Object.entries(parsed)) {
                    if (!value.chatId) {
                        logError('Repository config entry missing chatId', { key, value });
                        continue;
                    }

                    const normalizedKey = `id:${key}`;
                    repos.set(normalizedKey, {
                        chatId: value.chatId,
                        secret: value.secret || null,
                        style: value.style || fallbackStyle || 'card',
                        projectId: key,
                        projectName: value.projectName || null,
                    });

                    logInfo(`Registered repository config: ${normalizedKey} -> chat ${value.chatId}`);
                }
            }
        } catch (err) {
            logError('Failed to parse REPOSITORY_CONFIG', err);
        }
    }

    if (repos.size === 0 && fallbackGroupId) {
        repos.set('fallback', {
            chatId: fallbackGroupId,
            secret: fallbackSecret || null,
            style: fallbackStyle || 'card',
            projectId: null,
            projectName: null,
        });
        logInfo('Using fallback single-repo configuration');
    }

    return repos;
}

function findRepoConfig(repos, payload) {
    const projectId = payload.project?.id;

    if (projectId) {
        const byId = repos.get(`id:${projectId}`);
        if (byId) return byId;
    }

    const fallback = repos.get('fallback');
    if (fallback) return fallback;

    return null;
}

function validateWebhookSecret(repoConfig, incomingSecret) {
    if (!repoConfig.secret) {
        return true;
    }
    if (!incomingSecret) {
        return false;
    }
    const expected = Buffer.from(repoConfig.secret, 'utf8');
    const provided = Buffer.from(incomingSecret, 'utf8');
    if (expected.length !== provided.length) {
        return false;
    }
    return crypto.timingSafeEqual(expected, provided);
}

module.exports = {
    parseRepositoryConfig,
    findRepoConfig,
    validateWebhookSecret,
};
