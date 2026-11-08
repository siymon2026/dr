import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ListingCard from '../components/ListingCard.jsx';
import { Alert, Avatar, Button, Lightbox, Modal, Stars, EmptyState } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { applySeo } from '../lib/seo.js';
import { formatDate, formatPrice, pickName, timeAgo } from '../lib/format.js';

const REPORT_REASONS = ['prohibited_item', 'scam', 'wrong_category', 'counterfeit', 'offensive', 'duplicate', 'spam', 'other'];

export default function ListingDetail() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const { t, lang, user, toast, errorMessage, requestGeolocation } = useApp();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(null);
  const [showPhone, setShowPhone] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('scam');
  const [reportDetails, setReportDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageBusy, setMessageBusy] = useState(false);
  const [distance, setDistance] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    setActive(0);
    api
      .get(`/listings/${publicId}`)
      .then((res) => {
        setData(res);
        setSaved(res.is_favorite);
      })
      .catch((err) => setError(err));
  }, [publicId, user?.id]);

  const listing = data?.listing;
  const images = listing?.images?.length ? listing.images.map((i) => i.path) : [];

  useEffect(() => {
    if (!listing || !navigator.geolocation) return;
    if (typeof listing.lat !== 'number' || typeof listing.lng !== 'number') return;
    requestGeolocation()
      .then((coords) => {
        const R = 6371;
        const dLat = ((listing.lat - coords.lat) * Math.PI) / 180;
        const dLng = ((listing.lng - coords.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((coords.lat * Math.PI) / 180) * Math.cos((listing.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        setDistance(Math.round(2 * R * Math.asin(Math.sqrt(a))));
      })
      .catch(() => {});
  }, [listing, requestGeolocation]);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: listing.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast(t('listing.copied'), 'success');
    } catch {
      /* user cancelled */
    }
  };

  const toggleSave = async () => {
    if (!user) return navigate('/login');
    setBusy(true);
    try {
      const res = await api.post(`/favorites/${listing.id}`);
      setSaved(res.favorite);
      toast(res.favorite ? t('listing.saved') : t('common.delete'), 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const revealPhone = async () => {
    setShowPhone(true);
    try {
      await api.post(`/listings/${listing.id}/contact`, {});
    } catch {
      /* non-blocking */
    }
  };

  const startChat = async () => {
    if (!user) return navigate(`/login?next=/listing/${publicId}`);
    setMessageBusy(true);
    try {
      const res = await api.post('/conversations', { listing_id: listing.id, message: messageText.trim() || undefined });
      setMessageOpen(false);
      setMessageText('');
      navigate(`/messages/${res.conversation.id}`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setMessageBusy(false);
    }
  };

  const sendReport = async () => {
    setReportBusy(true);
    try {
      await api.post('/reports', { target_type: 'listing', target_id: listing.id, reason: reportReason, details: reportDetails });
      setReportOpen(false);
      toast(t('report.sent'), 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setReportBusy(false);
    }
  };

  const ownerId = data?.owner?.id;
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);

  const submitReview = async () => {
    setReviewBusy(true);
    try {
      await api.post('/reviews', { target_type: 'user', target_id: ownerId, rating: reviewRating, comment: reviewComment });
      setReviewDone(true);
      toast(t('review.thanks'), 'success');
    } catch (err) {
      if (err.code === 'already_reviewed') setAlreadyReviewed(true);
      toast(errorMessage(err), 'error');
    } finally {
      setReviewBusy(false);
    }
  };

  const structuredData = useMemo(() => {
    if (!listing) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: listing.title,
      description: listing.description,
      image: images.slice(0, 4),
      offers: {
        '@type': 'Offer',
        price: listing.price,
        priceCurrency: 'MAD',
        availability: listing.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      },
    };
  }, [listing, images]);

  useEffect(() => {
    if (!listing) return undefined;
    return applySeo({
      title: `${listing.title} — ${formatPrice(listing.price, 'MAD', lang)} | ${t('brand.name')}`,
      description: listing.description,
      image: images?.[0],
      url: `${window.location.origin}/listing/${listing.public_id}`,
      type: 'product',
      jsonLd: structuredData,
    });
  }, [listing, structuredData, images, lang, t]);

  if (error) {
    return (
      <div className="container" style={{ padding: '60px 0' }}>
        <EmptyState
          icon="alert"
          title={t('errors.listing_not_found')}
          hint={t('common.notFoundHint')}
          action={<Link to="/listings" className="btn mt-2">{t('nav.listings')}</Link>}
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container detail-grid" style={{ paddingTop: 24 }}>
        <div className="skeleton" style={{ aspectRatio: '4/3', borderRadius: 'var(--radius-lg)' }} />
        <div className="stack">
          <div className="skeleton" style={{ height: 28, width: '75%' }} />
          <div className="skeleton" style={{ height: 40, width: '45%' }} />
          <div className="skeleton" style={{ height: 120 }} />
        </div>
      </div>
    );
  }

  const isOwner = data.is_owner;
  const phone = data.owner?.phone;

  return (
    <div className="container" style={{ paddingTop: 20, paddingBottom: 44 }}>
      <nav className="tiny muted row" style={{ gap: 6, marginBottom: 14, flexWrap: 'wrap' }} aria-label="breadcrumb">
        <Link to="/" className="link">{t('nav.home')}</Link>
        <Icon name="chevronLeft" size={12} className="rtl-flip" />
        <Link to={`/listings?category=${listing.category.id}`} className="link">{pickName(listing.category.name, lang)}</Link>
        <Icon name="chevronLeft" size={12} className="rtl-flip" />
        <span className="truncate" style={{ maxWidth: 260 }}>{listing.title}</span>
      </nav>

      {listing.status !== 'active' && !isOwner && (
        <Alert type="warning" icon="info">
          {t('listing.sold')} / {listing.status}
        </Alert>
      )}
      {isOwner && listing.status !== 'active' && (
        <Alert type="info" icon="info">
          <div className="row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
            <span>
              {lang === 'ar' ? 'حالة الإعلان:' : lang === 'fr' ? 'Statut :' : 'Status:'} <b>{listing.status}</b>
              {listing.rejection_reason ? ` — ${listing.rejection_reason}` : ''}
            </span>
            <Link to="/my-listings" className="btn btn-sm btn-outline">{t('nav.myListings')}</Link>
          </div>
        </Alert>
      )}

      <div className="detail-grid" style={{ marginTop: 12 }}>
        <div>
          {/* gallery */}
          <div className="gallery-main">
            {images.length ? (
              <img
                src={images[active]}
                alt={`${listing.title} — ${active + 1}`}
                onClick={() => setLightbox(active)}
                style={{ cursor: 'zoom-in' }}
              />
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--ink-300)' }}>
                <Icon name="image" size={54} strokeWidth={1.2} />
              </div>
            )}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  className="gallery-nav prev"
                  onClick={() => setActive((a) => (a - 1 + images.length) % images.length)}
                  aria-label={t('common.prev')}
                >
                  <Icon name={document.documentElement.dir === 'rtl' ? 'chevronRight' : 'chevronLeft'} size={19} />
                </button>
                <button
                  type="button"
                  className="gallery-nav next"
                  onClick={() => setActive((a) => (a + 1) % images.length)}
                  aria-label={t('common.next')}
                >
                  <Icon name={document.documentElement.dir === 'rtl' ? 'chevronLeft' : 'chevronRight'} size={19} />
                </button>
                <span className="img-count" style={{ bottom: 12, insetInlineStart: 12, insetInlineEnd: 'auto' }}>
                  {active + 1} / {images.length}
                </span>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="gallery-thumbs">
              {images.map((img, i) => (
                <img key={img} src={listing.images[i].thumb || img} alt="" className={i === active ? 'active' : ''} onClick={() => setActive(i)} />
              ))}
            </div>
          )}

          {/* title + price */}
          <div className="card card-pad mt-3" style={{ display: 'grid', gap: 14 }}>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {listing.featured && (
                <span className="chip chip-accent"><Icon name="spark" size={12} /> {t('listing.featured')}</span>
              )}
              {listing.pinned && <span className="chip chip-info"><Icon name="pin" size={12} /> {t('listing.pinned')}</span>}
              {listing.condition === 'new' && <span className="chip chip-success">{t('listing.condition.new')}</span>}
            </div>

            <h1 style={{ fontSize: 'clamp(1.2rem, 3vw, 1.65rem)', lineHeight: 1.35 }}>{listing.title}</h1>

            <div className="price-block">
              <span className="price-main">
                {listing.price > 0 ? formatPrice(listing.price, listing.currency, lang) : t('store.contact')}
              </span>
              {listing.negotiable && <span className="chip chip-brand">{t('listing.negotiable')}</span>}
            </div>

            <div className="row" style={{ flexWrap: 'wrap', gap: 14, color: 'var(--text-muted)', fontSize: '0.83rem' }}>
              <span className="row" style={{ gap: 5 }}><Icon name="mapPin" size={14} /> {pickName(listing.city.name, lang)}{listing.area ? ` · ${pickName(listing.area.name, lang)}` : ''}</span>
              <span className="row" style={{ gap: 5 }}><Icon name="clock" size={14} /> {timeAgo(listing.published_at || listing.created_at, t)}</span>
              <span className="row" style={{ gap: 5 }}><Icon name="eye" size={14} /> {listing.views} {t('listing.views')}</span>
              <span className="row" style={{ gap: 5 }}><Icon name="heart" size={14} /> {listing.favorites} {t('listing.favorites')}</span>
            </div>

            <div className="divider" />

            <div>
              <h2 className="section-title" style={{ fontSize: '1rem', marginBottom: 10 }}>
                <span className="dot" style={{ height: 16 }} /> {t('listing.description')}
              </h2>
              <p className="description-body">{listing.description}</p>
            </div>

            <div className="spec-grid">
              <div className="spec">
                <span>{t('listing.condition')}</span>
                <b>{t(`listing.condition.${listing.condition}`)}</b>
              </div>
              <div className="spec">
                <span>{t('filters.category')}</span>
                <b>{pickName(listing.category.name, lang)}</b>
              </div>
              <div className="spec">
                <span>{t('filters.city')}</span>
                <b>{pickName(listing.city.name, lang)}</b>
              </div>
              {listing.attributes && Object.keys(listing.attributes).length > 0 &&
                Object.entries(listing.attributes).slice(0, 6).map(([k, v]) => (
                  <div className="spec" key={k}>
                    <span>{k}</span>
                    <b>{String(v)}</b>
                  </div>
                ))}
              {distance !== null && (
                <div className="spec">
                  <span>{t('home.nearby')}</span>
                  <b>~{distance} km</b>
                </div>
              )}
            </div>

            <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              <Button variant="outline" size="sm" icon="share" onClick={share} type="button">{t('listing.share')}</Button>
              <Button
                variant={saved ? 'soft' : 'outline'}
                size="sm"
                icon={saved ? 'heartFilled' : 'heart'}
                onClick={toggleSave}
                loading={busy}
                type="button"
              >
                {saved ? t('listing.saved') : t('listing.save')}
              </Button>
              <Button variant="outline" size="sm" icon="flag" onClick={() => (user ? setReportOpen(true) : navigate('/login'))} type="button">
                {t('listing.report')}
              </Button>
              {isOwner && (
                <Link to={`/listings/${listing.id}/edit`} className="btn btn-sm btn-soft">
                  <Icon name="edit" size={15} /> {t('myListings.edit')}
                </Link>
              )}
            </div>
          </div>

          {/* map placeholder / location */}
          {(listing.lat || listing.lng) && (
            <div className="card card-pad mt-3" style={{ display: 'grid', gap: 10 }}>
              <h3 className="row" style={{ gap: 7, fontSize: '0.96rem' }}>
                <Icon name="mapPin" size={16} /> {pickName(listing.city.name, lang)}
              </h3>
              <a
                className="btn btn-outline btn-sm"
                style={{ width: 'fit-content' }}
                href={`https://www.openstreetmap.org/?mlat=${listing.lat}&mlon=${listing.lng}#map=14/${listing.lat}/${listing.lng}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="external" size={14} /> {lang === 'ar' ? 'عرض على الخريطة' : lang === 'fr' ? 'Voir sur la carte' : 'View on map'}
              </a>
            </div>
          )}

          {/* safety */}
          <div className="card card-pad mt-3" style={{ background: 'var(--brand-50)', borderColor: 'var(--brand-200)' }}>
            <h3 className="row" style={{ gap: 7, fontSize: '0.95rem', marginBottom: 8 }}>
              <Icon name="shield" size={17} style={{ color: 'var(--brand-700)' }} />
              {t('listing.safety')}
            </h3>
            <ul className="stack" style={{ gap: 6, fontSize: '0.84rem', color: 'var(--brand-800)' }}>
              {[1, 2, 3, 4].map((i) => (
                <li key={i} className="row" style={{ gap: 7, alignItems: 'flex-start' }}>
                  <Icon name="check" size={13} style={{ marginTop: 4, flex: '0 0 auto' }} /> {t(`listing.safety${i}`)}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* sidebar */}
        <aside className="stack" style={{ gap: 14 }}>
          <div className="card seller-card">
            <div className="row" style={{ gap: 10 }}>
              <Link to={`/users/${data.owner.id}`}>
                <Avatar src={data.owner.avatar} name={data.owner.name} size="lg" />
              </Link>
              <div style={{ minWidth: 0 }}>
                <Link to={`/users/${data.owner.id}`} className="row" style={{ gap: 5 }}>
                  <b style={{ fontSize: '0.96rem' }} className="truncate">{data.owner.name}</b>
                  {data.owner.verified && (
                    <span className="badge-verified" title={t('account.verifiedSeller')}>
                      <Icon name="verified" size={15} />
                    </span>
                  )}
                </Link>
                <Stars value={data.owner.rating_avg} count={data.owner.rating_count} size={13} />
                <div className="tiny muted">
                  {t('listing.memberSince')} {formatDate(data.owner.member_since, lang)}
                </div>
              </div>
            </div>

            {data.store && (
              <Link to={`/stores/${data.store.slug}`} className="card card-pad" style={{ padding: 10, display: 'grid', gap: 6, background: 'var(--surface-2)' }}>
                <div className="row" style={{ gap: 8 }}>
                  <Avatar src={data.store.logo} name={data.store.name} size="sm" />
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 4 }}>
                      <b className="truncate" style={{ fontSize: '0.84rem' }}>{data.store.name}</b>
                      {data.store.verified && <Icon name="verified" size={13} style={{ color: 'var(--brand-600)' }} />}
                    </div>
                    <span className="tiny muted">{data.store.followers} {t('store.followers')}</span>
                  </div>
                </div>
              </Link>
            )}

            <div className="stack" style={{ gap: 8 }}>
              {user && !isOwner ? (
                <>
                  <Button icon="message" onClick={() => setMessageOpen(true)} type="button" className="btn-block">
                    {t('listing.sendMessage')}
                  </Button>
                  {phone ? (
                    <a href={`tel:${phone}`} className="btn btn-outline btn-block">
                      <Icon name="phone" size={16} /> {t('listing.contact')} {showPhone ? '' : '····'}
                    </a>
                  ) : (
                    <Button variant="outline" icon="phone" onClick={revealPhone} type="button" className="btn-block">
                      {t('listing.showPhone')}
                    </Button>
                  )}
                </>
              ) : !user ? (
                <>
                  <Link to={`/login?next=/listing/${publicId}`} className="btn btn-block">
                    <Icon name="message" size={16} /> {t('listing.sendMessage')}
                  </Link>
                  <Link to="/register" className="btn btn-outline btn-block">{t('nav.register')}</Link>
                </>
              ) : (
                <Alert type="info" icon="info">
                  {lang === 'ar' ? 'هذا إعلانك.' : lang === 'fr' ? 'C’est votre annonce.' : 'This is your listing.'}
                </Alert>
              )}
              {showPhone && phone && (
                <div className="alert alert-success" style={{ justifyContent: 'center' }}>
                  <a href={`tel:${phone}`} dir="ltr" style={{ fontWeight: 800, fontSize: '1.05rem' }}>{phone}</a>
                </div>
              )}
            </div>

            {user && !isOwner && !reviewDone && !alreadyReviewed && (
              <div className="stack" style={{ gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <span className="filter-title">{t('review.write')}</span>
                <Stars value={reviewRating} interactive onChange={setReviewRating} size={22} />
                <textarea
                  className="textarea"
                  style={{ minHeight: 70 }}
                  placeholder={t('review.comment')}
                  value={reviewComment}
                  maxLength={800}
                  onChange={(e) => setReviewComment(e.target.value)}
                />
                <Button variant="soft" size="sm" onClick={submitReview} loading={reviewBusy} type="button">
                  {t('review.submit')}
                </Button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {data.similar?.length > 0 && (
        <section className="section-sm">
          <div className="section-head">
            <h2 className="section-title"><span className="dot" /> {t('listing.similar')}</h2>
            <Link to={`/listings?category=${listing.category.id}`} className="section-link">
              {t('common.viewAll')} <Icon name="chevronLeft" size={15} className="rtl-flip" />
            </Link>
          </div>
          <div className="listing-grid">
            {data.similar.slice(0, 4).map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}

      <Lightbox images={images} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />

      <Modal
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        title={t('listing.sendMessage')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMessageOpen(false)} type="button">{t('common.cancel')}</Button>
            <Button onClick={startChat} loading={messageBusy} type="button" icon="send">{t('messages.send')}</Button>
          </>
        }
      >
        <div className="row" style={{ gap: 10 }}>
          <img src={images[0]} alt="" style={{ width: 54, height: 54, borderRadius: 10, objectFit: 'cover' }} />
          <div style={{ minWidth: 0 }}>
            <b className="truncate" style={{ fontSize: '0.88rem' }}>{listing.title}</b>
            <div className="small muted">{formatPrice(listing.price, listing.currency, lang)}</div>
          </div>
        </div>
        <textarea
          className="textarea"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder={t('messages.placeholder')}
          maxLength={2000}
        />
      </Modal>

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={t('report.title')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReportOpen(false)} type="button">{t('common.cancel')}</Button>
            <Button variant="danger" onClick={sendReport} loading={reportBusy} type="button">{t('report.submit')}</Button>
          </>
        }
      >
        <div className="field">
          <label htmlFor="report-reason">{t('report.reason')}</label>
          <select id="report-reason" className="select" value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>{t(`report.reason.${r}`)}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="report-details">{t('report.details')}</label>
          <textarea
            id="report-details"
            className="textarea"
            style={{ minHeight: 90 }}
            value={reportDetails}
            maxLength={1000}
            onChange={(e) => setReportDetails(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
