import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

/** Conteúdo do secret `oficina/plataforma/segredos`, criado pelo repositório de infra. */
export interface SegredosPlataforma {
  JWT_SECRET: string;
  INTERNAL_API_KEY: string;
}

const cliente = new SecretsManagerClient({});

// Resolvido uma vez por container e reaproveitado entre invocações.
let cache: SegredosPlataforma | undefined;

/**
 * Segredos da plataforma. Em teste/local, `JWT_SECRET` e `INTERNAL_API_KEY`
 * no ambiente dispensam o Secrets Manager.
 */
export async function obterSegredos(): Promise<SegredosPlataforma> {
  if (cache) return cache;

  const { JWT_SECRET, INTERNAL_API_KEY, SEGREDOS_NAME } = process.env;
  if (JWT_SECRET && INTERNAL_API_KEY) {
    cache = { JWT_SECRET, INTERNAL_API_KEY };
    return cache;
  }
  if (!SEGREDOS_NAME) {
    throw new Error('SEGREDOS_NAME (ou JWT_SECRET e INTERNAL_API_KEY) precisa estar configurado');
  }

  const resposta = await cliente.send(new GetSecretValueCommand({ SecretId: SEGREDOS_NAME }));
  if (!resposta.SecretString) throw new Error('Secret sem conteudo');

  cache = JSON.parse(resposta.SecretString) as SegredosPlataforma;
  return cache;
}

export async function obterSegredoJwt(): Promise<string> {
  return (await obterSegredos()).JWT_SECRET;
}
