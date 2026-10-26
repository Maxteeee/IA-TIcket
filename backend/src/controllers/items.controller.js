import { itemsRepository } from '../repositories/items.repository.js';

export function listItems(_req, res) {
  res.json(itemsRepository.findAll());
}

export function createItem(req, res) {
  const name = req.body?.name;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
    return res.status(400).json({ message: 'El nombre debe tener entre 1 y 100 caracteres' });
  }
  res.status(201).json(itemsRepository.create(name.trim()));
}
