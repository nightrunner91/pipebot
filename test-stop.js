const { Telegraf } = require('telegraf');

const bot = new Telegraf('dummy_token');

try {
    bot.stop('SIGTERM');
    console.log('Bot stopped successfully');
} catch (e) {
    console.error('Error stopping bot:', e.message);
}
