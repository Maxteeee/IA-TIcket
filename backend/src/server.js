import { networkInterfaces, release } from 'node:os';
import { createApp } from './app.js';
import { createRepositories } from './repositories/index.js';
import { seedReferenceData } from './data/reference.js';

const port = Number(process.env.PORT || 3000);
const repositories = createRepositories();
seedReferenceData(repositories);
const app = createApp({ repositories });

app.listen(port, '0.0.0.0', () => {
  console.log(`API local: http://localhost:${port}/api/health`);
  const publicApiUrl = process.env.PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  const inWsl = Boolean(process.env.WSL_DISTRO_NAME) || release().toLowerCase().includes('microsoft');
  if (publicApiUrl) console.log(`Para el celular: ${publicApiUrl}`);
  if (inWsl) {
    console.log('WSL: para acceder desde el celular, usá la IP de Windows con el puerto reenviado a WSL y permitido en el firewall de la red local.');
    if (!publicApiUrl) console.log('Configurá PUBLIC_API_URL en backend/.env con esa dirección; las IP internas de WSL no indican acceso desde el celular.');
  }
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        console.log(`${inWsl ? 'API interna WSL' : 'API de red local'}: http://${address.address}:${port}/api`);
      }
    }
  }
});
