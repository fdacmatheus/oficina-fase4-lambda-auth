const enviar = jest.fn();

jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn(() => ({ send: enviar })),
  GetSecretValueCommand: jest.fn((input: unknown) => ({ input })),
}));

describe('segredos da plataforma', () => {
  beforeEach(() => {
    jest.resetModules();
    enviar.mockReset();
    delete process.env.JWT_SECRET;
    delete process.env.INTERNAL_API_KEY;
    delete process.env.SEGREDOS_NAME;
  });

  const importar = () => import('../src/infrastructure/segredos');

  it('usa as variáveis de ambiente quando as duas existem, sem chamar a AWS', async () => {
    process.env.JWT_SECRET = 'jwt-local';
    process.env.INTERNAL_API_KEY = 'chave-local';
    const { obterSegredos, obterSegredoJwt } = await importar();
    await expect(obterSegredos()).resolves.toEqual({ JWT_SECRET: 'jwt-local', INTERNAL_API_KEY: 'chave-local' });
    await expect(obterSegredoJwt()).resolves.toBe('jwt-local');
    expect(enviar).not.toHaveBeenCalled();
  });

  it('busca o secret da plataforma uma vez por container', async () => {
    process.env.SEGREDOS_NAME = 'oficina/plataforma/segredos';
    enviar.mockResolvedValue({ SecretString: JSON.stringify({ JWT_SECRET: 'j', INTERNAL_API_KEY: 'k' }) });
    const { obterSegredos } = await importar();
    await obterSegredos();
    await expect(obterSegredos()).resolves.toEqual({ JWT_SECRET: 'j', INTERNAL_API_KEY: 'k' });
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0][0].input).toEqual({ SecretId: 'oficina/plataforma/segredos' });
  });

  it('só JWT_SECRET no ambiente não basta: vai ao Secrets Manager', async () => {
    process.env.JWT_SECRET = 'só-o-jwt';
    const { obterSegredos } = await importar();
    await expect(obterSegredos()).rejects.toThrow('SEGREDOS_NAME');
  });

  it('falha quando o secret volta vazio', async () => {
    process.env.SEGREDOS_NAME = 'x';
    enviar.mockResolvedValue({});
    const { obterSegredos } = await importar();
    await expect(obterSegredos()).rejects.toThrow('Secret sem conteudo');
  });
});
