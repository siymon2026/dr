/**
 * Server-Sent Events hub — per-user channels for chat/notifications.
 * Messages are never broadcast to other users.
 */
const channels = new Map(); // userId -> Set<res>

export function subscribe(userId, res) {
  const key = String(userId);
  if (!channels.has(key)) channels.set(key, new Set());
  channels.get(key).add(res);
  return () => {
    const set = channels.get(key);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) channels.delete(key);
  };
}

export function publish(userId, event, data) {
  const set = channels.get(String(userId));
  if (!set || set.size === 0) return 0;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  let sent = 0;
  for (const res of set) {
    try {
      res.write(payload);
      sent += 1;
    } catch {
      set.delete(res);
    }
  }
  return sent;
}

export function onlineUserCount() {
  return channels.size;
}

export function startHeartbeat() {
  const timer = setInterval(() => {
    for (const set of channels.values()) {
      for (const res of set) {
        try {
          res.write(': ping\n\n');
        } catch {
          set.delete(res);
        }
      }
    }
  }, 25000);
  timer.unref?.();
  return timer;
}
