import { networkInterfaces } from 'node:os';
import app from './app.js';

const port = Number(process.env.PORT || 3000);

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
