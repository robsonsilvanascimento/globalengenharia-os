import { createHash, randomBytes } from 'node:crypto';
import type { UsuarioRepository } from '../domain/UsuarioRepository';
import { enviarEmailComAnexo } from '../../../shared/infra/email/EmailService';

const UMA_HORA_EM_MS = 60 * 60 * 1000;

/**
 * Em producao, `FRONTEND_URL` ausente falha alto em vez de cair
 * silenciosamente para localhost: sem essa checagem, um deploy com a env
 * var esquecida enviaria e-mails de reset de senha reais com um link
 * quebrado (localhost, inacessivel para o cliente) sem nenhum aviso.
 */
function obterFrontendUrl(): string {
  const frontendUrl = process.env.FRONTEND_URL;

  if (frontendUrl) {
    return frontendUrl;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('FRONTEND_URL precisa estar definida no ambiente de producao');
  }

  return 'http://localhost:5173';
}

export interface SolicitarResetSenhaUseCaseInput {
  email: string;
}

export interface SolicitarResetSenhaUseCaseDeps {
  usuarioRepository: UsuarioRepository;
  /** Injetavel para testes; usa a implementacao real (SMTP) por padrao. */
  enviarEmail?: typeof enviarEmailComAnexo;
}

/**
 * Inicia o fluxo de "esqueci minha senha". Nunca revela ao chamador se o
 * e-mail existe ou nao na base (mitigacao de enumeracao de contas) — o
 * retorno e sempre "void" e a rota sempre responde com a mesma mensagem
 * generica, exista ou nao o usuario.
 */
export class SolicitarResetSenhaUseCase {
  constructor(private readonly deps: SolicitarResetSenhaUseCaseDeps) {}

  async execute({ email }: SolicitarResetSenhaUseCaseInput): Promise<void> {
    const { usuarioRepository } = this.deps;
    const enviarEmail = this.deps.enviarEmail ?? enviarEmailComAnexo;

    const usuario = await usuarioRepository.findByEmail(email);

    if (!usuario) {
      return;
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiraEm = new Date(Date.now() + UMA_HORA_EM_MS);

    await usuarioRepository.salvarTokenReset(usuario.id, tokenHash, expiraEm);

    const link = `${obterFrontendUrl()}/redefinir-senha?token=${token}`;

    await enviarEmail(
      usuario.email,
      'Redefinicao de senha',
      `Voce solicitou a redefinicao da sua senha. Acesse o link abaixo para criar uma nova senha (valido por 1 hora):\n\n${link}\n\nSe voce nao solicitou essa alteracao, ignore este e-mail.`,
      undefined,
    );
  }
}
