import { Router } from 'express';

export function createComprasRouter(controller) {
  const router = Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:id', controller.get);
  router.patch('/:id/estado', controller.updateState);
  router.get('/:id/mensajes', controller.listMessages);
  router.post('/:id/mensajes', controller.addMessage);
  router.get('/:id/historial', controller.listHistory);
  return router;
}
