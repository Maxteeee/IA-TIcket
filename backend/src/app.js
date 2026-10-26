import express from 'express';
import itemsRouter from './routes/items.routes.js';

const app = express();
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Backend conectado' });
});
app.use('/api/items', itemsRouter);

app.use((_req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

app.use((error, _req, res, _next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'El cuerpo debe ser JSON válido' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'El cuerpo es demasiado grande' });
  }
  console.error(error);
  res.status(500).json({ message: 'Error interno del servidor' });
});

export default app;
