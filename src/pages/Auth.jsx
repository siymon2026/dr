import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Alert, Button, Field } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { pickName } from '../lib/format.js';

function AuthSide({ mode }) {
  const { t, lang, categories } = useApp();
  return (
    <aside className="auth-side">
      <div className="row" style={{ gap: 10 }}>
        <span className="brand-mark" style={{ background: 'rgba(255,255,255,.16)', width: 44, height: 44 }}>
          <Icon name="box" size={22} />
        </span>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{t('brand.name')}</div>
          <div className="tiny" style={{ color: 'rgba(255,255,255,.55)' }}>{t('brand.tag')}</div>
        </div>
      </div>
      <h2 style={{ fontSize: '1.5rem', lineHeight: 1.4, marginTop: 8 }}>
        {mode === 'login' ? t('auth.welcome') : t('hero.cta')}
      </h2>
      <p style={{ color: 'rgba(255,255,255,.72)', fontSize: '0.92rem' }}>{t('hero.lead')}</p>
      <ul className="stack" style={{ gap: 12, marginTop: 6 }}>
        {[1, 2, 3].map((i) => (
          <li key={i} className="row" style={{ gap: 9, fontSize: '0.88rem', color: 'rgba(255,255,255,.86)' }}>
            <span style={{ width: 22, height: 22, borderRadius: 99, background: 'rgba(255,255,255,.16)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
              <Icon name="check" size={13} />
            </span>
            {t(`auth.util${i}`)}
          </li>
        ))}
      </ul>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {categories.slice(0, 5).map((c) => (
          <span key={c.id} className="chip" style={{ background: 'rgba(255,255,255,.1)', borderColor: 'rgba(255,255,255,.16)', color: '#fff', fontSize: '0.72rem' }}>
            {pickName(c.name, lang)}
          </span>
        ))}
      </div>
      <p className="tiny" style={{ color: 'rgba(255,255,255,.42)', marginTop: 'auto' }}>
        © {new Date().getFullYear()} {t('brand.name')} — {t('footer.madeIn')}
      </p>
    </aside>
  );
}

export function Login() {
  const { t, login, errorMessage, toast } = useApp();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const next = params.get('next') || '/';

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);
    try {
      await login(form.identifier.trim(), form.password);
      toast(t('auth.welcome'), 'success');
      navigate(next.startsWith('/') ? next : '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      if (err.details) setFieldErrors(err.details);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (email, password) => {
    setForm({ identifier: email, password });
    setError(null);
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="stack" style={{ gap: 4 }}>
          <h1 style={{ fontSize: '1.35rem' }}>{t('auth.login')}</h1>
          <p className="small muted">{t('auth.welcomeSub')}</p>
        </div>

        {error && <Alert type="error">{error}</Alert>}

        <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
          <Field label={t('auth.identifier')} htmlFor="identifier" error={fieldErrors.identifier} required>
            <input
              id="identifier"
              className={`input ${fieldErrors.identifier ? 'invalid' : ''}`}
              value={form.identifier}
              onChange={(e) => setForm({ ...form, identifier: e.target.value })}
              placeholder="you@example.ma / 06XXXXXXXX"
              autoComplete="username"
              required
              dir="ltr"
            />
          </Field>
          <Field label={t('auth.password')} htmlFor="password" error={fieldErrors.password} required>
            <input
              id="password"
              type="password"
              className={`input ${fieldErrors.password ? 'invalid' : ''}`}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="current-password"
              required
            />
          </Field>
          <div className="row-between">
            <Link to="/forgot-password" className="link small">{t('auth.forgot')}</Link>
          </div>
          <Button type="submit" loading={loading} className="btn-block btn-lg">
            {t('auth.login')}
          </Button>
        </form>

        <div className="divider" />
        <p className="center small muted">
          {t('auth.noAccount')}{' '}
          <Link to={`/register${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="link">
            {t('auth.register')}
          </Link>
        </p>

        <details className="card card-pad" style={{ padding: 12, background: 'var(--surface-2)' }}>
          <summary className="small strong" style={{ cursor: 'pointer' }}>{t('auth.demoHint')}</summary>
          <div className="stack" style={{ gap: 6, marginTop: 10 }}>
            {[
              { email: 'youssef@demo.ma', pass: 'Demo@12345', label: 'بيع وشراء (مستخدم)' },
              { email: 'admin@bii3chri.ma', pass: 'Admin@12345', label: 'إدارة (superadmin)' },
              { email: 'moderator@bii3chri.ma', pass: 'Moderator@12345', label: 'مراجعة (moderator)' },
            ].map((d) => (
              <button
                key={d.email}
                type="button"
                className="menu-item"
                style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
                onClick={() => fillDemo(d.email, d.pass)}
              >
                <Icon name="user" size={15} />
                <span style={{ flex: 1, textAlign: 'start' }}>
                  {d.label}
                  <br />
                  <span className="tiny muted" dir="ltr">{d.email}</span>
                </span>
                <Icon name="chevronLeft" size={14} className="rtl-flip" />
              </button>
            ))}
          </div>
        </details>
      </div>
      <AuthSide mode="login" />
    </div>
  );
}

export function Register() {
  const { t, register, errorMessage, toast, cities, lang } = useApp();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    city_id: '',
    accept_terms: false,
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const next = params.get('next') || '/';

  const strength = (() => {
    const p = form.password;
    let s = 0;
    if (p.length >= 8) s += 1;
    if (/[0-9]/.test(p)) s += 1;
    if (/[A-Za-z\u0600-\u06FF]/.test(p)) s += 1;
    if (p.length >= 12) s += 1;
    return s;
  })();

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    if (!form.email && !form.phone) {
      setError(t('post.formRequired'));
      setFieldErrors({ email: t('common.required') });
      return;
    }
    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        password: form.password,
        city_id: form.city_id ? Number(form.city_id) : undefined,
        accept_terms: form.accept_terms,
        locale: lang,
      });
      toast(t('notif.welcome'), 'success');
      navigate(next.startsWith('/') ? next : '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      if (err.details) setFieldErrors(err.details);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="stack" style={{ gap: 4 }}>
          <h1 style={{ fontSize: '1.35rem' }}>{t('auth.register')}</h1>
          <p className="small muted">{t('auth.createSub')}</p>
        </div>

        {error && <Alert type="error">{error}</Alert>}

        <form onSubmit={submit} className="stack" style={{ gap: 13 }}>
          <Field label={t('auth.name')} htmlFor="name" error={fieldErrors.name} required>
            <input
              id="name"
              className={`input ${fieldErrors.name ? 'invalid' : ''}`}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoComplete="name"
              required
              minLength={2}
              maxLength={60}
            />
          </Field>
          <Field label={t('auth.email')} htmlFor="email" error={fieldErrors.email} hint={t('common.optional')}>
            <input
              id="email"
              type="email"
              className={`input ${fieldErrors.email ? 'invalid' : ''}`}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
              placeholder="you@example.ma"
              dir="ltr"
            />
          </Field>
          <Field label={t('auth.phone')} htmlFor="phone" error={fieldErrors.phone} hint="06XXXXXXXX">
            <input
              id="phone"
              className={`input ${fieldErrors.phone ? 'invalid' : ''}`}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              autoComplete="tel"
              placeholder="06XXXXXXXX"
              dir="ltr"
            />
          </Field>
          <Field label={t('filters.city')} htmlFor="city">
            <select id="city" className="select" value={form.city_id} onChange={(e) => setForm({ ...form, city_id: e.target.value })}>
              <option value="">{t('search.city')}</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{pickName(c.name, lang)}</option>
              ))}
            </select>
          </Field>
          <Field label={t('auth.password')} htmlFor="reg-password" error={fieldErrors.password} required>
            <input
              id="reg-password"
              type="password"
              className={`input ${fieldErrors.password ? 'invalid' : ''}`}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
              required
              minLength={8}
            />
            {form.password && (
              <div className="row" style={{ gap: 4, marginTop: 2 }}>
                {[1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    style={{
                      flex: 1, height: 4, borderRadius: 99,
                      background: strength >= i ? (strength <= 2 ? 'var(--warning)' : 'var(--success)') : 'var(--border)',
                    }}
                  />
                ))}
              </div>
            )}
          </Field>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.accept_terms}
              onChange={(e) => setForm({ ...form, accept_terms: e.target.checked })}
              required
            />
            <span>
              {t('auth.accept')}{' '}
              <Link to="/page/terms" className="link" target="_blank">{t('footer.legal')}</Link>
            </span>
          </label>
          <Button type="submit" loading={loading} disabled={!form.accept_terms} className="btn-block btn-lg">
            {t('auth.register')}
          </Button>
        </form>

        <p className="center small muted">
          {t('auth.hasAccount')} <Link to="/login" className="link">{t('auth.login')}</Link>
        </p>
      </div>
      <AuthSide mode="register" />
    </div>
  );
}

export function ForgotPassword() {
  const { t, errorMessage } = useApp();
  const [identifier, setIdentifier] = useState('');
  const [sent, setSent] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/forgot-password', { identifier: identifier.trim() });
      setSent(res);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1 style={{ fontSize: '1.3rem' }}>{t('auth.reset.title')}</h1>
        <p className="small muted">{t('auth.reset.sub')}</p>
        {error && <Alert type="error">{error}</Alert>}
        {sent ? (
          <>
            <Alert type="success">{t('auth.reset.sent')}</Alert>
            {sent.dev_reset_token && (
              <Alert type="info">
                <div className="stack" style={{ gap: 6 }}>
                  <b>DEV · SMTP disabled</b>
                  <Link to={`/reset-password?token=${sent.dev_reset_token}`} className="link" style={{ wordBreak: 'break-all' }}>
                    /reset-password?token={sent.dev_reset_token.slice(0, 18)}…
                  </Link>
                </div>
              </Alert>
            )}
            <Link to="/login" className="btn btn-outline btn-block">{t('auth.login')}</Link>
          </>
        ) : (
          <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
            <Field label={t('auth.identifier')} htmlFor="forgot-id" required>
              <input
                id="forgot-id"
                className="input"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.ma"
                required
                dir="ltr"
              />
            </Field>
            <Button type="submit" loading={loading} className="btn-block">{t('auth.otpSend')}</Button>
            <Link to="/login" className="btn btn-ghost btn-block">{t('common.back')}</Link>
          </form>
        )}
      </div>
      <AuthSide mode="login" />
    </div>
  );
}

export function ResetPassword() {
  const { t, errorMessage, toast } = useApp();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) setError(t('errors.reset_token_invalid'));
  }, [token, t]);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError(t('errors.current_password_wrong'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.post('/auth/reset-password', { token, password });
      toast(t('auth.reset.new'), 'success');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1 style={{ fontSize: '1.3rem' }}>{t('auth.reset.new')}</h1>
        {error && <Alert type="error">{error}</Alert>}
        <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
          <Field label={t('auth.reset.new')} htmlFor="new-pass" required>
            <input
              id="new-pass"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </Field>
          <Field label={t('common.confirm')} htmlFor="confirm-pass" required>
            <input
              id="confirm-pass"
              type="password"
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </Field>
          <Button type="submit" loading={loading} disabled={!token} className="btn-block">{t('common.save')}</Button>
        </form>
      </div>
    </div>
  );
}

export default Login;
