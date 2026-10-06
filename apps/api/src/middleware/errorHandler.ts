import { FastifyInstance, FastifyError } from 'fastify';

export function setupErrorHandler(server: FastifyInstance) {
  server.setErrorHandler((error: FastifyError, request, reply) => {
    server.log.error(error);

    reply.status(error.statusCode || 500).send({
      error: error.name,
      message: error.message,
      statusCode: error.statusCode || 500,
    });
  });
}
