import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setCsrfToken, setUnauthorizedHandler } from '../lib/api.js';
import { LANGS, dirFor, translate } from '../i18n.js';

const AppContext = createContext(null);

const LANG_KEY = 'bc_lang';
const THEME_KEY = 'bc_theme';
const CITY_KEY = 'bc_city';
const RECENT_KEY = 'bc_recent_searches';

function readLocal(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage may be blocked */
  }
}

export function AppProvider({ children }) {
  const initialLang = (() => {
    const stored = readLocal(LANG_KEY);
    if (stored && LANGS.some((l) => l.code === stored)) return stored;
    const nav = navigator.language?.slice(0, 2);
    if (nav === 'fr') return 'fr';
    if (nav === 'en') return 'en';
    return 'ar';
  })();

  const [lang, setLangState] = useState(initialLang);
  const [theme, setThemeState] = useState(() => readLocal(THEME_KEY, 'light'));
  const [user, setUser] = useState(null);
  const [booted, setBooted] = useState(false);
  const [cities, setCities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cityId, setCityIdState] = useState(() => {
    const v = readLocal(CITY_KEY);
    return v ? Number(v) : null;
  });
  const [unread, setUnread] = useState({ notifications: 0, messages: 0 });
  const [toasts, setToasts] = useState([]);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      return JSON.parse(readLocal(RECENT_KEY, '[]')) || [];
    } catch {
      return [];
    }
  });
  const [geoCoords, setGeoCoords] = useState(null);
  const esRef = useRef(null);
  const listenersRef = useRef(new Set());

  /* ---------------- i18n ---------------- */
  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);
  const dir = dirFor(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    writeLocal(LANG_KEY, lang);
  }, [lang, dir]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeLocal(THEME_KEY, theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0c1716' : '#0f7b6c');
  }, [theme]);

  const setLang = useCallback(
    async (next) => {
      setLangState(next);
      if (user) {
        try {
          await api.patch('/auth/me', { locale: next });
        } catch {
          /* non-blocking */
        }
      }
    },
    [user],
  );

  const toggleTheme = useCallback(() => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark')), []);

  /* ---------------- toasts ---------------- */
  const toast = useCallback((message, type = 'info', timeout = 4000) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    if (timeout) setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), timeout);
  }, []);

  const dismissToast = useCallback((id) => setToasts((prev) => prev.filter((x) => x.id !== id)), []);

  /* ---------------- error translation ---------------- */
  const errorMessage = useCallback(
    (err) => {
      if (!err) return t('common.error');
      if (err.code === 'network_error') return t('common.offline');
      const key = `errors.${err.code || err.message}`;
      const translated = t(key);
      if (translated !== key) return translated;
      if (err.message && typeof err.message === 'string' && err.message.includes('.')) {
        const key2 = `errors.${err.message}`;
        const t2 = t(key2);
        if (t2 !== key2) return t2;
      }
      return t('common.error');
    },
    [t],
  );

  /* ---------------- session ---------------- */
  const refreshSession = useCallback(async () => {
    const data = await api.get('/session');
    setCsrfToken(data.csrfToken);
    setUser(data.user);
    return data.user;
  }, []);

  const refreshCounts = useCallback(async () => {
    try {
      const counts = await api.get('/notifications/unread-count');
      setUnread({ notifications: counts.notifications, messages: counts.messages });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    (async () => {
      try {
        await refreshSession();
      } catch {
        /* offline */
      } finally {
        setBooted(true);
      }
    })();
  }, [refreshSession]);

  useEffect(() => {
    if (user) refreshCounts();
    else setUnread({ notifications: 0, messages: 0 });
  }, [user, refreshCounts]);

  // Initial reference data
  useEffect(() => {
    Promise.all([api.get('/geo/cities'), api.get('/categories')])
      .then(([c, cat]) => {
        setCities(c.items);
        setCategories(cat.items);
      })
      .catch(() => {});
  }, []);

  /* ---------------- realtime (SSE) ---------------- */
  const listeners = listenersRef.current;
  const emit = useCallback((type, payload) => {
    for (const fn of listeners) fn(type, payload);
  }, [listeners]);

  const subscribeEvents = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  useEffect(() => {
    if (!user) {
      esRef.current?.close();
      esRef.current = null;
      return undefined;
    }
    let closed = false;
    let retry = 0;
    const connect = () => {
      if (closed) return;
      const es = new EventSource('/api/notifications/stream', { withCredentials: true });
      esRef.current = es;
      es.addEventListener('message', (e) => {
        try {
          const data = JSON.parse(e.data);
          emit('message', data);
          refreshCounts();
        } catch {
          /* ignore */
        }
      });
      es.addEventListener('notification', (e) => {
        try {
          emit('notification', JSON.parse(e.data));
          refreshCounts();
        } catch {
          /* ignore */
        }
      });
      es.addEventListener('conversation', () => refreshCounts());
      es.addEventListener('read', (e) => {
        try {
          emit('read', JSON.parse(e.data));
        } catch {
          /* ignore */
        }
      });
      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (closed) return;
        retry = Math.min(retry + 1, 6);
        setTimeout(connect, 1000 * retry);
      };
    };
    connect();
    return () => {
      closed = true;
      esRef.current?.close();
      esRef.current = null;
    };
  }, [user, emit, refreshCounts]);

  /* ---------------- auth actions ---------------- */
  const login = useCallback(
    async (identifier, password) => {
      const data = await api.post('/auth/login', { identifier, password });
      setCsrfToken(data.csrfToken);
      setUser(data.user);
      refreshCounts();
      return data.user;
    },
    [refreshCounts],
  );

  const register = useCallback(async (payload) => {
    const data = await api.post('/auth/register', payload);
    setCsrfToken(data.csrfToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      const data = await api.post('/auth/logout', {});
      if (data?.csrfToken) setCsrfToken(data.csrfToken);
    } catch {
      /* ignore */
    }
    setUser(null);
    esRef.current?.close();
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  /* ---------------- city & search memory ---------------- */
  const setCity = useCallback((id) => {
    setCityIdState(id);
    if (id) writeLocal(CITY_KEY, String(id));
    else localStorage.removeItem(CITY_KEY);
  }, []);

  const activeCity = useMemo(() => cities.find((c) => c.id === cityId) || null, [cities, cityId]);

  const rememberSearch = useCallback((term) => {
    const clean = String(term || '').trim();
    if (clean.length < 2) return;
    setRecentSearches((prev) => {
      const next = [clean, ...prev.filter((x) => x !== clean)].slice(0, 8);
      writeLocal(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const requestGeolocation = useCallback(
    () =>
      new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('unsupported'));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setGeoCoords(coords);
            resolve(coords);
          },
          (err) => reject(err),
          { timeout: 8000, maximumAge: 300000 },
        );
      }),
    [],
  );

  const value = useMemo(
    () => ({
      lang,
      dir,
      setLang,
      t,
      theme,
      toggleTheme,
      user,
      booted,
      login,
      register,
      logout,
      updateUser,
      refreshSession,
      cities,
      activeCity,
      cityId,
      setCity,
      categories,
      unread,
      refreshCounts,
      toast,
      toasts,
      dismissToast,
      errorMessage,
      subscribeEvents,
      recentSearches,
      rememberSearch,
      requestGeolocation,
      geoCoords,
    }),
    [
      lang, dir, setLang, t, theme, toggleTheme, user, booted, login, register, logout, updateUser,
      refreshSession, cities, activeCity, cityId, setCity, categories, unread, refreshCounts, toast,
      toasts, dismissToast, errorMessage, subscribeEvents, recentSearches, rememberSearch,
      requestGeolocation, geoCoords,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
