import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";

interface ToastItem {
  id: number;
  msg: string;
  tone: "ok" | "err" | "info";
}

const Ctx = createContext<(msg: string, tone?: ToastItem["tone"]) => void>(
  () => {}
);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<ToastItem[]>([]);

  const toast = useCallback(
    (msg: string, tone: ToastItem["tone"] = "info") => {
      const id = Date.now() + Math.random();
      setList((p) => [...p, { id, msg, tone }]);
      setTimeout(() => setList((p) => p.filter((t) => t.id !== id)), 2600);
    },
    []
  );

  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {list.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className={
                "pointer-events-auto max-w-[90vw] rounded-full px-4 py-2 text-sm font-medium shadow-lg " +
                (t.tone === "err"
                  ? "bg-red-500 text-white"
                  : t.tone === "ok"
                  ? "bg-accent text-white"
                  : "bg-surface-2 text-text border border-border")
              }
            >
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
