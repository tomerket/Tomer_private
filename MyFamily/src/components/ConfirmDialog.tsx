import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

type Ask = { title: string; text?: string; confirmLabel?: string; danger?: boolean };

/**
 * Small "Are you sure?" window. Usage:
 *   const [confirmDialog, confirm] = useConfirm();
 *   if (await confirm({ title: 'Remove reward?' })) ...
 *   ...render {confirmDialog}
 */
export function useConfirm(): [ReactNode, (ask: Ask) => Promise<boolean>] {
  const [ask, setAsk] = useState<Ask | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((a: Ask) => {
    setAsk(a);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setAsk(null);
  };

  return [ask ? <ConfirmDialog ask={ask} onClose={close} /> : null, confirm];
}

function ConfirmDialog({ ask, onClose }: { ask: Ask; onClose: (ok: boolean) => void }) {
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onClick={() => onClose(false)}>
      <div role="alertdialog" aria-modal aria-labelledby="confirm-title" className="panel w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-title" className="text-2xl font-extrabold leading-tight">
          {ask.title}
        </h2>
        {ask.text && <p className="mt-1 text-muted">{ask.text}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => onClose(false)}>
            Cancel
          </button>
          <button ref={okRef} className={`btn ${ask.danger === false ? 'btn-primary' : 'bg-danger text-white'}`} onClick={() => onClose(true)}>
            {ask.confirmLabel ?? 'Yes, remove'}
          </button>
        </div>
      </div>
    </div>
  );
}
