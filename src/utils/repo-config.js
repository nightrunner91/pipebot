const crypto = require('crypto');
const { logInfo, logError } = require('./logger');

const VALID_STATUSES = ['success', 'failed', 'running', 'canceled', 'pending', 'manual'];

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
                        notifyRules: repo.notifyRules || null,
                        deployLinks: repo.deployLinks || null,
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
                        notifyRules: value.notifyRules || null,
                        deployLinks: value.deployLinks || null,
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
            notifyRules: null,
            deployLinks: null,
        });
        logInfo('Using fallback single-repo configuration');
    }

    return repos;
}

function findRepoConfig(repos, payload) {
    const projectId = payload.project?.id || payload.project_id;

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

function extractStageName(payload) {
    const builds = payload.builds;
    const status = payload.object_attributes?.status;
    const stages = payload.object_attributes?.stages;
    const detailedStatus = payload.object_attributes?.detailed_status;

    if (builds && Array.isArray(builds) && builds.length > 0) {
        const matchingBuild = builds.find((b) => b.status === status);
        if (matchingBuild?.stage) {
            return matchingBuild.stage.toLowerCase();
        }

        if (status === 'running') {
            const activeStatuses = ['running', 'pending', 'preparing', 'scheduled'];
            const activeBuild = builds.find((b) => activeStatuses.includes(b.status));
            if (activeBuild?.stage) {
                return activeBuild.stage.toLowerCase();
            }
        }

        const lastBuild = builds[builds.length - 1];
        if (lastBuild?.stage) {
            return lastBuild.stage.toLowerCase();
        }
    }

    if (detailedStatus?.context) {
        return detailedStatus.context.toLowerCase();
    }

    if (stages && stages.length > 0) {
        return stages[0].toLowerCase();
    }

    return 'unknown';
}

function shouldNotify(repoConfig, payload) {
    const notifyRules = repoConfig?.notifyRules;
    if (!notifyRules) {
        return true;
    }

    const stageName = extractStageName(payload);
    const status = payload.object_attributes?.status;

    logInfo('shouldNotify check', {
        stageName,
        status,
        availableRules: Object.keys(notifyRules),
    });

    const stageRules = notifyRules[stageName];
    if (!stageRules) {
        logInfo('shouldNotify: stage not in rules, allowing', { stageName });
        return true;
    }

    const sendList = stageRules.send || [];
    const ignoreList = stageRules.ignore || [];

    if (sendList.length > 0 && !sendList.includes(status)) {
        logInfo('shouldNotify: status not in send list', { stageName, status, sendList });
        return false;
    }

    if (ignoreList.includes(status)) {
        if (sendList.includes(status)) {
            return true;
        }
        return false;
    }

    return true;
}

function getDeployLink(repoConfig, stageName, branch, status) {
    if (status !== 'success') {
        return null;
    }
    const deployLinks = repoConfig?.deployLinks;
    if (!deployLinks || !stageName) {
        return null;
    }

    const stageLinks = deployLinks[stageName];
    if (!stageLinks) {
        return null;
    }

    // New format: array of rules with branch matching
    if (Array.isArray(stageLinks)) {
        if (!branch) return null;
        const matched = stageLinks.find((rule) => rule.branch === branch);
        if (matched) {
            const url = matched.url?.trim();
            if (url) {
                return { url, name: matched.name?.trim() || 'View' };
            }
        }
        return null;
    }

    // Old format: single { url, name } — backward compatible, any branch
    if (stageLinks.url) {
        return { url: stageLinks.url.trim(), name: stageLinks.name };
    }

    return null;
}

module.exports = {
    parseRepositoryConfig,
    findRepoConfig,
    validateWebhookSecret,
    extractStageName,
    shouldNotify,
    getDeployLink,
};
