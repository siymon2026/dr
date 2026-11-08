/** Inline SVG icon set (stroke-based, 24px grid, currentColor). */
const paths = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  heart: <path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8Z" />,
  heartFilled: <path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8Z" fill="currentColor" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.4 3-5 6.5-5s6.5 1.6 6.5 5" /><path d="M17 5.2a3.5 3.5 0 0 1 0 6.6M18 15c2.4.5 3.5 2.2 3.5 5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  plusCircle: <><circle cx="12" cy="12" r="9" /><path d="M12 8.5v7M8.5 12h7" /></>,
  home: <><path d="m3 10.5 9-7.5 9 7.5" /><path d="M5.5 9.5V20h13V9.5" /><path d="M9.5 20v-5.5h5V20" /></>,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  message: <><path d="M21 11.5a8 8 0 0 1-8 8H8l-4.5 2.2V11.5a8 8 0 0 1 8-8h1.5a8 8 0 0 1 8 8Z" /></>,
  bell: <><path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" /><path d="M10.3 20a2 2 0 0 0 3.4 0" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m14 6-6 6 6 6" />,
  chevronRight: <path d="m10 6 6 6-6 6" />,
  chevronUp: <path d="m6 15 6-6 6 6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m4.5 12.5 5 5L20 7" />,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.7 2.7L16.5 9" /></>,
  star: <path d="m12 3.5 2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.9l6.1-.8Z" />,
  starFilled: <path d="m12 3.5 2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.9l6.1-.8Z" fill="currentColor" />,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  phone: <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3c0 1.1-.9 2-2 2A17 17 0 0 1 4.5 5.5c0-1.1.9-2 2-2Z" />,
  mapPin: <><path d="M19 10.5c0 5-7 11-7 11s-7-6-7-11a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10.5" r="2.6" /></>,
  camera: <><path d="M3.5 8.5h3l1.6-2.2h7.8l1.6 2.2h3v11h-17z" /><circle cx="12" cy="13.6" r="3.4" /></>,
  upload: <><path d="M12 16V4M7.5 8.5 12 4l4.5 4.5" /><path d="M4 16v3.5h16V16" /></>,
  trash: <><path d="M4 7h16M9.5 7V4.5h5V7" /><path d="M6.5 7 8 20.5h8L17.5 7" /><path d="M10 11v6M14 11v6" /></>,
  edit: <><path d="M4 20h4L20 8l-4-4L4 16Z" /><path d="m14.5 5.5 4 4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.5-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4Z" /></>,
  shield: <><path d="M12 3 5 6v5.5c0 4.6 3 8 7 9.5 4-1.5 7-4.9 7-9.5V6Z" /><path d="m9 12 2 2 4-4" /></>,
  flag: <><path d="M5 21V3.5h12l-2.5 4.5L17 12.5H5" /></>,
  share: <><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="m8.2 10.8 7.6-4M8.2 13.2l7.6 4" /></>,
  filter: <path d="M4 5.5h16l-6.3 7.6V20l-3.4-2v-4.9Z" />,
  sliders: <><path d="M4 8h9M17 8h3M4 16h3M11 16h9" /><circle cx="15" cy="8" r="2" /><circle cx="9" cy="16" r="2" /></>,
  bag: <><path d="M4.5 8h15l-1.2 12.5H5.7Z" /><path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2" /></>,
  store: <><path d="M4 9.5V20h16V9.5" /><path d="M3 9.5 5 4h14l2 5.5a3 3 0 0 1-5.5 1 3 3 0 0 1-5.5 0 3 3 0 0 1-5.5-1Z" /></>,
  car: <><path d="M5 16.5V12l2-5h10l2 5v4.5" /><path d="M4 16.5h16" /><circle cx="7.5" cy="17.5" r="1.8" /><circle cx="16.5" cy="17.5" r="1.8" /><path d="M6 12h12" /></>,
  laptop: <><rect x="4.5" y="5" width="15" height="10.5" rx="1.5" /><path d="M2.5 19h19" /></>,
  shirt: <path d="M8 3.5 4 6l2 4 2-1v10.5h8V9l2 1 2-4-4-2.5-2 2h-4Z" />,
  sofa: <><path d="M4 12V8.5a2 2 0 0 1 4 0V12" /><path d="M16 12V8.5a2 2 0 0 1 4 0V12" /><path d="M4 12h16v5H4z" /><path d="M6 17v3M18 17v3" /></>,
  plug: <><path d="M9 3v5M15 3v5" /><path d="M6.5 8h11v3a5.5 5.5 0 0 1-11 0Z" /><path d="M12 16.5V21" /></>,
  dumbbell: <><path d="M4 9.5v5M7 7.5v9M17 7.5v9M20 9.5v5M7 12h10" /></>,
  paw: <><circle cx="7" cy="8" r="1.8" /><circle cx="12" cy="6" r="1.8" /><circle cx="17" cy="8" r="1.8" /><path d="M12 11c3 0 5 2 5 4.5S14.8 20 12 20s-5-2-5-4.5S9 11 12 11Z" /></>,
  wrench: <path d="M15.5 3a5.5 5.5 0 0 0-5 7.7L3.5 17.7 6.3 20.5l7-7a5.5 5.5 0 0 0 6.9-7l-3 3-2.8-.7-.7-2.8Z" />,
  bricks: <><rect x="3.5" y="5" width="8" height="5" /><rect x="12.5" y="5" width="8" height="5" /><rect x="8" y="10" width="8" height="5" /><rect x="3.5" y="15" width="8" height="5" /><rect x="12.5" y="15" width="8" height="5" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z" /><path d="M4 18.5A2 2 0 0 1 6 16.5h14" /></>,
  toy: <><circle cx="12" cy="12" r="8.5" /><circle cx="9" cy="10" r="1.2" /><circle cx="15" cy="10" r="1.2" /><path d="M8.5 14.5a4 4 0 0 0 7 0" /></>,
  baby: <><circle cx="12" cy="13" r="6" /><path d="M12 7c0-2 1-3.5 3-3.5" /><circle cx="9.8" cy="12" r=".9" fill="currentColor" /><circle cx="14.2" cy="12" r=".9" fill="currentColor" /><path d="M10 15.5a2.4 2.4 0 0 0 4 0" /></>,
  sparkles: <><path d="M12 3v4M12 17v4M5 12H3M21 12h-2M6.5 6.5 5 5M19 19l-1.5-1.5M6.5 17.5 5 19M19 5l-1.5 1.5" /><circle cx="12" cy="12" r="3" /></>,
  tools: <><path d="M6 3.5 9 6.5 6 9.5 3 6.5Z" /><path d="M15 14.5 18 17.5 15 20.5 12 17.5Z" /><path d="m8.5 8.5 7 7" /><path d="m6 20.5 3-3M15 6.5l3-3" /></>,
  briefcase: <><rect x="3.5" y="7.5" width="17" height="12" rx="2" /><path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2" /><path d="M3.5 12h17" /></>,
  box: <><path d="m12 3 8 4.2v9.6L12 21l-8-4.2V7.2Z" /><path d="m4 7.2 8 4.3 8-4.3M12 11.5V21" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>,
  send: <><path d="m21 3-9.5 9.5" /><path d="M21 3 14.5 21l-3-7.5L4 10.5Z" /></>,
  image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m4.5 17.5 4.5-4.5 3.5 3.5 3-3 4 4" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6 8.5 6 8.5-6" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.2 4.2 5.6 5.6M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />,
  chart: <><path d="M4 20h16" /><rect x="5.5" y="12" width="3.5" height="6" /><rect x="10.5" y="8" width="3.5" height="10" /><rect x="15.5" y="4.5" width="3.5" height="13.5" /></>,
  money: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.8" /><path d="M6 9.5v5M18 9.5v5" /></>,
  tag: <><path d="M11 3.5H20v9l-8.5 8.5L3 12.5Z" /><circle cx="16" cy="8" r="1.4" /></>,
  crown: <path d="M3 18h18l-1.5-9-4.5 4-3-6-3 6-4.5-4Z" />,
  pin: <><path d="M12 3v11" /><path d="M8 10h8l-4 4.5Z" /><circle cx="12" cy="19" r="2" /></>,
  bolt: <path d="M13.5 2 5 13.5h5L9.5 22 19 10.5h-5Z" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.8v.2" /></>,
  alert: <><path d="M12 3 2.5 20h19Z" /><path d="M12 9v5M12 17v.2" /></>,
  refresh: <><path d="M20 11a8 8 0 1 0-2 5.5" /><path d="M20 4.5V11h-6" /></>,
  external: <><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 14v5.5H4.5V6H10" /></>,
  list: <><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" fill="currentColor" /><circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="4" cy="18" r="1" fill="currentColor" /></>,
  archive: <><rect x="3" y="4.5" width="18" height="4.5" rx="1" /><path d="M5 9v11h14V9" /><path d="M10 13h4" /></>,
  ban: <><circle cx="12" cy="12" r="9" /><path d="m6 18 12-12" /></>,
  wallet: <><path d="M3.5 7.5h17v12h-17z" /><path d="M3.5 7.5 17 4.5v3" /><circle cx="16.5" cy="13.5" r="1.2" fill="currentColor" /></>,
  file: <><path d="M6 3.5h8l4 4v13H6Z" /><path d="M14 3.5V8h4" /></>,
  download: <><path d="M12 4v11M8 11l4 4 4-4" /><path d="M4.5 20h15" /></>,
  card: <><rect x="2.5" y="5.5" width="19" height="13" rx="2" /><path d="M2.5 10h19" /></>,
  spark: <path d="M12 3.5 13.8 9l5.7 1.8L13.8 12.6 12 18l-1.8-5.4L4.5 10.8 10.2 9Z" />,
  verified: <><path d="m12 2.5 2.6 1.5 3-.2 1 2.8 2.4 1.8-1 2.8 1 2.8-2.4 1.8-1 2.8-3-.2L12 21.5l-2.6-1.5-3 .2-1-2.8L3 15.6l1-2.8-1-2.8 2.4-1.8 1-2.8 3 .2Z" /><path d="m8.8 12.2 2.2 2.2 4.2-4.4" /></>,
  location: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
  hamburger: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  credit: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v9M9 10.5c0-1.2 1.3-2 3-2s3 .8 3 2-1 1.6-3 2-3 .8-3 2 1.3 2 3 2 3-.8 3-2" /></>,
};

export default function Icon({ name, size = 20, fill = 'none', strokeWidth = 1.8, className = '', ...rest }) {
  const content = paths[name];
  if (!content) return null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {content}
    </svg>
  );
}

export const CATEGORY_ICONS = {
  car: 'car', home: 'home', phone: 'phone', laptop: 'laptop', shirt: 'shirt', sofa: 'sofa', plug: 'plug',
  dumbbell: 'dumbbell', paw: 'paw', wrench: 'wrench', bricks: 'bricks', book: 'book', toy: 'toy', baby: 'baby',
  sparkles: 'sparkles', tools: 'tools', briefcase: 'briefcase', box: 'box',
};
