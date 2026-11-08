import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useApp } from '../state/AppContext.jsx';

export default function Footer() {
  const { t, lang } = useApp();
  const year = new Date().getFullYear();

  const cols = [
    {
      title: t('footer.market'),
      links: [
        { to: '/listings', label: t('nav.listings') },
        { to: '/categories', label: t('nav.categories') },
        { to: '/stores', label: t('nav.stores') },
        { to: '/listings?featured=1', label: t('nav.featured') },
        { to: '/pricing', label: t('nav.pricing') },
      ],
    },
    {
      title: t('footer.support'),
      links: [
        { to: '/help', label: t('nav.help') },
        { to: '/page/about', label: t('nav.about') },
        { to: '/contact', label: t('nav.contact') },
        { to: '/page/prohibited', label: lang === 'ar' ? 'المنتجات المحظورة' : lang === 'fr' ? 'Produits interdits' : 'Prohibited items' },
      ],
    },
    {
      title: t('footer.legal'),
      links: [
        { to: '/page/terms', label: lang === 'ar' ? 'شروط الاستخدام' : lang === 'fr' ? "Conditions d'utilisation" : 'Terms of use' },
        { to: '/page/privacy', label: lang === 'ar' ? 'سياسة الخصوصية' : lang === 'fr' ? 'Confidentialité' : 'Privacy policy' },
      ],
    },
  ];

  return (
    <footer className="app-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="stack" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 10 }}>
              <span
                className="brand-mark"
                style={{ width: 40, height: 40, background: 'linear-gradient(135deg, var(--brand-400), var(--brand-600))' }}
              >
                <Icon name="box" size={21} />
              </span>
              <div>
                <div style={{ color: '#fff', fontWeight: 800 }}>{t('brand.name')}</div>
                <div className="tiny" style={{ color: 'rgba(255,255,255,.5)' }}>{t('brand.tag')}</div>
              </div>
            </div>
            <p style={{ maxWidth: 320, lineHeight: 1.75 }}>{t('footer.aboutText')}</p>
            <div className="row" style={{ gap: 8, marginTop: 4 }}>
              <span className="chip" style={{ background: 'rgba(255,255,255,.08)', borderColor: 'rgba(255,255,255,.14)', color: '#fff' }}>
                <Icon name="shield" size={13} /> {lang === 'ar' ? 'منصة آمنة' : lang === 'fr' ? 'Plateforme sûre' : 'Secure platform'}
              </span>
              <span className="chip" style={{ background: 'rgba(255,255,255,.08)', borderColor: 'rgba(255,255,255,.14)', color: '#fff' }}>
                🇲🇦 {lang === 'ar' ? 'مغربية 100%' : lang === 'fr' ? '100% marocaine' : '100% Moroccan'}
              </span>
            </div>
          </div>

          {cols.map((col) => (
            <div key={col.title}>
              <div className="footer-title">{col.title}</div>
              <div className="footer-links">
                {col.links.map((l) => (
                  <Link key={l.to} to={l.to}>
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="footer-bottom">
          <span>
            © {year} {t('brand.name')} — {t('footer.rights')}
          </span>
          <span className="row" style={{ gap: 6 }}>
            <Icon name="mapPin" size={13} /> {t('footer.madeIn')}
          </span>
        </div>
      </div>
    </footer>
  );
}
