import { useId, useRef, useState } from 'react';

export const gameUrl = 'https://words.chrisawad.com/';

export default function CopyGameLink() {
  const id = useId();
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

  return <div className="copy-game-link">
    <label htmlFor={id}>Game link</label>
    <input id={id} ref={field} readOnly value={gameUrl} onFocus={event => event.currentTarget.select()} />
    <button type="button" className="primary-button" onClick={copyLink}>Copy link</button>
    <div role="status">{message}</div>
  </div>;
}
