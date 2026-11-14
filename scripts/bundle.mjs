import { build } from 'esbuild';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// Cada handler vira um zip independente e autocontido (sem dependência
// nativa): a função de token chama o os-service por HTTP e a authorizer só
// verifica a assinatura do JWT.
const handlers = [
  { nome: 'token', externals: [] },
  { nome: 'authorizer', externals: [] },
];

rmSync('build', { recursive: true, force: true });

for (const { nome, externals } of handlers) {
  const saida = `build/${nome}`;
  mkdirSync(saida, { recursive: true });

  await build({
    entryPoints: [`src/handlers/${nome}.ts`],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: `${saida}/index.js`,
    minify: true,
    sourcemap: false,
    // O runtime Node da Lambda ja fornece o AWS SDK v3.
    external: ['@aws-sdk/*', ...externals],
  });

  if (externals.length > 0) {
    writeFileSync(
      `${saida}/package.json`,
      JSON.stringify({ name: `oficina-auth-${nome}`, private: true }, null, 2),
    );
    execSync(`npm install --prefix ${saida} --silent --no-audit --no-fund ${externals.join(' ')}`, {
      stdio: 'inherit',
    });
  }

  execSync(`cd ${saida} && zip -qr ../${nome}.zip .`, { stdio: 'inherit' });
  console.log(`empacotado: build/${nome}.zip`);
}
