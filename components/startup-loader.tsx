"use client";

import { useEffect, useState } from "react";
import Icon from "./icon";

export default function StartupLoader() {
  const [phase, setPhase] = useState<"loading" | "leaving" | "done">("loading");

  useEffect(() => {
    let revealTimer: ReturnType<typeof setTimeout>;
    let removeTimer: ReturnType<typeof setTimeout>;
    const started = performance.now();
    let finishing = false;

    function finish() {
      if (finishing) return;
      finishing = true;
      revealTimer = setTimeout(
        () => {
          setPhase("leaving");
          removeTimer = setTimeout(() => setPhase("done"), 320);
        },
        Math.max(0, 900 - (performance.now() - started)),
      );
    }

    // Slow external resources must never keep visitors behind the introduction.
    const deadline = setTimeout(finish, 4000);
    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });

    return () => {
      window.removeEventListener("load", finish);
      clearTimeout(deadline);
      clearTimeout(revealTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div className={`startup-loader${phase === "leaving" ? " is-leaving" : ""}`}>
      <div className="startup-loader-card" role="status" aria-label="ariellbot">
        <div className="startup-loader-window" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="startup-loader-content">
          <div className="startup-loader-mark">
            <Icon name="bot" size={48} />
          </div>
          <span className="startup-loader-brand" dir="ltr">
            ariellbot<span>.</span>
          </span>
          <div className="startup-loader-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </div>
      </div>
    </div>
  );
}
