import { FastifyRequest, FastifyReply } from 'fastify';
import rateLimit from '@fastify/rate-limit';

export async function setupRateLimit(server: any) {
  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    allowList: ['127.0.0.1'], // Whitelist localhost
  });
}
