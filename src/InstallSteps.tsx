import { gameUrl } from './CopyGameLink';
import { getPlatform } from './installLaunch';

export default function InstallSteps({ embedded }: { embedded: boolean }) {
  const platform = getPlatform();
  const game = window.isSecureContext ? 'Glow Words' : <a href={gameUrl}>Glow Words</a>;
  if (platform === 'ios') return <ol className="install-steps">
    <li>{embedded ? <>Use <strong>Open in Safari</strong> in this window’s menu, or copy the game link below and open it in Safari. Tap <strong>Share</strong>.</>
      : <>Open {game} in Safari and tap <strong>Share</strong>.</>}</li>
    <li>Choose <strong>Add to Home Screen</strong>. Turn on <strong>Open as Web App</strong> if offered, then tap <strong>Add</strong>.</li>
  </ol>;
  if (platform === 'android') return <ol className="install-steps">
    <li>{embedded ? <>Choose <strong>Open in Chrome</strong> in this window’s menu, or copy the game link below and open it in Chrome.</>
      : <>Open {game} in Chrome.</>}</li>
    <li>Tap Chrome’s <strong>⋮ menu</strong>, choose <strong>Install app</strong> or <strong>Add to Home screen</strong>, and follow the prompt.</li>
  </ol>;
  if (!window.isSecureContext) return <p className="install-steps">To install from this preview, open <a href={gameUrl}>Glow Words over HTTPS</a>.</p>;
  if (/Macintosh/.test(navigator.userAgent) && /Version\/.*Safari\//.test(navigator.userAgent)) {
    return <p className="install-steps">In Safari, choose <strong>File → Add to Dock</strong>, then select <strong>Add</strong>.</p>;
  }
  return <p className="install-steps">Open Glow Words in Chrome or Edge and choose the <strong>install option</strong> in the address bar or browser menu.</p>;
}
