import { describe, expect, it, vi } from 'vitest';
import { ListarOrdensServicoUseCase } from '../../../ordens-servico/application/ListarOrdensServicoUseCase';
import { criarOrdemServicoFake, FakeOrdemServicoRepository } from '../../../ordens-servico/application/__tests__/fakes';
import {
  ConsultarPagamentoViaWhatsappUseCase,
  type BuscarPagamentoDaOSFn,
  type ResultadoPagamentoOS,
} from '../ConsultarPagamentoViaWhatsappUseCase';

function montarUseCase(buscarPagamentoDaOS: BuscarPagamentoDaOSFn = vi.fn()) {
  const ordemServicoRepository = new FakeOrdemServicoRepository();
  const listarOrdensServicoUseCase = new ListarOrdensServicoUseCase({ ordemServicoRepository });
  const useCase = new ConsultarPagamentoViaWhatsappUseCase({
    ordemServicoRepository,
    listarOrdensServicoUseCase,
    buscarPagamentoDaOS,
  });

  return { useCase, ordemServicoRepository };
}

function mensagemDe(respostas: Awaited<ReturnType<ConsultarPagamentoViaWhatsappUseCase['execute']>>): string {
  return respostas[0]?.tipo === 'texto' ? respostas[0].mensagem : '';
}

describe('ConsultarPagamentoViaWhatsappUseCase', () => {
  it('informa que nao encontrou quando o numero informado nao existe', async () => {
    const { useCase } = montarUseCase();

    const respostas = await useCase.execute({ clienteId: 'cliente-1', intencao: { numeroOS: 'OS-2026-999999' } });

    expect(mensagemDe(respostas).toLowerCase()).toContain('nao encontramos');
  });

  it('nega a consulta quando a OS pertence a outro cliente (sem vazar dados)', async () => {
    const { useCase, ordemServicoRepository } = montarUseCase();
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: 'os-1', numero: 'OS-2026-000999', clienteId: 'cliente-outro' }),
    );

    const respostas = await useCase.execute({ clienteId: 'cliente-1', intencao: { numeroOS: 'OS-2026-000999' } });

    expect(mensagemDe(respostas).toLowerCase()).toContain('nao encontramos');
    expect(mensagemDe(respostas)).not.toContain('cliente-outro');
  });

  it('avisa que a OS ainda esta em andamento quando nao esta concluida', async () => {
    const buscarPagamentoDaOS = vi.fn();
    const { useCase, ordemServicoRepository } = montarUseCase(buscarPagamentoDaOS);
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: 'os-1', numero: 'OS-2026-000001', clienteId: 'cliente-1', status: 'em_andamento' }),
    );

    const respostas = await useCase.execute({ clienteId: 'cliente-1', intencao: { numeroOS: 'OS-2026-000001' } });

    expect(mensagemDe(respostas)).toContain('OS-2026-000001');
    expect(mensagemDe(respostas).toLowerCase()).toContain('ainda esta em andamento');
    expect(buscarPagamentoDaOS).not.toHaveBeenCalled();
  });

  it('informa que a OS ja esta paga', async () => {
    const buscarPagamentoDaOS = vi.fn<BuscarPagamentoDaOSFn>().mockResolvedValue({ statusPagamento: 'pago' });
    const { useCase, ordemServicoRepository } = montarUseCase(buscarPagamentoDaOS);
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: 'os-1', numero: 'OS-2026-000001', clienteId: 'cliente-1', status: 'concluida' }),
    );

    const respostas = await useCase.execute({ clienteId: 'cliente-1', intencao: { numeroOS: 'OS-2026-000001' } });

    expect(mensagemDe(respostas).toLowerCase()).toContain('ja esta paga');
  });

  it('informa que o valor ainda esta sendo definido quando a OS concluida nao tem valor cobrado', async () => {
    const buscarPagamentoDaOS = vi.fn<BuscarPagamentoDaOSFn>().mockResolvedValue({ statusPagamento: 'sem_valor' });
    const { useCase, ordemServicoRepository } = montarUseCase(buscarPagamentoDaOS);
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: 'os-1', numero: 'OS-2026-000001', clienteId: 'cliente-1', status: 'concluida' }),
    );

    const respostas = await useCase.execute({ clienteId: 'cliente-1', intencao: { numeroOS: 'OS-2026-000001' } });

    expect(mensagemDe(respostas).toLowerCase()).toContain('valor ainda esta sendo definido');
  });

  it('devolve o valor e o codigo Pix quando o pagamento esta pendente', async () => {
    const resultado: ResultadoPagamentoOS = {
      statusPagamento: 'pendente',
      valor: 150,
      pixCopiaECola: '00020126...copia-e-cola-fake',
    };
    const buscarPagamentoDaOS = vi.fn<BuscarPagamentoDaOSFn>().mockResolvedValue(resultado);
    const { useCase, ordemServicoRepository } = montarUseCase(buscarPagamentoDaOS);
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: 'os-1', numero: 'OS-2026-000001', clienteId: 'cliente-1', status: 'concluida' }),
    );

    const respostas = await useCase.execute({ clienteId: 'cliente-1', intencao: { numeroOS: 'OS-2026-000001' } });

    const mensagem = mensagemDe(respostas);
    expect(mensagem).toContain('OS-2026-000001');
    expect(mensagem).toContain('150');
    expect(mensagem).toContain('00020126...copia-e-cola-fake');
  });

  it('sem numero informado: avisa quando nao ha nenhuma OS concluida', async () => {
    const { useCase, ordemServicoRepository } = montarUseCase();
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: 'os-1', numero: 'OS-2026-000001', clienteId: 'cliente-1', status: 'em_andamento' }),
    );

    const respostas = await useCase.execute({ clienteId: 'cliente-1', intencao: {} });

    expect(mensagemDe(respostas).toLowerCase()).toContain('nao possui nenhuma');
  });

  it('sem numero informado: usa a OS concluida encontrada', async () => {
    const buscarPagamentoDaOS = vi.fn<BuscarPagamentoDaOSFn>().mockResolvedValue({ statusPagamento: 'pago' });
    const { useCase, ordemServicoRepository } = montarUseCase(buscarPagamentoDaOS);
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: 'os-1', numero: 'OS-2026-000001', clienteId: 'cliente-1', status: 'em_andamento' }),
    );
    ordemServicoRepository.seed(
      criarOrdemServicoFake({ id: 'os-2', numero: 'OS-2026-000002', clienteId: 'cliente-1', status: 'concluida' }),
    );

    const respostas = await useCase.execute({ clienteId: 'cliente-1', intencao: {} });

    expect(mensagemDe(respostas)).toContain('OS-2026-000002');
  });
});
