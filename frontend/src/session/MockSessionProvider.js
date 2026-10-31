import { createContext, useContext, useState } from 'react';
import { authMock } from '../services/auth.mock.js';

const SessionContext = createContext(null);

export function MockSessionProvider({ children }) {
  const [session, setSession] = useState(() => authMock.getSession());
  const nextSession = authMock.getNextSession(session.usuario.id);
  const switchProfile = () => setSession((current) => authMock.getNextSession(current.usuario.id));

  return <SessionContext.Provider value={{ session, nextSession, switchProfile }}>{children}</SessionContext.Provider>;
}

export function useMockSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('La sesión debe usarse dentro de MockSessionProvider');
  return context;
}
