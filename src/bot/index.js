const { Telegraf } = require('telegraf');
const { logInfo, logError } = require('../utils/logger');

const startTime = new Date();

let recentNotifications = [];
const MAX_RECENT = 100;

function trackNotification(notification) {
    recentNotifications.unshift({
        ...notification,
        timestamp: new Date().toISOString(),
    });
    if (recentNotifications.length > MAX_RECENT) {
        recentNotifications = recentNotifications.slice(0, MAX_RECENT);
    }
}

function createBot(token, repositories = new Map()) {
    const bot = new Telegraf(token);

    bot.catch((err, ctx) => {
        logError(`Unhandled error for ${ctx.updateType}`, err);
    });

    bot.command('start', (ctx) => {
        const message =
            '👋 <b>Welcome to Pipeline Alert Bot!</b>\n\n' +
            'I monitor your GitLab CI/CD pipelines and send notifications to this chat.\n\n' +
            'Use /help to see all available commands.';
        ctx.reply(message, { parse_mode: 'HTML' });
    });

    bot.command('help', (ctx) => {
        const message =
            '📋 <b>Available Commands:</b>\n\n' +
            '/start - Initialize the bot and receive a greeting\n' +
            '/help - Display all available commands\n' +
            '/ping - Check bot latency\n' +
            '/status - Show bot health, connected repos count, webhook mode, and uptime\n' +
            '/uptime - Detailed uptime breakdown with start time\n' +
            '/version - Bot version, Node.js version, platform, and memory usage\n' +
            '/info - Bot description, features, and metadata\n' +
            '/repos - List all monitored GitLab repositories\n' +
            '/repo &lt;name&gt; - Get detailed info about a specific repository\n' +
            '/health - Run a health check on Telegram connection and GitLab API connectivity\n' +
            '/recent [count] - Show recent pipeline notifications (default: 5, max: 20)\n' +
            '/alerts - Show current notification style configuration\n' +
            '/chat_id - Get the current chat ID for use in repos.config.js\n' +
            '/test_notification - Send a test notification to verify the bot is working';
        ctx.reply(message, { parse_mode: 'HTML' });
    });

    bot.command('ping', async (ctx) => {
        const start = Date.now();
        const msg = await ctx.reply('🏓 Pong!');
        const latency = Date.now() - start;
        const editMessage = `🏓 Pong! Latency: <b>${latency}ms</b>`;
        try {
            await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, editMessage, { parse_mode: 'HTML' });
        } catch (err) {
            logError('Failed to edit ping message', err);
        }
    });

    bot.command('status', (ctx) => {
        const uptimeMs = Date.now() - startTime.getTime();
        const uptimeSeconds = Math.floor(uptimeMs / 1000);
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;

        const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        const repoCount = repositories.size;

        let statusEmoji = '🟢';
        let statusText = 'Healthy';

        const message =
            `${statusEmoji} <b>Bot Status</b>\n\n` +
            `<b>Status:</b> ${statusText}\n` +
            `<b>Connected Repositories:</b> ${repoCount}\n` +
            `<b>Webhook Mode:</b> Active\n` +
            `<b>Uptime:</b> ${uptimeStr}`;
        ctx.reply(message, { parse_mode: 'HTML' });
    });

    bot.command('uptime', (ctx) => {
        const uptimeMs = Date.now() - startTime.getTime();
        const uptimeSeconds = Math.floor(uptimeMs / 1000);
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;

        const message =
            '⏱️ <b>Uptime Details</b>\n\n' +
            `<b>Started at:</b> ${startTime.toISOString()}\n` +
            `<b>Current time:</b> ${new Date().toISOString()}\n` +
            `<b>Total uptime:</b>\n` +
            `  • Days: ${days}\n` +
            `  • Hours: ${hours}\n` +
            `  • Minutes: ${minutes}\n` +
            `  • Seconds: ${seconds}`;
        ctx.reply(message, { parse_mode: 'HTML' });
    });

    bot.command('version', (ctx) => {
        const packageJson = require('../../package.json');
        const memoryUsage = process.memoryUsage();
        const memoryMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);

        const message =
            '📦 <b>Version Information</b>\n\n' +
            `<b>Bot Version:</b> ${packageJson.version}\n` +
            `<b>Node.js Version:</b> ${process.version}\n` +
            `<b>Platform:</b> ${process.platform} (${process.arch})\n` +
            `<b>Memory Usage:</b> ${memoryMB} MB`;
        ctx.reply(message, { parse_mode: 'HTML' });
    });

    bot.command('info', (ctx) => {
        const packageJson = require('../../package.json');

        const message =
            '🤖 <b>Pipeline Alert Bot</b>\n\n' +
            'A Telegram bot that monitors GitLab CI/CD pipelines and sends real-time notifications to your chat.\n\n' +
            '<b>Features:</b>\n' +
            '• Real-time pipeline notifications\n' +
            '• Multi-repository support\n' +
            '• Customizable notification rules per stage\n' +
            '• Deploy link buttons for quick access\n' +
            '• Multiple message styles (card, tree, minimal)\n' +
            '• Webhook-based architecture for reliability\n\n' +
            `<b>Version:</b> ${packageJson.version}\n` +
            `<b>Author:</b> ${packageJson.author || 'N/A'}`;
        ctx.reply(message, { parse_mode: 'HTML' });
    });

    bot.command('repos', (ctx) => {
        if (repositories.size === 0) {
            ctx.reply('📭 No repositories configured.');
            return;
        }

        let message = '📚 <b>Monitored Repositories</b>\n\n';

        let index = 1;
        for (const [key, repo] of repositories) {
            const name = repo.projectName || key;
            message += `<b>${index}.</b> ${name}\n`;
            if (repo.projectId) {
                message += `   ID: ${repo.projectId}\n`;
            }
            message += '\n';
            index++;
        }

        message += `Total: <b>${repositories.size}</b> repositories`;
        ctx.reply(message, { parse_mode: 'HTML' });
    });

    bot.command('repo', (ctx) => {
        const args = ctx.message.text.split(' ').slice(1);
        if (args.length === 0) {
            ctx.reply('⚠️ Please specify a repository name or ID.\n\nUsage: /repo &lt;name&gt;', { parse_mode: 'HTML' });
            return;
        }

        const searchQuery = args.join(' ').toLowerCase();
        let foundRepo = null;
        let foundKey = null;

        for (const [key, repo] of repositories) {
            const name = (repo.projectName || key).toLowerCase();
            const id = String(repo.projectId || '').toLowerCase();
            if (name.includes(searchQuery) || id === searchQuery) {
                foundRepo = repo;
                foundKey = key;
                break;
            }
        }

        if (!foundRepo) {
            ctx.reply(`❌ Repository "${args.join(' ')}" not found.\n\nUse /repos to see all available repositories.`);
            return;
        }

        let message = `📁 <b>${foundRepo.projectName || foundKey}</b>\n\n`;
        message += `<b>Project ID:</b> ${foundRepo.projectId || 'N/A'}\n`;
        message += `<b>Chat ID:</b> ${foundRepo.chatId}\n`;

        if (foundRepo.notifyRules) {
            message += '\n<b>Notification Rules:</b>\n';
            for (const [stage, rules] of Object.entries(foundRepo.notifyRules)) {
                const sendList = rules.send ? rules.send.join(', ') : 'all';
                const ignoreList = rules.ignore ? rules.ignore.join(', ') : 'none';
                message += `  • <b>${stage}:</b> send=[${sendList}], ignore=[${ignoreList}]\n`;
            }
        }

        if (foundRepo.deployLinks) {
            message += '\n<b>Deploy Links:</b>\n';
            for (const [stage, links] of Object.entries(foundRepo.deployLinks)) {
                if (Array.isArray(links)) {
                    for (const link of links) {
                        message += `  • <b>${stage}</b> (${link.branch}): <a href="${link.url}">${link.name}</a>\n`;
                    }
                } else if (links.url) {
                    message += `  • <b>${stage}:</b> <a href="${links.url}">${links.name || 'View'}</a>\n`;
                }
            }
        }

        ctx.reply(message, { parse_mode: 'HTML', disable_web_page_preview: true });
    });

    bot.command('health', async (ctx) => {
        let telegramStatus = '🟢 Connected';
        let gitlabStatus = '🟢 Configured';

        try {
            await bot.telegram.getMe();
        } catch (err) {
            telegramStatus = '🔴 Disconnected';
            logError('Health check: Telegram connection failed', err);
        }

        if (repositories.size === 0) {
            gitlabStatus = '🟡 No repositories configured';
        }

        const message =
            '🏥 <b>Health Check</b>\n\n' +
            `<b>Telegram:</b> ${telegramStatus}\n` +
            `<b>GitLab Webhooks:</b> ${gitlabStatus}\n` +
            `<b>Monitored Repos:</b> ${repositories.size}`;
        ctx.reply(message, { parse_mode: 'HTML' });
    });

    bot.command('recent', (ctx) => {
        const args = ctx.message.text.split(' ').slice(1);
        let count = 5;

        if (args.length > 0) {
            const parsed = parseInt(args[0], 10);
            if (!isNaN(parsed) && parsed > 0) {
                count = Math.min(parsed, 20);
            }
        }

        if (recentNotifications.length === 0) {
            ctx.reply('📭 No recent pipeline notifications.');
            return;
        }

        const recent = recentNotifications.slice(0, count);
        let message = '📊 <b>Recent Pipeline Notifications</b>\n\n';

        for (const notification of recent) {
            const statusEmoji = notification.status === 'success' ? '✅' :
                notification.status === 'failed' ? '❌' :
                    notification.status === 'running' ? '🔄' : '⏸️';

            message += `${statusEmoji} <b>${notification.projectName || 'Unknown'}</b>\n`;
            message += `   Pipeline #${notification.pipelineId || 'N/A'} - ${notification.stage || 'unknown'}\n`;
            message += `   Status: ${notification.status}\n`;
            message += `   Time: ${new Date(notification.timestamp).toLocaleString()}\n\n`;
        }

        message += `Showing <b>${recent.length}</b> of <b>${recentNotifications.length}</b> total notifications`;
        ctx.reply(message, { parse_mode: 'HTML' });
    });

    bot.command('alerts', (ctx) => {
        const alertStyle = process.env.ALERT_STYLE || 'card';

        let message = '🔔 <b>Notification Configuration</b>\n\n';
        message += `<b>Global Alert Style:</b> ${alertStyle}\n\n`;

        message += '<b>Available Styles:</b>\n';
        message += '  • <b>card</b> - Clean card layout with bold labels\n';
        message += '  • <b>tree</b> - Structured list with tree connectors\n';
        message += '  • <b>minimal</b> - Compact format with inline badges\n\n';

        if (repositories.size > 0) {
            message += '<b>Per-Repository Overrides:</b>\n';
            for (const [key, repo] of repositories) {
                const name = repo.projectName || key;
                const style = repo.style || 'card (default)';
                message += `  • ${name}: ${style}\n`;
            }
        }

        ctx.reply(message, { parse_mode: 'HTML' });
    });

    bot.command('chat_id', (ctx) => {
        const chatId = ctx.chat.id;
        const message =
            '💬 <b>Chat ID</b>\n\n' +
            `Your chat ID is: <code>${chatId}</code>\n\n` +
            'Use this ID in your repos.config.js file to route notifications to this chat.';
        ctx.reply(message, { parse_mode: 'HTML' });
    });

    bot.command('test_notification', async (ctx) => {
        const testMessage =
            '🧪 <b>Test Notification</b>\n\n' +
            'This is a test notification from Pipeline Alert Bot.\n\n' +
            'If you see this message, the bot is working correctly! ✅';

        const replyMarkup = {
            inline_keyboard: [
                [
                    { text: '📋 View Pipeline', url: 'https://gitlab.com' },
                ],
            ],
        };

        try {
            await ctx.reply(testMessage, {
                parse_mode: 'HTML',
                reply_markup: replyMarkup,
            });
            logInfo('Test notification sent successfully', { chatId: ctx.chat.id });
        } catch (err) {
            logError('Failed to send test notification', err);
            ctx.reply('❌ Failed to send test notification. Check logs for details.');
        }
    });

    return bot;
}

async function sendPipelineNotification(bot, chatId, message, reply_markup) {
    try {
        const options = {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
        };
        if (reply_markup) {
            options.reply_markup = reply_markup;
        }
        await bot.telegram.sendMessage(chatId, message, options);
        logInfo('Notification sent successfully', { chatId });
    } catch (error) {
        logError('Failed to send notification', error, { chatId });
    }
}

module.exports = { createBot, sendPipelineNotification, trackNotification };
