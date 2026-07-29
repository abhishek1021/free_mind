"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bookmark, LayoutGrid, Compass } from "lucide-react";
import {
  MythCard,
  fetchGeminiCards,
  fetchMixedBatch,
  fetchRandomGeminiCards,
  randomDeity,
  CONTENT_CATEGORIES,
} from "@/lib/api";
import CardView from "./CardView";

type Tab = "feed" | "explore" | "saved";

export default function Feed() {
  const [tab, setTab] = useState<Tab>("feed");

  // ── Feed state ────────────────────────────────────────────────
  const [feedCards, setFeedCards] = useState<MythCard[]>([]);
  const [feedIndex, setFeedIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const feedLoadingMore = useRef(false);

  // ── Explore state ─────────────────────────────────────────────
  const [exploreCategory, setExploreCategory] = useState<string | null>(null);
  const [exploreTopic, setExploreTopic] = useState<string | null>(null);
  const [exploreCards, setExploreCards] = useState<MythCard[]>([]);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreLoadingMore, setExploreLoadingMore] = useState(false);
  const exploreLoadingMoreRef = useRef(false);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

  // ── Bookmarks ─────────────────────────────────────────────────
  const [bookmarks, setBookmarks] = useState<MythCard[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("fm_myth_bookmarks");
      if (saved) setBookmarks(JSON.parse(saved));
    } catch {}
    loadRandom();
  }, []);

  // ── Feed actions ──────────────────────────────────────────────

  async function loadTopic(topic: string, category = "Mythology") {
    setFeedLoading(true);
    setFeedError(false);
    setFeedIndex(0);
    try {
      const cards = await fetchGeminiCards(topic, category);
      setFeedCards(cards);
    } catch {
      setFeedError(true);
    } finally {
      setFeedLoading(false);
    }
  }

  async function loadRandom(category?: string | null) {
    setFeedLoading(true);
    setFeedError(false);
    setFeedIndex(0);
    try {
      const cards = category
        ? await fetchRandomGeminiCards(category)
        : await fetchMixedBatch(5);
      setFeedCards(cards);
    } catch {
      setFeedError(true);
    } finally {
      setFeedLoading(false);
    }
  }

  // Silently append more mixed cards when near the end
  useEffect(() => {
    if (activeCategory !== null) return;
    if (feedLoadingMore.current) return;
    if (feedCards.length === 0) return;
    if (feedIndex < feedCards.length - 2) return;

    feedLoadingMore.current = true;
    fetchMixedBatch(5)
      .then((newCards) => setFeedCards((prev) => [...prev, ...newCards]))
      .finally(() => { feedLoadingMore.current = false; });
  }, [feedIndex, feedCards.length, activeCategory]);

  const goNext = useCallback(() => {
    setDirection(1);
    setFeedIndex((i) => Math.min(i + 1, feedCards.length - 1));
  }, [feedCards.length]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setFeedIndex((i) => Math.max(i - 1, 0));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (tab !== "feed") return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goNext();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, tab]);

  function handleFeedCategoryChip(cat: string) {
    const same = cat === activeCategory;
    const next = same ? null : cat;
    setActiveCategory(next);
    loadRandom(next);
  }

  function openInFeed(topic: string, category?: string) {
    loadTopic(topic, category ?? "Mythology");
    setTab("feed");
    setDirection(1);
  }

  // ── Explore actions ───────────────────────────────────────────

  async function loadExploreCategory(cat: string) {
    setExploreCategory(cat);
    const topic = randomDeity(cat);
    setExploreTopic(topic);
    setExploreLoading(true);
    setExploreCards([]);
    try {
      const cards = await fetchGeminiCards(topic, cat, 10);
      setExploreCards(cards);
    } catch {}
    finally { setExploreLoading(false); }
  }

  async function loadExploreTopic(topic: string, cat: string) {
    setExploreTopic(topic);
    setExploreLoading(true);
    setExploreCards([]);
    try {
      const cards = await fetchGeminiCards(topic, cat, 10);
      setExploreCards(cards);
    } catch {}
    finally { setExploreLoading(false); }
  }

  async function loadMoreExplore() {
    if (!exploreCategory || exploreLoadingMoreRef.current) return;
    exploreLoadingMoreRef.current = true;
    setExploreLoadingMore(true);
    try {
      // Pick a different topic within the same category each time
      const usedTopics = new Set([exploreTopic]);
      const topics = CONTENT_CATEGORIES[exploreCategory]?.topics ?? [];
      const fresh = topics.filter((t) => !usedTopics.has(t));
      const nextTopic = fresh.length > 0
        ? fresh[Math.floor(Math.random() * fresh.length)]
        : randomDeity(exploreCategory);
      const cards = await fetchGeminiCards(nextTopic, exploreCategory, 10);
      setExploreCards((prev) => [...prev, ...cards]);
    } catch {}
    finally {
      setExploreLoadingMore(false);
      exploreLoadingMoreRef.current = false;
    }
  }

  // IntersectionObserver to auto-load more when sentinel enters view
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreExplore();
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [exploreCards.length, exploreCategory]);

  // ── Bookmarks ─────────────────────────────────────────────────

  function toggleBookmark(card: MythCard) {
    setBookmarks((prev) => {
      const exists = prev.some((b) => b.id === card.id);
      const next = exists ? prev.filter((b) => b.id !== card.id) : [card, ...prev];
      try { localStorage.setItem("fm_myth_bookmarks", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const currentCard = feedCards[feedIndex];
  const isBookmarked = currentCard ? bookmarks.some((b) => b.id === currentCard.id) : false;

  return (
    <div className="flex flex-col h-full w-full" style={{ background: "#0f0f0f" }}>
      <div className="flex-1 min-h-0">

        {/* ── FEED TAB ──────────────────────────────────────────── */}
        {tab === "feed" && (
          <div className="h-full flex flex-col">
            <div className="px-4 pt-4 pb-3 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h1 className="text-white font-semibold text-base tracking-tight">Free Mind</h1>
                  {currentCard && !feedLoading && (
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                      {activeCategory
                        ? `${currentCard.deityName} · ${feedIndex + 1} / ${feedCards.length}`
                        : `${currentCard.category} · ${currentCard.deityName}`}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { setActiveCategory(null); loadRandom(null); }}
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}
                  aria-label="Shuffle"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 3 21 3 21 8"/><polyline points="4 20 9 20 9 15"/>
                    <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                    <polyline points="16 21 21 21 21 16"/><polyline points="4 4 9 4 9 9"/>
                  </svg>
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                {Object.entries(CONTENT_CATEGORIES).map(([cat, meta]) => (
                  <button
                    key={cat}
                    onClick={() => handleFeedCategoryChip(cat)}
                    className="px-3.5 py-1.5 rounded-full text-xs whitespace-nowrap flex-shrink-0 transition-all"
                    style={
                      activeCategory === cat
                        ? { background: meta.color, border: `1px solid ${meta.color}`, color: "#fff" }
                        : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }
                    }
                  >
                    {meta.emoji} {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 px-4 pb-4 min-h-0">
              {feedLoading ? (
                <LoadingSkeleton />
              ) : feedError ? (
                <ErrorState onRetry={() => loadRandom(activeCategory)} />
              ) : currentCard ? (
                <CardView
                  card={currentCard}
                  direction={direction}
                  isBookmarked={isBookmarked}
                  onToggleBookmark={() => toggleBookmark(currentCard)}
                  onNext={goNext}
                  onPrev={goPrev}
                  canGoPrev={feedIndex > 0}
                />
              ) : null}
            </div>
          </div>
        )}

        {/* ── EXPLORE TAB ───────────────────────────────────────── */}
        {tab === "explore" && (
          <div className="h-full flex flex-col">
            {/* Category chips — vertical wrap grid */}
            <div className="px-4 pt-4 flex-shrink-0">
              <h2 className="text-white font-semibold text-base mb-3">Explore</h2>
              <div className="flex flex-wrap gap-2 pb-3">
                {Object.entries(CONTENT_CATEGORIES).map(([cat, meta]) => (
                  <button
                    key={cat}
                    onClick={() => loadExploreCategory(cat)}
                    className="px-3.5 py-2 rounded-full text-xs transition-all font-medium"
                    style={
                      exploreCategory === cat
                        ? { background: meta.color, color: "#fff" }
                        : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }
                    }
                  >
                    {meta.emoji} {cat}
                  </button>
                ))}
              </div>

              {/* Topic chips — wrap grid, shown once a category is selected */}
              {exploreCategory && !exploreLoading && (
                <>
                  <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.25)" }}>Topics in {exploreCategory}</p>
                  <div className="flex flex-wrap gap-2 pb-3">
                    {CONTENT_CATEGORIES[exploreCategory].topics.map((topic) => (
                      <button
                        key={topic}
                        onClick={() => loadExploreTopic(topic, exploreCategory)}
                        className="px-3 py-1.5 rounded-full text-xs transition-all"
                        style={
                          exploreTopic === topic
                            ? { background: `${CONTENT_CATEGORIES[exploreCategory].color}33`, border: `1px solid ${CONTENT_CATEGORIES[exploreCategory].color}`, color: CONTENT_CATEGORIES[exploreCategory].color }
                            : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.35)" }
                        }
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Facts list */}
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              {!exploreCategory ? (
                <EmptyExplore />
              ) : exploreLoading ? (
                <ExploreLoadingState />
              ) : (
                <div className="flex flex-col gap-3">
                  {exploreCards.map((card) => (
                    <ExploreFactCard
                      key={card.id}
                      card={card}
                      onOpen={() => openInFeed(card.deityName, card.category)}
                    />
                  ))}
                  {/* Sentinel + loading more indicator */}
                  <div ref={bottomSentinelRef} className="py-2 flex items-center justify-center">
                    {exploreLoadingMore && (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 animate-spin"
                          style={{ borderColor: exploreCategory ? CONTENT_CATEGORIES[exploreCategory]?.color : "#4f46e5", borderTopColor: "transparent" }} />
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Loading more…</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SAVED TAB ─────────────────────────────────────────── */}
        {tab === "saved" && (
          <div className="h-full flex flex-col">
            <div className="px-4 pt-4 pb-2 flex-shrink-0">
              <h2 className="text-white font-semibold text-base">Saved</h2>
              {bookmarks.length > 0 && (
                <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                  {bookmarks.length} {bookmarks.length === 1 ? "card" : "cards"}
                </p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {bookmarks.length === 0 ? (
                <EmptySaved />
              ) : (
                <div className="flex flex-col gap-3 mt-2">
                  {bookmarks.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => openInFeed(card.deityName, card.category)}
                      className="w-full text-left rounded-2xl overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <div className="flex gap-3 p-3">
                        {card.imageUrl && (
                          <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
                            <img src={card.imageUrl} alt={card.deityName} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs mb-1 font-medium" style={{ color: CONTENT_CATEGORIES[card.category]?.color ?? "#818cf8" }}>
                            {CONTENT_CATEGORIES[card.category]?.emoji} {card.deityName}
                          </p>
                          <p className="text-sm leading-relaxed line-clamp-3" style={{ color: "rgba(255,255,255,0.55)" }}>
                            {card.fact}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <nav className="flex flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "#0f0f0f" }}>
        {([
          { id: "feed" as Tab, Icon: LayoutGrid, label: "Feed" },
          { id: "explore" as Tab, Icon: Compass, label: "Explore" },
          { id: "saved" as Tab, Icon: Bookmark, label: "Saved" },
        ]).map(({ id, Icon, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex-1 py-3.5 flex flex-col items-center gap-1 text-xs transition-colors"
            style={{ color: tab === id ? "#818cf8" : "rgba(255,255,255,0.22)" }}
          >
            <Icon size={19} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function ExploreFactCard({ card, onOpen }: { card: MythCard; onOpen: () => void }) {
  const meta = CONTENT_CATEGORIES[card.category] ?? CONTENT_CATEGORIES["Mythology"];
  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-2xl p-4 transition-all"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-xs px-2.5 py-0.5 rounded-full font-medium"
          style={{ background: `${meta.color}22`, color: meta.color }}
        >
          {meta.emoji} {card.category}
        </span>
        <span className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{card.deityName}</span>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>{card.fact}</p>
      <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>Tap to read more →</p>
    </button>
  );
}

function ExploreLoadingState() {
  return (
    <div className="flex flex-col gap-3 mt-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl p-4 animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div className="h-4 w-24 rounded-full mb-3" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="h-3 w-full rounded mb-2" style={{ background: "rgba(255,255,255,0.05)" }} />
          <div className="h-3 w-4/5 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
        </div>
      ))}
      <p className="text-xs text-center mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>Gemini is thinking…</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="w-full h-full rounded-3xl flex flex-col overflow-hidden animate-pulse"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex-shrink-0" style={{ height: "48%", background: "rgba(255,255,255,0.05)" }} />
      <div className="flex-1 p-5 flex flex-col gap-3">
        <div className="h-6 w-36 rounded-lg" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="h-4 w-full rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }} />
        <div className="h-4 w-5/6 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }} />
        <p className="text-xs mt-auto" style={{ color: "rgba(255,255,255,0.2)" }}>Gemini is thinking…</p>
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-center px-8">
      <span className="text-4xl">✦</span>
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
        Couldn&apos;t reach Gemini. Check your API key or connection.
      </p>
      <button onClick={onRetry} className="px-5 py-2 rounded-xl text-sm text-white" style={{ background: "#4f46e5" }}>
        Try again
      </button>
    </div>
  );
}

function EmptyExplore() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center gap-3 px-6">
      <span className="text-4xl">✦</span>
      <p className="text-sm font-medium text-white">Pick a category above</p>
      <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>
        Choose Science, History, Riddles, or any category to start reading facts
      </p>
    </div>
  );
}

function EmptySaved() {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-center gap-2">
      <span className="text-3xl">🔖</span>
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>No saved cards yet</p>
      <p className="text-xs" style={{ color: "rgba(255,255,255,0.18)" }}>Tap the bookmark on any card</p>
    </div>
  );
}
