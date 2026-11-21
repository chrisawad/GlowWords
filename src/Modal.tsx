import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export default function Modal({ titleId, className = '', onDismiss, children }: {
  titleId: string;
  className?: string;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return <dialog ref={ref} aria-labelledby={titleId} className={`game-dialog ${className}`}
    onClose={event => { if (!event.currentTarget.open) onDismiss(); }}>
    {children}
  </dialog>;
}
