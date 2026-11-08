import { Suspense, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import Icon from './Icon.jsx';
import { Toasts, Spinner } from './ui.jsx';
import { useApp } from '../state/AppContext.jsx';

export function PageLoader() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '48vh' }}>
      <Spinner dark size={30} />
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname]);
  return null;
}

export function BottomNav() {
  const { t, user, unread } = useApp();
  const items = [
    { to: '/', icon: 'home', label: t('nav.home'), end: true },
    { to: '/listings', icon: 'search', label: t('nav.listings') },
    { to: '/post', icon: 'plusCircle', label: t('nav.post') },
    { to: user ? '/messages' : '/login', icon: 'message', label: t('nav.messages'), badge: unread.messages },
    { to: user ? '/account' : '/login', icon: 'user', label: user ? t('nav.account') : t('nav.login') },
  ];
  return (
    <nav className="bottom-nav" aria-label="mobile">
      {items.map((item, idx) => (
        <NavLink key={`${item.to}-${idx}`} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
            <Icon name={item.icon} size={21} />
            {item.badge > 0 && (
              <span
                style={{
                  position: 'absolute', top: -4, insetInlineEnd: -8, minWidth: 15, height: 15, borderRadius: 99,
                  background: 'var(--accent-500)', color: '#fff', fontSize: 9, fontWeight: 800,
                  display: 'grid', placeItems: 'center', padding: '0 3px',
                }}
              >
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            )}
          </span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout({ children }) {
  return (
    <>
      <ScrollToTop />
      <Header />
      <main id="main">
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </main>
      <Footer />
      <BottomNav />
      <Link to="/post" className="fab-post" aria-label="post">
        <Icon name="plus" size={26} />
      </Link>
      <Toasts />
    </>
  );
}
