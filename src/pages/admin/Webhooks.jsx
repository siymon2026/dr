import { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { Alert, Button, EmptyState, StatCard } from '../../components/ui.jsx';
import { useApp } from '../../state/AppContext.jsx';
import { api } from '../../lib/api.js';
import { formatDate, formatNumber } from '../../lib/format.js';

/**
 * Payment webhook log. Providers post to /api/webhooks/:provider; every call is
 * archived with its signature verdict so a rejected delivery can be audited.
 * Payments stay disabled until a provider is configured (see config.payments).
 */
export default function AdminWebhooks() {
  const { t, lang, toast, errorMessage } = useApp();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    api.get('/admin/webhooks?limit=100').then(setData).catch((err) => toast(errorMessage(err), 'error'));
  }, [toast, errorMessage]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = data?.stats || {};

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: '1.3rem' }}>{t('admin.webhooks')}</h1>
        <Button size="sm" variant="outline" icon="refresh" onClick={load} />
      </div>

      <Alert type="info" icon="info">{t('pricing.notice')}</Alert>

      {!data && <div className="skeleton" style={{ height: 220 }} />}

      {data && (
        <>
          <div className="kpi-grid">
            <StatCard label={t('admin.overview')} value={formatNumber(stats.total || 0, lang)} icon="bolt" />
            <StatCard label={t('admin.validSignature')} value={formatNumber(stats.valid_signature || 0, lang)} icon="checkCircle" />
            <StatCard label={t('admin.invalidSignature')} value={formatNumber(stats.rejected || 0, lang)} icon="alert" />
            <StatCard label={t('admin.webhookProcessed')} value={formatNumber(stats.processed || 0, lang)} icon="check" />
          </div>

          {data.items.length === 0 && <div className="card"><EmptyState icon="bolt" title={t('search.noResults')} /></div>}

          {data.items.length > 0 && (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Provider</th>
                    <th>{t('admin.webhookEvent')}</th>
                    <th>{t('admin.webhookSignature')}</th>
                    <th>{t('admin.webhookProcessed')}</th>
                    <th>{t('common.date')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((w) => (
                    <tr key={w.id}>
                      <td className="tiny muted">{w.id}</td>
                      <td className="small strong" dir="ltr">{w.provider}</td>
                      <td className="tiny" dir="ltr">{w.event || '—'}</td>
                      <td>
                        <span className={`chip tiny ${w.signature_ok ? 'chip-success' : 'chip-danger'}`}>
                          {w.signature_ok ? t('admin.validSignature') : t('admin.invalidSignature')}
                        </span>
                      </td>
                      <td>
                        <span className={`chip tiny ${w.processed ? 'chip-success' : ''}`}>{w.processed ? '✓' : '—'}</span>
                      </td>
                      <td className="tiny nowrap">{formatDate(w.created_at, lang, { withTime: true })}</td>
                      <td>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(open === w.id ? null : w.id)}>
                          <Icon name={open === w.id ? 'chevronUp' : 'chevronDown'} size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {open && (
                <pre className="card card-pad tiny" style={{ marginTop: 8, overflowX: 'auto', whiteSpace: 'pre-wrap' }} dir="ltr">
                  {(() => {
                    const item = data.items.find((x) => x.id === open);
                    if (!item) return '';
                    try {
                      return JSON.stringify(JSON.parse(item.payload), null, 2);
                    } catch {
                      return item.payload || '';
                    }
                  })()}
                </pre>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
