// Niche configs são dados estáticos em packages/shared/niche-configs/
// Não há seed de banco para niche configs no v1.
// Os pipeline_stages são criados dinamicamente no registro de cada org (auth/register).

async function main(): Promise<void> {
  console.log('Seed: niche configs are static — see packages/shared/niche-configs/');
  console.log('Pipeline stages are created per-org during registration.');
}

main();
