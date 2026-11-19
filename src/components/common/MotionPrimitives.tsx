import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { HelpCircle, X, CheckCircle2, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { useOrbitMine } from '../../context/OrbitMineContext';

export const AnimatedNumber: React.FC<{
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}> = ({ value, decimals = 0, suffix = '', className = '' }) => {
  const prefersReduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prefersReduced) {
      setDisplay(value);
      prevRef.current = value;
      return;
    }

    const start = prevRef.current;
    const end = value;
    const duration = 520;
    const startTime = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(start + (end - start) * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prevRef.current = end;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, prefersReduced]);

  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
};

export const PageTransition: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  const prefersReduced = useReducedMotion();
  return (
    <motion.div
      initial={prefersReduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const TechnicalTooltip: React.FC<{ term: string; explanation: string }> = ({
  term,
  explanation,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex items-center gap-1 group">
      <span>{term}</span>
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Explain ${term}`}
        className="text-slate-400 hover:text-cyan-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-lg bg-slate-900 dark:bg-slate-950 text-slate-100 text-xs leading-relaxed border border-slate-700 shadow-lg pointer-events-none"
        >
          <span className="block font-semibold text-cyan-400 mb-1">{term}</span>
          {explanation}
        </span>
      )}
    </span>
  );
};

export const EmptyStateCard: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}> = ({ title, description, actionLabel, onAction, icon }) => (
  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] p-10 text-center max-w-xl mx-auto my-8">
    {icon && <div className="mx-auto mb-4 w-11 h-11 rounded-lg bg-cyan-500/10 text-cyan-500 flex items-center justify-center">{icon}</div>}
    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">{description}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export const NotificationToastStack: React.FC = () => {
  const { notifications, dismissNotification } = useOrbitMine();

  if (notifications.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {notifications.map((n) => {
        const icon =
          n.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          ) : n.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          ) : n.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
          );

        return (
          <div
            key={n.id}
            className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700/80 shadow-lg"
          >
            {icon}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{n.title}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">{n.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismissNotification(n.id)}
              aria-label="Dismiss notification"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
