import jwt from 'jsonwebtoken';
import type { APIGatewayProxyEventV2, APIGatewayRequestAuthorizerEventV2 } from 'aws-lambda';

const SEGREDO = 'segredo-de-teste';
process.env.JWT_SECRET = SEGREDO;
process.env.INTERNAL_API_KEY = 'chave-interna-teste';

jest.mock('../src/infrastructure/clientes.repository', () => ({ buscarPorDocumento: jest.fn() }));

import { handler as authorizer } from '../src/handlers/authorizer';
import { handler as token } from '../src/handlers/token';
import { isCpfValido } from '../src/domain/cpf';
import { log } from '../src/infrastructure/log';
import { buscarPorDocumento } from '../src/infrastructure/clientes.repository';
import * as segredos from '../src/infrastructure/segredos';

const buscar = buscarPorDocumento as jest.MockedFunction<typeof buscarPorDocumento>;

describe('casos de borda', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('CPF com o primeiro dígito verificador errado é inválido', () => {
    expect(isCpfValido('529.982.247-35')).toBe(false);
  });

  it('log sem contexto extra ainda sai em JSON', () => {
    log.info('só a mensagem');
    expect(JSON.parse((console.log as jest.Mock).mock.calls[0][0])).toMatchObject({ mensagem: 'só a mensagem' });
  });

  describe('authorizer', () => {
    const evento = (headers: Record<string, string>, comContexto = true) =>
      ({ routeKey: 'GET /x', headers, ...(comContexto ? { requestContext: { requestId: 'r' } } : {}) }) as unknown as APIGatewayRequestAuthorizerEventV2;

    it('aceita o header Authorization com maiúscula e token sem username', async () => {
      const t = jwt.sign({ sub: 'c-1' }, SEGREDO);
      const r = await authorizer(evento({ Authorization: `Bearer ${t}` }, false));
      expect(r).toEqual({ isAuthorized: true, context: { clienteId: 'c-1', username: '' } });
    });

    it('nega com "falha inesperada" quando o segredo não está disponível', async () => {
      jest.spyOn(segredos, 'obterSegredoJwt').mockRejectedValueOnce(new Error('Secrets Manager fora'));
      const r = await authorizer(evento({ authorization: 'Bearer qualquer' }));
      expect(r.isAuthorized).toBe(false);
      expect((console.log as jest.Mock).mock.calls.at(-1)[0]).toContain('falha inesperada');
    });
  });

  describe('token', () => {
    const evento = (body?: string, comContexto = true) =>
      ({ body, ...(comContexto ? { requestContext: { requestId: 'r' } } : {}) }) as unknown as APIGatewayProxyEventV2;

    it('corpo ausente vira CPF inválido (400), mesmo sem requestContext', async () => {
      const r = await token(evento(undefined, false));
      expect(r).toMatchObject({ statusCode: 400 });
    });

    it('erro que não é Error vira 500 com a mensagem convertida', async () => {
      buscar.mockRejectedValueOnce('os-service fora');
      const r = await token(evento(JSON.stringify({ cpf: '529.982.247-25' })));
      expect(r).toMatchObject({ statusCode: 500 });
      expect((console.error as jest.Mock).mock.calls.at(-1)[0]).toContain('os-service fora');
    });
  });
});
