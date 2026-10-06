import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { authRoutes } from './routes/auth.js';
import { syncRoutes } from './routes/sync.js';
import { productsRoutes } from './routes/products.js';


// ─── Environment & Secrets Validation ─────────────────────────────────────────
const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET environment variable is missing in production.');
  process.exit(1);
}

const jwtSecret = process.env.JWT_SECRET || (isProd ? '' : 'dev-secret-change-in-production-min-32-chars');

console.log(`[STARTUP] Config status: JWT_SECRET=${process.env.JWT_SECRET ? 'configured' : 'using dev default'}`);
console.log(`[STARTUP] Config status: DATABASE_URL=${process.env.DATABASE_URL ? 'configured' : 'missing'}`);

const server = Fastify({
  logger: isProd ? { level: 'warn' } : true,
});

// ─── Strict CORS Configuration ────────────────────────────────────────────────
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://localhost:5173', 'tauri://localhost'];

await server.register(cors, {
  origin: isProd ? allowedOrigins : true,
  credentials: true,
});

await server.register(jwt, {
  secret: jwtSecret,
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
