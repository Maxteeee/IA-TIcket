import { Router } from 'express';

export function createUsuariosRouter(controller) {
  const router = Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:id', controller.get);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.delete);
  router.get('/:id/favoritos', controller.listFavorites);
  router.put('/:id/favoritos/:eventoId', controller.addFavorite);
  router.delete('/:id/favoritos/:eventoId', controller.removeFavorite);
  router.get('/:id/resenias', controller.listReviews);
  router.get('/:id/reputacion', controller.reputation);
  return router;
}
