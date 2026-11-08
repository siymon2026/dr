import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Alert, Avatar, Button, ConfirmDialog, Field, Tabs } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { formatDate, formatPrice, pickName, timeAgo } from '../lib/format.js';
import { LANGS } from '../i18n.js';

export default function Account() {
  const { t, lang, setLang, user, updateUser, cities, logout, toast, errorMessage } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState('profile');
  const [form, setForm] = useState({
    name: '',
    bio: '',
    city_id: '',
    phone: '',
    show_phone: true,
    show_last_seen: true,
    allow_messages: true,
  });
  const [passwords, setPasswords] = useState({ current_password: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activity, setActivity] = useState([]);
  const [reports, setReports] = useState([]);
  const [orders, setOrders] = useState([]);
  const [otpState, setOtpState] = useState({ sending: false, code: '', dev: null, busy: false });
  const [blocks, setBlocks] = useState([]);
  const avatarRef = useRef(null);

  useEffect(() => {
    if (!user) navigate('/login?next=/account', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || '',
      bio: user.bio || '',
      city_id: user.city_id ? String(user.city_id) : '',
      phone: user.phone || '',
      show_phone: user.show_phone !== false,
      show_last_seen: user.show_last_seen !== false,
      allow_messages: user.allow_messages !== false,
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    api.get('/auth/me/activity').then((r) => setActivity(r.items)).catch(() => {});
    api.get('/reports/mine').then((r) => setReports(r.items)).catch(() => {});
    api.get('/payments/orders').then((r) => setOrders(r.items)).catch(() => {});
    api.get('/conversations/blocks/list').then((r) => setBlocks(r.items || [])).catch(() => setBlocks([]));
  }, [user]);

  if (!user) return null;

  const saveProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.patch('/auth/me', {
        name: form.name.trim(),
        bio: form.bio,
        city_id: form.city_id ? Number(form.city_id) : null,
        phone: form.phone.trim() || null,
        show_phone: form.show_phone,
        show_last_seen: form.show_last_seen,
        allow_messages: form.allow_messages,
      });
      updateUser(res.user);
      toast(t('account.saved'), 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const uploadAvatar = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const form2 = new FormData();
      form2.append('image', file);
      const res = await api.upload('/uploads/avatar', form2);
      updateUser({ avatar: res.avatar });
      toast(t('account.saved'), 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
      if (avatarRef.current) avatarRef.current.value = '';
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (passwords.password !== passwords.confirm) {
      toast(t('errors.current_password_wrong'), 'error');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/change-password', { current_password: passwords.current_password, password: passwords.password });
      setPasswords({ current_password: '', password: '', confirm: '' });
      toast(t('account.saved'), 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async (purpose) => {
    setOtpState((s) => ({ ...s, sending: true, dev: null }));
    try {
      const res = await api.post('/auth/otp/request', { purpose });
      setOtpState((s) => ({ ...s, sending: false, dev: res.dev_code || null }));
      toast(t('account.otpSend'), 'success');
    } catch (err) {
      setOtpState((s) => ({ ...s, sending: false }));
      toast(errorMessage(err), 'error');
    }
  };

  const verifyOtp = async (purpose) => {
    setOtpState((s) => ({ ...s, busy: true }));
    try {
      const res = await api.post('/auth/otp/verify', { purpose, code: otpState.code });
      updateUser(res.user);
      setOtpState({ sending: false, code: '', dev: null, busy: false });
      toast(t('account.verified'), 'success');
    } catch (err) {
      setOtpState((s) => ({ ...s, busy: false }));
      toast(errorMessage(err), 'error');
    }
  };

  const deleteAccount = async () => {
    setBusy(true);
    try {
      await api.del('/auth/me', { password: deletePassword });
      await logout();
      navigate('/');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const unblock = async (blockedUser) => {
    try {
      await api.del(`/conversations/block/${blockedUser.id}`);
      setBlocks((prev) => prev.filter((b) => b.id !== blockedUser.id));
      toast(t('account.unblocked'), 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const tabs = [
    { value: 'profile', label: t('account.profile') },
    { value: 'privacy', label: t('account.privacy') },
    { value: 'security', label: t('account.security') },
    { value: 'blocks', label: t('account.blocks') },
    { value: 'activity', label: t('account.activity') },
    { value: 'orders', label: t('account.orders') },
  ];

  return (
    <div className="container" style={{ maxWidth: 880, paddingTop: 24, paddingBottom: 44 }}>
      <h1 style={{ fontSize: 'clamp(1.25rem,3vw,1.6rem)', marginBottom: 4 }}>{t('account.title')}</h1>
      <p className="small muted" style={{ marginBottom: 16 }}>
        {t('account.memberSince')} {formatDate(user.created_at, lang)}
        {user.verified_seller && (
          <span className="chip chip-brand tiny" style={{ marginInlineStart: 8 }}>
            <Icon name="verified" size={12} /> {t('account.verifiedSeller')}
          </span>
        )}
      </p>

      <Tabs items={tabs} value={tab} onChange={setTab} />

      <div className="card card-pad mt-3">
        {tab === 'profile' && (
          <form onSubmit={saveProfile} className="stack" style={{ gap: 16 }}>
            <div className="row" style={{ gap: 14 }}>
              <Avatar src={user.avatar} name={user.name} size="xl" />
              <div className="stack" style={{ gap: 6 }}>
                <b>{t('account.avatar')}</b>
                <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => uploadAvatar(e.target.files?.[0])} />
                <Button type="button" size="sm" variant="outline" onClick={() => avatarRef.current?.click()} icon="camera" loading={busy}>
                  {t('common.edit')}
                </Button>
                <span className="tiny muted">JPG / PNG / WebP — 4MB</span>
              </div>
            </div>
            <div className="form-grid">
              <Field label={t('auth.name')} required>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} required />
              </Field>
              <Field label={t('filters.city')}>
                <select className="select" value={form.city_id} onChange={(e) => setForm({ ...form, city_id: e.target.value })}>
                  <option value="">—</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{pickName(c.name, lang)}</option>)}
                </select>
              </Field>
              <Field label={t('auth.phone')} hint={user.phone_verified ? t('account.verified') : t('account.notVerified')}>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" placeholder="06XXXXXXXX" />
              </Field>
              <Field label={t('account.language')}>
                <select className="select" value={lang} onChange={(e) => setLang(e.target.value)}>
                  {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </Field>
            </div>
            <Field label={t('account.bio')} hint={`${form.bio.length}/500`}>
              <textarea className="textarea" style={{ minHeight: 90 }} value={form.bio} maxLength={500} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </Field>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button type="submit" loading={busy} icon="check">{t('common.save')}</Button>
            </div>
          </form>
        )}

        {tab === 'privacy' && (
          <form onSubmit={saveProfile} className="stack" style={{ gap: 16 }}>
            <div className="stack" style={{ gap: 14 }}>
              {[
                { key: 'show_phone', label: t('account.showPhone'), desc: lang === 'ar' ? 'سيظهر رقم هاتفك في إعلاناتك للمشترين.' : 'Votre numéro sera visible sur vos annonces.' },
                { key: 'show_last_seen', label: t('account.showLastSeen'), desc: lang === 'ar' ? 'عرض آخر وقت تواجد لك للمستخدمين.' : 'Afficher votre dernière connexion.' },
                { key: 'allow_messages', label: t('account.allowMessages'), desc: lang === 'ar' ? 'يمكن للمشترين بدء محادثة معك.' : 'Les acheteurs peuvent vous écrire.' },
              ].map((item) => (
                <label key={item.key} className="row-between card card-pad" style={{ padding: 14, cursor: 'pointer', alignItems: 'center' }}>
                  <div>
                    <b style={{ fontSize: '0.9rem' }}>{item.label}</b>
                    <p className="tiny muted">{item.desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={form[item.key]}
                    onChange={(e) => setForm({ ...form, [item.key]: e.target.checked })}
                    style={{ width: 20, height: 20, accentColor: 'var(--brand-600)' }}
                  />
                </label>
              ))}
            </div>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <a href="/api/auth/me/export" className="btn btn-outline" download>
                <Icon name="download" size={16} /> {t('account.export')}
              </a>
              <Button type="submit" loading={busy} icon="check">{t('common.save')}</Button>
            </div>

            <div className="divider" />
            <div className="stack" style={{ gap: 8 }}>
              <h3 className="small strong" style={{ color: 'var(--danger)' }}>{t('account.danger')}</h3>
              <p className="small muted">{t('account.deleteWarning')}</p>
              <Button type="button" variant="danger-outline" style={{ width: 'fit-content' }} onClick={() => setDeleteOpen(true)} icon="trash">
                {t('account.deleteAccount')}
              </Button>
            </div>
          </form>
        )}

        {tab === 'security' && (
          <div className="stack" style={{ gap: 20 }}>
            <form onSubmit={changePassword} className="stack" style={{ gap: 14 }}>
              <h3 className="small strong">{t('auth.changePassword')}</h3>
              <Field label={t('auth.currentPassword')} required>
                <input type="password" className="input" value={passwords.current_password} onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })} required autoComplete="current-password" />
              </Field>
              <div className="form-grid">
                <Field label={t('auth.reset.new')} required>
                  <input type="password" className="input" value={passwords.password} onChange={(e) => setPasswords({ ...passwords, password: e.target.value })} minLength={8} required autoComplete="new-password" />
                </Field>
                <Field label={t('common.confirm')} required>
                  <input type="password" className="input" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} minLength={8} required autoComplete="new-password" />
                </Field>
              </div>
              <Button type="submit" loading={busy} style={{ width: 'fit-content' }} icon="lock">{t('common.save')}</Button>
            </form>

            <div className="divider" />

            <div className="stack" style={{ gap: 12 }}>
              <h3 className="small strong">{t('account.verifyPhone')} / {t('account.verifyEmail')}</h3>
              {[
                { purpose: 'phone', value: user.phone, verified: user.phone_verified, label: t('auth.phone') },
                { purpose: 'email', value: user.email, verified: user.email_verified, label: t('auth.email') },
              ].map((item) => (
                <div key={item.purpose} className="row-between card card-pad" style={{ padding: 13, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <b style={{ fontSize: '0.88rem' }}>{item.label}</b>
                    <div className="tiny muted" dir="ltr">{item.value || '—'}</div>
                  </div>
                  {item.verified ? (
                    <span className="chip chip-success"><Icon name="checkCircle" size={13} /> {t('account.verified')}</span>
                  ) : (
                    <div className="row" style={{ gap: 6 }}>
                      <Button type="button" size="sm" variant="outline" loading={otpState.sending} onClick={() => sendOtp(item.purpose)}>
                        {t('account.otpSend')}
                      </Button>
                      <input
                        className="input"
                        style={{ width: 100 }}
                        placeholder="000000"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpState.code}
                        onChange={(e) => setOtpState({ ...otpState, code: e.target.value.replace(/\D/g, '') })}
                        dir="ltr"
                      />
                      <Button type="button" size="sm" loading={otpState.busy} onClick={() => verifyOtp(item.purpose)} disabled={otpState.code.length !== 6}>
                        {t('account.otpVerify')}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {otpState.dev && (
                <Alert type="info" icon="info">
                  DEV code (SMS/SMTP disabled): <b dir="ltr">{otpState.dev}</b>
                </Alert>
              )}
            </div>

            <div className="divider" />
            <div className="stack" style={{ gap: 8 }}>
              <h3 className="small strong">{lang === 'ar' ? 'الجلسات' : lang === 'fr' ? 'Sessions' : 'Sessions'}</h3>
              <p className="small muted">{lang === 'ar' ? 'تسجيل الخروج من جميع الأجهزة الأخرى.' : 'Déconnectez-vous de tous les autres appareils.'}</p>
              <Button
                type="button"
                variant="danger-outline"
                style={{ width: 'fit-content' }}
                icon="logout"
                onClick={async () => {
                  await api.post('/auth/logout-all', {});
                  await logout();
                  navigate('/login');
                }}
              >
                {t('nav.logout')}
              </Button>
            </div>
          </div>
        )}

        {tab === 'blocks' && (
          <div className="stack" style={{ gap: 14 }}>
            <div>
              <h3 className="small strong">{t('account.blocks')}</h3>
              <p className="tiny muted">{t('account.blocksIntro')}</p>
            </div>
            {blocks.length === 0 && <p className="small muted">{t('account.noBlocks')}</p>}
            <div className="stack" style={{ gap: 8 }}>
              {blocks.map((b) => (
                <div key={b.id} className="row-between" style={{ padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 10, gap: 10 }}>
                  <Link to={`/users/${b.id}`} className="row" style={{ gap: 10, minWidth: 0 }}>
                    <Avatar src={b.avatar} name={b.name} size="sm" />
                    <span style={{ minWidth: 0 }}>
                      <b className="small">{b.name}</b>
                      <span className="tiny muted" style={{ display: 'block' }}>{timeAgo(b.created_at, t)}</span>
                    </span>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => unblock(b)} icon="ban">{t('account.unblock')}</Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'activity' && (
          <div className="stack" style={{ gap: 16 }}>
            <h3 className="small strong">{t('account.activity')}</h3>
            {activity.length === 0 && <p className="small muted">—</p>}
            <div className="stack" style={{ gap: 6 }}>
              {activity.map((a, i) => (
                <div key={i} className="row-between tiny" style={{ padding: '7px 10px', background: 'var(--surface-2)', borderRadius: 8 }}>
                  <span className="row" style={{ gap: 7 }}>
                    <Icon name={a.action.includes('login') ? 'lock' : a.action.includes('listing') ? 'list' : 'info'} size={13} />
                    {a.action}
                  </span>
                  <span className="muted">{timeAgo(a.created_at, t)}</span>
                </div>
              ))}
            </div>

            <div className="divider" />
            <h3 className="small strong">{t('account.reports')}</h3>
            {reports.length === 0 && <p className="small muted">—</p>}
            <div className="stack" style={{ gap: 6 }}>
              {reports.map((r) => (
                <div key={r.id} className="row-between tiny" style={{ padding: '7px 10px', background: 'var(--surface-2)', borderRadius: 8 }}>
                  <span>{t(`report.reason.${r.reason}`)} · {r.target_type} #{r.target_id}</span>
                  <span className="chip tiny">{r.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'orders' && (
          <div className="stack" style={{ gap: 12 }}>
            <h3 className="small strong">{t('account.orders')}</h3>
            {orders.length === 0 && <p className="small muted">—</p>}
            {orders.map((o) => (
              <div key={o.id} className="row-between card card-pad" style={{ padding: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <b style={{ fontSize: '0.88rem' }}>{o.title}</b>
                  <div className="tiny muted" dir="ltr">{o.reference} · {formatDate(o.created_at, lang, { withTime: true })}</div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <b style={{ fontSize: '0.9rem' }}>{formatPrice(o.amount, o.currency, lang)}</b>
                  <span className={`chip ${o.status === 'paid' ? 'chip-success' : 'chip-warning'}`}>{o.status}</span>
                </div>
              </div>
            ))}
            <Link to="/pricing" className="btn btn-outline" style={{ width: 'fit-content' }}>{t('nav.pricing')}</Link>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title={t('account.deleteAccount')}
        message={
          <div className="stack" style={{ gap: 10 }}>
            <p>{t('account.deleteWarning')}</p>
            <input
              type="password"
              className="input"
              placeholder={t('auth.password')}
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />
          </div>
        }
        confirmLabel={t('common.delete')}
        danger
        loading={busy}
        onClose={() => setDeleteOpen(false)}
        onConfirm={deleteAccount}
      />
    </div>
  );
}
