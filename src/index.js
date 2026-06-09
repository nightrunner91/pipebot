require('dotenv').config();
const { createBot, trackNotification } = require('./bot');
const { createServer } = require('./server');
const { parseRepositoryConfig } = require('./utils/repo-config');
const { logInfo, logError } = require('./utils/logger');

// Global Error Handlers to prevent silent fatal crashes
process.on('uncaughtException', (err) => {
    logError('FATAL: Uncaught Exception', err);
});
process.on('unhandledRejection', (reason, promise) => {
    logError('FATAL: Unhandled Rejection', reason);
});

let parsedPort = parseInt(process.env.PORT || '3000', 10);
if (isNaN(parsedPort)) {
    parsedPort = 3000;
}

const config = {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    groupId: process.env.TELEGRAM_GROUP_ID,
    gitlabSecret: process.env.GITLAB_WEBHOOK_SECRET,
    port: parsedPort,
    alertStyle: process.env.ALERT_STYLE || 'card',
    repositoryConfig: process.env.REPOSITORY_CONFIG || null,
};

// Parse repository mapping (multi-repo support)
const repositories = parseRepositoryConfig(
    config.repositoryConfig,
    config.groupId,
    config.gitlabSecret,
    config.alertStyle
);

logInfo(`Loaded ${repositories.size} repository configuration(s)`);

// Initialize Bot only if token is present
let bot = null;
if (config.botToken) {
    try {
        bot = createBot(config.botToken, repositories);
        logInfo('Telegram bot initialized successfully');
        
        // Start bot with long polling (coexists with Express webhook server)
        bot.launch().catch((err) => {
            logError('Failed to start bot', err);
        });
    } catch (err) {
        logError('Failed to initialize Telegram bot', err);
    }
} else {
    logError('TELEGRAM_BOT_TOKEN is missing. Bot functionality will be disabled.');
}

// Initialize Web Server
const app = createServer(bot, config, repositories);

// Start Server
async function start() {
    try {
        logInfo('Starting webhook server...');

        // Bind to config.port and fallback defaults to handle any Railway port mapping mismatch
        const ports = Array.from(new Set([config.port, 3000, 8080, 5000, 8000, 4000, 80, 5952].map(Number)));
        ports.forEach((port) => {
            const server = app.listen(port, '0.0.0.0', () => {
                logInfo(`Webhook server listening on 0.0.0.0:${port}`);
            });
            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    logInfo(`Port ${port} is already in use, skipping (this is normal if another server has bound it)`);
                } else {
                    logError(`Failed to listen on 0.0.0.0:${port}`, err);
                }
            });
        });

        // Graceful Shutdown
        // Removed bot.stop() because it throws if bot.launch() wasn't called
        process.once('SIGINT', () => { 
            logInfo('Received SIGINT, shutting down...');
            process.exit(0); 
        });
        process.once('SIGTERM', () => { 
            logInfo('Received SIGTERM, shutting down...');
            process.exit(0); 
        });
    } catch (error) {
        logError('Startup failed', error);
        process.exit(1);
    }
}

start();
