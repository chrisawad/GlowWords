import { useCallback, useEffect, useState } from 'react';
import CopyGameLink from './CopyGameLink';
import Icon from './Icon';
import InstallSteps from './InstallSteps';
import { isEmbeddedLaunch } from './installLaunch';
import Modal from './Modal';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
const nav = navigator as Navigator & {
  standalone?: boolean;
  install?: () => Promise<unknown>;
  getInstalledRelatedApps?: () => Promise<{ platform: string; url?: string; id?: string }[]>;
};
const standalone = matchMedia('(display-mode: standalone), (display-mode: minimal-ui), (display-mode: window-controls-overlay)');
const canceledMessage = 'Installation canceled. You can keep playing here.';

function isInstallCancellation(error: unknown) {
  if (!(error instanceof Error) || error.name !== 'AbortError') return false;
  // Some hosts use AbortError even when they explicitly report a policy or platform restriction.
  return !/not supported|unsupported|not allowed|not permitted|unavailable|not available|restricted|blocked|permission denied/i.test(error.message);
}

export function useInstall() {
  const [embedded] = useState(isEmbeddedLaunch);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [installedHere, setInstalledHere] = useState(false);
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);
  const [checked, setChecked] = useState(false);
  const [offerSeen, setOfferSeen] = useState(false);
  const rememberOffer = useCallback(() => { setOfferSeen(true); setMessage(''); }, []);
  const [appMode, setAppMode] = useState(standalone.matches);
  useEffect(() => {
    let active = true;
    let latestCheck = 0;
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href;
    // Give a fast positive result time to arrive. Some webviews never settle the lookup.
    const startDeadline = () => window.setTimeout(() => setChecked(true), 600);
    let deadline = startDeadline();
    const checkInstalled = async () => {
      const check = ++latestCheck;
      try {
        if (!manifest || !nav.getInstalledRelatedApps) return;
        const apps = await nav.getInstalledRelatedApps();
        const id = new URL('./', manifest).href;
        if (active && check === latestCheck) setAlreadyInstalled(apps.some(app => app.platform === 'webapp' && (app.url === manifest || app.id === id)));
      } catch { /* A denied lookup leaves installation unconfirmed. */ }
      finally {
        if (active && check === latestCheck) {
          window.clearTimeout(deadline);
          setChecked(true);
        }
      }
    };
    if (document.readyState === 'complete') void checkInstalled();
    else window.addEventListener('load', checkInstalled, { once: true });
    const restoreVisit = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      // Back/Forward can restore this exact document, including an already-open dialog.
      setOfferSeen(Boolean(document.querySelector('dialog.install-dialog[open]')));
      setInstalledHere(false);
      setAlreadyInstalled(false);
      setChecked(false);
      setApiUnavailable(false);
      window.clearTimeout(deadline);
      deadline = startDeadline();
      void checkInstalled();
    };
    const reflect = () => setAppMode(standalone.matches);
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
      setMessage('');
      setInstalledHere(false);
    };
    const installed = () => { setInstalledHere(true); setPrompt(null); };
    standalone.addEventListener('change', reflect);
    window.addEventListener('focus', checkInstalled);
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', installed);
    window.addEventListener('pageshow', restoreVisit);
    return () => {
      active = false;
      window.clearTimeout(deadline);
      window.removeEventListener('load', checkInstalled);
      standalone.removeEventListener('change', reflect);
      window.removeEventListener('focus', checkInstalled);
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', installed);
      window.removeEventListener('pageshow', restoreVisit);
    };
  }, []);
  const canUseInstallApi = !apiUnavailable && window.top === window.self && typeof nav.install === 'function';
  const canPrompt = window.isSecureContext && Boolean(canUseInstallApi || prompt);
  const request = async () => {
    if (pending || !canPrompt) return;
    setPending(true);
    setMessage('');
    try {
      if (canUseInstallApi && nav.install) {
        await nav.install();
        setInstalledHere(true);
      } else if (prompt) {
        setPrompt(null);
        await prompt.prompt();
        if ((await prompt.userChoice).outcome === 'accepted') setInstalledHere(true);
        else setMessage(canceledMessage);
      }
    } catch (error) {
      if (isInstallCancellation(error)) {
        setMessage(canceledMessage);
      } else {
        // Some hosts expose the API but reject installation. A fresh eligibility event can still work.
        setApiUnavailable(true);
        setPrompt(current => current === prompt ? null : current);
        setMessage('The installer could not open. Try again or use your browser’s install menu.');
      }
    } finally {
      setPending(false);
    }
  };
  // On iOS the window can explicitly report browser mode even when its host looks standalone.
  const ownWindow = !embedded && (nav.standalone ?? appMode);
  const installed = ownWindow || installedHere || alreadyInstalled;
  return {
    installed,
    embedded,
    shouldOffer: checked && !installed && !offerSeen,
    rememberOffer,
    canPrompt,
    pending,
    message,
    request,
  };
}

export default function InstallDialog({ install, onDismiss }: {
  install: ReturnType<typeof useInstall>; onDismiss: () => void;
}) {
  const native = install.canPrompt || install.pending;
  return <Modal titleId="install-title" className="install-dialog" onShow={install.rememberOffer} onDismiss={onDismiss}>
    <img className="app-icon" src={`${import.meta.env.BASE_URL}icons/glow-192.png`} alt="" />
    <h2 id="install-title">Install Glow Words</h2>
    <p>Keep Glow Words on your home screen and play offline after your first visit.</p>
    {!native && <>
      <InstallSteps embedded={install.embedded} />
      <details className="install-copy" open={install.embedded}>
        <summary>Copy the game link</summary>
        <CopyGameLink showLabel={false} />
      </details>
    </>}
    {native && <button autoFocus={!install.embedded} className="primary-button" aria-disabled={install.pending} onClick={install.request}><Icon name="install" />{install.pending ? 'Installing…' : 'Install app'}</button>}
    <div role="status">{install.message}</div>
    <button type="button" className="quiet-button" onClick={onDismiss}>Not now</button>
  </Modal>;
}
