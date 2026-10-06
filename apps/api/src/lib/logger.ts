import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      translateTime: true,
      colorize: true,
    },
  },
  formatters: {
    level: (label: string) => ({ level: label.toUpperCase() }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function logAudit(
  tenantId: string,
  action: string,
  entityType: string,
  entityId: string,
  userId?: string
) {
  logger.info({
    tenantId,
    action,
    entityType,
    entityId,
    userId,
    audit: true,
  }, 'Audit log');
}
