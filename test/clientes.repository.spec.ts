import { buscarPorDocumento } from '../src/infrastructure/clientes.repository';

jest.mock('../src/infrastructure/segredos', () => ({
  obterSegredos: jest.fn().mockResolvedValue({ JWT_SECRET: 'j', INTERNAL_API_KEY: 'chave-interna' }),
}));

describe('buscarPorDocumento (os-service)', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
    process.env.OS_SERVICE_URL = 'http://os-nlb.interno/';
  });

  it('chama a rota interna com o CPF sem máscara e a chave interna', async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ id: 'c-1', nome: 'João', documento: '52998224725', email: null }),
    });
    await expect(buscarPorDocumento('529.982.247-25')).resolves.toEqual({
      id: 'c-1',
      nome: 'João',
      documento: '52998224725',
      email: null,
      ativo: true,
    });
    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(url).toBe('http://os-nlb.interno/api/internos/clientes/documento/52998224725');
    expect(opcoes.headers).toEqual({ 'x-chave-interna': 'chave-interna' });
    expect(opcoes.signal).toBeInstanceOf(AbortSignal);
  });

  it('404 vira cliente inexistente', async () => {
    fetchMock.mockResolvedValue({ status: 404, ok: false });
    await expect(buscarPorDocumento('52998224725')).resolves.toBeNull();
  });

  it('outros erros do os-service sobem', async () => {
    fetchMock.mockResolvedValue({ status: 503, ok: false });
    await expect(buscarPorDocumento('52998224725')).rejects.toThrow('os-service respondeu 503');
  });

  it('falha sem OS_SERVICE_URL', async () => {
    delete process.env.OS_SERVICE_URL;
    await expect(buscarPorDocumento('52998224725')).rejects.toThrow('OS_SERVICE_URL');
  });
});
