import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Alert, Button, EmptyState, Field } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { pickName, formatDate } from '../lib/format.js';

export function Page({ slug: slugProp }) {
  const params = useParams();
  const slug = slugProp || params.slug;
  const { t, lang } = useApp();
  const [page, setPage] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setPage(null);
    setNotFound(false);
    api.get(`/content/pages/${slug}`).then((r) => setPage(r.page)).catch(() => setNotFound(true));
  }, [slug]);

  useEffect(() => {
    if (page) document.title = `${pickName(page.title, lang)} | ${t('brand.name')}`;
  }, [page, lang, t]);

  if (notFound) {
    return (
      <div className="container" style={{ padding: '60px 0' }}>
        <EmptyState icon="file" title={t('common.notFound')} action={<Link to="/" className="btn mt-2">{t('common.goHome')}</Link>} />
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 820, paddingTop: 28, paddingBottom: 50 }}>
      {!page ? (
        <div className="stack">
          <div className="skeleton" style={{ height: 30, width: '50%' }} />
          <div className="skeleton" style={{ height: 240 }} />
        </div>
      ) : (
        <article className="card card-pad" style={{ display: 'grid', gap: 12 }}>
          <h1 style={{ fontSize: 'clamp(1.3rem,3.4vw,1.8rem)' }}>{pickName(page.title, lang)}</h1>
          <span className="tiny muted">{formatDate(page.updated_at, lang)}</span>
          <div className="divider" />
          <div className="description-body" style={{ fontSize: '0.94rem' }}>{pickName(page.body, lang)}</div>
          <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <Link to="/help" className="btn btn-outline btn-sm">{t('nav.help')}</Link>
            <Link to="/contact" className="btn btn-ghost btn-sm">{t('nav.contact')}</Link>
          </div>
        </article>
      )}
    </div>
  );
}

