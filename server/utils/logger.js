import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || 'info';
const prettyPrint = process.env.LOG_PRETTY === 'true' || isDevelopment;

const logger = pino({
  level: logLevel,
  transport: prettyPrint ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      singleLine: false,
      messageFormat: '{levelLabel} - {msg}'
    }
  } : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: {
        host: req.headers.host,
        userAgent: req.headers['user-agent']
      },
      remoteAddress: req.remoteAddress,
      remotePort: req.remotePort
    }),
    res: (res) => ({
      statusCode: res.statusCode
    }),
    err: pino.stdSerializers.err
  }
});

// Helper functions for structured logging
export const logRequest = (req, message = 'Incoming request') => {
  logger.info({
    req,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent')
  }, message);
};

export const logResponse = (req, res, duration, message = 'Request completed') => {
  logger.info({
    req,
    res,
    duration,
    statusCode: res.statusCode
  }, message);
};

export const logError = (error, context = {}) => {
  logger.error({
    err: error,
    ...context,
    stack: error.stack
  }, error.message);
};

export const logJobStart = (jobId, brandId, context = {}) => {
  logger.info({
    jobId,
    brandId,
    ...context
  }, `Job started: ${jobId}`);
};

export const logJobComplete = (jobId, duration, context = {}) => {
  logger.info({
    jobId,
    duration,
    ...context
  }, `Job completed: ${jobId}`);
};

export const logJobError = (jobId, error, context = {}) => {
  logger.error({
    jobId,
    err: error,
    ...context
  }, `Job failed: ${jobId} - ${error.message}`);
};

export const logApiCall = (service, endpoint, duration, success = true) => {
  const logFn = success ? logger.info : logger.error;
  logFn({
    service,
    endpoint,
    duration,
    success
  }, `API call to ${service}: ${endpoint}`);
};

export const logDatabaseQuery = (operation, table, duration, context = {}) => {
  logger.debug({
    operation,
    table,
    duration,
    ...context
  }, `Database ${operation} on ${table}`);
};

export const logSecurity = (event, context = {}) => {
  logger.warn({
    event,
    ...context
  }, `Security event: ${event}`);
};

export default logger;
