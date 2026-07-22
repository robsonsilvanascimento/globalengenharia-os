import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { LoginUseCase } from '../../application/LoginUseCase';
import { RefreshTokenUseCase } from '../../application/RefreshTokenUseCase';
import { SolicitarResetSenhaUseCase } from '../../application/SolicitarResetSenhaUseCase';
import { RedefinirSenhaUseCase } from '../../application/RedefinirSenhaUseCase';
import { enviarEmailComAnexo } from '../../../../shared/infra/email/EmailService';
import type { HashService } from '../../application/ports/HashService';
import type { TokenService } from '../../application/ports/TokenService';
import { CredenciaisInvalidasError } from '../../domain/errors/CredenciaisInvalidasError';
import { TokenInvalidoError } from '../../domain/errors/TokenInvalidoError';
import { TokenResetInvalidoError } from '../../domain/errors/TokenResetInvalidoError';
import type { UsuarioRepository } from '../../domain/UsuarioRepository';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../../../shared/http/errors/AppError';
import { authenticate } from '../../../../shared/http/middlewares/auth';
import { buildRouteRateLimit } from '../../../../shared/http/middlewares/rate-limit';

/**
 * Limite mais rigido para rotas sensiveis de autenticacao (por IP), acima do
 * limite global padrao: mitiga forca-bruta de senha em /auth/login e abuso
 * (email bombing / enumeracao por timing) em /auth/esqueci-senha e
 * /auth/redefinir-senha. 10 tentativas por minuto por IP.
 */
const authRateLimit = {
  config: { rateLimit: buildRouteRateLimit({ max: 10, timeWindowMs: 60_000 }) },
};

const loginBodySchema = z.object({
  email: z.string().email().max(255),
  // .max(128): alem de nao existir senha legitima maior que isso, evita que
  // uma string gigante force um custo de hashing (bcrypt) desproporcional a
  // cada tentativa, mesmo com o rate limit acima.
  senha: z.string().min(1).max(128),
});

const refreshBodySchema = z.object({
  refreshToken: z.string().min(1).max(2000),
});

const esqueciSenhaBodySchema = z.object({
  email: z.string().email().max(255),
});

const redefinirSenhaBodySchema = z.object({
  token: z.string().min(1).max(255),
  nova_senha: z.string().min(6).max(128),
});

export interface AuthRoutesDeps {
  usuarioRepository: UsuarioRepository;
  hashService: HashService;
  tokenService: TokenService;
  /** Injetavel para testes; usa a implementacao real (SMTP) por padrao. */
  enviarEmail?: typeof enviarEmailComAnexo;
}

/** Registra as rotas publicas/autenticadas do modulo de auth. */
export function registerAuthRoutes(app: FastifyInstance, deps: AuthRoutesDeps): void {
  const loginUseCase = new LoginUseCase(deps);
  const refreshTokenUseCase = new RefreshTokenUseCase(deps);
  const solicitarResetSenhaUseCase = new SolicitarResetSenhaUseCase(deps);
  const redefinirSenhaUseCase = new RedefinirSenhaUseCase(deps);

  app.post('/auth/login', authRateLimit, async (request, reply) => {
    const body = loginBodySchema.parse(request.body);

    try {
      const resultado = await loginUseCase.execute(body);
      return reply.status(200).send(resultado);
    } catch (error) {
      if (error instanceof CredenciaisInvalidasError) {
        throw new UnauthorizedError(error.message);
      }
      throw error;
    }
  });

  app.post('/auth/refresh', async (request, reply) => {
    const body = refreshBodySchema.parse(request.body);

    try {
      const resultado = await refreshTokenUseCase.execute(body);
      return reply.status(200).send(resultado);
    } catch (error) {
      if (error instanceof TokenInvalidoError) {
        throw new UnauthorizedError(error.message);
      }
      throw error;
    }
  });

  app.post('/auth/esqueci-senha', authRateLimit, async (request, reply) => {
    const body = esqueciSenhaBodySchema.parse(request.body);

    await solicitarResetSenhaUseCase.execute(body);

    // Resposta sempre identica, exista ou nao o e-mail na base, para nao
    // permitir enumeracao de contas cadastradas.
    return reply
      .status(200)
      .send({ message: 'Se o e-mail existir em nossa base, você receberá instruções em breve.' });
  });

  app.post('/auth/redefinir-senha', authRateLimit, async (request, reply) => {
    const body = redefinirSenhaBodySchema.parse(request.body);

    try {
      await redefinirSenhaUseCase.execute({ token: body.token, novaSenha: body.nova_senha });
      return reply.status(200).send({ message: 'Senha redefinida com sucesso.' });
    } catch (error) {
      if (error instanceof TokenResetInvalidoError) {
        throw new ValidationError(error.message);
      }
      throw error;
    }
  });

  app.get('/auth/me', { preHandler: authenticate }, async (request, reply) => {
    const usuario = await deps.usuarioRepository.findById(request.user!.id);

    if (!usuario) {
      throw new NotFoundError('Usuario nao encontrado');
    }

    return reply.status(200).send({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      ativo: usuario.ativo,
    });
  });
}
