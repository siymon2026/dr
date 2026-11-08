import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { initials } from '../lib/format.js';
import { useApp } from '../state/AppContext.jsx';

export function Spinner({ dark = false, size = 18 }) {
  return <span className={dark ? 'spinner spinner-dark' : 'spinner'} style={{ width: size, height: size }} />;
}

export function Button({ children, loading = false, variant, size, icon, iconRight, className = '', ...rest }) {
  const cls = [
    'btn',
    variant ? `btn-${variant}` : '',
    size ? `btn-${size}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} disabled={rest.disabled || loading} {...rest}>
      {loading ? <Spinner /> : icon ? <Icon name={icon} size={17} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={17} /> : null}
    </button>
  );
}

export function Avatar({ src, name, size = '', className = '' }) {
  const cls = ['avatar', size ? `avatar-${size}` : '', className].filter(Boolean).join(' ');
  if (src) return <img className={cls} src={src} alt={name || ''} loading="lazy" />;
  return (
    <span className={cls} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Stars({ value = 0, count, size = 15, interactive = false, onChange }) {
  const rounded = Math.round(Number(value) || 0);
  return (
    <span className={`row ${interactive ? 'stars interactive' : 'stars'}`} style={{ gap: 3 }} dir="ltr">
      {[1, 2, 3, 4, 5].map((i) =>
        interactive ? (
          <button key={i} type="button" onClick={() => onChange?.(i)} aria-label={`${i} stars`}>
            <Icon name={i <= rounded ? 'starFilled' : 'star'} size={size} style={{ color: i <= rounded ? '#f5a623' : '#cbd5d1' }} />
          </button>
        ) : (
          <Icon
            key={i}
            name={i <= rounded ? 'starFilled' : 'star'}
            size={size}
            style={{ color: i <= rounded ? '#f5a623' : '#d5ded9' }}
          />
        ),
      )}
      {count !== undefined && count !== null && (
        <span className="tiny muted" style={{ marginInlineStart: 4, direction: 'ltr' }}>
          ({count})
        </span>
      )}
      {typeof value === 'number' && value > 0 && count === undefined && (
        <span className="tiny muted" style={{ marginInlineStart: 3, direction: 'ltr' }}>
          {Number(value).toFixed(1)}
        </span>
      )}
    </span>
  );
}

export function Modal({ open, onClose, title, children, footer, size }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={size ? { width: `min(${size}px, 100%)` } : undefined} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3 style={{ fontSize: '1.02rem' }}>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="close">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onClose, loading, danger }) {
  const { t } = useApp();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title || t('common.confirm')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            {t('common.cancel')}
          </Button>
          <Button variant={danger ? 'danger' : undefined} onClick={onConfirm} loading={loading} type="button">
            {confirmLabel || t('common.confirm')}
          </Button>
        </>
      }
    >
      <p className="muted">{message}</p>
    </Modal>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  if (!toasts.length) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type}`} onClick={() => dismissToast(toast.id)}>
          <Icon
            name={toast.type === 'error' ? 'alert' : toast.type === 'success' ? 'checkCircle' : 'info'}
            size={17}
            style={{ flex: '0 0 auto', marginTop: 2 }}
          />
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

export function Alert({ type = 'info', children, icon }) {
  const iconName = icon || (type === 'error' ? 'alert' : type === 'success' ? 'checkCircle' : type === 'warning' ? 'alert' : 'info');
  return (
    <div className={`alert alert-${type}`}>
      <Icon name={iconName} size={17} style={{ flex: '0 0 auto', marginTop: 2 }} />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ icon = 'box', title, hint, action }) {
  return (
    <div className="empty">
      <Icon name={icon} size={46} strokeWidth={1.3} />
      <b style={{ color: 'var(--text)' }}>{title}</b>
      {hint && <p className="small" style={{ maxWidth: 420 }}>{hint}</p>}
      {action}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="skeleton" style={{ aspectRatio: '4 / 3', borderRadius: 0 }} />
      <div style={{ padding: 14, display: 'grid', gap: 8 }}>
        <div className="skeleton" style={{ height: 13, width: '85%' }} />
        <div className="skeleton" style={{ height: 13, width: '60%' }} />
        <div className="skeleton" style={{ height: 18, width: '40%', marginTop: 4 }} />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 8 }) {
  return (
    <div className="listing-grid">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function Pagination({ page, pages, onChange }) {
  const { t } = useApp();
  if (!pages || pages <= 1) return null;
  const items = [];
  const push = (p) => items.push(p);
  const window = 1;
  push(1);
  if (page - window > 2) push('…');
  for (let p = Math.max(2, page - window); p <= Math.min(pages - 1, page + window); p += 1) push(p);
  if (page + window < pages - 1) push('…');
  if (pages > 1) push(pages);

  return (
    <nav className="pagination" aria-label="pagination">
      <button type="button" className="page-btn" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label={t('common.prev')}>
        <Icon name={document.documentElement.dir === 'rtl' ? 'chevronRight' : 'chevronLeft'} size={16} />
      </button>
      {items.map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="muted tiny">…</span>
        ) : (
          <button
            key={p}
            type="button"
            className={`page-btn ${p === page ? 'active' : ''}`}
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" className="page-btn" onClick={() => onChange(page + 1)} disabled={page >= pages} aria-label={t('common.next')}>
        <Icon name={document.documentElement.dir === 'rtl' ? 'chevronLeft' : 'chevronRight'} size={16} />
      </button>
    </nav>
  );
}

export function ImageWithFallback({ src, alt, className = '', ...rest }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={className}
        style={{ display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: 'var(--ink-300)' }}
        aria-label={alt}
      >
        <Icon name="image" size={30} strokeWidth={1.4} />
      </div>
    );
  }
  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt || ''}
      className={`${className} ${loaded ? 'loaded' : ''}`.trim()}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      {...rest}
    />
  );
}

