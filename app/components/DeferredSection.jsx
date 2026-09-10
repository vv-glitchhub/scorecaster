"use client";

import { useState } from "react";
import { useLanguage } from "./LanguageProvider";

export default function DeferredSection({ title, description, children }) {
  const { tr } = useLanguage();
  const [open, setOpen] = useState(false);
  return <details className="sc-surface rounded-2xl p-5" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="cursor-pointer text-base font-black text-[var(--sc-text)]">{tr(title)}</summary>
    {description ? <p className="mt-2 text-sm text-[var(--sc-muted)]">{tr(description)}</p> : null}
    {open ? <div className="mt-5">{children}</div> : null}
  </details>;
}
