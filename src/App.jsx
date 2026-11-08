import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import Layout, { PageLoader } from './components/Layout.jsx';
import { useApp } from './state/AppContext.jsx';

/* --- public pages --- */
const Home = lazy(() => import('./pages/Home.jsx'));
const Listings = lazy(() => import('./pages/Listings.jsx'));
const ListingDetail = lazy(() => import('./pages/ListingDetail.jsx'));
const Categories = lazy(() => import('./pages/Categories.jsx'));
const Category = lazy(() => import('./pages/Category.jsx'));
const Stores = lazy(() => import('./pages/Stores.jsx'));
const StoreDetail = lazy(() => import('./pages/StoreDetail.jsx'));
const UserProfile = lazy(() => import('./pages/UserProfile.jsx'));
const Pricing = lazy(() => import('./pages/Pricing.jsx'));
const PlanDetail = lazy(() => import('./pages/PlanDetail.jsx'));

const { Page, Help, About, Contact, NotFound } = {
  Page: lazy(() => import('./pages/Content.jsx').then((m) => ({ default: m.Page }))),
  Help: lazy(() => import('./pages/Content.jsx').then((m) => ({ default: m.Help }))),
  About: lazy(() => import('./pages/Content.jsx').then((m) => ({ default: m.About }))),
  Contact: lazy(() => import('./pages/Content.jsx').then((m) => ({ default: m.Contact }))),
  NotFound: lazy(() => import('./pages/Content.jsx').then((m) => ({ default: m.NotFound }))),
};

