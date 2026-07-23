"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Card, cardTypeConfig } from "@/lib/cards";
import { Bookmark, BookmarkCheck, Eye } from "lucide-react";

interface Props {
  card: Card;
  onNext: () => void;
  onPrev: () => void;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  direction: number;
}

export default function CardView({ card, onNext, onPrev, isBookmarked, onToggleBookmark, direction }: Props) {
  const [revealed, setRevealed] = useState(false);
  const config = cardTypeConfig[card.type];
  const hasImage = !!card.imageUrl;

  const variants = {
    enter: (dir: number) => ({ y: dir > 0 ? 60 : -60, opacity: 0, scale: 0.97 }),
    center: { y: 0, opacity: 1, scale: 1 },
    exit: (dir: number) => ({ y: dir > 0 ? -60 : 60, opacity: 0, scale: 0.97 }),
  };

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={card.id}
        custom={direction}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
        className={`relative w-full max-w-md h-full bg-gradient-to-br ${config.bg} rounded-3xl shadow-2xl flex flex-col overflow-hidden`}
      >
        {/* Hero image */}
        {hasImage && (
          <div className="relative w-full h-48 flex-shrink-0">
            <Image
              src={card.imageUrl!}
              alt={card.title || card.type}
              fill
              className="object-cover"
              sizes="(max-width: 448px) 100vw, 448px"
              priority
            />
            {/* Gradient fade into card background */}
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.4) 60%, var(--card-fade) 100%)`,
              }}
            />
            {/* Type badge over image */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="text-xl drop-shadow">{card.emoji}</span>
              <span className={`text-xs font-bold tracking-widest ${config.textColor} drop-shadow bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm`}>
                {config.label}
              </span>
            </div>
            {/* Bookmark over image */}
            <button
              onClick={onToggleBookmark}
              className="absolute top-3 right-4 p-2 rounded-full bg-black/40 hover:bg-black/60 transition-colors backdrop-blur-sm"
            >
              {isBookmarked ? (
                <BookmarkCheck size={18} className="text-yellow-400" />
              ) : (
                <Bookmark size={18} className="text-white/80" />
              )}
            </button>
          </div>
        )}

        {/* Top bar — shown only when no image */}
        {!hasImage && (
          <div className="flex items-center justify-between px-6 pt-6 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{card.emoji}</span>
              <span className={`text-xs font-bold tracking-widest ${config.textColor}`}>{config.label}</span>
            </div>
            <button
              onClick={onToggleBookmark}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              {isBookmarked ? (
                <BookmarkCheck size={18} className="text-yellow-400" />
              ) : (
                <Bookmark size={18} className="text-white/60" />
              )}
            </button>
          </div>
        )}

        {/* Divider — only without image */}
        {!hasImage && <div className={`mx-6 h-px ${config.accent} opacity-40`} />}

        {/* Content */}
        <div className="flex-1 flex flex-col justify-center px-6 py-5 gap-3 overflow-auto">
          {card.title && (
            <h2 className="text-white text-xl font-bold leading-snug">{card.title}</h2>
          )}

          <p className="text-white/85 text-base leading-relaxed whitespace-pre-line">{card.content}</p>

          {card.type === "riddle" && (
            <div className="mt-1">
              {!revealed ? (
                <button
                  onClick={() => setRevealed(true)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl ${config.accent} text-white text-sm font-semibold hover:opacity-90 transition-opacity`}
                >
                  <Eye size={16} />
                  Reveal Answer
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/10 rounded-xl px-4 py-3"
                >
                  <p className="text-xs text-white/50 mb-1 uppercase tracking-wider">Answer</p>
                  <p className="text-white font-semibold">{card.answer}</p>
                </motion.div>
              )}
            </div>
          )}

          {card.type === "quote" && card.source && (
            <p className={`text-sm font-semibold ${config.textColor}`}>— {card.source}</p>
          )}
        </div>

        {/* Bottom nav */}
        <div className="flex items-center justify-between px-6 pb-6 pt-2 flex-shrink-0">
          <button
            onClick={onPrev}
            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white/70 text-sm font-medium"
          >
            ← Prev
          </button>
          <button
            onClick={onNext}
            className={`px-6 py-2.5 rounded-xl ${config.accent} text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg`}
          >
            Next →
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
