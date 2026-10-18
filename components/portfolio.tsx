"use client";
import { loadSavedTranslation } from "@/lib/saved-translation";
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
import Image from "next/image";
import AnswerText from "./answer-text";
import PrivacyDialog from "./privacy-dialog";
import Icon from "./icon";
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
  useHostingLookup = false,
}: {
  name: string;
  role: string;
  initialLanguage?: Language;
  useHostingLookup?: boolean;
}) {
  const [locationUnavailable, setLocationUnavailable] = useState(false);
  const [automaticLanguage, setAutomaticLanguage] = useState<Language>(initialLanguage);
  const [languageChoice, setLanguageChoice] = useState<"auto" | Language>("auto");
  const language = languageChoice === "auto" ? automaticLanguage : languageChoice;
  const [loadedTranslation, setLoadedTranslation] = useState<{
    language: Language;
    messages: Translation;
  }>();
  const [translationFailed, setTranslationFailed] = useState(false);
  const [translationRetry, setTranslationRetry] = useState(0);
  const localTranslation = builtInTranslation(language);
  const t =
    localTranslation ||
    (loadedTranslation?.language === language
      ? loadedTranslation.messages
      : builtInTranslation("en")!);
  const uiLanguage =
    localTranslation || loadedTranslation?.language === language ? language : "en";
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
      const language = await detectVisitorLanguage(
        cancel.signal,
        fetch,
        useHostingLookup,
      );
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
  }, [languageChoice, useHostingLookup]);
  useEffect(() => {
    document.documentElement.lang = uiLanguage;
    document.documentElement.dir = languageDirection(uiLanguage);
  }, [uiLanguage]);
  useEffect(() => {
    setTranslationFailed(false);
    if (builtInTranslation(language)) return;
    const cancel = new AbortController();
    (async () => {
      const saved = await loadSavedTranslation(language);
      if (saved) return { locale: language, messages: saved };
      throw new Error("Local translation unavailable");
    })()
      .then((data) => {
        if (data.locale !== language) throw new Error("Wrong translation language");
        const messages = validateTranslation(data.messages);
        if (!cancel.signal.aborted) setLoadedTranslation({ language, messages });
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
      <div className="window-bar" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <main id="main" tabIndex={-1}>
        <header>
          <a
            className="brand"
            href="/"
            aria-label={`ariellbot · ${t.accessibility.home}`}
          >
            <span className="brand-mark" aria-hidden="true">
              <Image
                src="/images/ariell-profile.jpeg"
                alt=""
                width={44}
                height={44}
                className="brand-avatar"
              />
            </span>
            <span>
              ariell<span className="brand-dot">bot</span>
            </span>
          </a>
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
            {messages.length > 0 && (
              <button className="reset" onClick={clear} disabled={busy}>
                <Icon name="refresh" size={16} /> <span>{t.newChat}</span>
              </button>
            )}
          </div>
        </header>
        {!localTranslation &&
          loadedTranslation?.language !== language &&
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
              <div className="portrait">
                <Image
                  src="/images/ariell-profile.jpeg"
                  alt={name === "Your name" ? "Ariell" : name}
                  width={160}
                  height={160}
                  priority
                  className="portrait-image"
                />
              </div>
              <h1>{t.heading}</h1>
              <p className="intro-copy">{t.intro}</p>
              <section className="suggestions-panel" aria-labelledby="suggestions-title">
                <h2 id="suggestions-title">
                  <Icon name="chat" size={24} />
                  {t.explore}
                </h2>
                <div className="suggestions">
                  {t.nav.map((label, i) => (
                    <button
                      key={label}
                      onClick={() => void send(t.navQuestions[i])}
                      disabled={busy}
                    >
                      <Icon
                        name={
                          (["experience", "projects", "skills", "contact"] as const)[i]
                        }
                        size={18}
                      />
                      <span className="suggestion-label">{label}</span>
                    </button>
                  ))}
                </div>
              </section>
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
                      <Image
                        src="/images/ariell-profile.jpeg"
                        alt=""
                        width={28}
                        height={28}
                        className="message-avatar"
                      />
                      ariellbot
                    </>
                  )}
                </div>
                <div className="message-text">
                  {m.role === "assistant" ? (
                    <AnswerText
                      text={m.content}
                      opensNewTab={t.accessibility.opensNewTab}
                    />
                  ) : (
                    m.content
                  )}
                </div>
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
          <label className="sr-only" htmlFor="question">
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
              {busy ? <span aria-hidden="true">…</span> : <Icon name="send" size={22} />}
            </button>
          </form>
          <p id="question-help" className="sr-only">
            {t.accessibility.inputHelp}
          </p>
          <div className="sr-only">
            <span>{t.honesty}</span>
            <span id="question-count">
              {t.accessibility.remaining.replace("{count}", String(2000 - input.length))}
            </span>
          </div>
        </div>
        <footer>
          <button
            type="button"
            className="privacy-button"
            aria-haspopup="dialog"
            aria-controls="privacy-dialog"
            aria-expanded={privacy}
            onClick={() => setPrivacy(true)}
          >
            <Icon name="shield" size={14} />
            {t.privacyButton.replace(/\s*↗$/, "")}
          </button>
        </footer>
      </main>
      <PrivacyDialog open={privacy} onDismiss={() => setPrivacy(false)} t={t} />
    </div>
  );
}
