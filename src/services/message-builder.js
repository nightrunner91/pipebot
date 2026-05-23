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

function extractData(payload, projectNameOverride) {
    const project = escapeHtml(projectNameOverride || payload.project?.name || 'Unknown Project');
    const namespace = escapeHtml(payload.project?.namespace || '');
    const status = payload.object_attributes?.status;
    const ref = escapeHtml(payload.object_attributes?.ref || 'unknown');
    const pipelineId = payload.object_attributes?.id;
    const duration = formatDuration(payload.object_attributes?.duration);
    const stages = formatStages(payload.object_attributes?.stages);
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
    let msg = `${data.emoji} ${data.statusText}\n`;
    msg += `\n`;
    msg += `<b>${data.project}</b>\n`;
    msg += `\n`;
    msg += `<b>Branch</b> - <code>${data.ref}</code>\n`;
    msg += `<b>Commit</b> - <code>${data.shortSha}</code>\n`;
    if (data.stages) {
        msg += `<b>Stages</b> - <code>${data.stages}</code>\n`;
    }
    msg += `<b>Author</b> - <code>${data.author}</code>\n`;
    if (data.duration && data.status !== 'running') {
        msg += `<b>Duration</b> - <code>${data.duration}</code>\n`;
    }
    return msg;
}

function formatBadgeStyle(data) {
    let msg = `${data.emoji} <code>${data.badge}</code>\n`;
    msg += `\n`;
    msg += `<b>${data.project}</b>\n`;
    msg += `\u251C\u2500 <b>Branch:</b> <code>${data.ref}</code>\n`;
    msg += `\u251C\u2500 <b>Commit:</b> <a href="${data.commitUrl}">${data.shortSha}</a>\n`;
    msg += `\u251C\u2500 <b>Author:</b> ${data.author}\n`;
    if (data.triggeredBy) {
        msg += `\u251C\u2500 <b>Triggered by:</b> ${data.triggeredBy}\n`;
    }
    msg += `\u251C\u2500 <b>Duration:</b> ${data.duration || 'N/A'}\n`;
    msg += `\u2514\u2500 <b>Stages:</b> ${data.stages || 'N/A'}\n`;
    if (data.commitMsg) {
        msg += `\n<i>${data.commitMsg}</i>\n`;
    }
    msg += `\n`;
    msg += `<a href="${data.pipelineUrl}">View in GitLab \u2192</a>`;
    return msg;
}

function formatMinimalStyle(data) {
    let msg = `${data.emoji} <b>Pipeline ${data.statusText}</b>\n`;
    msg += `<i>${data.project}</i>\n`;
    msg += `\n`;
    let inline = `<code>${data.ref}</code> \u00B7 <a href="${data.commitUrl}">${data.shortSha}</a> \u00B7 ${data.author}`;
    if (data.triggeredBy) {
        inline += ` \u00B7 via ${data.triggeredBy}`;
    }
    msg += inline + '\n';
    if (data.commitMsg) {
        msg += `<i>${data.commitMsg}</i>\n`;
    }
    msg += `\n`;
    const metaParts = [];
    if (data.duration) metaParts.push(`\u23F1 ${data.duration}`);
    if (data.stages) metaParts.push(data.stages);
    if (metaParts.length) {
        msg += metaParts.join(' \u00B7 ') + '\n';
    }
    msg += `\n`;
    msg += `<a href="${data.pipelineUrl}">Open Pipeline</a>`;
    return msg;
}

function buildMessage(payload, style = 'card', projectNameOverride) {
    const data = extractData(payload, projectNameOverride);
    switch (style) {
        case 'badge':
            return formatBadgeStyle(data);
        case 'minimal':
            return formatMinimalStyle(data);
        case 'card':
        default:
            return formatCardStyle(data);
    }
}

function buildInlineKeyboard(data) {
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
    return buttons.length ? { inline_keyboard: buttons } : undefined;
}

function buildMessageWithKeyboard(payload, style = 'card', projectNameOverride) {
    const data = extractData(payload, projectNameOverride);
    const message = buildMessage(payload, style, projectNameOverride);
    const reply_markup = buildInlineKeyboard(data);
    return { message, reply_markup };
}

module.exports = {
    escapeHtml,
    formatDuration,
    formatStages,
    getStatusConfig,
    buildMessage,
    buildMessageWithKeyboard,
    formatCardStyle,
    formatBadgeStyle,
    formatMinimalStyle,
};
