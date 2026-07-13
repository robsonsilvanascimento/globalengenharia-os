import { describe, expect, it, vi } from 'vitest';
import { enviarEmailComAnexo, AnexoEmail } from './EmailService';

describe('EmailService', () => {
  it('envia e-mail com sucesso sem anexo', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'abc-123' });
    const transporter = { sendMail };

    const resultado = await enviarEmailComAnexo(
      'cliente@exemplo.com',
      'Ordem de servico concluida',
      'Sua OS foi concluida.',
      undefined,
      transporter,
    );

    expect(resultado).toEqual({ sucesso: true });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'cliente@exemplo.com',
        subject: 'Ordem de servico concluida',
        text: 'Sua OS foi concluida.',
        attachments: undefined,
      }),
    );
  });

  it('envia e-mail com sucesso com anexo', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'abc-456' });
    const transporter = { sendMail };

    const anexo: AnexoEmail = {
      filename: 'relatorio.pdf',
      content: Buffer.from('conteudo-fake'),
      contentType: 'application/pdf',
    };

    const resultado = await enviarEmailComAnexo(
      'cliente@exemplo.com',
      'Relatorio da OS',
      'Segue em anexo o relatorio.',
      anexo,
      transporter,
    );

    expect(resultado).toEqual({ sucesso: true });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [
          {
            filename: 'relatorio.pdf',
            content: anexo.content,
            contentType: 'application/pdf',
          },
        ],
      }),
    );
  });

  it('retorna sucesso: false quando o transporter rejeita, sem lancar excecao', async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error('conexao SMTP recusada'));
    const transporter = { sendMail };

    const resultado = await enviarEmailComAnexo(
      'cliente@exemplo.com',
      'Assunto',
      'Corpo',
      undefined,
      transporter,
    );

    expect(resultado).toEqual({ sucesso: false, erro: 'conexao SMTP recusada' });
  });

  it('retorna sucesso: false com erro nao-Error, sem lancar excecao', async () => {
    const sendMail = vi.fn().mockRejectedValue('falha desconhecida');
    const transporter = { sendMail };

    const resultado = await enviarEmailComAnexo(
      'cliente@exemplo.com',
      'Assunto',
      'Corpo',
      undefined,
      transporter,
    );

    expect(resultado).toEqual({ sucesso: false, erro: 'falha desconhecida' });
  });
});
