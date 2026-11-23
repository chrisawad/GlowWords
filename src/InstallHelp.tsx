import CopyGameLink, { gameUrl } from './CopyGameLink';

function getPlatform() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Mac/.test(navigator.platform)) return 'mac';
  return 'desktop';
}

const launchInstructions = {
  android: 'Swipe up on your Android home screen to open the app drawer. Find Glow Words and tap it to play.',
  ios: 'Tap Glow Words on your Home Screen to play.',
  mac: 'Search for Glow Words in Spotlight and open it to play.',
  desktop: 'Search for Glow Words in your computer’s apps and open it to play.',
};

function PlatformInstructions({ platform }: { platform: keyof typeof launchInstructions }) {
  if (platform === 'android') {
    return <>
      <ol>
        <li>If the game opened inside another app, open its menu (⋮) and choose <strong>Open in Chrome</strong> or <strong>Open in browser</strong>. Choose Chrome if asked.</li>
        <li>If that option is missing, tap <strong>Copy link</strong> below. Open Chrome, paste the link into its address bar, and go to the game.</li>
        <li>In Chrome’s menu (⋮), choose <strong>Install and create shortcut</strong>, then <strong>Install</strong>. Some versions show <strong>Install app</strong> or <strong>Add to Home screen</strong> instead.</li>
      </ol>
      <CopyGameLink />
    </>;
  }
  if (platform === 'ios') {
    return <p>Open Glow Words in Safari. Tap Safari’s <strong>Share</strong> button, then <strong>Add to Home Screen</strong>. Turn on <strong>Open as Web App</strong> if offered and tap <strong>Add</strong>.</p>;
  }
  if (platform === 'mac') {
    return <p>Open Glow Words in Safari. Choose <strong>File → Add to Dock</strong>, then <strong>Add</strong>.</p>;
  }
  return <p>Open Glow Words in Chrome. In its menu, choose <strong>Cast, save, and share</strong>, then <strong>Install page as app</strong>. In Edge, look for the install icon in the address bar.</p>;
}

export default function InstallHelp({ installed, expanded = false }: { installed: boolean; expanded?: boolean }) {
  const platform = getPlatform();
  return <details className="install-help" open={expanded}>
    <summary>{installed ? 'Where to find Glow Words' : 'How to install'}</summary>
    {!installed && <>
      {!window.isSecureContext && <p>For installation, open <a href={gameUrl}>Glow Words over HTTPS</a>.</p>}
      <PlatformInstructions platform={platform} />
    </>}
    <p>{!installed && <strong>Already installed? </strong>}{launchInstructions[platform]}</p>
  </details>;
}
