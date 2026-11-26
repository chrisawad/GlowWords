import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export default function Modal({ titleId, className = '', onShow, onDismiss, children }: {
  titleId: string;
  className?: string;
  onShow?: () => void;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    onShow?.();
    return () => dialog.close();
  }, [onShow]);

  return <dialog ref={ref} aria-labelledby={titleId} className={`game-dialog ${className}`}
    onClose={event => { if (!event.currentTarget.open) onDismiss(); }}>
    {children}
  </dialog>;
}
