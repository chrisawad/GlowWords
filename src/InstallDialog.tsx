import { useCallback, useEffect, useState } from 'react';
import CopyGameLink from './CopyGameLink';
import Icon from './Icon';
import InstallSteps from './InstallSteps';
import { getInstallLaunch } from './installLaunch';
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

export function useInstall() {
  const [launch] = useState(getInstallLaunch);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installedHere, setInstalledHere] = useState(false);
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);
  const [checked, setChecked] = useState(false);
  const [offerSeen, setOfferSeen] = useState(false);
  const rememberOffer = useCallback(() => setOfferSeen(true), []);
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
      window.clearTimeout(deadline);
      deadline = startDeadline();
      void checkInstalled();
    };
    const reflect = () => setAppMode(standalone.matches);
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
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
  const canUseInstallApi = window.top === window.self && typeof nav.install === 'function';
  const request = async () => {
    let accepted = false;
    if (canUseInstallApi && nav.install) {
      await nav.install();
      accepted = true;
    } else if (prompt) {
      setPrompt(null);
      await prompt.prompt();
      accepted = (await prompt.userChoice).outcome === 'accepted';
    }
    if (accepted) setInstalledHere(true);
    return accepted;
  };
  // On iOS the window can explicitly report browser mode even when its host looks standalone.
  const ownWindow = !launch.external && (nav.standalone ?? appMode);
  const installed = ownWindow || installedHere || alreadyInstalled;
  return {
    installed,
    embedded: launch.external,
    shouldOffer: checked && !installed && !launch.invited && !offerSeen,
    rememberOffer,
    canPrompt: window.isSecureContext && Boolean(canUseInstallApi || prompt),
    request,
  };
}

export default function InstallDialog({ install, onDismiss }: {
  install: ReturnType<typeof useInstall>; onDismiss: () => void;
}) {
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const request = async () => {
    if (pending) return;
    setPending(true);
    try {
      setMessage('');
      if (!await install.request()) setMessage('Installation canceled. You can keep playing here.');
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === 'AbortError'
        ? 'Installation canceled. You can keep playing here.'
        : 'The installer could not open. Try again or use your browser’s install menu.');
    } finally { setPending(false); }
  };
  const native = install.canPrompt || pending;
  return <Modal titleId="install-title" className="install-dialog" onShow={install.rememberOffer} onDismiss={onDismiss}>
    <img className="app-icon" src={`${import.meta.env.BASE_URL}icons/glow-192.png`} alt="" />
    <h2 id="install-title">Install Glow Words</h2>
    <p>Keep Glow Words on your home screen and play offline after your first visit.</p>
    {(!native || install.embedded) && <>
      <InstallSteps embedded={install.embedded} />
      <details className="install-copy" open={install.embedded}>
        <summary>Copy the game link</summary>
        <CopyGameLink showLabel={false} />
      </details>
    </>}
    {native && <button autoFocus={!install.embedded} className="primary-button" aria-disabled={pending} onClick={request}><Icon name="install" />{pending ? 'Installing…' : 'Install app'}</button>}
    <div role="status">{message}</div>
    <button type="button" className="quiet-button" onClick={onDismiss}>Not now</button>
  </Modal>;
}
