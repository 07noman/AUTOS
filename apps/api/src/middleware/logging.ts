import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../lib/logger.js';

export function requestLogging(server: any) {
  server.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    logger.info({
      method: request.method,
      url: request.url,
      tenantId: request.headers['x-tenant-id'],
    }, 'Request received');
  });

  server.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    logger.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.getResponseTime(),
    }, 'Request completed');
  });
}
