import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { authRoutes } from './routes/auth.js';
import { syncRoutes } from './routes/sync.js';
import { productsRoutes } from './routes/products.js';


const server = Fastify({ logger: true });

await server.register(cors, { origin: true, credentials: true });
await server.register(jwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-change-in-production-min-32-chars',
});

// Rate limiting — 100 req/min per IP
await server.register(rateLimit, { max: 100, timeWindow: '1 minute' });

// Reusable JWT authentication decorator
server.decorate('authenticate', async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

await server.register(authRoutes, { prefix: '/api/v1' });
await server.register(syncRoutes, { prefix: '/api/v1' });
await server.register(productsRoutes, { prefix: '/api/v1' });


server.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }));

const port = Number(process.env.API_PORT || 4000);
const host = process.env.API_HOST || '0.0.0.0';

try {
  await server.listen({ port, host });
  console.log(`API listening on http://${host}:${port}`);
} catch (err) {
  server.log.error(err);
  process.exit(1);
}
