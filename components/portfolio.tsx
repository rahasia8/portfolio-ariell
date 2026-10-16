"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  browserLanguage,
  normalizeLanguage,
  languageDirection,
  languageOptions,
  type Language,
} from "@/lib/locale";
import {
  builtInTranslation,
  validateTranslation,
  type Translation,
} from "@/lib/translations";
import { detectVisitorLanguage } from "@/lib/location-client";
import PrivacyDialog from "./privacy-dialog";
import type { Source } from "@/lib/types";
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  language?: Language;
};
export default function Portfolio({
  name,
  role,
  initialLanguage = "en",
}: {
  name: string;
  role: string;
  initialLanguage?: Language;
}) {
  const [locationUnavailable, setLocationUnavailable] = useState(false);
  const [automaticLanguage, setAutomaticLanguage] = useState<Language>(initialLanguage);
  const [languageChoice, setLanguageChoice] = useState<"auto" | Language>("auto");
  const language = languageChoice === "auto" ? automaticLanguage : languageChoice;
  const [remoteTranslation, setRemoteTranslation] = useState<{
    language: Language;
    messages: Translation;
  }>();
  const [translationFailed, setTranslationFailed] = useState(false);
  const [translationRetry, setTranslationRetry] = useState(0);
  const localTranslation = builtInTranslation(language);
  const t =
    localTranslation ||
    (remoteTranslation?.language === language
      ? remoteTranslation.messages
      : builtInTranslation("en")!);
  const uiLanguage =
    localTranslation || remoteTranslation?.language === language ? language : "en";
  const suggestions = t.suggestions;
  const selectableLanguages = Array.from(new Set([...languageOptions, language])).sort();
  const nativeNames = new Intl.DisplayNames([language], { type: "language" });
  useEffect(() => {
    const detected = browserLanguage(
      navigator.languages?.length ? navigator.languages : [navigator.language],
    );
    setAutomaticLanguage(detected);
    try {
      const saved = normalizeLanguage(localStorage.getItem("portfolio-language"));
      if (saved) setLanguageChoice(saved);
    } catch {}
  }, []);
  useEffect(() => {
    if (languageChoice !== "auto") return;
    try {
      if (normalizeLanguage(localStorage.getItem("portfolio-language"))) return;
    } catch {}
    let cancel = new AbortController();
    let lastCheck = 0;
    async function detect() {
      if (Date.now() - lastCheck < 15000) return;
      lastCheck = Date.now();
      cancel.abort();
      cancel = new AbortController();
      const language = await detectVisitorLanguage(cancel.signal);
      if (!cancel.signal.aborted) {
        setLocationUnavailable(!language);
        if (language) setAutomaticLanguage(language);
      }
    }
    void detect();
    window.addEventListener("focus", detect);
    return () => {
      cancel.abort();
      window.removeEventListener("focus", detect);
    };
  }, [languageChoice]);
  useEffect(() => {
    document.documentElement.lang = uiLanguage;
    document.documentElement.dir = languageDirection(uiLanguage);
  }, [uiLanguage]);
  useEffect(() => {
    setTranslationFailed(false);
    if (builtInTranslation(language)) return;
    const cancel = new AbortController();
    fetch(`/api/translations?locale=${encodeURIComponent(language)}`, {
      signal: cancel.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Translation unavailable");
        const data = await response.json();
        if (data.locale !== language) throw new Error("Wrong translation language");
        const messages = validateTranslation(data.messages);
        if (!cancel.signal.aborted) setRemoteTranslation({ language, messages });
      })
      .catch(() => {
        if (!cancel.signal.aborted) setTranslationFailed(true);
      });
    return () => cancel.abort();
  }, [language, translationRetry]);
  function selectLanguage(value: string) {
    if (value !== "auto" && !normalizeLanguage(value)) return;
    setLanguageChoice(value);
    setError("");
    try {
      if (value === "auto") localStorage.removeItem("portfolio-language");
      else localStorage.setItem("portfolio-language", value);
    } catch {}
  }
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [conversationId, setConversationId] = useState<string>();
  const [privacy, setPrivacy] = useState(false);
  const followLatest = useRef(true);
  const sendButton = useRef<HTMLButtonElement>(null);
  const [announcement, setAnnouncement] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const controller = useRef<AbortController | null>(null);
  const locked = useRef(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("portfolio-chat") || "null");
      if (saved && Array.isArray(saved.messages)) {
        setMessages(
          saved.messages
            .filter(
              (m: Message) =>
                m &&
                typeof m.id === "string" &&
                ["user", "assistant"].includes(m.role) &&
                typeof m.content === "string",
            )
            .slice(-40),
        );
        if (typeof saved.conversationId === "string")
          setConversationId(saved.conversationId);
      }
    } catch {}
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setReady(d.knowledgeReady === true))
      .catch(() => {});
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    if (followLatest.current)
      end.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "end",
      });
  }, [messages, busy]);
  function persist(next: Message[], id?: string) {
    try {
      sessionStorage.setItem(
        "portfolio-chat",
        JSON.stringify({ messages: next.slice(-40), conversationId: id }),
      );
    } catch {}
  }
  async function send(text: string) {
    const question = text.trim();
    if (!question || locked.current) return;
    locked.current = true;
    followLatest.current = true;
    setAnnouncement("");
    setBusy(true);
    setError("");
    setInput("");
    const next: Message[] = [
      ...messages,
      { id: crypto.randomUUID(), role: "user", content: question, language },
    ];
    setMessages(next);
    persist(next, conversationId);
    controller.current = new AbortController();
    const timeout = setTimeout(() => controller.current?.abort(), 55000);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: question,
          conversationId,
          locale: language,
          history: messages
            .slice(-6)
            .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })),
        }),
        signal: controller.current.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? t.rateError
            : response.status >= 500
              ? t.unavailable
              : t.sendError,
        );
      const complete: Message[] = [
        ...next,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer,
          sources: data.sources,
          language,
        },
      ];
      setMessages(complete);
      setConversationId(data.conversationId);
      persist(complete, data.conversationId);
    } catch (e) {
      setError(e instanceof Error && e.name !== "AbortError" ? e.message : t.timeout);
      setInput(question);
    } finally {
      clearTimeout(timeout);
      setBusy(false);
      locked.current = false;
      if (
        [document.body, field.current, sendButton.current].includes(
          document.activeElement as HTMLElement,
        )
      )
        requestAnimationFrame(() => field.current?.focus());
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }
  function clear() {
    controller.current?.abort();
    setAnnouncement(t.accessibility.cleared);
    setMessages([]);
    setConversationId(undefined);
    setError("");
    try {
      sessionStorage.removeItem("portfolio-chat");
    } catch {}
    field.current?.focus();
  }
  return (
    <div className="shell">
      <div className="skip-links">
        <a href="#main" onClick={() => document.getElementById("main")?.focus()}>
          {t.accessibility.skipChat}
        </a>
        <a href="#question" onClick={() => field.current?.focus()}>
          {t.accessibility.skipInput}
        </a>
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
      <aside className="sidebar">
        <a className="brand" href="/" aria-label={t.accessibility.home}>
          <span className="brand-mark" aria-hidden="true">
            p<span>↗</span>
          </span>
          <span>
            portfolio<span className="brand-dot">.ai</span>
          </span>
        </a>
        <div className="profile">
          <div className="avatar" aria-hidden="true">
            {name === "Your name" ? "Y." : name.slice(0, 1) + "."}
            <span />
          </div>
          <p className="eyebrow">{t.person}</p>
          <h1>{name}</h1>
          <p className="role">{role}</p>
          <p className="profile-note">{t.profile}</p>
        </div>
        <nav aria-label={t.explore}>
          <p className="nav-label">{t.explore}</p>
          {t.nav.map((label, i) => (
            <button
              key={label}
              disabled={busy}
              onClick={() => void send(t.navQuestions[i])}
            >
              <span className="nav-icon" aria-hidden="true">
                {["◷", "◇", "⌘", "↗"][i]}
              </span>
              {label}
              <span className="nav-arrow" aria-hidden="true">
                ↗
              </span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="source-note">
            <span className="small-star" aria-hidden="true">
              ✳
            </span>
            <div>
              <strong>{t.grounded}</strong>
              <p>{t.sourceNote}</p>
            </div>
          </div>
          <button
            type="button"
            className="privacy-button"
            aria-haspopup="dialog"
            aria-controls="privacy-dialog"
            aria-expanded={privacy}
            aria-label={t.privacyButton.replace(/\s*↗$/, "")}
            onClick={() => setPrivacy(true)}
          >
            {t.privacyButton}
          </button>
        </div>
      </aside>
      <main id="main" tabIndex={-1}>
        <header>
          <div className="header-label">
            <span className="status-dot" aria-hidden="true" /> PERSONAL AI PORTFOLIO
          </div>
          <div className="header-actions">
            <label className="language-picker">
              <span className="sr-only">{t.language}</span>
              <select
                value={languageChoice}
                onChange={(e) => selectLanguage(e.target.value)}
                disabled={busy}
              >
                <option value="auto">
                  {t.auto} · {automaticLanguage.toUpperCase()}
                </option>
                {selectableLanguages.map((code) => (
                  <option key={code} value={code}>
                    {nativeNames.of(code) || code}
                  </option>
                ))}
              </select>
            </label>
            <button className="reset" onClick={clear} disabled={busy}>
              <span aria-hidden="true">↻</span> <span>{t.newChat}</span>
            </button>
          </div>
        </header>
        {!localTranslation &&
          remoteTranslation?.language !== language &&
          !translationFailed && (
            <div className="translation-notice" role="status">
              {t.detecting}
            </div>
          )}
        {locationUnavailable && languageChoice === "auto" && (
          <div className="translation-notice" role="status">
            {t.locationUnavailable}
          </div>
        )}
        {translationFailed && (
          <div className="translation-notice" role="status">
            {t.translationError}{" "}
            <button onClick={() => setTranslationRetry((value) => value + 1)}>
              {t.retryLanguage}
            </button>
          </div>
        )}
        <section
          className={`conversation ${messages.length ? "has-messages" : ""}`}
          aria-label={t.conversation}
          tabIndex={0}
          onScroll={(event) => {
            const el = event.currentTarget;
            followLatest.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
          }}
        >
          {!messages.length ? (
            <div className="welcome">
              <div className="intro-tag">
                <span aria-hidden="true">✳</span> {t.introTag}
              </div>
              <h2>
                {t.heading}
                <br />
                {t.headingLead}
                <em>{t.headingEm}</em>
              </h2>
              <p className="intro-copy">{t.intro}</p>
              <div className="suggestions">
                {suggestions.map((s) => (
                  <button
                    key={s.icon}
                    onClick={() => void send(s.question)}
                    disabled={busy}
                  >
                    <span className="card-number" aria-hidden="true">
                      {s.icon}
                      <span>↗</span>
                    </span>
                    <strong>{s.title}</strong>
                    <span>{s.detail}</span>
                  </button>
                ))}
              </div>
              <div className="knowledge-status">
                <span className={ready ? "status-dot" : "empty-dot"} aria-hidden="true" />
                {ready ? t.ready : t.preparing}
              </div>
            </div>
          ) : null}
          <div
            className="messages"
            role="log"
            aria-label={t.messages}
            aria-live="polite"
            aria-relevant="additions text"
            aria-atomic="false"
          >
            {messages.map((m) => (
              <article
                key={m.id}
                className={`message ${m.role}`}
                lang={normalizeLanguage(m.language) || undefined}
              >
                <div className="message-label">
                  {m.role === "user" ? (
                    t.you
                  ) : (
                    <>
                      {" "}
                      <span aria-hidden="true">✳</span> {t.assistant}
                    </>
                  )}
                </div>
                <div className="message-text">{m.content}</div>
                {!!m.sources?.length && (
                  <div className="sources">
                    <span>{t.sources}</span>
                    {m.sources.map((s) =>
                      s.url && /^(https?:\/\/|\/(?!\/))/.test(s.url) ? (
                        <a
                          key={s.sourceId}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {s.title} <span aria-hidden="true">↗</span>
                          <span className="sr-only">
                            {" "}
                            ({t.accessibility.opensNewTab})
                          </span>
                        </a>
                      ) : (
                        <span className="source-chip" key={s.sourceId}>
                          {s.title}
                        </span>
                      ),
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
          {busy && (
            <div className="thinking" role="status">
              <span className="spinner" aria-hidden="true" /> {t.thinking}
            </div>
          )}
          <div ref={end} />
        </section>
        <div className="composer-area">
          {error && (
            <p id="question-error" className="error" role="alert">
              {error}
            </p>
          )}
          <label className="input-label" htmlFor="question">
            {t.inputLabel}
          </label>
          <form onSubmit={submit} className="composer">
            <textarea
              id="question"
              ref={field}
              placeholder={t.placeholder}
              value={input}
              maxLength={2000}
              rows={1}
              readOnly={busy}
              aria-describedby={`question-help question-count${error ? " question-error" : ""}`}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(input);
                }
              }}
            />
            <button
              ref={sendButton}
              type="submit"
              disabled={busy || !input.trim()}
              aria-label={t.send}
            >
              <span aria-hidden="true">{busy ? "…" : "↑"}</span>
            </button>
          </form>
          <p id="question-help" className="input-help">
            {t.accessibility.inputHelp}
          </p>
          <div className="composer-footer">
            <span>{t.honesty}</span>
            <span id="question-count">
              {t.accessibility.remaining.replace("{count}", String(2000 - input.length))}
            </span>
          </div>
        </div>
        <footer>
          <span>{t.footer}</span>
          <span>{t.footerDetail}</span>
          <button
            type="button"
            className="mobile-privacy privacy-button"
            aria-haspopup="dialog"
            aria-controls="privacy-dialog"
            aria-expanded={privacy}
            onClick={() => setPrivacy(true)}
          >
            {t.privacyButton}
          </button>
        </footer>
      </main>
      <PrivacyDialog open={privacy} onDismiss={() => setPrivacy(false)} t={t} />
    </div>
  );
}
