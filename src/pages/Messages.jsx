import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Avatar, Button, EmptyState, Lightbox } from '../components/ui.jsx';
import { useApp } from '../state/AppContext.jsx';
import { api } from '../lib/api.js';
import { dayLabel, formatPrice, timeAgo, timeOnly } from '../lib/format.js';

export default function Messages() {
  const { id: convId } = useParams();
  const navigate = useNavigate();
  const { t, lang, user, toast, errorMessage, refreshCounts, subscribeEvents } = useApp();

  const [conversations, setConversations] = useState(null);
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const activeId = convId ? Number(convId) : null;

  useEffect(() => {
    if (!user) navigate('/login?next=/messages', { replace: true });
  }, [user, navigate]);

  const loadConversations = useCallback(() => {
    api
      .get('/conversations')
      .then((res) => setConversations(res.items))
      .catch((err) => toast(errorMessage(err), 'error'));
  }, [toast, errorMessage]);

  useEffect(() => {
    if (user) loadConversations();
  }, [user, loadConversations]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  };

  const loadThread = useCallback(
    async (id) => {
      try {
        const res = await api.get(`/conversations/${id}`);
        setThread(res.conversation);
        setMessages(res.messages);
        setBlocked(res.blocked_by_me);
        refreshCounts();
        scrollToBottom();
      } catch (err) {
        toast(errorMessage(err), 'error');
        navigate('/messages', { replace: true });
      }
    },
    [toast, errorMessage, refreshCounts, navigate],
  );

  useEffect(() => {
    if (activeId) loadThread(activeId);
    else {
      setThread(null);
      setMessages([]);
    }
  }, [activeId, loadThread]);

  // live updates
  useEffect(() => {
    const off = subscribeEvents((type, payload) => {
      if (type === 'message') {
        if (payload.conversation_id === activeId) {
          setMessages((prev) => (prev.some((m) => m.id === payload.id) ? prev : [...prev, payload]));
          if (payload.sender_id !== user?.id) api.post(`/conversations/${activeId}/read`, {}).catch(() => {});
          scrollToBottom();
        }
        loadConversations();
        refreshCounts();
      }
      if (type === 'read' && payload.conversation_id === activeId) {
        setMessages((prev) => prev.map((m) => (m.read_at ? m : { ...m, read_at: Date.now() })));
      }
      if (type === 'notification') loadConversations();
    });
    return off;
  }, [subscribeEvents, activeId, user?.id, loadConversations, refreshCounts]);

  const send = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || !activeId || sending) return;
    setSending(true);
    setText('');
    try {
      const res = await api.post(`/conversations/${activeId}/messages`, { body });
      setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
      scrollToBottom();
      loadConversations();
    } catch (err) {
      setText(body);
      toast(errorMessage(err), 'error');
    } finally {
      setSending(false);
    }
  };

  const uploadImage = async (file) => {
    if (!file || !activeId) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await api.upload(`/conversations/${activeId}/image`, form);
      setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
      scrollToBottom();
      loadConversations();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toggleBlock = async () => {
    try {
      if (blocked) await api.del(`/conversations/block/${thread.counterpart.id}`);
      else await api.post(`/conversations/block/${thread.counterpart.id}`, {});
      setBlocked(!blocked);
      toast(t('account.saved'), 'success');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  if (!user) return null;

  const imagesInThread = messages.filter((m) => m.attachment).map((m) => m.attachment);
  let lastDay = null;

  return (
    <div className="container" style={{ paddingTop: 18, paddingBottom: 22 }}>
      <div className={`chat-layout ${activeId ? '' : 'mobile-list'}`}>
        <div className="conv-list">
          <div className="row-between" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <b style={{ fontSize: '0.96rem' }}>{t('messages.title')}</b>
            <span className="chip chip-brand tiny">{conversations?.length || 0}</span>
          </div>
          {!conversations && (
            <div className="stack" style={{ padding: 12, gap: 8 }}>
              {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 62 }} />)}
            </div>
          )}
          {conversations && conversations.length === 0 && (
            <EmptyState
              icon="message"
              title={t('messages.empty')}
              hint={t('messages.emptyHint')}
              action={<Link to="/listings" className="btn btn-sm mt-2">{t('nav.listings')}</Link>}
            />
          )}
          {conversations?.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`conv-item ${c.id === activeId ? 'active' : ''}`}
              onClick={() => navigate(`/messages/${c.id}`)}
            >
              {c.listing.image ? (
                <img src={c.listing.image} alt="" loading="lazy" decoding="async" />
              ) : (
                <div style={{ width: 46, height: 46, borderRadius: 10, background: 'var(--surface-2)', display: 'grid', placeItems: 'center' }}>
                  <Icon name="image" size={18} />
                </div>
              )}
              <div className="conv-body">
                <span className="conv-name">
                  <span className="truncate">{c.counterpart.name}</span>
                  <span className="tiny muted nowrap">{timeAgo(c.last_message_at || c.created_at, t)}</span>
                </span>
                <span className="conv-preview">{c.listing.title}</span>
                <span className="row-between" style={{ gap: 6 }}>
                  <span className="conv-preview" style={{ color: c.unread ? 'var(--text)' : undefined, fontWeight: c.unread ? 600 : 400 }}>
                    {c.last_message || '—'}
                  </span>
                  {c.unread > 0 && <span className="unread-pill">{c.unread}</span>}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="chat-panel">
          {!thread ? (
            <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
              <EmptyState icon="message" title={t('messages.select')} hint={t('messages.emptyHint')} />
            </div>
          ) : (
            <>
              <div className="chat-header">
                <button type="button" className="icon-btn mobile-only" onClick={() => navigate('/messages')} aria-label="back">
                  <Icon name="chevronLeft" size={19} className="rtl-flip" />
                </button>
                <Avatar src={thread.counterpart.avatar} name={thread.counterpart.name} size="sm" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Link to={`/users/${thread.counterpart.id}`} className="strong truncate" style={{ fontSize: '0.9rem', display: 'block' }}>
                    {thread.counterpart.name}
                  </Link>
                  <Link to={`/listing/${thread.listing.public_id}`} className="tiny muted truncate" style={{ display: 'block' }}>
                    {t('messages.about')}: {thread.listing.title}
                  </Link>
                </div>
                <Link to={`/listing/${thread.listing.public_id}`} className="desktop-only" style={{ flex: '0 0 auto' }}>
                  {thread.listing.image && (
                    <img src={thread.listing.image} alt="" style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'cover' }} loading="lazy" decoding="async" />
                  )}
                </Link>
                <button type="button" className="icon-btn" onClick={toggleBlock} title={blocked ? t('messages.unblock') : t('messages.block')} aria-label="block">
                  <Icon name={blocked ? 'ban' : 'shield'} size={18} style={{ color: blocked ? 'var(--danger)' : undefined }} />
                </button>
              </div>

              <div className="chat-scroll" ref={scrollRef}>
                <div className="chat-day">
                  <Link to={`/listing/${thread.listing.public_id}`} className="row" style={{ gap: 8, justifyContent: 'center' }}>
                    {thread.listing.image && <img src={thread.listing.image} alt="" style={{ width: 30, height: 30, borderRadius: 6, objectFit: 'cover' }} loading="lazy" decoding="async" />}
                    <span>{thread.listing.title} · {formatPrice(thread.listing.price, thread.listing.currency, lang)}</span>
                  </Link>
                </div>
                {messages.map((m) => {
                  const mine = m.sender_id === user.id;
                  const day = dayLabel(m.created_at, lang, t);
                  const showDay = day !== lastDay;
                  lastDay = day;
                  return (
                    <div key={m.id} style={{ display: 'contents' }}>
                      {showDay && <span className="chat-day">{day}</span>}
                      <div className={`bubble-row ${mine ? 'mine' : ''}`}>
                        {!mine && <Avatar src={thread.counterpart.avatar} name={thread.counterpart.name} size="sm" />}
                        <div className="bubble">
                          {m.attachment && (
                            <img
                              src={m.attachment}
                              alt=""
                              onClick={() => setLightbox(imagesInThread.indexOf(m.attachment))}
                              style={{ display: 'block', marginBottom: m.body ? 6 : 0 }}
                            />
                          )}
                          {m.body}
                          <span className="bubble-time">
                            {timeOnly(m.created_at)}
                            {mine && (m.read_at ? ' ✓✓' : ' ✓')}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {blocked && (
                  <div className="chat-day" style={{ color: 'var(--danger)' }}>{t('messages.blocked')}</div>
                )}
              </div>

              <form className="chat-composer" onSubmit={send}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => uploadImage(e.target.files?.[0])}
                />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || blocked}
                  aria-label={t('post.field.photos')}
                >
                  {uploading ? <span className="spinner spinner-dark" style={{ width: 16, height: 16 }} /> : <Icon name="image" size={20} />}
                </button>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t('messages.placeholder')}
                  maxLength={2000}
                  disabled={blocked}
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send(e);
                    }
                  }}
                />
                <Button type="submit" loading={sending} disabled={!text.trim() || blocked} icon="send" aria-label={t('messages.send')}>
                  <span className="desktop-only">{t('messages.send')}</span>
                </Button>
              </form>
            </>
          )}
        </div>
      </div>

      <Lightbox images={imagesInThread} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />
    </div>
  );
}
