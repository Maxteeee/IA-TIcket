import { networkInterfaces } from 'node:os';
import { createApp } from './app.js';
import { createRepositories } from './repositories/index.js';
import { seedDemoData } from './data/demo.js';
import { seedReferenceData } from './data/reference.js';

const port = Number(process.env.PORT || 3000);
const repositories = createRepositories();
seedReferenceData(repositories);
if (process.argv.includes('--demo') || process.env.SEED_DEMO === 'true') {
  seedDemoData(repositories);
  console.log('Catálogo de prueba cargado en memoria');
}
const app = createApp({ repositories });

app.listen(port, '0.0.0.0', () => {
  console.log(`API local: http://localhost:${port}/api/health`);
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        console.log(`Para el celular: http://${address.address}:${port}/api`);
      }
    }
  }
});
