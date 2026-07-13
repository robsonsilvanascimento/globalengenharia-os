import { OrdemServicoForm } from './OrdemServicoForm';
import './OrdemServicoCreatePage.css';

/** Page for creating a new Ordem de Serviço (atendente/admin only). */
export function OrdemServicoCreatePage() {
  return (
    <div className="os-create-page">
      <h1 className="os-create-page-title">Nova ordem de serviço</h1>
      <OrdemServicoForm modo="criar" />
    </div>
  );
}
