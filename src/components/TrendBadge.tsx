import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { formatYoYPercent, getYoYTrendDirection } from '../utils/growthUtils';

interface TrendBadgeProps {
  value: number | null | undefined;
  size?: 'xs' | 'sm' | 'md';
  periodLabel?: string;
  sublabel?: string;
  decimals?: number;
  showIcon?: boolean;
  className?: string;
  title?: string;
}

export const TrendBadge: React.FC<TrendBadgeProps> = ({
  value,
  size = 'sm',
  periodLabel,
  sublabel,
  decimals = 1,
  showIcon = true,
  className = '',
  title,
}) => {
  const direction = getYoYTrendDirection(value);
  const formattedVal = formatYoYPercent(value, true, decimals);

  const defaultTitle =
    title ||
    (value !== null && value !== undefined
      ? `Year-over-Year Growth: ${formattedVal}${periodLabel ? ` (${periodLabel})` : ''}`
      : 'No historical prior-year baseline observation in panel');

  if (direction === 'na') {
    return (
      <span
        title={defaultTitle}
        className={`inline-flex items-center gap-1 font-mono text-slate-400 font-medium ${
          size === 'xs' ? 'text-[10px]' : size === 'sm' ? 'text-[11px]' : 'text-xs'
        } ${className}`}
      >
        <span className="text-slate-300">—</span>
        <span>N/A</span>
      </span>
    );
  }

  const sizeClasses = {
    xs: 'px-1 py-0.2 text-[10px] gap-0.5',
    sm: 'px-1.5 py-0.5 text-[11px] gap-1',
    md: 'px-2 py-1 text-xs gap-1.5',
  }[size];

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
  }[size];

  const themeClasses = {
    up: 'bg-emerald-50 text-emerald-700 border border-emerald-200/90 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
    down: 'bg-rose-50 text-rose-700 border border-rose-200/90 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
    flat: 'bg-slate-50 text-slate-600 border border-slate-200/90 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800',
  }[direction];

  return (
    <span
      title={defaultTitle}
      className={`inline-flex items-center font-mono tabular-nums font-semibold rounded ${sizeClasses} ${themeClasses} ${className} transition-colors select-none`}
    >
      {showIcon && (
        <span className="shrink-0 flex items-center justify-center">
          {direction === 'up' && <ArrowUpRight className={iconSizes} strokeWidth={2.5} />}
          {direction === 'down' && <ArrowDownRight className={iconSizes} strokeWidth={2.5} />}
          {direction === 'flat' && <Minus className={iconSizes} strokeWidth={2.5} />}
        </span>
      )}
      <span>{formattedVal}</span>
      {periodLabel && (
        <span className="font-sans font-normal text-[9px] opacity-75 border-l border-current/25 pl-1 ml-0.5">
          {periodLabel}
        </span>
      )}
      {sublabel && (
        <span className="font-sans font-normal text-[9px] opacity-75 ml-0.5">
          {sublabel}
        </span>
      )}
    </span>
  );
};
