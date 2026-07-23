"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Card, cardTypeConfig } from "@/lib/cards";

interface Props {
  open: boolean;
  onClose: () => void;
  bookmarks: Card[];
}

export default function BookmarksDrawer({ open, onClose, bookmarks }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-sm bg-slate-900 z-50 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <h2 className="text-white font-bold text-lg">Saved Cards</h2>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                <X size={20} className="text-white/70" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
              {bookmarks.length === 0 ? (
                <div className="text-center text-white/30 mt-16">
                  <p className="text-4xl mb-3">🔖</p>
                  <p>No saved cards yet.</p>
                  <p className="text-sm mt-1">Tap the bookmark icon on any card.</p>
                </div>
              ) : (
                bookmarks.map((card) => {
                  const cfg = cardTypeConfig[card.type];
                  return (
                    <div key={card.id} className={`bg-gradient-to-br ${cfg.bg} rounded-2xl p-4`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span>{card.emoji}</span>
                        <span className={`text-xs font-bold tracking-widest ${cfg.textColor}`}>{cfg.label}</span>
                      </div>
                      {card.title && <p className="text-white font-semibold text-sm mb-1">{card.title}</p>}
                      <p className="text-white/70 text-sm line-clamp-3">{card.content}</p>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
