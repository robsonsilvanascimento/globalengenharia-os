import { Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import { prisma } from '../../../../shared/infra/PrismaClient';
import { redisConnection } from '../../../../shared/infra/RedisConnection';
import { logger } from '../../../../shared/infra/Logger';

function buildTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
}

function buildHtml(
  sete: Array<{ nome: string; os: string; dias: number }>,
  quinze: Array<{ nome: string; os: string; dias: number }>,
  trinta: Array<{ nome: string; os: string; dias: number }>,
): string {
  const renderSection = (
    titulo: string,
    items: Array<{ nome: string; os: string; dias: number }>,
  ) => {
    if (items.length === 0) return '';
    const rows = items
      .map(
        (i) =>
          `<tr><td>${i.nome}</td><td>${i.os}</td><td>${i.dias} dia(s)</td></tr>`,
      )
      .join('');
    return `
      <h2>${titulo}</h2>
      <table border="1" cellpadding="6" cellspacing="0">
        <thead><tr><th>Componente</th><th>OS</th><th>Dias Restantes</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  };

  return `<!DOCTYPE html><html><body>
    <h1>Alertas de Garantia</h1>
    ${renderSection('Vencendo em 7 dias', sete)}
    ${renderSection('Vencendo em 15 dias', quinze)}
    ${renderSection('Vencendo em 30 dias', trinta)}
  </body></html>`;
}

export const garantiaWorker = new Worker(
  'alerta-garantia',
  async () => {
    const hoje = new Date();
    const limite = new Date();
    limite.setDate(limite.getDate() + 30);

    const componentes = await prisma.componenteInstalado.findMany({
      where: {
        garantiaExpiraEm: {
          gte: hoje,
          lte: limite,
        },
      },
      include: {
        ordemServico: { select: { numero: true } },
      },
    });

    const hojeStr = hoje.toISOString().slice(0, 10);

    const sete: Array<{ nome: string; os: string; dias: number }> = [];
    const quinze: Array<{ nome: string; os: string; dias: number }> = [];
    const trinta: Array<{ nome: string; os: string; dias: number }> = [];

    for (const c of componentes) {
      const diasRestantes = Math.ceil(
        (c.garantiaExpiraEm!.getTime() - hoje.getTime()) / 86400000,
      );

      const jaExiste = await prisma.alertaGarantia.findFirst({
        where: { componenteId: c.id, criadoEm: { gte: new Date(hojeStr) } },
      });

      if (!jaExiste) {
        await prisma.alertaGarantia.create({
          data: { componenteId: c.id, diasRestantes },
        });
      }

      const item = { nome: c.nome, os: c.ordemServico.numero ?? c.ordemServicoId, dias: diasRestantes };

      if (diasRestantes <= 7) {
        sete.push(item);
      } else if (diasRestantes <= 15) {
        quinze.push(item);
      } else {
        trinta.push(item);
      }
    }

    if (componentes.length === 0) return;

    const html = buildHtml(sete, quinze, trinta);
    const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@globalengenharia.com';
    const transporter = buildTransporter();

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: adminEmail,
      subject: 'Alertas de Garantia — Vencimentos nos próximos 30 dias',
      html,
    });

    logger.info({ total: componentes.length }, 'Alertas de garantia processados');
  },
  {
    connection: redisConnection,
    concurrency: 1,
  },
);
