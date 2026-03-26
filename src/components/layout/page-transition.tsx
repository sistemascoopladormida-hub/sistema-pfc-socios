"use client";

import { AnimatePresence, motion } from "framer-motion";

type PageTransitionProps = {
  transitionKey: string;
  children: React.ReactNode;
};

export function PageTransition({ transitionKey, children }: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={transitionKey}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
