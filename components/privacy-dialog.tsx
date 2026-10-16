"use client";
import { useEffect, useRef } from "react";
import type { Translation } from "@/lib/translations";
export default function PrivacyDialog({
  open,
  onDismiss,
  t,
}: {
  open: boolean;
  onDismiss: () => void;
  t: Translation;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    closeButton.current?.focus();
    return () => {
      if (element.open) element.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);
  return (
    <dialog
      id="privacy-dialog"
      ref={dialog}
      className="privacy-dialog"
      aria-labelledby="privacy-title"
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onDismiss();
      }}
    >
      <div className="privacy-modal" tabIndex={0} aria-labelledby="privacy-title">
        <button ref={closeButton} type="button" onClick={onDismiss} aria-label={t.close}>
          <span aria-hidden="true">×</span>
        </button>
        <p className="eyebrow">{t.transparent}</p>
        <h2 id="privacy-title">{t.privacyTitle}</h2>
        {t.privacy.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </dialog>
  );
}
