import { describe, expect, it } from 'vitest';
import { ListarOrdensServicoUseCase } from '../../../ordens-servico/application/ListarOrdensServicoUseCase';
import { criarOrdemServicoFake, FakeOrdemServicoRepository } from '../../../ordens-servico/application/__tests__/fakes';
import { ConsultarStatusOSViaWhatsappUseCase } from '../ConsultarStatusOSViaWhatsappUseCase';

function montarUseCase() {
  const ordemServicoRepository = new FakeOrdemServicoRepository();
  const listarOrdensServicoUseCase = new ListarOrdensServicoUseCase({ ordemServicoRepository });
  const useCase = new ConsultarStatusOSViaWhatsappUseCase({
    ordemServicoRepository,
    listarOrdensServicoUseCase,
  });

  return { useCase, ordemServicoRepository };
}

describe('ConsultarStatusOSViaWhatsappUseCase', () => {
  it('responde com o detalhe da OS quando o numero informado existe e pertence ao cliente', async () => {
    const { useCase, ordemServicoRepository } = montarUseCase();
    ordemServicoRepository.seed(
      criarOrdemServicoFake({
        id: 'os-1',
        numero: 'OS-2026-000123',
        clienteId: 'cliente-1',
        status: 'em_andamento',
        tecnicoId: 'tecnico-1',
      }),
    );

    const respostas = await useCase.execute({
      clienteId: 'cliente-1',
      intencao: { numeroOS: 'OS-2026-000123' },
    });

    expect(respostas).toHaveLength(1);
    expect(respostas[0]).toMatchObject({ tipo: 'texto' });
    const mensagem = respostas[0].tipo === 'texto' ? respostas[0].mensagem : '';
    expect(mensagem).toContain('OS-2026-000123');
    expect(mensagem).toContain('Em andamento');
  });

  it('resolve o numero informado apenas com digitos (sem prefixo OS-AAAA-)', async () => {
    const { useCase, ordemServicoRepository } = montarUseCase();
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: 'os-1', numero: 'OS-2026-000123', clienteId: 'cliente-1', status: 'aberta' }),
    );

    const respostas = await useCase.execute({ clienteId: 'cliente-1', intencao: { numeroOS: '123' } });

    const mensagem = respostas[0].tipo === 'texto' ? respostas[0].mensagem : '';
    expect(mensagem).toContain('OS-2026-000123');
  });

  it('nega a consulta quando a OS existe mas pertence a outro cliente (sem vazar dados)', async () => {
    const { useCase, ordemServicoRepository } = montarUseCase();
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: 'os-1', numero: 'OS-2026-000999', clienteId: 'cliente-outro' }),
    );

    const respostas = await useCase.execute({
      clienteId: 'cliente-1',
      intencao: { numeroOS: 'OS-2026-000999' },
    });

    expect(respostas).toHaveLength(1);
    const mensagem = respostas[0].tipo === 'texto' ? respostas[0].mensagem : '';
    expect(mensagem.toLowerCase()).toContain('nao encontramos');
    expect(mensagem).not.toContain('cliente-outro');
  });

  it('informa que nao encontrou quando o numero nao existe', async () => {
    const { useCase } = montarUseCase();

    const respostas = await useCase.execute({
      clienteId: 'cliente-1',
      intencao: { numeroOS: 'OS-2026-999999' },
    });

    const mensagem = respostas[0].tipo === 'texto' ? respostas[0].mensagem : '';
    expect(mensagem.toLowerCase()).toContain('nao encontramos');
  });

  it('sem numero informado: avisa que nao ha OS em aberto quando o cliente nao tem nenhuma ativa', async () => {
    const { useCase, ordemServicoRepository } = montarUseCase();
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: 'os-1', numero: 'OS-2026-000001', clienteId: 'cliente-1', status: 'concluida' }),
    );

    const respostas = await useCase.execute({ clienteId: 'cliente-1', intencao: {} });

    const mensagem = respostas[0].tipo === 'texto' ? respostas[0].mensagem : '';
    expect(mensagem.toLowerCase()).toContain('nao possui nenhuma');
  });

  it('sem numero informado: responde direto quando ha exatamente uma OS ativa', async () => {
    const { useCase, ordemServicoRepository } = montarUseCase();
    ordemServicoRepository.seed(
      criarOrdemServicoFake({
        id: 'os-1',
        numero: 'OS-2026-000001',
        clienteId: 'cliente-1',
        status: 'triagem',
      }),
    );
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: 'os-2', numero: 'OS-2026-000002', clienteId: 'cliente-1', status: 'concluida' }),
    );

    const respostas = await useCase.execute({ clienteId: 'cliente-1', intencao: {} });

    expect(respostas).toHaveLength(1);
    const mensagem = respostas[0].tipo === 'texto' ? respostas[0].mensagem : '';
    expect(mensagem).toContain('OS-2026-000001');
    expect(mensagem).not.toContain('OS-2026-000002');
  });

  it('sem numero informado: lista resumidamente quando ha multiplas OS ativas', async () => {
    const { useCase, ordemServicoRepository } = montarUseCase();
    ordemServicoRepository.seed(
      criarOrdemServicoFake({
        id: 'os-1',
        numero: 'OS-2026-000001',
        clienteId: 'cliente-1',
        status: 'aberta',
        descricaoProblema: 'Chuveiro nao esquenta',
      }),
    );
    ordemServicoRepository.seed(
      criarOrdemServicoFake({
        id: 'os-2',
        numero: 'OS-2026-000002',
        clienteId: 'cliente-1',
        status: 'em_andamento',
        descricaoProblema: 'Disjuntor desarmando',
      }),
    );

    const respostas = await useCase.execute({ clienteId: 'cliente-1', intencao: {} });

    expect(respostas).toHaveLength(1);
    const mensagem = respostas[0].tipo === 'texto' ? respostas[0].mensagem : '';
    expect(mensagem).toContain('OS-2026-000001');
    expect(mensagem).toContain('OS-2026-000002');
    expect(mensagem.toLowerCase()).toContain('informe o numero');
  });
});
