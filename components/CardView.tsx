"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { MythCard, fetchDeityImageUrl, CONTENT_CATEGORIES } from "@/lib/api";

interface Props {
  card: MythCard;
  direction: number;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onNext: () => void;
  onPrev: () => void;
  canGoPrev: boolean;
}

const SWIPE_THRESHOLD = 70;

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 320 : -320, opacity: 0, scale: 0.95 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit:  (dir: number) => ({ x: dir > 0 ? -320 : 320, opacity: 0, scale: 0.95 }),
};

export default function CardView({
  card, direction, isBookmarked, onToggleBookmark, onNext, onPrev, canGoPrev,
}: Props) {
  const [imgError, setImgError] = useState(false);
  const [resolvedImageUrl, setResolvedImageUrl] = useState(card.imageUrl);
  const progress = Math.min(((card.factIndex + 1) / card.totalFacts) * 100, 100);

  const catMeta = CONTENT_CATEGORIES[card.category] ?? CONTENT_CATEGORIES["Mythology"];

  useEffect(() => {
    setImgError(false);
    setResolvedImageUrl(card.imageUrl);
    let cancelled = false;
    fetchDeityImageUrl(card.deityName, card.category).then((url) => {
      if (!cancelled && url) setResolvedImageUrl(url);
    });
    return () => { cancelled = true; };
  }, [card.deityName, card.imageUrl]);

  // Motion value for live drag translation
  const dragX = useMotionValue(0);
  const cardRotate = useTransform(dragX, [-200, 200], [-6, 6]);
  const cardOpacity = useTransform(dragX, [-180, 0, 180], [0.55, 1, 0.55]);

  // Raw pointer tracking (works for both touch and mouse)
  const startX = useRef<number | null>(null);
  const isDragging = useRef(false);

  function startDrag(clientX: number) {
    startX.current = clientX;
    isDragging.current = true;
  }

  function moveDrag(clientX: number) {
    if (!isDragging.current || startX.current === null) return;
    dragX.set((clientX - startX.current) * 0.45);
  }

  function endDrag(clientX: number) {
    if (!isDragging.current || startX.current === null) return;
    const dx = clientX - startX.current;
    isDragging.current = false;
    startX.current = null;

    if (dx < -SWIPE_THRESHOLD) {
      dragX.set(0);
      onNext();
    } else if (dx > SWIPE_THRESHOLD && canGoPrev) {
      dragX.set(0);
      onPrev();
    } else {
      animate(dragX, 0, { type: "spring", stiffness: 400, damping: 28 });
    }
  }

  function cancelDrag() {
    if (!isDragging.current) return;
    isDragging.current = false;
    startX.current = null;
    animate(dragX, 0, { type: "spring", stiffness: 400, damping: 28 });
  }

  return (
    <div
      className="w-full h-full"
      style={{ position: "relative", userSelect: "none" }}
      /* Touch */
      onTouchStart={(e) => startDrag(e.touches[0].clientX)}
      onTouchMove={(e) => moveDrag(e.touches[0].clientX)}
      onTouchEnd={(e) => endDrag(e.changedTouches[0].clientX)}
      onTouchCancel={cancelDrag}
      /* Mouse */
      onMouseDown={(e) => startDrag(e.clientX)}
      onMouseMove={(e) => moveDrag(e.clientX)}
      onMouseUp={(e) => endDrag(e.clientX)}
      onMouseLeave={cancelDrag}
    >
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={card.id}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          style={{
            x: dragX,
            rotate: cardRotate,
            opacity: cardOpacity,
            width: "100%",
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0,
            background: "#111218",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "24px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            cursor: isDragging.current ? "grabbing" : "grab",
          }}
        >
          {/* Hero image */}
          <div className="relative flex-shrink-0 overflow-hidden" style={{ height: "48%" }}>
            {resolvedImageUrl && !imgError ? (
              <img
                src={resolvedImageUrl}
                alt={card.deityName}
                className="w-full h-full object-cover"
                draggable={false}
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: `${catMeta.color}18` }}>
                <span className="text-6xl opacity-30">{catMeta.emoji}</span>
              </div>
            )}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, transparent 40%, #111218 100%)" }}
            />
            <div
              className="absolute top-3 left-3 text-xs font-medium px-2.5 py-1 rounded-lg"
              style={{ background: `${catMeta.color}cc`, color: "#fff", backdropFilter: "blur(4px)" }}
            >
              {card.category.toUpperCase()}
            </div>
            <div
              className="absolute top-3 right-3 flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg"
              style={{ background: "rgba(0,0,0,0.45)", color: "rgba(255,255,255,0.4)", backdropFilter: "blur(4px)" }}
            >
              <span className="font-serif font-bold">W</span>
              Wikipedia
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-col px-5 pt-4" style={{ flex: 1, minHeight: 0 }}>
            <h2 className="text-white text-2xl font-semibold leading-tight mb-3">{card.deityName}</h2>
            <p
              style={{ color: "rgba(255,255,255,0.65)", fontSize: "14px", lineHeight: "1.6", flex: 1, overflow: "auto" }}
            >
              {card.fact}
            </p>
            {card.totalFacts > 1 && (
              <p className="text-xs mt-2 mb-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                Fact {card.factIndex + 1} of {card.totalFacts}
              </p>
            )}
          </div>

          {/* Actions */}
          <div style={{ padding: "0 20px 20px", flexShrink: 0 }}>
            <div className="flex items-center justify-end mb-4">
              <button
                onClick={onToggleBookmark}
                onMouseDown={(e) => e.stopPropagation()}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={
                  isBookmarked
                    ? { background: "rgba(79,70,229,0.25)", border: "1px solid rgba(99,102,241,0.5)", color: "#818cf8" }
                    : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)" }
                }
              >
                {isBookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onPrev}
                onMouseDown={(e) => e.stopPropagation()}
                disabled={!canGoPrev}
                className="flex-none w-11 h-11 rounded-2xl flex items-center justify-center disabled:opacity-20"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}
              >
                <ChevronLeft size={18} />
              </button>

              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, background: "#4f46e5" }}
                />
              </div>

              <button
                onClick={onNext}
                onMouseDown={(e) => e.stopPropagation()}
                className="flex-none w-11 h-11 rounded-2xl flex items-center justify-center text-white"
                style={{ background: "#4f46e5" }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
