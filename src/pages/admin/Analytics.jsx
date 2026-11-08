import { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { BarChart, Button, EmptyState, StatCard } from '../../components/ui.jsx';
import { useApp } from '../../state/AppContext.jsx';
import { api } from '../../lib/api.js';
import { formatDate, formatNumber } from '../../lib/format.js';

/* =========================== search analytics =========================== */

export function AdminSearchAnalytics() {
  const { t, lang, toast, errorMessage } = useApp();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    setData(null);
    api
      .get(`/admin/search-analytics?days=${days}`)
      .then(setData)
      .catch((err) => toast(errorMessage(err), 'error'));
  }, [days, toast, errorMessage]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = data?.totals || {};
  const rate = totals.searches ? Math.round(((totals.empty_results || 0) / totals.searches) * 100) : 0;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: '1.3rem' }}>{t('admin.searchAnalytics')}</h1>
        <div className="row" style={{ gap: 6 }}>
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" className={`chip ${days === d ? 'chip-brand' : ''}`} onClick={() => setDays(d)}>
              {d} {t('admin.days')}
            </button>
          ))}
          <Button size="sm" variant="outline" icon="refresh" onClick={load} />
        </div>
      </div>

      {!data && <div className="skeleton" style={{ height: 240 }} />}

      {data && (
        <>
          <div className="kpi-grid">
            <StatCard label={t('admin.totalSearches')} value={formatNumber(totals.searches || 0, lang)} icon="search" />
            <StatCard label={t('admin.zeroResults')} value={formatNumber(totals.empty_results || 0, lang)} icon="alert" />
            <StatCard label={t('admin.emptyResultRate')} value={`${rate}%`} icon="chart" />
            <StatCard
              label={t('admin.avgResults')}
              value={formatNumber(totals.searches ? Math.round((totals.result_sum || 0) / totals.searches) : 0, lang)}
              icon="list"
            />
          </div>

          {data.daily.length > 0 && (
            <div className="card card-pad">
              <b className="small">{t('admin.totalSearches')}</b>
              <BarChart data={data.daily} valueKey="searches" labelKey="day" />
            </div>
          )}

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            <div className="card card-pad stack" style={{ gap: 8 }}>
              <b className="small">{t('admin.topQueries')}</b>
              {data.top.length === 0 && <EmptyState icon="search" title="—" />}
              {data.top.map((row, i) => (
                <div key={`${row.query}-${i}`} className="row-between tiny" style={{ padding: '7px 10px', background: 'var(--surface-2)', borderRadius: 8 }}>
                  <span className="row" style={{ gap: 8, minWidth: 0 }}>
                    <span className="muted" style={{ width: 18 }}>{i + 1}</span>
                    <span>{row.query}</span>
                  </span>
                  <span className="row" style={{ gap: 8 }}>
                    <span className="muted">{row.avg_results}</span>
                    <span className="chip tiny">{row.hits}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="card card-pad stack" style={{ gap: 8 }}>
              <b className="small">{t('admin.zeroResults')}</b>
              {data.empty.length === 0 && <EmptyState icon="checkCircle" title="—" />}
              {data.empty.map((row, i) => (
                <div key={`${row.query}-e${i}`} className="row-between tiny" style={{ padding: '7px 10px', background: 'var(--surface-2)', borderRadius: 8 }}>
                  <span>{row.query}</span>
                  <span className="row" style={{ gap: 8 }}>
                    <span className="muted nowrap">{formatDate(row.last_seen, lang)}</span>
                    <span className="chip chip-warning tiny">{row.hits}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ================================ SEO ================================ */

export function AdminSeo() {
  const { t, lang, toast, errorMessage } = useApp();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/admin/seo').then(setData).catch((err) => toast(errorMessage(err), 'error'));
  }, [toast, errorMessage]);

  const u = data?.urls || {};
  const h = data?.health || {};

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: '1.3rem' }}>{t('admin.seo')}</h1>
        <div className="row" style={{ gap: 6 }}>
          <a className="btn btn-outline btn-sm" href={data?.sitemap_url || '/sitemap.xml'} target="_blank" rel="noreferrer">
            <Icon name="link" size={15} /> {t('admin.seoSitemap')}
          </a>
          <a className="btn btn-outline btn-sm" href={data?.robots_url || '/robots.txt'} target="_blank" rel="noreferrer">
            <Icon name="file" size={15} /> {t('admin.seoRobots')}
          </a>
        </div>
      </div>

      {!data && <div className="skeleton" style={{ height: 240 }} />}

      {data && (
        <>
          <div className="kpi-grid">
            <StatCard label={t('admin.seoIndexed')} value={formatNumber(u.total || 0, lang)} icon="globe" />
            <StatCard label={t('admin.listings')} value={formatNumber(u.listings || 0, lang)} icon="list" />
            <StatCard label={t('admin.stores')} value={formatNumber(u.stores || 0, lang)} icon="store" />
            <StatCard label={t('admin.categories')} value={formatNumber(u.categories || 0, lang)} icon="grid" />
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            <div className="card card-pad stack" style={{ gap: 6 }}>
              <b className="small">{t('admin.seoMissingDesc')}</b>
              <span style={{ fontSize: '1.6rem', fontWeight: 700 }}>{formatNumber(h.missing_descriptions || 0, lang)}</span>
              <a className="tiny" href="/admin/listings" style={{ color: 'var(--brand)' }}>{t('admin.listings')}</a>
            </div>
            <div className="card card-pad stack" style={{ gap: 6 }}>
              <b className="small">{t('admin.seoMissingImages')}</b>
              <span style={{ fontSize: '1.6rem', fontWeight: 700 }}>{formatNumber(h.missing_images || 0, lang)}</span>
              <a className="tiny" href="/admin/listings?filter=images" style={{ color: 'var(--brand)' }}>{t('admin.listings')}</a>
            </div>
          </div>

          <div className="card card-pad stack" style={{ gap: 8 }}>
            <b className="small">{t('admin.seoSitemap')}</b>
            <div className="tiny muted" dir="ltr">{data.sitemap_url}</div>
            {data.last_listing_update && (
              <div className="tiny muted">{t('myListings.updated') || 'updated'} · {formatDate(data.last_listing_update, lang, { withTime: true })}</div>
            )}
            <a className="small" href={data.sitemap_url} target="_blank" rel="noreferrer" style={{ color: 'var(--brand)' }}>{t('admin.openInNewTab')}</a>
          </div>
        </>
      )}
    </div>
  );
}
