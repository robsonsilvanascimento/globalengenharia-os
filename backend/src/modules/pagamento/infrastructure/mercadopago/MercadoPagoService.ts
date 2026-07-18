import { MercadoPagoConfig, Payment } from 'mercadopago';

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN ?? '',
});

export interface PixGerado {
  mercadoPagoId: string;
  qrCode: string;
  copiaECola: string;
}

export async function gerarPixOrdemServico(params: {
  ordemServicoId: string;
  valor: number;
  clienteNome: string;
  clienteEmail?: string;
}): Promise<PixGerado> {
  const payment = new Payment(client);
  const result = await payment.create({
    body: {
      transaction_amount: params.valor,
      payment_method_id: 'pix',
      description: `OS #${params.ordemServicoId}`,
      payer: {
        email: params.clienteEmail ?? 'cliente@globalengenharia.com',
        first_name: params.clienteNome,
      },
      date_of_expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      external_reference: params.ordemServicoId,
      metadata: { ordem_servico_id: params.ordemServicoId },
    },
  });

  return {
    mercadoPagoId: String(result.id),
    qrCode: result.point_of_interaction?.transaction_data?.qr_code_base64 ?? '',
    copiaECola: result.point_of_interaction?.transaction_data?.qr_code ?? '',
  };
}

/**
 * Cancela um pagamento Pix no Mercado Pago. So funciona enquanto o pagamento
 * ainda esta pendente (Pix expira/cancela automaticamente); se o cliente ja
 * pagou, o Mercado Pago rejeita o cancelamento e o erro sobe para quem
 * chamou tratar (ex.: orientar a fazer um reembolso em vez de cancelamento).
 */
export async function cancelarPixOrdemServico(mercadoPagoId: string): Promise<void> {
  const payment = new Payment(client);
  await payment.cancel({ id: mercadoPagoId });
}

export { client as mercadoPagoClient };
