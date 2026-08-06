"use client";

import { useState, useEffect, useRef } from "react";
import { Bookmark, LayoutGrid, Compass, Send } from "lucide-react";
import {
  MythCard,
  fetchGeminiCards,
  fetchMixedBatch,
  fetchRandomGeminiCards,
  fetchCategoryMixedBatch,
  fetchDeityImageUrl,
  randomDeity,
  CONTENT_CATEGORIES,
} from "@/lib/api";
import { TELEGRAM_CHANNELS, TelegramChannel } from "@/lib/telegram-channels";
import { TelegramPost } from "@/app/api/telegram/posts/route";
import StoryReader from "./StoryReader";

const STORY_CATEGORIES = new Set(["Short Stories", "Moral Stories"]);

type Tab = "feed" | "explore" | "saved" | "channels";

type FeedItem =
  | { kind: "fact"; card: MythCard; uid: string }
  | { kind: "post"; post: TelegramPost; channel: TelegramChannel; uid: string };

export default function Feed() {
  const [tab, setTab] = useState<Tab>("feed");

  // ── Instagram-style feed state ────────────────────────────────
  const [feedItems, setFeedItems]             = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading]         = useState(true);
  const [feedError, setFeedError]             = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [activeCategory, setActiveCategory]   = useState<string | null>(null);
  const feedLoadingMoreRef = useRef(false);
  const feedSentinelRef    = useRef<HTMLDivElement>(null);
  const feedScrollRef      = useRef<HTMLDivElement>(null);
  const seenPostIds        = useRef(new Set<string>());
  const channelPool        = useRef<TelegramChannel[]>([]);

  // ── Pull-to-refresh state ─────────────────────────────────────
  const [pullDistance, setPullDistance]   = useState(0);
  const [isRefreshing, setIsRefreshing]   = useState(false);
  const pullStartY  = useRef(0);
  const isPulling   = useRef(false);
  const PULL_THRESHOLD = 65;
  const PULL_MAX       = 90;

  // ── Explore state ─────────────────────────────────────────────
  const [exploreCategory, setExploreCategory]       = useState<string | null>(null);
  const [exploreTopic, setExploreTopic]             = useState<string | null>(null);
  const [exploreCards, setExploreCards]             = useState<MythCard[]>([]);
  const [exploreLoading, setExploreLoading]         = useState(false);
  const [exploreLoadingMore, setExploreLoadingMore] = useState(false);
  const exploreLoadingMoreRef = useRef(false);
  const exploreSentinelRef    = useRef<HTMLDivElement>(null);

  // ── Channels state ───────────────────────────────────────────
  const [activeChannel, setActiveChannel]   = useState<TelegramChannel | null>(null);
  const [channelPosts, setChannelPosts]     = useState<TelegramPost[]>([]);
  const [channelLoading, setChannelLoading] = useState(false);
  const [channelError, setChannelError]     = useState<string | null>(null);
  const [channelsOpen, setChannelsOpen]     = useState(true); // accordion open by default until first pick

  // Fire prefetch every time the user lands on the channels tab
  useEffect(() => {
    if (tab !== "channels") return;
    fetch("/api/telegram/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channels: TELEGRAM_CHANNELS.map((c) => c.username) }),
    }).catch(() => {});
  }, [tab]);

  // ── Story reader ──────────────────────────────────────────────
  const [storyCard, setStoryCard] = useState<MythCard | null>(null);

  // ── Bookmarks ─────────────────────────────────────────────────
  const [bookmarks, setBookmarks] = useState<MythCard[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("fm_myth_bookmarks");
      if (saved) setBookmarks(JSON.parse(saved));
    } catch {}
    loadInitialFeed(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Feed helpers ──────────────────────────────────────────────

  function shuffled(arr: TelegramChannel[]): TelegramChannel[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Fetch posts from `count` channels one-at-a-time (sequential, not parallel).
  // Calls `onItem` immediately after each channel resolves so posts appear in
  // the feed one-by-one rather than all at once. Limit=5 keeps thumbnail
  // downloads small, reducing auth.ExportAuthorization calls to Telegram.
  async function fetchTelegramSequential(
    count: number,
    onItem: (item: FeedItem) => void
  ): Promise<void> {
    if (TELEGRAM_CHANNELS.length === 0) return;

    if (channelPool.current.length < count) {
      channelPool.current = [...channelPool.current, ...shuffled(TELEGRAM_CHANNELS)];
    }
    const picks = channelPool.current.splice(0, count);

    for (const ch of picks) {
      try {
        // Pick a random point in the channel's recent history so each refresh
        // surfaces different posts. 40% chance to get the very latest (no offset);
        // otherwise pick a random date between 1 and 60 days ago.
        const useOffset = Math.random() > 0.4;
        const offsetDate = useOffset
          ? Math.floor(Date.now() / 1000) - (1 + Math.floor(Math.random() * 59)) * 86400
          : undefined;

        const url = `/api/telegram/posts?channel=${encodeURIComponent(ch.username)}&limit=5${offsetDate ? `&offsetDate=${offsetDate}` : ""}`;
        const res  = await fetch(url);
        const data = await res.json();
        const posts: TelegramPost[] = data.posts ?? [];
        const fresh = posts.filter((p) => !seenPostIds.current.has(`${ch.username}-${p.id}`));
        if (fresh.length === 0) continue;
        const post = fresh[0];
        seenPostIds.current.add(`${ch.username}-${post.id}`);
        onItem({ kind: "post", post, channel: ch, uid: `${ch.username}-${post.id}` });
      } catch {
        // skip this channel, continue to the next
      }
    }
  }

  async function loadInitialFeed(category: string | null) {
    setFeedLoading(true);
    setFeedError(false);
    setFeedItems([]);
    seenPostIds.current.clear();
    channelPool.current = [];

    const factsPromise = category ? fetchCategoryMixedBatch(category) : fetchMixedBatch(6);

    try {
      // Phase 1 — show facts immediately, dismiss loading spinner
      const facts = await factsPromise;
      setFeedItems(facts.map((card) => ({ kind: "fact" as const, card, uid: card.id })));
      setFeedLoading(false);

      // Phase 2 — fetch Telegram posts one channel at a time; each post appends
      // to the feed as soon as it arrives (no waiting for all channels to finish)
      if (!category) {
        fetchTelegramSequential(4, (item) => {
          setFeedItems((prev) => [...prev, item]);
        }).catch(() => {});
      }
    } catch {
      setFeedError(true);
      setFeedLoading(false);
    }
  }

  async function loadMoreFeed() {
    if (feedLoadingMoreRef.current) return;
    feedLoadingMoreRef.current = true;
    setFeedLoadingMore(true);

    const factsPromise = activeCategory ? fetchCategoryMixedBatch(activeCategory) : fetchMixedBatch(6);

    try {
      // Phase 1 — append facts and dismiss the loading spinner
      const facts = await factsPromise;
      setFeedItems((prev) => [...prev, ...facts.map((card) => ({ kind: "fact" as const, card, uid: card.id }))]);
      setFeedLoadingMore(false);
      feedLoadingMoreRef.current = false;

      // Phase 2 — append Telegram posts one at a time after facts are shown
      if (!activeCategory) {
        fetchTelegramSequential(4, (item) => {
          setFeedItems((prev) => [...prev, item]);
        }).catch(() => {});
      }
    } catch {
      // ignore
    } finally {
      setFeedLoadingMore(false);
      feedLoadingMoreRef.current = false;
    }
  }

  // Infinite scroll for feed
  useEffect(() => {
    const el = feedSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) loadMoreFeed(); },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedItems.length, activeCategory]);

  function handleCategoryChip(cat: string) {
    const next = cat === activeCategory ? null : cat;
    setActiveCategory(next);
    loadInitialFeed(next);
  }

  // ── Pull-to-refresh handlers ──────────────────────────────────

  function onTouchStart(e: React.TouchEvent) {
    if ((feedScrollRef.current?.scrollTop ?? 0) === 0) {
      pullStartY.current = e.touches[0].clientY;
      isPulling.current  = true;
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!isPulling.current || isRefreshing) return;
    const dy = e.touches[0].clientY - pullStartY.current;
    if (dy <= 0) { setPullDistance(0); return; }
    // Apply resistance so it feels natural
    setPullDistance(Math.min(dy * 0.45, PULL_MAX));
  }

  async function onTouchEnd() {
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullDistance >= PULL_THRESHOLD) {
      setPullDistance(PULL_THRESHOLD); // lock indicator open
      setIsRefreshing(true);
      await loadInitialFeed(activeCategory);
      setIsRefreshing(false);
    }
    setPullDistance(0);
  }

  // ── Explore actions ───────────────────────────────────────────

  async function loadExploreCategory(cat: string) {
    setExploreCategory(cat);
    const topic = randomDeity(cat);
    setExploreTopic(topic);
    setExploreLoading(true);
    setExploreCards([]);
    try { setExploreCards(await fetchGeminiCards(topic, cat, 10)); } catch {}
    finally { setExploreLoading(false); }
  }

  async function loadExploreTopic(topic: string, cat: string) {
    setExploreTopic(topic);
    setExploreLoading(true);
    setExploreCards([]);
    try { setExploreCards(await fetchGeminiCards(topic, cat, 10)); } catch {}
    finally { setExploreLoading(false); }
  }

  async function loadMoreExplore() {
    if (!exploreCategory || exploreLoadingMoreRef.current) return;
    exploreLoadingMoreRef.current = true;
    setExploreLoadingMore(true);
    try {
      const topics  = CONTENT_CATEGORIES[exploreCategory]?.topics ?? [];
      const fresh   = topics.filter((t) => t !== exploreTopic);
      const next    = fresh.length > 0 ? fresh[Math.floor(Math.random() * fresh.length)] : randomDeity(exploreCategory);
      const more = await fetchGeminiCards(next, exploreCategory, 10);
      setExploreCards((prev) => [...prev, ...more]);
    } catch {}
    finally { setExploreLoadingMore(false); exploreLoadingMoreRef.current = false; }
  }

  useEffect(() => {
    const el = exploreSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) loadMoreExplore(); },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploreCards.length, exploreCategory]);

  // ── Channel client-side cache (sessionStorage) ───────────────
  // Survives Lambda cold starts and container switches on Amplify serverless.
  // sessionStorage clears automatically when the PWA session ends.
  const CH_TTL = 5 * 60 * 1000;
  function getChCache(username: string): TelegramPost[] | null {
    try {
      const raw = sessionStorage.getItem(`fm_ch_${username}`);
      if (!raw) return null;
      const { posts, ts } = JSON.parse(raw);
      return Date.now() - ts < CH_TTL ? posts : null;
    } catch { return null; }
  }
  function setChCache(username: string, posts: TelegramPost[]) {
    try {
      sessionStorage.setItem(`fm_ch_${username}`, JSON.stringify({ posts, ts: Date.now() }));
    } catch {}
  }

  // ── Channel actions ───────────────────────────────────────────

  async function loadChannel(ch: TelegramChannel) {
    setActiveChannel(ch);
    setChannelError(null);

    // Phase 1 — instant display from client cache if available
    const cached = getChCache(ch.username);
    if (cached && cached.length > 0) {
      setChannelPosts(cached.slice(0, 10));
      setChannelLoading(false);
      // Refresh in background so next open is fresh
      fetch(`/api/telegram/posts?channel=${encodeURIComponent(ch.username)}&limit=20`)
        .then((r) => r.json())
        .then((data) => {
          const posts: TelegramPost[] = data.posts ?? [];
          if (posts.length > 0) {
            setChCache(ch.username, posts);
            setChannelPosts(posts);
          }
        })
        .catch(() => {});
      return;
    }

    // Phase 1 — no cache, show skeleton and fetch first 10
    setChannelLoading(true);
    setChannelPosts([]);

    try {
      const res1  = await fetch(`/api/telegram/posts?channel=${encodeURIComponent(ch.username)}&limit=10&initial=1`);
      const data1 = await res1.json();
      if (!res1.ok) throw new Error(data1.error ?? "Failed");

      const initial: TelegramPost[] = data1.posts ?? [];
      setChannelPosts(initial);
      setChannelLoading(false);

      // Phase 2 — fetch remaining posts silently and update cache
      fetch(`/api/telegram/posts?channel=${encodeURIComponent(ch.username)}&limit=20`)
        .then((r) => r.json())
        .then((data2) => {
          const posts: TelegramPost[] = data2.posts ?? [];
          if (posts.length > 0) {
            setChCache(ch.username, posts);
            setChannelPosts(posts);
          }
        })
        .catch(() => {});
    } catch (err) {
      setChannelError(String(err));
      setChannelLoading(false);
    }
  }

  // ── Bookmarks ─────────────────────────────────────────────────

  function toggleBookmark(card: MythCard) {
    setBookmarks((prev) => {
      const exists = prev.some((b) => b.id === card.id);
      const next   = exists ? prev.filter((b) => b.id !== card.id) : [card, ...prev];
      try { localStorage.setItem("fm_myth_bookmarks", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full w-full" style={{ background: "#0f0f0f" }}>
      {/* Story full-screen reader */}
      {storyCard && (
        <StoryReader card={storyCard} onClose={() => setStoryCard(null)} />
      )}

      <div className="flex-1 min-h-0">

        {/* ── FEED TAB ──────────────────────────────────────────── */}
        {tab === "feed" && (
          <div className="h-full flex flex-col">

            {/* Header + category chips */}
            <div className="px-4 pt-4 pb-2 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-white font-semibold text-base tracking-tight">Free Mind</h1>
                <button
                  onClick={() => { setActiveCategory(null); loadInitialFeed(null); }}
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)" }}
                  aria-label="Refresh feed"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 3 21 3 21 8"/><polyline points="4 20 9 20 9 15"/>
                    <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                    <polyline points="16 21 21 21 21 16"/><polyline points="4 4 9 4 9 9"/>
                  </svg>
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                {Object.entries(CONTENT_CATEGORIES).map(([cat, meta]) => (
                  <button
                    key={cat}
                    onClick={() => handleCategoryChip(cat)}
                    className="px-3.5 py-1.5 rounded-full text-xs whitespace-nowrap flex-shrink-0 transition-all"
                    style={
                      activeCategory === cat
                        ? { background: meta.color, color: "#fff" }
                        : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)" }
                    }
                  >
                    {meta.emoji} {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable feed */}
            <div
              ref={feedScrollRef}
              className="flex-1 overflow-y-auto px-4 pb-6"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {/* Pull-to-refresh indicator */}
              <div
                className="flex items-center justify-center overflow-hidden transition-all"
                style={{
                  height: pullDistance > 0 || isRefreshing ? Math.max(pullDistance, isRefreshing ? PULL_THRESHOLD : 0) : 0,
                  transition: isPulling.current ? "none" : "height 0.3s ease",
                }}
              >
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: 36, height: 36,
                    background: "rgba(255,255,255,0.08)",
                    transform: `rotate(${isRefreshing ? 0 : (pullDistance / PULL_MAX) * 270}deg)`,
                    transition: isRefreshing ? "none" : "transform 0.1s linear",
                    animation: isRefreshing ? "spin 0.8s linear infinite" : "none",
                  }}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                    <polyline points="21 3 21 8 16 8" />
                  </svg>
                </div>
                {isRefreshing && (
                  <span className="ml-2 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Refreshing…</span>
                )}
              </div>

              {feedLoading && !isRefreshing ? (
                <FeedSkeleton />
              ) : feedError && !isRefreshing ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
                  <span className="text-4xl">✦</span>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Couldn&apos;t load feed. Check your connection.</p>
                  <button onClick={() => loadInitialFeed(activeCategory)} className="px-5 py-2 rounded-xl text-sm text-white" style={{ background: "#4f46e5" }}>Try again</button>
                </div>
              ) : (
                <div className="flex flex-col gap-4 pt-2">
                  {feedItems.map((item) =>
                    item.kind === "fact" ? (
                      <InstaFactCard
                        key={item.uid}
                        card={item.card}
                        isBookmarked={bookmarks.some((b) => b.id === item.card.id)}
                        onBookmark={() => toggleBookmark(item.card)}
                        onReadStory={STORY_CATEGORIES.has(item.card.category) ? () => setStoryCard(item.card) : undefined}
                      />
                    ) : (
                      <TelegramPostCard key={item.uid} post={item.post} channel={item.channel} />
                    )
                  )}

                  {/* Infinite scroll sentinel */}
                  <div ref={feedSentinelRef} className="py-3 flex items-center justify-center">
                    {feedLoadingMore && (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 animate-spin"
                          style={{ borderColor: "#818cf8", borderTopColor: "transparent" }} />
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Loading more…</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── EXPLORE TAB ───────────────────────────────────────── */}
        {tab === "explore" && (
          <div className="h-full flex flex-col">
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
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              {!exploreCategory ? (
                <div className="flex flex-col items-center justify-center h-64 text-center gap-3 px-6">
                  <span className="text-4xl">✦</span>
                  <p className="text-sm font-medium text-white">Pick a category above</p>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>Choose Science, History, Riddles, or any category to start reading</p>
                </div>
              ) : exploreLoading ? (
                <ExploreLoadingState />
              ) : (
                <div className="flex flex-col gap-3">
                  {exploreCards.map((card) => (
                    <ExploreFactCard
                      key={card.id}
                      card={card}
                      onReadStory={STORY_CATEGORIES.has(card.category) ? () => setStoryCard(card) : undefined}
                    />
                  ))}
                  <div ref={exploreSentinelRef} className="py-2 flex items-center justify-center">
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
                <div className="flex flex-col items-center justify-center h-48 text-center gap-2">
                  <span className="text-3xl">🔖</span>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>No saved cards yet</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.18)" }}>Tap the bookmark on any card</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 mt-2">
                  {bookmarks.map((card) => (
                    <div
                      key={card.id}
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
                          <p className="text-sm leading-relaxed line-clamp-3" style={{ color: "rgba(255,255,255,0.55)" }}>{card.fact}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CHANNELS TAB ──────────────────────────────────────── */}
        {tab === "channels" && (
          <div className="h-full flex flex-col">
            {/* Accordion header */}
            <div className="px-4 pt-4 flex-shrink-0">
              <button
                onClick={() => setChannelsOpen((v) => !v)}
                className="w-full flex items-center justify-between mb-1"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
              >
                <h2 className="text-white font-semibold text-base">
                  {activeChannel ? `${activeChannel.emoji} ${activeChannel.name}` : "Channels"}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                  {channelsOpen ? "▲ hide" : "▼ select"}
                </span>
              </button>
              {!channelsOpen && activeChannel && (
                <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Tap header to switch channel</p>
              )}
              {!channelsOpen && !activeChannel && (
                <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Tap header to pick a channel</p>
              )}

              {/* Collapsible chip grid */}
              {channelsOpen && (
                <div className="accordion-chips flex flex-wrap gap-2 pt-2 pb-3">
                  {TELEGRAM_CHANNELS.map((ch) => (
                    <button
                      key={ch.username}
                      onClick={() => { loadChannel(ch); setChannelsOpen(false); }}
                      className="px-3.5 py-2 rounded-full text-xs font-medium transition-all"
                      style={
                        activeChannel?.username === ch.username
                          ? { background: "#2481cc", color: "#fff" }
                          : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }
                      }
                    >
                      {ch.emoji} {ch.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              {!activeChannel ? (
                <div className="flex flex-col items-center justify-center h-64 text-center gap-3 px-6">
                  <span className="text-4xl">📡</span>
                  <p className="text-sm font-medium text-white">Pick a channel to start</p>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>Tap "select" at the top to choose a channel</p>
                </div>
              ) : channelLoading ? (
                <div className="flex flex-col gap-3 mt-1">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-2xl p-4 animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="h-3 w-24 rounded mb-3" style={{ background: "rgba(255,255,255,0.08)" }} />
                      <div className="h-3 w-full rounded mb-2" style={{ background: "rgba(255,255,255,0.05)" }} />
                      <div className="h-3 w-4/5 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
                    </div>
                  ))}
                  <p className="text-xs text-center mt-2" style={{ color: "rgba(255,255,255,0.2)" }}>Fetching from Telegram…</p>
                </div>
              ) : channelError ? (
                <div className="flex flex-col items-center justify-center h-48 text-center gap-3 px-6">
                  <span className="text-3xl">⚠️</span>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{channelError}</p>
                  <button onClick={() => activeChannel && loadChannel(activeChannel)}
                    className="px-5 py-2 rounded-xl text-sm text-white" style={{ background: "#2481cc" }}>
                    Try again
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {channelPosts.map((post) => (
                    <TelegramPostCard key={post.id} post={post} channel={activeChannel!} />
                  ))}
                  {channelPosts.length === 0 && (
                    <p className="text-center text-sm mt-8" style={{ color: "rgba(255,255,255,0.3)" }}>No posts found</p>
                  )}
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
          { id: "channels" as Tab, Icon: Send, label: "Channels" },
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

// Long-press hook: fires `callback` after holding for `ms` milliseconds
function useLongPress(callback: () => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    timer.current = setTimeout(callback, ms);
  };
  const cancel = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  };

  return {
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

function CardDetailModal({
  onClose,
  image,
  badge,
  badgeColor,
  title,
  subtitle,
  text,
}: {
  onClose: () => void;
  image?: string | null;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle?: string;
  text: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: "rgba(0,0,0,0.94)", animation: "modal-backdrop-in 0.2s ease forwards" }}
      onClick={onClose}
    >
      <div
        className="flex-1 flex flex-col overflow-hidden mx-3 my-6 rounded-3xl"
        style={{
          background: "#141414",
          border: "1px solid rgba(255,255,255,0.1)",
          animation: "modal-card-in 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: `${badgeColor}25`, color: badgeColor }}>
              {badge}
            </span>
            {subtitle && (
              <span className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{subtitle}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full ml-2 flex-shrink-0"
            style={{ width: 32, height: 32, background: "rgba(255,255,255,0.08)" }}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Full image — object-contain so nothing is cropped */}
          {image && (
            <div style={{ background: "#000", width: "100%" }}>
              <img
                src={image}
                alt={title}
                style={{ width: "100%", maxHeight: "55vh", objectFit: "contain", display: "block" }}
              />
            </div>
          )}

          {/* Text body */}
          <div className="p-5">
            <p className="text-base font-semibold mb-3 leading-snug" style={{ color: "rgba(255,255,255,0.92)" }}>
              {title}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.72)", letterSpacing: "0.01em" }}>
              {text}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InstaFactCard({
  card,
  isBookmarked,
  onBookmark,
  onReadStory,
}: {
  card: MythCard;
  isBookmarked: boolean;
  onBookmark: () => void;
  onReadStory?: () => void;
}) {
  const [img, setImg]         = useState(card.imageUrl ?? "");
  const [modal, setModal]     = useState(false);
  const cardRef               = useRef<HTMLDivElement>(null);
  const meta = CONTENT_CATEGORIES[card.category] ?? CONTENT_CATEGORIES["Mythology"];

  const longPress = useLongPress(() => setModal(true));

  // Only fetch the Wikipedia image once the card scrolls into view
  useEffect(() => {
    if (img || !cardRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        obs.disconnect();
        fetchDeityImageUrl(card.deityName, card.category).then((url) => {
          if (url) setImg(url);
        });
      },
      { threshold: 0.1 }
    );
    obs.observe(cardRef.current);
    return () => obs.disconnect();
  }, [card.deityName, card.category, img]);

  return (
    <>
      {modal && (
        <CardDetailModal
          onClose={() => setModal(false)}
          image={img || null}
          badge={`${meta.emoji} ${card.category}`}
          badgeColor={meta.color}
          title={card.deityName}
          text={card.fact}
        />
      )}
      <div
        ref={cardRef}
        className="rounded-2xl overflow-hidden select-none"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        {...longPress}
      >
        {/* Image — object-contain so full image is visible */}
        {img ? (
          <div style={{ background: "#000", width: "100%" }}>
            <img
              src={img}
              alt={card.deityName}
              style={{ width: "100%", maxHeight: "260px", objectFit: "contain", display: "block" }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center" style={{ height: 100, background: `${meta.color}18` }}>
            <span style={{ fontSize: 36 }}>{meta.emoji}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: `${meta.color}22`, color: meta.color }}>
              {meta.emoji} {card.category}
            </span>
            <button
              onClick={onBookmark}
              onPointerDown={(e) => e.stopPropagation()}
              className="p-1.5 rounded-full transition-colors"
              style={{ color: isBookmarked ? "#fff" : "rgba(255,255,255,0.28)" }}
              aria-label={isBookmarked ? "Remove bookmark" : "Bookmark"}
            >
              <Bookmark size={15} fill={isBookmarked ? "white" : "none"} />
            </button>
          </div>
          <p className="text-xs font-medium mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>{card.deityName}</p>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.82)" }}>{card.fact}</p>

          {/* Read full story button — story categories only */}
          {onReadStory && (
            <button
              onClick={onReadStory}
              onPointerDown={(e) => e.stopPropagation()}
              className="mt-3 flex items-center gap-2 text-sm font-medium rounded-xl px-4 py-2.5 w-full justify-center transition-opacity active:opacity-70"
              style={{ background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}40` }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                <path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"/>
              </svg>
              Read full story
            </button>
          )}

          {/* Long-press hint */}
          <p className="text-center mt-3 text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>
            Hold to expand
          </p>
        </div>
      </div>
    </>

  );
}

function TelegramPostCard({ post, channel }: { post: TelegramPost; channel: TelegramChannel }) {
  const [muted, setMuted]             = useState(true);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [progress, setProgress]       = useState(0);    // 0–100
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);
  const [ctrlVisible, setCtrlVisible] = useState(false);
  const [imgLoaded, setImgLoaded]     = useState(false);
  const [imgError, setImgError]       = useState(false);
  const [modal, setModal]             = useState(false);
  const [videoSrc, setVideoSrc]       = useState<string | null>(null);

  const videoRef     = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoSrcRef  = useRef<string | null>(null);
  const hideTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const longPress  = useLongPress(() => setModal(true));
  const isCdnVideo = post.hasVideo && !!post.mediaUrl && !post.mediaUrl.startsWith("/api/");

  const date = new Date(post.date * 1000).toLocaleDateString("en-US", {
    day: "numeric", month: "short", year: "numeric",
  });

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  function formatTime(s: number): string {
    if (!isFinite(s) || s < 0) return "0:00";
    const m   = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  function revealControls() {
    setCtrlVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setCtrlVisible(false), 3000);
  }

  function handleVideoTap() {
    if (videoSrc) revealControls();
  }

  function handlePlayPause(e: React.MouseEvent) {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else          v.pause();
    revealControls();
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v || !isFinite(duration) || duration === 0) return;
    const pct = parseFloat(e.target.value);
    v.currentTime = (pct / 100) * duration;
    setProgress(pct);
  }

  function handleTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (isFinite(v.duration) && v.duration > 0) {
      setProgress((v.currentTime / v.duration) * 100);
    }
  }

  // Controls are visible when paused (always) or recently tapped (while playing)
  const showControls = !!videoSrc && (!isPlaying || ctrlVisible);

  // IntersectionObserver: autoplay CDN videos on enter; pause all on exit
  useEffect(() => {
    if (!post.hasVideo || !containerRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (isCdnVideo && post.mediaUrl) {
            if (!videoSrcRef.current) {
              videoSrcRef.current = post.mediaUrl;
              setVideoSrc(post.mediaUrl);
            } else {
              videoRef.current?.play().catch(() => {});
            }
          }
        } else {
          videoRef.current?.pause();
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.hasVideo, post.mediaUrl, isCdnVideo]);

  function handlePlay() {
    if (!post.mediaUrl) return;
    if (!videoSrcRef.current) {
      videoSrcRef.current = post.mediaUrl;
      setVideoSrc(post.mediaUrl);
    } else {
      videoRef.current?.play().catch(() => {});
    }
  }

  // Shared video event handlers
  const videoEvents = {
    onCanPlay:        () => { if (videoRef.current?.paused) videoRef.current.play().catch(() => {}); },
    onPlay:           () => setIsPlaying(true),
    onPause:          () => { setIsPlaying(false); setCtrlVisible(true); },
    onTimeUpdate:     handleTimeUpdate,
    onDurationChange: () => { const v = videoRef.current; if (v && isFinite(v.duration)) setDuration(v.duration); },
  };

  // Shared controls overlay (rendered over both CDN and proxy video elements)
  function VideoControls() {
    return (
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0) 100%)",
          padding: "28px 10px 8px",
          opacity: showControls ? 1 : 0,
          transition: "opacity 0.25s ease",
          pointerEvents: showControls ? "auto" : "none",
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Progress scrubber */}
        <input
          type="range"
          min="0"
          max="100"
          step="0.2"
          value={progress}
          onChange={handleSeek}
          className="video-scrubber"
          style={{
            background: `linear-gradient(to right, #fff ${progress}%, rgba(255,255,255,0.28) ${progress}%)`,
            marginBottom: 7,
          }}
        />
        {/* Controls row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Play / Pause */}
          <button
            onClick={handlePlayPause}
            style={{ color: "#fff", display: "flex", background: "none", border: "none", padding: 0, cursor: "pointer" }}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          {/* Time display */}
          <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em", userSelect: "none" }}>
            {formatTime(currentTime)}{duration > 0 ? ` / ${formatTime(duration)}` : ""}
          </span>

          <div style={{ flex: 1 }} />

          {/* Mute / Unmute */}
          <button
            onClick={() => setMuted((m) => !m)}
            style={{ color: "#fff", display: "flex", background: "none", border: "none", padding: 0, cursor: "pointer" }}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
                <path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25A6.956 6.956 0 0112 19c-.34 0-.68-.03-1-.08v2.06c.33.05.66.08 1 .02 1.85 0 3.57-.57 4.98-1.53l1.79 1.79L20 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {modal && (
        <CardDetailModal
          onClose={() => setModal(false)}
          image={post.imageUrl}
          badge={`${channel.emoji} ${channel.name}`}
          badgeColor="#2481cc"
          title={date}
          subtitle={post.views > 0 ? `👁 ${post.views.toLocaleString()} views` : undefined}
          text={post.text}
        />
      )}
      <div
        className="rounded-2xl overflow-hidden select-none"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(36,129,204,0.2)" }}
        {...longPress}
      >
        {post.hasVideo && post.mediaUrl && (
          <div
            ref={containerRef}
            className="relative w-full"
            style={{ background: "#000" }}
            onClick={handleVideoTap}
          >
            {isCdnVideo ? (
              /* CDN video: poster shown until IntersectionObserver autoplays */
              <>
                {!videoSrc && post.imageUrl && (
                  <img src={post.imageUrl} alt="" className="w-full object-cover"
                    style={{ maxHeight: "340px", display: "block" }} />
                )}
                {videoSrc && (
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    muted={muted}
                    playsInline
                    loop
                    preload="auto"
                    poster={post.imageUrl ?? undefined}
                    className="w-full"
                    style={{ maxHeight: "340px", display: "block" }}
                    {...videoEvents}
                  />
                )}
              </>
            ) : (
              /* Proxy video: tap-to-play to avoid Telegram FLOOD_WAIT */
              <>
                {!videoSrc && (
                  <div className="relative">
                    {post.imageUrl && (
                      <img src={post.imageUrl} alt="" className="w-full object-cover"
                        style={{ maxHeight: "340px", display: "block" }} />
                    )}
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); handlePlay(); }}
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ background: "rgba(0,0,0,0.28)" }}
                      aria-label="Play video"
                    >
                      <div className="flex items-center justify-center rounded-full"
                        style={{ width: 54, height: 54, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}>
                        <svg viewBox="0 0 24 24" width="26" height="26" fill="white">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                    </button>
                  </div>
                )}
                {videoSrc && (
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    muted={muted}
                    playsInline
                    loop
                    preload="metadata"
                    className="w-full"
                    style={{ maxHeight: "340px", display: "block" }}
                    {...videoEvents}
                  />
                )}
              </>
            )}

            {/* Unified player controls overlay */}
            {videoSrc && <VideoControls />}
          </div>
        )}

        {/* Full image — object-contain so nothing is cropped */}
        {!post.hasVideo && post.imageUrl && !imgError && (
          <div className="relative w-full" style={{ background: "#000" }}>
            {!imgLoaded && (
              <div
                className="absolute inset-0 animate-pulse"
                style={{ minHeight: 160, background: "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 100%)" }}
              />
            )}
            <img
              src={post.imageUrl}
              alt=""
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              style={{
                width: "100%",
                maxHeight: "320px",
                objectFit: "contain",
                display: "block",
                opacity: imgLoaded ? 1 : 0,
                transition: "opacity 0.3s ease",
              }}
            />
          </div>
        )}

        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full" style={{ background: "rgba(36,129,204,0.2)", color: "#2481cc" }}>
              {channel.emoji} {channel.name}
            </span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>{date}</span>
            {post.views > 0 && (
              <span className="text-xs ml-auto" style={{ color: "rgba(255,255,255,0.2)" }}>
                👁 {post.views.toLocaleString()}
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
            {post.text.length > 300 ? post.text.slice(0, 300) + "…" : post.text}
          </p>
          {/* Long-press hint */}
          <p className="text-center mt-3 text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>
            Hold to expand
          </p>
        </div>
      </div>
    </>
  );
}

function ExploreFactCard({ card, onReadStory }: { card: MythCard; onReadStory?: () => void }) {
  const meta = CONTENT_CATEGORIES[card.category] ?? CONTENT_CATEGORIES["Mythology"];
  return (
    <div
      className="w-full text-left rounded-2xl p-4"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ background: `${meta.color}22`, color: meta.color }}>
          {meta.emoji} {card.category}
        </span>
        <span className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{card.deityName}</span>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>{card.fact}</p>
      {onReadStory && (
        <button
          onClick={onReadStory}
          className="mt-3 text-xs font-medium flex items-center gap-1.5"
          style={{ color: meta.color }}
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
            <path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"/>
          </svg>
          Read full story →
        </button>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl overflow-hidden animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div style={{ height: 180, background: "rgba(255,255,255,0.06)" }} />
          <div className="p-4 flex flex-col gap-2">
            <div className="h-5 w-28 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="h-3 w-full rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
            <div className="h-3 w-4/5 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
          </div>
        </div>
      ))}
      <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.2)" }}>Loading your feed…</p>
    </div>
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
