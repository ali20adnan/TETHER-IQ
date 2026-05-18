const ICONS = {
  overview: (
  <>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </>
  ),
  crm: (
    <>
      <path d="M4 18V8" />
      <path d="M10 18V5" />
      <path d="M16 18v-7" />
      <path d="M22 18V3" />
    </>
  ),
  orders: (
    <>
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
      <path d="M3 4h2l1.5 11h11L20 7H7" />
    </>
  ),
  payments: (
    <>
      <circle cx="8" cy="8" r="5" />
      <path d="M12.5 12.5L19 19" />
      <path d="M16 6h5v5" />
    </>
  ),
  profiles: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c0-4 3.5-6 7-6s7 2 7 6" />
    </>
  ),
  site: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
    </>
  ),
  marketing: (
    <>
      <path d="M4 11v4l3 1.5V9L4 11z" />
      <path d="M7 9.5 18 4v12L7 16.5" />
      <path d="M18 16v3" />
    </>
  ),
  blocked: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M7 7l10 10" />
    </>
  ),
  chat: (
    <>
      <path d="M5 6a7 7 0 0114 0v7a7 7 0 01-7 7H9l-4 3v-4.5A7 7 0 015 13V6z" />
    </>
  ),
  ccotp: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M7 14h4" />
    </>
  ),
  admins: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M4 18c0-2.5 2-4 5-4M14 18c0-1.8 1.5-3 3.5-3" />
    </>
  ),
  system: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
};

export default function AdminTabIcon({ name }) {
  const paths = ICONS[name];
  if (!paths) return null;
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths}
    </svg>
  );
}
