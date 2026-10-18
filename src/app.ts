import Fastify, { LogController } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

export function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
    logController: new LogController({
      disableRequestLogging: process.env.NODE_ENV === 'test',
    }),
  });

  app.register(swagger, {
    openapi: {
      info: {
        title: 'GreenCode API',
        description: 'API do sistema de logÃ­stica reversa GreenCode.',
        version: '0.1.0',
      },
      servers: [{ url: 'http://localhost:3000' }],
      tags: [{ name: 'Health', description: 'Estado tÃ©cnico do servidor' }],
    },
  });

  app.register(swaggerUi, { routePrefix: '/docs' });

  app.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Verifica se o servidor HTTP estÃ¡ respondendo.',
        response: {
          200: {
            type: 'object',
            required: ['status', 'service'],
            properties: {
              status: { type: 'string', const: 'ok' },
              service: { type: 'string', const: 'greencode-api' },
            },
          },
        },
      },
    },
    async () => ({ status: 'ok', service: 'greencode-api' }),
  );

  return app;
}
