"use client";

import { useState, useEffect, useCallback } from "react";
import { Bookmark } from "lucide-react";
import { getShuffledCards, Card } from "@/lib/cards";
import CardView from "./CardView";
import SessionSummary from "./SessionSummary";
import BookmarksDrawer from "./BookmarksDrawer";

const SESSION_SIZE = 10;

export default function Feed() {
  const [deck, setDeck] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [seenInSession, setSeenInSession] = useState<Card[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDeck(getShuffledCards());
    const saved = localStorage.getItem("fm_bookmarks");
    if (saved) setBookmarkedIds(new Set(JSON.parse(saved)));
  }, []);

  const currentCard = deck[index];

  const goNext = useCallback(() => {
    const nextSeen = [...seenInSession, currentCard];
    if (nextSeen.length >= SESSION_SIZE) {
      setSeenInSession(nextSeen);
      setShowSummary(true);
      return;
    }
    setSeenInSession(nextSeen);
    setDirection(1);
    setIndex((i) => (i + 1) % deck.length);
  }, [currentCard, deck.length, seenInSession]);

  const goPrev = useCallback(() => {
    setDirection(-1);
    setIndex((i) => (i - 1 + deck.length) % deck.length);
  }, [deck.length]);

  const toggleBookmark = useCallback(() => {
    if (!currentCard) return;
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(currentCard.id)) next.delete(currentCard.id);
      else next.add(currentCard.id);
      localStorage.setItem("fm_bookmarks", JSON.stringify([...next]));
      return next;
    });
  }, [currentCard]);

  const handleContinue = () => {
    setSeenInSession([]);
    setShowSummary(false);
    setDirection(1);
    setIndex((i) => (i + 1) % deck.length);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") goNext();
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  const bookmarkedCards = deck.filter((c) => bookmarkedIds.has(c.id));

  if (!currentCard) return null;

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 flex-shrink-0">
        <div>
          <h1 className="text-white font-bold text-lg tracking-tight">Free Mind</h1>
          <p className="text-white/30 text-xs">
            {index + 1} / {deck.length}
          </p>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="relative p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <Bookmark size={18} className="text-white/70" />
          {bookmarkedIds.size > 0 && (
            <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {bookmarkedIds.size}
            </span>
          )}
        </button>
      </header>

      {/* Card area */}
      <main className="flex-1 flex items-center justify-center px-4 pb-4 min-h-0">
        {showSummary ? (
          <SessionSummary cards={seenInSession} onContinue={handleContinue} />
        ) : (
          <div className="w-full max-w-md h-full">
            <CardView
              card={currentCard}
              onNext={goNext}
              onPrev={goPrev}
              isBookmarked={bookmarkedIds.has(currentCard.id)}
              onToggleBookmark={toggleBookmark}
              direction={direction}
            />
          </div>
        )}
      </main>

      <BookmarksDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        bookmarks={bookmarkedCards}
      />
    </div>
  );
}
