/**
 * Tiny SEO helpers for the SPA: keep <title>, meta description, canonical and
 * OpenGraph/Twitter tags in sync with the current page without a helmet lib.
 */

function setMeta(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/** Apply page metadata. Returns a cleanup function that restores the defaults. */
export function applySeo({ title, description, image, url, type = 'website', jsonLd }) {
  const prev = {
    title: document.title,
    description: document.head.querySelector('meta[name="description"]')?.getAttribute('content') || '',
  };
  if (title) document.title = title;
  if (description) {
    setMeta('name', 'description', description.slice(0, 300));
    setMeta('property', 'og:description', description.slice(0, 300));
  }
  if (title) {
    setMeta('property', 'og:title', title);
    setMeta('name', 'twitter:title', title);
  }
  if (image) {
    setMeta('property', 'og:image', image);
    setMeta('name', 'twitter:image', image);
  }
  setMeta('property', 'og:type', type);
  if (url) {
    setMeta('property', 'og:url', url);
    setLink('canonical', url);
  }

  let script = null;
  if (jsonLd) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(jsonLd);
    document.head.appendChild(script);
  }

  return () => {
    document.title = prev.title;
    if (prev.description) setMeta('name', 'description', prev.description);
    if (script?.parentNode) script.parentNode.removeChild(script);
  };
}
