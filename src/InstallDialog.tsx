import { useCallback, useEffect, useState } from 'react';
import Icon from './Icon';
import InstallHelp from './InstallHelp';
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
const offerKey = 'glowwords.installOfferSeen';
const installedKey = 'glowwords.installConfirmed';

export function useInstall() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installedHere, setInstalledHere] = useState(false);
  const [previousInstall, setPreviousInstall] = useState(() => {
    try { return localStorage.getItem(installedKey) === '1'; } catch { return false; }
  });
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);
  const [checked, setChecked] = useState(false);
  const [offerSeen, setOfferSeen] = useState(() => {
    try { return sessionStorage.getItem(offerKey) === '1'; } catch { return false; }
  });
  const rememberOffer = useCallback(() => {
    setOfferSeen(true);
    try { sessionStorage.setItem(offerKey, '1'); } catch { /* The current game still remembers the offer. */ }
  }, []);
  const [appMode, setAppMode] = useState(standalone.matches);
  const [offlineReady, setOfflineReady] = useState(Boolean(navigator.serviceWorker?.controller));
  useEffect(() => {
    let active = true;
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href;
    const checkInstalled = async () => {
      if (!manifest || !nav.getInstalledRelatedApps) return;
      try {
        const apps = await nav.getInstalledRelatedApps();
        const id = new URL('./', manifest).href;
        if (active) setAlreadyInstalled(apps.some(app => app.platform === 'webapp' && (app.url === manifest || app.id === id)));
      } catch { /* Standalone mode and browser install events remain available. */ }
    };
    void checkInstalled().then(() => { if (active) setChecked(true); });
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.ready.then(() => { if (active) setOfflineReady(true); });
    }
    const reflect = () => setAppMode(standalone.matches);
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
      // A fresh eligibility event also covers uninstalling the app.
      try { localStorage.removeItem(installedKey); } catch { /* Storage is optional. */ }
      setPreviousInstall(false);
      setInstalledHere(false);
      setAlreadyInstalled(false);
    };
    const installed = () => { setInstalledHere(true); setPrompt(null); };
    const syncInstall = (event: StorageEvent) => {
      if (event.key === installedKey) setPreviousInstall(event.newValue === '1');
    };
    standalone.addEventListener('change', reflect);
    window.addEventListener('focus', checkInstalled);
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', installed);
    window.addEventListener('storage', syncInstall);
    return () => {
      active = false;
      standalone.removeEventListener('change', reflect);
      window.removeEventListener('focus', checkInstalled);
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', installed);
      window.removeEventListener('storage', syncInstall);
    };
  }, []);
  const request = async () => {
    let accepted = false;
    if (nav.install) {
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
  const installed = appMode || nav.standalone === true || installedHere || alreadyInstalled;
  useEffect(() => {
    if (installed) {
      setPreviousInstall(true);
      try { localStorage.setItem(installedKey, '1'); } catch { /* In-memory detection still works. */ }
    }
  }, [installed]);
  const skipOffer = installed || previousInstall;
  return {
    offlineReady,
    installed,
    skipOffer,
    shouldOffer: checked && !skipOffer && !offerSeen && window.top === window.self,
    rememberOffer,
    canPrompt: window.isSecureContext && Boolean(nav.install || prompt),
    request,
  };
}

export default function InstallDialog({ install, automatic, onDismiss }: {
  install: ReturnType<typeof useInstall>; automatic: boolean; onDismiss: () => void;
}) {
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const request = async () => {
    if (pending) return;
    setPending(true);
    try {
      if (!await install.request()) setMessage('Installation canceled.');
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === 'AbortError'
        ? 'Installation canceled.'
        : 'Installation didn’t finish. You can also use your browser’s install menu.');
    } finally { setPending(false); }
  };
  return <Modal titleId="install-title" className="install-dialog" onDismiss={onDismiss}>
    <button className="dialog-close" onClick={onDismiss} aria-label="Close install dialog"><Icon name="close" /></button>
    <img className="app-icon" src={`${import.meta.env.BASE_URL}icons/glow-192.png`} alt="" />
    <h2 id="install-title">Install Glow Words</h2>
    <p>Keep the word garden on your home screen.{install.offlineReady && ' This device is ready for offline play.'}</p>
    {install.installed ? <p role="status">Glow Words is installed.</p> : <>
      <div role="status">{message}</div>
      {(install.canPrompt || pending) && <button className="primary-button" aria-disabled={pending} onClick={request}><Icon name="install" />{pending ? 'Installing…' : 'Install app'}</button>}
    </>}
    <InstallHelp installed={install.installed} expanded={!automatic && !install.canPrompt && !pending} />
    <button type="button" className="quiet-button" onClick={onDismiss}>{automatic ? 'Not now' : 'Back to puzzle'}</button>
  </Modal>;
}
