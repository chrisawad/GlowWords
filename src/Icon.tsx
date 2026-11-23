const paths = {
  mic: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 18v3m-3 0h6"/></>,
  settings: <><path d="m9.5 3-.5 2-2 .9-1.9-.6-2 3.4 1.5 1.5v2.6L3.1 14.4l2 3.4 2-.6 1.9 1 .5 2.1h4l.6-2.1 2-1 1.9.6 2-3.4-1.5-1.6v-2.6L20 8.7l-2-3.4-2 .6L14 5l-.5-2z"/><circle cx="11.5" cy="11.6" r="3"/></>,
  sound: <><path d="M4 9h4l5-4v14l-5-4H4zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>,
  muted: <><path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6m0-6-5 6"/></>,
  clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></>,
  install: <path d="M12 3v11m-4-4 4 4 4-4M4 15v5h16v-5"/>,
  share: <><circle cx="18" cy="5" r="3"/><circle cx="5" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m7.7 10.6 7.6-4.2M7.7 13.4l7.6 4.2"/></>,
  spark: <path d="m12 2 2.1 7.9L22 12l-7.9 2.1L12 22l-2.1-7.9L2 12l7.9-2.1z"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  leaf: <><path d="M4 19c0-8 7-14 16-14 0 9-5 14-12 13m-4 3 10-11"/></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r=".7"/><circle cx="4" cy="12" r=".7"/><circle cx="4" cy="18" r=".7"/></>,
};

export default function Icon({ name }: { name: keyof typeof paths }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
