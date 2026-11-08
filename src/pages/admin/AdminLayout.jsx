import { useEffect } from 'react';
import { NavLink, Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { useApp } from '../../state/AppContext.jsx';
import { Toasts } from '../../components/ui.jsx';

const NAV = [
  { to: '/admin', labelKey: 'admin.overview', icon: 'chart', end: true },
  { labelKey: 'admin.listings', icon: 'list', to: '/admin/listings' },
  { labelKey: 'admin.users', icon: 'users', to: '/admin/users' },
  { labelKey: 'admin.stores', icon: 'store', to: '/admin/stores' },
  { labelKey: 'admin.reports', icon: 'flag', to: '/admin/reports' },
  { labelKey: 'admin.categories', icon: 'grid', to: '/admin/categories', perm: 'platform.categories' },
  { labelKey: 'admin.cities', icon: 'mapPin', to: '/admin/cities', perm: 'platform.geo' },
  { labelKey: 'admin.finance', icon: 'money', to: '/admin/finance', perm: 'finance.view' },
  { labelKey: 'admin.plans', icon: 'crown', to: '/admin/plans', perm: 'plans.manage' },
  { labelKey: 'admin.coupons', icon: 'tag', to: '/admin/coupons', perm: 'coupons.manage' },
  { labelKey: 'admin.content', icon: 'file', to: '/admin/content', perm: 'platform.content' },
  { labelKey: 'admin.notifications', icon: 'bell', to: '/admin/notifications', perm: 'platform.notifications' },
  { labelKey: 'admin.staff', icon: 'shield', to: '/admin/staff', perm: 'staff.manage' },
  { labelKey: 'admin.settings', icon: 'settings', to: '/admin/settings', perm: 'platform.settings' },
  { labelKey: 'admin.audit', icon: 'clock', to: '/admin/audit', perm: 'audit.view' },
];

export default function AdminLayout() {
  const { t, user, booted } = useApp();
  const location = useLocation();

  useEffect(() => {
    document.title = `${t('admin.title')} | ${t('brand.name')}`;
  }, [t]);

  if (!booted) {
    return <div className="container" style={{ padding: '60px 0' }}><div className="skeleton" style={{ height: 220 }} /></div>;
  }

  if (!user) return <Navigate to="/login?next=/admin" replace />;
  if (!user.permissions?.length) {
    return (
      <div className="container" style={{ padding: '60px 0' }}>
        <div className="card card-pad center">
          <Icon name="shield" size={34} style={{ color: 'var(--ink-300)', margin: '0 auto 8px' }} />
          <b>{t('admin.notAuthorized')}</b>
          <div className="mt-2"><Link to="/" className="btn btn-outline btn-sm">{t('common.goHome')}</Link></div>
        </div>
      </div>
    );
  }

  const items = NAV.filter((n) => !n.perm || user.permissions.includes(n.perm));

  return (
    <div className="admin-shell">
      <nav className="admin-nav" aria-label="admin">
        <div className="nav-label">{t('admin.title')}</div>
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name={item.icon} size={17} />
            {t(item.labelKey)}
          </NavLink>
        ))}
        <div className="menu-sep" />
        <Link to="/" className="menu-item">
          <Icon name="home" size={16} /> {t('nav.home')}
        </Link>
      </nav>
      <div className="admin-main" key={location.pathname}>
        <Outlet />
      </div>
      <Toasts />
    </div>
  );
}
