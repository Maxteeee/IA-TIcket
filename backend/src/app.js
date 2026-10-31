import express from 'express';
import itemsRouter from './routes/items.routes.js';
import { DomainError } from './domain/DomainError.js';
import { createRepositories } from './repositories/index.js';
import { createServices } from './services/index.js';
import { createUsuariosController } from './controllers/usuarios.controller.js';
import { createCategoriasController } from './controllers/categorias.controller.js';
import { createEventosController } from './controllers/eventos.controller.js';
import { createComprasController } from './controllers/compras.controller.js';
import { createReseniasController } from './controllers/resenias.controller.js';
import { createUsuariosRouter } from './routes/usuarios.routes.js';
import { createCategoriasRouter } from './routes/categorias.routes.js';
import { createEventosRouter } from './routes/eventos.routes.js';
import { createComprasRouter } from './routes/compras.routes.js';
import { createReseniasRouter } from './routes/resenias.routes.js';

export function createApp({ repositories = createRepositories(), now = () => new Date() } = {}) {
  const app = express();
  const clock = { now };
  const services = createServices(repositories, clock);
  const comprasController = createComprasController(services.compras, clock);
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', message: 'Backend conectado' });
  });
  app.use('/api/items', itemsRouter);
  app.use('/api/usuarios', createUsuariosRouter(createUsuariosController(services.usuarios, clock)));
  app.use('/api/categorias', createCategoriasRouter(createCategoriasController(services.categorias)));
  app.use('/api/eventos', createEventosRouter(createEventosController(services.eventos, clock), comprasController));
  app.use('/api/compras', createComprasRouter(comprasController));
  app.use('/api/resenias', createReseniasRouter(createReseniasController(services.resenias)));

  app.use((_req, res) => {
    res.status(404).json({ message: 'Ruta no encontrada' });
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof DomainError) return res.status(error.status).json({ message: error.message });
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ message: 'El cuerpo debe ser JSON válido' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ message: 'El cuerpo es demasiado grande' });
    }
    console.error(error);
    res.status(500).json({ message: 'Error interno del servidor' });
  });
  return app;
}

export default createApp();
