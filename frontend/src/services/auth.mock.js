import { RolUsuario } from '../session/roles.js';

const profiles = [
  { usuario: { id: 'comprador-1', nombre: 'Comprador 1', initials: 'C1' }, roles: [RolUsuario.COMPRADOR] },
  { usuario: { id: 'organizador-1', nombre: 'Organizador 1', initials: 'O1' }, roles: [RolUsuario.COMPRADOR, RolUsuario.ORGANIZADOR] },
];

// Simula el contrato de una sesión. Los IDs son fixtures locales, todavía sin API.
export const authMock = {
  getSession(profileId = 'comprador-1') {
    const profile = profiles.find((item) => item.usuario.id === profileId);
    if (!profile) throw new Error('Perfil de prueba no encontrado');
    return { usuario: { ...profile.usuario }, roles: [...profile.roles] };
  },
  getNextSession(profileId) {
    const index = profiles.findIndex((item) => item.usuario.id === profileId);
    if (index === -1) throw new Error('Perfil de prueba no encontrado');
    return this.getSession(profiles[(index + 1) % profiles.length].usuario.id);
  },
};
