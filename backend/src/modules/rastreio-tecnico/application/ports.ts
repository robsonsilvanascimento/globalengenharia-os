/** Dados minimos da OS que o rastreio precisa (evita acoplar ao repo completo). */
export interface OSParaRastreio {
  id: string;
  tecnicoId: string | null;
  clienteId: string;
  numero: string;
  latitude: number | null;
  longitude: number | null;
}

export interface BuscarOSParaRastreio {
  buscar(id: string): Promise<OSParaRastreio | null>;
}

/** Usuario que dispara a acao (para autorizacao). */
export interface AtorRastreio {
  id: string;
  papel: string;
}

/** Notifica o cliente (via WhatsApp) que o tecnico esta a caminho. */
export type NotificarClienteACaminho = (dados: { ordemServicoId: string; clienteId: string }) => Promise<void>;
