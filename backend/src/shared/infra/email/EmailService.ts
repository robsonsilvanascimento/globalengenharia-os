import nodemailer, { Transporter } from 'nodemailer';
import { logger } from '../Logger';

export interface AnexoEmail {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export type ResultadoEnvioEmail = { sucesso: true } | { sucesso: false; erro: string };

let transporterSingleton: Transporter | undefined;

function criarTransporter(): Transporter {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? '587');
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

function obterTransporter(): Transporter {
  if (!transporterSingleton) {
    transporterSingleton = criarTransporter();
  }
  return transporterSingleton;
}

function extrairMensagemErro(erro: unknown): string {
  if (erro instanceof Error) {
    return erro.message;
  }
  return String(erro);
}

export async function enviarEmailComAnexo(
  destinatario: string,
  assunto: string,
  corpoTexto: string,
  anexo?: AnexoEmail,
  transporter: Pick<Transporter, 'sendMail'> = obterTransporter(),
): Promise<ResultadoEnvioEmail> {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: destinatario,
      subject: assunto,
      text: corpoTexto,
      attachments: anexo
        ? [
            {
              filename: anexo.filename,
              content: anexo.content,
              contentType: anexo.contentType,
            },
          ]
        : undefined,
    });

    return { sucesso: true };
  } catch (erro) {
    const mensagem = extrairMensagemErro(erro);
    logger.error({ err: erro, destinatario, assunto }, 'Falha ao enviar e-mail');
    return { sucesso: false, erro: mensagem };
  }
}
