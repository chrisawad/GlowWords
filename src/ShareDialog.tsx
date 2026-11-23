import { useRef, useState } from 'react';
import Icon from './Icon';
import Modal from './Modal';

export const gameUrl = 'https://words.chrisawad.com/';

export default function ShareDialog({ onDismiss }: { onDismiss: () => void }) {
  const field = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(gameUrl);
      setMessage('Link copied.');
    } catch {
      field.current?.focus();
      field.current?.select();
      setMessage('Use your device’s Copy command to copy the selected link.');
    }
  };

  return <Modal titleId="share-title" className="share-dialog" onDismiss={onDismiss}>
    <div className="dialog-symbol"><Icon name="share" /></div>
    <h2 id="share-title">Share Glow Words</h2>
    <label htmlFor="game-link">Game link</label>
    <input id="game-link" ref={field} readOnly value={gameUrl} onFocus={event => event.currentTarget.select()} />
    <button className="primary-button" onClick={copyLink}>Copy link</button>
    <div role="status">{message}</div>
    <form method="dialog"><button className="dialog-close" aria-label="Close share dialog"><Icon name="close" /></button></form>
  </Modal>;
}
