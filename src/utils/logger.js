const SENSITIVE_KEYS = ['token', 'secret', 'password', 'key', 'auth', 'credential', 'authorization', 'cookie'];

function sanitizeValue(value) {
    if (typeof value === 'string' && value.length > 0) {
        return value.substring(0, 4) + '***' + value.substring(value.length - 2);
    }
    return '[REDACTED]';
}

function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) {
            sanitized[key] = sanitizeValue(value);
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeObject(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

function logInfo(message, context = {}) {
    console.log(JSON.stringify({ level: 'INFO', timestamp: new Date().toISOString(), message, context: sanitizeObject(context) }));
}
function logError(message, error, context = {}) {
    const safeContext = typeof context === 'object' ? sanitizeObject(context) : {};
    console.error(JSON.stringify({ level: 'ERROR', timestamp: new Date().toISOString(), message, error: error?.message || error, stack: error?.stack, context: safeContext }));
}
module.exports = { logInfo, logError };
