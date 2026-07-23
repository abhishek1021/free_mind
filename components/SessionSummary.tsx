"use client";

import { motion } from "framer-motion";
import { Card, cardTypeConfig } from "@/lib/cards";

interface Props {
  cards: Card[];
  onContinue: () => void;
}

export default function SessionSummary({ cards, onContinue }: Props) {
  const counts = cards.reduce((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const lines = Object.entries(counts).map(([type, count]) => {
    const cfg = cardTypeConfig[type as keyof typeof cardTypeConfig];
    return { label: cfg.label, count, textColor: cfg.textColor };
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-md bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl shadow-2xl p-8 flex flex-col gap-6"
    >
      <div className="text-center">
        <span className="text-5xl">🧠</span>
        <h2 className="text-white text-2xl font-bold mt-3">Mind Snapshot</h2>
        <p className="text-white/50 text-sm mt-1">Here's what you just absorbed</p>
      </div>

      <div className="flex flex-col gap-3">
        {lines.map(({ label, count, textColor }) => (
          <div key={label} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
            <span className={`text-sm font-semibold ${textColor}`}>{label}</span>
            <span className="text-white font-bold">{count}</span>
          </div>
        ))}
      </div>

      <div className="text-center text-white/40 text-sm">
        {cards.length} cards · {Math.round(cards.length * 0.4)} min of mindful reading
      </div>

      <button
        onClick={onContinue}
        className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 transition-colors text-white font-semibold"
      >
        Keep Going →
      </button>
    </motion.div>
  );
}
