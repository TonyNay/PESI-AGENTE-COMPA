"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./billing.module.css";

/** Sin top layer: el desafío 3DS de Culqi debe poder mostrarse sobre el checkout. */
export function BillingDialog({ title, children, onClose, busy = false, wide = false }: {
  title: string; children: ReactNode; onClose: () => void; busy?: boolean; wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const locked = useRef(busy);
  useEffect(() => { close.current = onClose; locked.current = busy; }, [onClose, busy]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || locked.current) return;
      // No interceptar los controles de una ventana externa de Culqi/3DS.
      if (!panel.current?.contains(document.activeElement)) return;
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key !== "Tab") return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), iframe, [tabindex="0"]')).filter((el) => el.getClientRects().length > 0);
      if (!items.length) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === items[0] || document.activeElement === panel.current)) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, []);

  return createPortal(<div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <div ref={panel} className={`${styles.dialog} ${wide ? styles.wideDialog : ""}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
      <header className={styles.dialogHeader}><span>{title}</span><button type="button" className={styles.iconButton} aria-label="Cerrar ventana" disabled={busy} onClick={onClose}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><path d="m6 6 12 12M6 18 18 6" /></svg></button></header>
      {children}
    </div>
  </div>, document.body);
}
