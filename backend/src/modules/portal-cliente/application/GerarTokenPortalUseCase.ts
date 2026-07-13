import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

export interface GerarTokenPortalDeps {
  prisma: PrismaClient;
}

export interface GerarTokenPortalResultado {
  token: string;
  expiraEm: Date;
}

export class GerarTokenPortalUseCase {
  constructor(private readonly deps: GerarTokenPortalDeps) {}

  async execute(clienteId: string): Promise<GerarTokenPortalResultado> {
    const { prisma } = this.deps;

    const token = randomBytes(32).toString('hex');
    const expiraEm = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.tokenPortalCliente.create({
      data: { clienteId, token, expiraEm },
    });

    return { token, expiraEm };
  }
}
