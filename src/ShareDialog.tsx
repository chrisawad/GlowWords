import CopyGameLink from './CopyGameLink';
import Icon from './Icon';
import Modal from './Modal';

export default function ShareDialog({ onDismiss }: { onDismiss: () => void }) {
  return <Modal titleId="share-title" onDismiss={onDismiss}>
    <div className="dialog-symbol"><Icon name="share" /></div>
    <h2 id="share-title">Share Glow Words</h2>
    <CopyGameLink />
    <form method="dialog"><button className="dialog-close" aria-label="Close share dialog"><Icon name="close" /></button></form>
  </Modal>;
}
