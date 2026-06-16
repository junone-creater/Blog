"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ApiTag = { id: string; name: string; slug: string };

type TagInputProps = {
  value: string[];
  onChange: (tags: string[]) => void;
  label?: string;
};

export default function TagInput({ value, onChange, label = "태그" }: TagInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tags")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ApiTag[]) => {
        if (!cancelled && Array.isArray(data)) {
          setSuggestions(data.map((tag) => tag.name));
        }
      })
      .catch(() => {
        /* 추천 없이 동작 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasTag = (name: string) => value.some((tag) => tag.toLowerCase() === name.toLowerCase());

  const filtered = useMemo(() => {
    const query = draft.trim().toLowerCase();
    return suggestions
      .filter((name) => !value.some((tag) => tag.toLowerCase() === name.toLowerCase()))
      .filter((name) => (query ? name.toLowerCase().includes(query) : true))
      .slice(0, 8);
  }, [suggestions, value, draft]);

  function addTag(raw: string) {
    const name = raw.trim();
    if (!name || hasTag(name)) {
      setDraft("");
      return;
    }
    onChange([...value, name]);
    setDraft("");
    setActiveIndex(-1);
  }

  function removeTag(name: string) {
    onChange(value.filter((tag) => tag !== name));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (filtered.length > 0) {
        setOpen(true);
        setActiveIndex((prev) => (prev + 1) % filtered.length);
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (filtered.length > 0) {
        setOpen(true);
        setActiveIndex((prev) => (prev <= 0 ? filtered.length - 1 : prev - 1));
      }
      return;
    }
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      if (open && activeIndex >= 0 && activeIndex < filtered.length) {
        addTag(filtered[activeIndex]);
      } else {
        addTag(draft);
      }
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === "Backspace" && draft === "" && value.length > 0) {
      event.preventDefault();
      removeTag(value[value.length - 1]);
    }
  }

  return (
    <div className="block text-sm font-bold text-[#53606d]" ref={containerRef}>
      <span>{label}</span>
      <div className="relative mt-1">
        <div className="flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-[#d7cec0] bg-white px-2 py-1.5 focus-within:border-moss">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-[#f1ece2] px-2 py-0.5 text-xs font-bold text-ink"
            >
              {tag}
              <button
                type="button"
                aria-label={`${tag} 삭제`}
                onClick={() => removeTag(tag)}
                className="text-[#8a8275] hover:text-rust"
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? "쉼표 또는 Enter로 추가" : ""}
            className="min-w-[6rem] flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-[#a59c8c]"
          />
        </div>

        {open && filtered.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-md border border-[#d7cec0] bg-white py-1 shadow-soft">
            {filtered.map((name, index) => (
              <li key={name}>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    addTag(name);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`block w-full px-3 py-1.5 text-left text-sm font-medium ${
                    index === activeIndex ? "bg-[#f1ece2] text-ink" : "text-[#53606d]"
                  }`}
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
