function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDuration(seconds) {
    if (!seconds && seconds !== 0) return null;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
}

function formatStages(stages) {
    if (!stages || !stages.length) return null;
    return stages.join(' \u2192 ');
}

function getStatusConfig(status) {
    const configs = {
        success:  { emoji: '\u2705', statusText: 'Passed',    badge: '\u2713 SUCCESS' },
        failed:   { emoji: '\u274C', statusText: 'Failed',    badge: '\u2717 FAILED' },
        running:  { emoji: '\uD83D\uDD04', statusText: 'Running',   badge: '\u27F3 RUNNING' },
        canceled: { emoji: '\u26A0\uFE0F', statusText: 'Canceled',  badge: '! CANCELED' },
        pending:  { emoji: '\u23F3', statusText: 'Pending',   badge: '\u23F3 PENDING' },
        manual:   { emoji: '\uD83D\uDD27', statusText: 'Manual',    badge: '\uD83D\uDD27 MANUAL' },
    };
    return configs[status] || { emoji: '\uD83D\uDCCB', statusText: status || 'Unknown', badge: status || 'UNKNOWN' };
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

    return 'pipeline';
}

function extractData(payload, projectNameOverride) {
    const project = escapeHtml(projectNameOverride || payload.project?.name || 'Unknown Project');
    const namespace = escapeHtml(payload.project?.namespace || '');
    const status = payload.object_attributes?.status;
    const ref = escapeHtml(payload.object_attributes?.ref || 'unknown');
    const pipelineId = payload.object_attributes?.id;
    const duration = formatDuration(payload.object_attributes?.duration);
    const stages = formatStages(payload.object_attributes?.stages);
    const stageName = extractStageName(payload);
    const sha = payload.object_attributes?.sha || '';
    const shortSha = escapeHtml(sha.substring(0, 8));
    const author = escapeHtml(payload.commit?.author?.name || 'Unknown');
    const commitMsg = escapeHtml(payload.commit?.message?.trim().split('\n')[0] || '');
    const triggeredBy = escapeHtml(payload.user?.name || '');
    const pipelineUrl = payload.project?.web_url + '/-/pipelines/' + pipelineId;
    const commitUrl = payload.commit?.url || '';
    const repoUrl = payload.project?.web_url || '';

    return {
        project,
        namespace,
        status,
        ref,
        pipelineId,
        duration,
        stages,
        stageName,
        shortSha,
        author,
        commitMsg,
        triggeredBy,
        pipelineUrl,
        commitUrl,
        repoUrl,
        ...getStatusConfig(status),
    };
}

function formatCardStyle(data) {
    let msg = `<b>${data.emoji} ${data.statusText} [${data.stageName}]</b>\n`;
    msg += `\n`;
    msg += `<b>${data.project}</b>\n`;
    msg += `\n`;
    msg += `<b>Branch</b> - <code>${data.ref}</code>\n`;
    msg += `<b>Commit</b> - <code>${data.shortSha}</code>\n`;
    msg += `<b>Author</b> - <code>${data.author}</code>\n`;
    if (data.duration && data.status !== 'running') {
        msg += `<b>Duration</b> - <code>${data.duration}</code>\n`;
    }
    return msg;
}

function formatTreeStyle(data) {
    let msg = `<b>${data.emoji} ${data.statusText} [${data.stageName}]</b>\n`;
    msg += `\n`;
    msg += `<b>${data.project}</b>\n`;
    msg += `\u251C\u2500 <b>Branch:</b> <code>${data.ref}</code>\n`;
    msg += `\u251C\u2500 <b>Commit:</b> <code>${data.shortSha}</code>\n`;
    if (data.duration && data.status !== 'running') {
        msg += `\u251C\u2500 <b>Author:</b> <code>${data.author}</code>\n`;
        msg += `\u2514\u2500 <b>Duration:</b> <code>${data.duration}</code>\n`;
    } else {
        msg += `\u2514\u2500 <b>Author:</b> <code>${data.author}</code>\n`;
    }
    return msg;
}

function formatMinimalStyle(data) {
    let msg = `<b>${data.emoji} ${data.statusText} [${data.stageName}]</b>\n`;
    msg += `\n`;
    msg += `<b>${data.project}</b>\n`;
    msg += `\n`;
    const badges = [
        `<code>${data.ref}</code>`,
        `<code>${data.shortSha}</code>`,
        `<code>${data.author}</code>`,
    ];
    if (data.duration && data.status !== 'running') {
        badges.push(`<code>${data.duration}</code>`);
    }
    msg += badges.join(' / ');
    return msg;
}

function buildMessage(payload, style = 'card', projectNameOverride) {
    const data = extractData(payload, projectNameOverride);
    switch (style) {
        case 'tree':
            return formatTreeStyle(data);
        case 'minimal':
            return formatMinimalStyle(data);
        case 'card':
        default:
            return formatCardStyle(data);
    }
}

function buildInlineKeyboard(data, deployLink) {
    const buttons = [];
    const row1 = [];
    if (data.pipelineUrl) {
        row1.push({ text: 'Pipeline', url: data.pipelineUrl });
    }
    if (data.commitUrl) {
        row1.push({ text: 'Commit', url: data.commitUrl });
    }
    if (row1.length) buttons.push(row1);
    if (data.repoUrl) {
        buttons.push([{ text: 'View repository', url: data.repoUrl }]);
    }
    if (deployLink && deployLink.url) {
        buttons.push([{ text: deployLink.name || 'View', url: deployLink.url }]);
    }
    return buttons.length ? { inline_keyboard: buttons } : undefined;
}

function buildMessageWithKeyboard(payload, style = 'card', projectNameOverride, deployLink) {
    const data = extractData(payload, projectNameOverride);
    const message = buildMessage(payload, style, projectNameOverride);
    const reply_markup = buildInlineKeyboard(data, deployLink);
    return { message, reply_markup };
}

module.exports = {
    escapeHtml,
    formatDuration,
    formatStages,
    extractStageName,
    getStatusConfig,
    buildMessage,
    buildMessageWithKeyboard,
    formatCardStyle,
    formatTreeStyle,
    formatMinimalStyle,
};
