const logger = {
    info: (message, meta = {}) => {
        const timestamp = new Date().toISOString();
        console.log(JSON.stringify({ level: 'info', timestamp, message, ...meta }));
    },
    error: (message, error = null) => {
        const timestamp = new Date().toISOString();
        const errorDetails = error ? {
            name: error.name,
            message: error.message,
            stack: error.stack
        } : {};
        console.error(JSON.stringify({ level: 'error', timestamp, message, ...errorDetails }));
    },
    warn: (message, meta = {}) => {
        const timestamp = new Date().toISOString();
        console.warn(JSON.stringify({ level: 'warn', timestamp, message, ...meta }));
    },
    debug: (message, meta = {}) => {
        if (process.env.NODE_ENV !== 'production') {
            const timestamp = new Date().toISOString();
            console.debug(JSON.stringify({ level: 'debug', timestamp, message, ...meta }));
        }
    }
};

export default logger;