/* --- auth --- */
const Login = lazy(() => import('./pages/Auth.jsx').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Auth.jsx').then((m) => ({ default: m.Register })));
const ForgotPassword = lazy(() => import('./pages/Auth.jsx').then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/Auth.jsx').then((m) => ({ default: m.ResetPassword })));

/* --- private pages --- */
const PostListing = lazy(() => import('./pages/PostListing.jsx'));
const MyListings = lazy(() => import('./pages/MyListings.jsx'));
const Favorites = lazy(() => import('./pages/Favorites.jsx'));
const Messages = lazy(() => import('./pages/Messages.jsx'));
const Account = lazy(() => import('./pages/Account.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));
const StoreManage = lazy(() => import('./pages/StoreManage.jsx'));

/* --- admin --- */
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'));
const AdminOverview = lazy(() => import('./pages/admin/Overview.jsx'));
const AdminListings = lazy(() => import('./pages/admin/Listings.jsx'));
const AdminUsers = lazy(() => import('./pages/admin/Users.jsx'));
const AdminStores = lazy(() => import('./pages/admin/Stores.jsx'));
const AdminReports = lazy(() => import('./pages/admin/Reports.jsx'));
const AdminCategories = lazy(() => import('./pages/admin/Catalog.jsx').then((m) => ({ default: m.AdminCategories })));
const AdminCities = lazy(() => import('./pages/admin/Catalog.jsx').then((m) => ({ default: m.AdminCities })));
const AdminFinance = lazy(() => import('./pages/admin/Finance.jsx').then((m) => ({ default: m.AdminFinance })));
const AdminPlans = lazy(() => import('./pages/admin/Finance.jsx').then((m) => ({ default: m.AdminPlans })));
const AdminCoupons = lazy(() => import('./pages/admin/Finance.jsx').then((m) => ({ default: m.AdminCoupons })));
const AdminContent = lazy(() => import('./pages/admin/Platform.jsx').then((m) => ({ default: m.AdminContent })));
const AdminBroadcast = lazy(() => import('./pages/admin/Platform.jsx').then((m) => ({ default: m.AdminNotifications })));
const AdminSettings = lazy(() => import('./pages/admin/Platform.jsx').then((m) => ({ default: m.AdminSettings })));
const AdminStaff = lazy(() => import('./pages/admin/Platform.jsx').then((m) => ({ default: m.AdminStaff })));
const AdminAudit = lazy(() => import('./pages/admin/Platform.jsx').then((m) => ({ default: m.AdminAudit })));
const AdminInbox = lazy(() => import('./pages/admin/Inbox.jsx'));
const AdminSearchAnalytics = lazy(() => import('./pages/admin/Analytics.jsx').then((m) => ({ default: m.AdminSearchAnalytics })));
const AdminSeo = lazy(() => import('./pages/admin/Analytics.jsx').then((m) => ({ default: m.AdminSeo })));
const AdminWebhooks = lazy(() => import('./pages/admin/Webhooks.jsx'));

function RequireAuth({ children }) {
  const { user, booted } = useApp();
  const { pathname, search } = useLocation();
  if (!booted) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(`${pathname}${search}`)}`} replace />;
  return children;
}

function RequirePermission({ perm, children }) {
  const { user, booted } = useApp();
  if (!booted) return <PageLoader />;
  if (!user) return <Navigate to="/login?next=/admin" replace />;
  if (perm && !user.permissions?.includes(perm)) return <Navigate to="/admin" replace />;
  return children;
}

function TitleWatcher() {
  const { t } = useApp();
  const { pathname } = useLocation();
  useEffect(() => {
    const map = {
      '/': 'nav.home',
      '/listings': 'nav.listings',
      '/listings/featured': 'nav.featured',
      '/categories': 'nav.categories',
      '/stores': 'nav.stores',
      '/pricing': 'nav.pricing',
      '/post': 'nav.post',
      '/my-listings': 'nav.myListings',
      '/favorites': 'nav.favorites',
      '/messages': 'nav.messages',
      '/notifications': 'nav.notifications',
      '/account': 'nav.account',
      '/login': 'nav.login',
      '/register': 'nav.register',
      '/help': 'nav.help',
      '/contact': 'nav.contact',
      '/about': 'nav.about',
      '/store/manage': 'nav.store',
      '/store/new': 'nav.store',
    };
    const key = map[pathname];
    document.title = key ? `${t(key)} | ${t('brand.name')}` : `${t('brand.name')} — ${t('brand.slogan')}`;
  }, [pathname, t]);
  return null;
}

export default function App() {
  return (
    <>
      <TitleWatcher />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="listings" element={<RequirePermission perm="listings.view"><AdminListings /></RequirePermission>} />
            <Route path="users" element={<RequirePermission perm="users.view"><AdminUsers /></RequirePermission>} />
            <Route path="stores" element={<RequirePermission perm="stores.view"><AdminStores /></RequirePermission>} />
            <Route path="reports" element={<RequirePermission perm="reports.view"><AdminReports /></RequirePermission>} />
            <Route path="categories" element={<RequirePermission perm="platform.categories"><AdminCategories /></RequirePermission>} />
            <Route path="cities" element={<RequirePermission perm="platform.geo"><AdminCities /></RequirePermission>} />
            <Route path="finance" element={<RequirePermission perm="finance.view"><AdminFinance /></RequirePermission>} />
            <Route path="plans" element={<RequirePermission perm="plans.manage"><AdminPlans /></RequirePermission>} />
            <Route path="coupons" element={<RequirePermission perm="coupons.manage"><AdminCoupons /></RequirePermission>} />
            <Route path="content" element={<RequirePermission perm="platform.content"><AdminContent /></RequirePermission>} />
            <Route path="notifications" element={<RequirePermission perm="platform.notifications"><AdminBroadcast /></RequirePermission>} />
            <Route path="staff" element={<RequirePermission perm="staff.manage"><AdminStaff /></RequirePermission>} />
            <Route path="settings" element={<RequirePermission perm="platform.settings"><AdminSettings /></RequirePermission>} />
            <Route path="audit" element={<RequirePermission perm="audit.view"><AdminAudit /></RequirePermission>} />
            <Route path="inbox" element={<RequirePermission perm="platform.content"><AdminInbox /></RequirePermission>} />
            <Route path="analytics" element={<RequirePermission perm="platform.content"><AdminSearchAnalytics /></RequirePermission>} />
            <Route path="seo" element={<RequirePermission perm="platform.content"><AdminSeo /></RequirePermission>} />
            <Route path="webhooks" element={<RequirePermission perm="finance.view"><AdminWebhooks /></RequirePermission>} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>

          <Route element={<Layout><Outlet /></Layout>}>
            <Route index element={<Home />} />

            <Route path="listings" element={<Listings />} />
            <Route path="listings/featured" element={<Listings featured />} />
            <Route path="listing/:publicId" element={<ListingDetail />} />
            <Route path="categories" element={<Categories />} />
            <Route path="category/:slug" element={<Category />} />

            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />

            <Route path="users/:id" element={<UserProfile />} />
            <Route path="stores" element={<Stores />} />
            <Route path="stores/:slug" element={<StoreDetail />} />
            <Route path="pricing" element={<Pricing />} />
            <Route path="pricing/:code" element={<PlanDetail />} />

            <Route path="post" element={<RequireAuth><PostListing /></RequireAuth>} />
            <Route path="listings/:id/edit" element={<RequireAuth><PostListing edit /></RequireAuth>} />
            <Route path="my-listings" element={<RequireAuth><MyListings /></RequireAuth>} />
            <Route path="favorites" element={<RequireAuth><Favorites /></RequireAuth>} />
            <Route path="messages" element={<RequireAuth><Messages /></RequireAuth>} />
            <Route path="messages/:id" element={<RequireAuth><Messages /></RequireAuth>} />
            <Route path="notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
            <Route path="account" element={<RequireAuth><Account /></RequireAuth>} />
            <Route path="store/new" element={<RequireAuth><StoreManage /></RequireAuth>} />
            <Route path="store/manage" element={<RequireAuth><StoreManage /></RequireAuth>} />

            <Route path="page/:slug" element={<Page />} />
            <Route path="about" element={<About />} />
            <Route path="help" element={<Help />} />
            <Route path="contact" element={<Contact />} />
            <Route path="privacy" element={<Page slug="privacy" />} />
            <Route path="terms" element={<Page slug="terms" />} />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
