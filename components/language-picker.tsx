"use client";

import { useId, useRef, useState } from "react";

type Option = { value: string; label: string; search: string };

export default function LanguagePicker({
  label,
  notFound,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  notFound: string;
  value: string;
  options: Option[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const filtered = options.filter((option) =>
    option.search.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  function choose(option: Option) {
    onChange(option.value);
    setOpen(false);
    setQuery("");
    field.current?.focus();
  }
  return (
    <div
      className="language-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setQuery("");
        }
      }}
    >
      <input
        ref={field}
        role="combobox"
        aria-label={label}
        aria-expanded={open && !disabled}
        aria-controls={`${id}-options`}
        aria-autocomplete="list"
        aria-activedescendant={
          open && !disabled && filtered[active] ? `${id}-${active}` : undefined
        }
        autoComplete="off"
        disabled={disabled}
        value={
          open ? query : options.find((option) => option.value === value)?.label || ""
        }
        placeholder={label}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") {
            setOpen(false);
            setQuery("");
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            const next = !open
              ? 0
              : Math.max(
                  0,
                  Math.min(
                    filtered.length - 1,
                    active + (event.key === "ArrowDown" ? 1 : -1),
                  ),
                );
            setActive(next);
            document
              .getElementById(`${id}-${next}`)
              ?.scrollIntoView({ block: "nearest" });
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            if (filtered[active]) choose(filtered[active]);
          }
        }}
      />
      {open && !disabled && (
        <div className="language-options">
          <div id={`${id}-options`} role="listbox" aria-label={label} tabIndex={0}>
            {filtered.map((option, index) => (
              <div
                key={option.value}
                id={`${id}-${index}`}
                role="option"
                data-value={option.value}
                aria-selected={option.value === value}
                className={index === active ? "is-active" : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                {option.label}
              </div>
            ))}
          </div>
          {!filtered.length && (
            <div className="language-empty" role="status">
              {notFound}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
