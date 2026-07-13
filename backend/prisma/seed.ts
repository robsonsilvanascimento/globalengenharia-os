import { randomBytes } from 'node:crypto';
import { PrismaClient, AreaServico } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

/** Gera uma senha aleatoria forte (nunca deixe um fallback fixo em codigo-fonte). */
function gerarSenhaAleatoria(): string {
  return randomBytes(12).toString('base64url');
}

const senhaGerada = gerarSenhaAleatoria();

const ADMIN_INICIAL = {
  nome: 'Administrador',
  email: process.env.ADMIN_SEED_EMAIL ?? 'admin@globalengenharia.com',
  // Se ADMIN_SEED_SENHA nao for definida, gera uma senha aleatoria e imprime
  // no console apenas nesta execucao (nunca fica salva em codigo-fonte).
  senha: process.env.ADMIN_SEED_SENHA ?? senhaGerada,
  senhaFoiGerada: !process.env.ADMIN_SEED_SENHA,
};

type CategoriaSeed = {
  nome: string;
  area: AreaServico;
};

const categorias: CategoriaSeed[] = [
  // Eletrica
  { nome: 'Instalação elétrica residencial/comercial', area: 'eletrica' },
  { nome: 'Manutenção e reparo elétrico', area: 'eletrica' },
  { nome: 'Quadro de distribuição/disjuntores', area: 'eletrica' },
  { nome: 'Iluminação', area: 'eletrica' },
  { nome: 'Laudo técnico/inspeção elétrica (NR10)', area: 'eletrica' },

  // Automacao
  { nome: 'Automação residencial', area: 'automacao' },
  { nome: 'Automação industrial', area: 'automacao' },
  { nome: 'Automação de portões e cercas', area: 'automacao' },
  { nome: 'CFTV/segurança eletrônica', area: 'automacao' },

  // Energia Solar
  { nome: 'Projeto e instalação de sistema fotovoltaico', area: 'energia_solar' },
  { nome: 'Manutenção e limpeza de painéis solares', area: 'energia_solar' },
  { nome: 'Vistoria e homologação junto à concessionária', area: 'energia_solar' },
  { nome: 'Ampliação de sistema solar existente', area: 'energia_solar' },

  // Outros
  { nome: 'Outros', area: 'outro' },
];

async function main() {
  for (const categoria of categorias) {
    const existente = await prisma.categoriaServico.findFirst({
      where: { nome: categoria.nome, area: categoria.area },
    });

    if (existente) {
      await prisma.categoriaServico.update({
        where: { id: existente.id },
        data: { ativo: true },
      });
      continue;
    }

    await prisma.categoriaServico.create({
      data: {
        nome: categoria.nome,
        area: categoria.area,
        ativo: true,
      },
    });
  }

  console.log(`Seed concluído: ${categorias.length} categorias de serviço garantidas.`);

  const adminExistente = await prisma.usuario.findUnique({
    where: { email: ADMIN_INICIAL.email },
  });

  if (adminExistente) {
    console.log(`Usuário admin '${ADMIN_INICIAL.email}' já existe — nenhuma alteração feita.`);
    return;
  }

  const senhaHash = await bcrypt.hash(ADMIN_INICIAL.senha, SALT_ROUNDS);

  await prisma.usuario.create({
    data: {
      nome: ADMIN_INICIAL.nome,
      email: ADMIN_INICIAL.email,
      senhaHash,
      papel: 'admin',
      ativo: true,
    },
  });

  console.log('========================================================');
  console.log('Usuário admin inicial criado:');
  console.log(`  E-mail: ${ADMIN_INICIAL.email}`);
  if (ADMIN_INICIAL.senhaFoiGerada) {
    console.log(`  Senha (gerada agora, só aparece uma vez): ${ADMIN_INICIAL.senha}`);
  } else {
    console.log('  Senha: a definida em ADMIN_SEED_SENHA');
  }
  console.log('Anote essa senha agora e TROQUE assim que fizer o primeiro login.');
  console.log('========================================================');

  const slaDefaults = [
    { prioridade: 'baixa' as const, prazoHoras: 120 },
    { prioridade: 'normal' as const, prazoHoras: 48 },
    { prioridade: 'alta' as const, prazoHoras: 8 },
    { prioridade: 'urgente' as const, prazoHoras: 4 },
  ];
  for (const s of slaDefaults) {
    await prisma.slaConfig.upsert({
      where: { prioridade: s.prioridade },
      create: s,
      update: { prazoHoras: s.prazoHoras },
    });
  }
  console.log('Seed SlaConfig: 4 configurações de SLA garantidas.');
}

main()
  .catch((error) => {
    console.error('Erro ao rodar seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
