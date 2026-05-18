const ICONS = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  crm: (
    <>
      <path d="M4 19V9" />
      <path d="M10 19V5" />
      <path d="M16 19v-6" />
      <path d="M22 19V3" />
    </>
  ),
  orders: (
    <>
      <path d="M6 6h15l-1.5 9h-12z" />
      <path d="M6 6 5 3H2" />
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
    </>
  ),
  payments: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M2 10h20" />
      <path d="M12 14h.01" />
    </>
  ),
  profiles: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20v-1a7 7 0 0114 0v1" />
    </>
  ),
  site: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9" />
      <path d="M12 3c-2.5 2.5-4 5.5-4 9s1.5 6.5 4 9" />
    </>
  ),
  marketing: (
    <>
      <path d="M4 10v5l4-2V8L4 10z" />
      <path d="M8 8.5 19 4v11L8 17.5" />
    </>
  ),
  blocked: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m7 7 10 10" />
    </>
  ),
  chat: (
    <>
      <path d="M6 7a6 6 0 0112 0v6a6 6 0 01-6 6H9l-4 3v-4a6 6 0 01-5-5V7z" />
    </>
  ),
  ccotp: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </>
  ),
  admins: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M4 19v-1a5 5 0 015-5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M14 19v-1a3 3 0 013-3" />
    </>
  ),
  system: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
};

export default function AdminTabIcon({ name }) {
  const paths = ICONS[name];
  if (!paths) return null;
  return (
    <svg
      className="admin-tab-icon__svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths}
    </svg>
  );
}