export function Tabs({ items, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          className={`tab ${value === item.value ? 'active' : ''}`}
          onClick={() => onChange(item.value)}
        >
          {item.label}
          {item.count !== undefined && <span className="badge-count" style={{ marginInlineStart: 6 }}>{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, error, required, children, htmlFor }) {
  return (
    <div className="field">
      {label && (
        <label htmlFor={htmlFor}>
          {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
        </label>
      )}
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export function VerifiedBadge({ name = 'verified', title }) {
  return (
    <span className="badge-verified" title={title || ''} aria-label={title || 'verified'}>
      <Icon name={name} size={15} />
    </span>
  );
}

export function Lightbox({ images, index, onClose, onIndex }) {
  useEffect(() => {
    if (index === null || index === undefined) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex((index + 1) % images.length);
      if (e.key === 'ArrowLeft') onIndex((index - 1 + images.length) % images.length);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, images.length, onClose, onIndex]);

  if (index === null || index === undefined) return null;
  return (
    <div className="lightbox" onClick={onClose} role="presentation">
      <img src={images[index]} alt="" onClick={(e) => e.stopPropagation()} />
      <button type="button" className="icon-btn" style={{ position: 'fixed', top: 18, insetInlineEnd: 18, background: 'rgba(255,255,255,.14)', color: '#fff' }} onClick={onClose} aria-label="close">
        <Icon name="close" size={22} />
      </button>
    </div>
  );
}

export function StatCard({ label, value, icon, delta, deltaColor, hint }) {
  return (
    <div className="stat-card">
      <div className="row-between">
        <span className="label">{label}</span>
        {icon && (
          <span className="stat-icon">
            <Icon name={icon} size={17} />
          </span>
        )}
      </div>
      <span className="value">{value}</span>
      {delta !== undefined && (
        <span className="delta" style={{ color: deltaColor || 'var(--success)' }}>
          {delta}
        </span>
      )}
      {hint && <span className="tiny muted">{hint}</span>}
    </div>
  );
}

export function BarChart({ data, valueKey = 'count', labelKey = 'date' }) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  return (
    <div className="chart">
      {data.map((d, i) => (
        <div className="chart-col" key={i} title={`${d[labelKey]}: ${d[valueKey]}`}>
          <div className="chart-bar" style={{ height: `${Math.max(3, ((Number(d[valueKey]) || 0) / max) * 100)}%` }} />
          <span className="chart-label">{String(d[labelKey]).slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export function StatusChip({ status }) {
  const { t } = useApp();
  const map = {
    active: ['chip-success', 'checkCircle'],
    pending: ['chip-warning', 'clock'],
    rejected: ['chip-danger', 'close'],
    paused: ['chip', 'clock'],
    sold: ['chip-info', 'check'],
    expired: ['chip', 'clock'],
    deleted: ['chip-danger', 'trash'],
    suspended: ['chip-danger', 'ban'],
    banned: ['chip-danger', 'ban'],
    open: ['chip-warning', 'flag'],
    resolved: ['chip-success', 'checkCircle'],
    dismissed: ['chip', 'close'],
    reviewing: ['chip-info', 'eye'],
    paid: ['chip-success', 'checkCircle'],
    draft: ['chip', 'file'],
  };
  const [cls, icon] = map[status] || ['chip', 'info'];
  const labels = {
    active: t('myListings.active'),
    pending: t('myListings.pending'),
    rejected: t('myListings.rejected'),
    paused: t('myListings.paused'),
    sold: t('myListings.sold'),
    expired: t('myListings.expired'),
    deleted: t('common.delete'),
    suspended: t('admin.suspend'),
    banned: t('admin.suspend'),
    paid: t('admin.activate'),
    open: t('report.title'),
  };
  return (
    <span className={`chip ${cls}`} style={{ fontSize: '0.72rem' }}>
      <Icon name={icon} size={12} />
      {labels[status] || status}
    </span>
  );
}
