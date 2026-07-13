import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { logger } from '../../infra/Logger';
import { AppError } from '../errors/AppError';

interface ErrorBody {
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

/**
 * Error handler global do Fastify. Registrar com:
 *   app.setErrorHandler(errorHandler)
 */
export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof ZodError) {
    const body: ErrorBody = {
      error: {
        message: 'Dados invalidos',
        code: 'VALIDATION_ERROR',
        details: error.flatten(),
      },
    };
    reply.status(400).send(body);
    return;
  }

  if (error instanceof AppError) {
    const body: ErrorBody = {
      error: {
        message: error.message,
        code: error.code,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    };
    reply.status(error.statusCode).send(body);
    return;
  }

  // Erros de validacao de schema do proprio Fastify (JSON Schema / ajv)
  const fastifyError = error as FastifyError;
  if (fastifyError.statusCode && fastifyError.statusCode < 500) {
    const body: ErrorBody = {
      error: {
        message: fastifyError.message,
        code: fastifyError.code ?? 'BAD_REQUEST',
      },
    };
    reply.status(fastifyError.statusCode).send(body);
    return;
  }

  logger.error({ err: error, url: request.url, method: request.method }, 'Erro nao tratado');

  const body: ErrorBody = {
    error: {
      message: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR',
    },
  };
  reply.status(500).send(body);
}
