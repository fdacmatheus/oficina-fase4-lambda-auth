import { apenasDigitos } from '../domain/cpf';
import { obterSegredos } from './segredos';

export interface ClienteEncontrado {
  id: string;
  nome: string;
  documento: string;
  email: string | null;
  ativo: boolean;
}

/**
 * Consulta o cliente no os-service, dono dos dados de cliente.
 *
 * Na fase 3 esta função lia a tabela direto no RDS. Na fase 4 cada serviço tem
 * banco próprio, então a Lambda chama a rota interna do os-service pelo NLB
 * interno (a função roda dentro da VPC), autenticando com a chave interna.
 */
export async function buscarPorDocumento(documento: string): Promise<ClienteEncontrado | null> {
  const base = process.env.OS_SERVICE_URL;
  if (!base) throw new Error('OS_SERVICE_URL nao configurada');

  const { INTERNAL_API_KEY } = await obterSegredos();
  const resposta = await fetch(
    `${base.replace(/\/$/, '')}/api/internos/clientes/documento/${apenasDigitos(documento)}`,
    { headers: { 'x-chave-interna': INTERNAL_API_KEY }, signal: AbortSignal.timeout(3000) },
  );

  if (resposta.status === 404) return null;
  if (!resposta.ok) throw new Error(`os-service respondeu ${resposta.status}`);

  const cliente = (await resposta.json()) as Omit<ClienteEncontrado, 'ativo'>;
  return { ...cliente, ativo: true };
}
