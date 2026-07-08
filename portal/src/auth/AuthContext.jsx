import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { api, getToken, setToken } from "../api/client";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    (async () => {
      try {
        const [{ user }, ctx] = await Promise.all([api.me(), api.context()]);
        setUser(user); setContext(ctx);
      } catch {
        setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(logon, passphrase) {
    const { token, user } = await api.login(logon, passphrase);
    setToken(token);
    setUser(user);
    const ctx = await api.context();
    setContext(ctx);
    return user;
  }
  function logout() { setToken(null); setUser(null); setContext(null); }

  const value = useMemo(() => ({ user, context, loading, login, logout, refreshContext: async () => setContext(await api.context()) }), [user, context, loading]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