export function Help() {
  const { t, lang } = useApp();
  const [faqs, setFaqs] = useState(null);
  const [open, setOpen] = useState(0);

  useEffect(() => {
    api.get('/content/faq').then((r) => setFaqs(r.items)).catch(() => setFaqs([]));
  }, []);

  return (
    <div className="container" style={{ maxWidth: 820, paddingTop: 28, paddingBottom: 50 }}>
      <h1 style={{ fontSize: 'clamp(1.3rem,3.4vw,1.8rem)', marginBottom: 6 }}>{t('nav.help')}</h1>
      <p className="muted small" style={{ marginBottom: 20 }}>
        {lang === 'ar' ? 'أجوبة على أكثر الأسئلة تداولاً، ودليل مبسط للبدء.' : lang === 'fr' ? 'Réponses aux questions fréquentes et guide de démarrage.' : 'Answers to common questions and a quick start guide.'}
      </p>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', marginBottom: 22 }}>
        {[
          { icon: 'plusCircle', title: lang === 'ar' ? 'كيف أنشر إعلاناً؟' : 'Comment publier ?', to: '/post' },
          { icon: 'message', title: lang === 'ar' ? 'كيف أراسل البائع؟' : 'Contacter un vendeur', to: '/listings' },
          { icon: 'shield', title: lang === 'ar' ? 'نصائح الأمان' : 'Conseils de sécurité', to: '/page/prohibited' },
          { icon: 'store', title: lang === 'ar' ? 'إنشاء متجر' : 'Créer une boutique', to: '/store/new' },
        ].map((c) => (
          <Link key={c.title} to={c.to} className="card card-pad row" style={{ gap: 10 }}>
            <span className="stat-icon"><Icon name={c.icon} size={17} /></span>
            <b className="small">{c.title}</b>
          </Link>
        ))}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        {!faqs && [1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 60 }} />)}
        {faqs?.map((f, i) => (
          <div key={f.id} className="card" style={{ overflow: 'hidden' }}>
            <button
              type="button"
              className="row-between"
              style={{ width: '100%', padding: '13px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'start', gap: 10 }}
              onClick={() => setOpen(open === i ? -1 : i)}
              aria-expanded={open === i}
            >
              <b style={{ fontSize: '0.92rem' }}>{pickName(f.q, lang)}</b>
              <Icon name={open === i ? 'chevronUp' : 'chevronDown'} size={17} style={{ flex: '0 0 auto', color: 'var(--ink-400)' }} />
            </button>
            {open === i && (
              <div style={{ padding: '0 16px 14px', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {pickName(f.a, lang)}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card card-pad mt-3 row-between" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <b className="small">{lang === 'ar' ? 'لم تجد إجابتك؟' : lang === 'fr' ? 'Pas trouvé ?' : 'Not found?'}</b>
          <p className="tiny muted">{lang === 'ar' ? 'فريق الدعم جاهز لمساعدتك.' : 'Notre équipe est là pour vous aider.'}</p>
        </div>
        <Link to="/contact" className="btn btn-sm">{t('nav.contact')}</Link>
      </div>
    </div>
  );
}

export function About() {
  const { lang } = useApp();
  return <Page slug="about" lang={lang} />;
}

export function Contact() {
  const { t, lang, toast, errorMessage } = useApp();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFieldErrors({});
    try {
      await api.post('/content/contact', form);
      setSent(true);
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      if (err.details) setFieldErrors(err.details);
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 720, paddingTop: 28, paddingBottom: 50 }}>
      <h1 style={{ fontSize: 'clamp(1.3rem,3.4vw,1.8rem)', marginBottom: 6 }}>{t('nav.contact')}</h1>
      <p className="muted small" style={{ marginBottom: 20 }}>
        {lang === 'ar' ? 'أرسل لنا رسالة وسنجيب في أقرب وقت.' : lang === 'fr' ? 'Envoyez-nous un message, nous répondons rapidement.' : 'Send us a message and we will reply soon.'}
      </p>

      {sent ? (
        <div className="card card-pad stack" style={{ gap: 14 }}>
          <Alert type="success" icon="checkCircle">
            {lang === 'ar' ? 'تم إرسال رسالتك بنجاح. شكراً لتواصلك!' : lang === 'fr' ? 'Message envoyé, merci !' : 'Message sent, thank you!'}
          </Alert>
          <Button type="button" variant="outline" onClick={() => setSent(false)} style={{ width: 'fit-content' }}>
            {t('common.more')}
          </Button>
        </div>
      ) : (
        <form className="card card-pad stack" style={{ gap: 14 }} onSubmit={submit}>
          <div className="form-grid">
            <Field label={t('auth.name')} error={fieldErrors.name} required>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
            </Field>
            <Field label={t('auth.email')} error={fieldErrors.email} required>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required dir="ltr" />
            </Field>
          </div>
          <Field label={t('report.details')} hint={t('common.optional')}>
            <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={120} />
          </Field>
          <Field label={t('messages.placeholder')} error={fieldErrors.message} required>
            <textarea className="textarea" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} minLength={10} maxLength={3000} required style={{ minHeight: 140 }} />
          </Field>
          <Button type="submit" loading={busy} icon="send" style={{ width: 'fit-content' }}>{t('report.submit')}</Button>
        </form>
      )}

      <div className="grid mt-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        {[
          { icon: 'mail', label: 'support@bii3chri.ma', href: 'mailto:support@bii3chri.ma' },
          { icon: 'phone', label: '+212 5 22 00 00 00', href: 'tel:+212522000000' },
          { icon: 'mapPin', label: lang === 'ar' ? 'الدار البيضاء، المغرب' : 'Casablanca, Maroc' },
        ].map((c) => (
          <a key={c.label} href={c.href || '#'} className="card card-pad row" style={{ gap: 9 }}>
            <Icon name={c.icon} size={17} style={{ color: 'var(--brand-600)' }} />
            <span className="small" dir={c.icon === 'mail' || c.icon === 'phone' ? 'ltr' : undefined}>{c.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function NotFound() {
  const { t } = useApp();
  return (
    <div className="container" style={{ padding: '70px 0' }}>
      <div style={{ display: 'grid', justifyItems: 'center', gap: 12, textAlign: 'center' }}>
        <span style={{ fontSize: '3.4rem', fontWeight: 800, color: 'var(--brand-200)' }}>404</span>
        <h1 style={{ fontSize: '1.3rem' }}>{t('common.notFound')}</h1>
        <p className="muted small" style={{ maxWidth: 380 }}>{t('common.notFoundHint')}</p>
        <div className="row" style={{ gap: 8 }}>
          <Link to="/" className="btn">{t('common.goHome')}</Link>
          <Link to="/listings" className="btn btn-outline">{t('nav.listings')}</Link>
        </div>
      </div>
    </div>
  );
}
