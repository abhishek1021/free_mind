"use client";

import { useState, useEffect, useRef } from "react";
import { MythCard, CONTENT_CATEGORIES } from "@/lib/api";

interface Props {
  card: MythCard;
  onClose: () => void;
}

export default function StoryReader({ card, onClose }: Props) {
  const [story, setStory]     = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const fetched = useRef(false);
  const meta    = CONTENT_CATEGORIES[card.category] ?? CONTENT_CATEGORIES["Short Stories"];
  const isMoral = card.category === "Moral Stories";

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    const params = new URLSearchParams({
      topic:    card.deityName,
      category: card.category,
      excerpt:  card.fact,
    });

    fetch(`/api/gemini/story?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setStory(data.story ?? "");
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [card]);

  // Split story into paragraphs; detect "Moral: ..." line for moral stories
  const paragraphs = story.split(/\n+/).filter((p) => p.trim());
  const moralIndex = isMoral
    ? paragraphs.findIndex((p) => p.trim().startsWith("नैतिक शिक्षा:") || p.trim().toLowerCase().startsWith("moral:"))
    : -1;
  const storyParagraphs = moralIndex >= 0 ? paragraphs.slice(0, moralIndex) : paragraphs;
  const moralLine       = moralIndex >= 0 ? paragraphs[moralIndex] : null;

  return (
    /* Full-screen overlay */
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "#0a0a0a" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 pt-10 pb-4 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <button
          onClick={onClose}
          className="flex items-center justify-center rounded-full flex-shrink-0"
          style={{ width: 36, height: 36, background: "rgba(255,255,255,0.07)" }}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <span
            className="text-xs font-medium px-2.5 py-0.5 rounded-full"
            style={{ background: `${meta.color}22`, color: meta.color }}
          >
            {meta.emoji} {card.category}
          </span>
          <p className="text-sm font-semibold text-white mt-1 truncate">{card.deityName}</p>
        </div>
      </div>

      {/* Scrollable story content */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {loading ? (
          <StoryLoadingSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <span className="text-4xl">✦</span>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              Couldn&apos;t generate the full story. Please try again.
            </p>
            <button
              onClick={() => { setError(false); setLoading(true); fetched.current = false; }}
              className="px-5 py-2 rounded-xl text-sm text-white"
              style={{ background: meta.color }}
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* Story title */}
            <h1
              className="text-2xl font-bold mb-1 leading-tight"
              style={{ color: "rgba(255,255,255,0.95)" }}
            >
              {card.deityName}
            </h1>
            <p className="text-xs mb-6" style={{ color: "rgba(255,255,255,0.3)" }}>
              A {card.category === "Moral Stories" ? "moral story" : "short story"} · written by Gemini AI
            </p>

            {/* Excerpt pill */}
            <div
              className="rounded-xl p-4 mb-6"
              style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}30` }}
            >
              <p className="text-xs font-medium mb-1" style={{ color: meta.color }}>Opening</p>
              <p className="text-sm italic leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                {card.fact}
              </p>
            </div>

            {/* Full story */}
            <div className="flex flex-col gap-5">
              {storyParagraphs.map((para, i) => (
                <p
                  key={i}
                  className="text-base leading-8"
                  style={{ color: "rgba(255,255,255,0.82)", letterSpacing: "0.01em" }}
                >
                  {para}
                </p>
              ))}
            </div>

            {/* Moral highlight box */}
            {moralLine && (
              <div
                className="mt-8 rounded-2xl p-5"
                style={{ background: `${meta.color}20`, border: `1px solid ${meta.color}50` }}
              >
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: meta.color }}>
                  The Moral
                </p>
                <p className="text-sm leading-relaxed font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>
                  {moralLine.replace(/^नैतिक शिक्षा:\s*/i, "").replace(/^moral:\s*/i, "")}
                </p>
              </div>
            )}

            <div className="h-16" />
          </>
        )}
      </div>
    </div>
  );
}

function StoryLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-7 w-3/4 rounded-lg" style={{ background: "rgba(255,255,255,0.08)" }} />
      <div className="h-3 w-40 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
      <div className="h-20 rounded-xl mt-2" style={{ background: "rgba(255,255,255,0.05)" }} />
      {[100, 85, 100, 70, 90, 80].map((w, i) => (
        <div key={i} className="h-4 rounded" style={{ background: "rgba(255,255,255,0.05)", width: `${w}%` }} />
      ))}
      <p className="text-xs text-center mt-4" style={{ color: "rgba(255,255,255,0.2)" }}>
        Gemini is writing your story…
      </p>
    </div>
  );
}
