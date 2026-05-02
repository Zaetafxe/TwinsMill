type StatCardProps = {
  label: string;
  value: string;
  hint: string;
  trend?: "up" | "down" | "stable";
};

export function StatCard({ label, value, hint, trend }: StatCardProps) {
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : null;
  const trendColor = trend === "up" ? "text-emerald-500" : trend === "down" ? "text-rose-500" : "";

  return (
    <article className="panel fade-up relative overflow-hidden p-4 col-span-6 lg:col-span-3 md:p-5">
      {/* Decorative corner accent */}
      <div
        className="pointer-events-none absolute right-0 top-0 h-16 w-16 rounded-bl-[32px] opacity-[0.06]"
        style={{ background: "linear-gradient(135deg, #0f2f63, #b98656)" }}
      />
      <p className="text-[0.63rem] font-bold uppercase tracking-[0.1em] text-slate-400 leading-tight mb-2">{label}</p>
      <div className="flex items-end gap-1.5 min-w-0">
        <h3
          className="font-display text-2xl leading-none min-w-0 break-all"
          style={{
            background: "linear-gradient(118deg, #0f2f63 0%, #0a1f45 56%, #b98656 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {value}
        </h3>
        {trendIcon && (
          <span className={`mb-0.5 text-sm font-bold leading-none shrink-0 ${trendColor}`}>{trendIcon}</span>
        )}
      </div>
      <p className="ops-detail mt-2 text-xs leading-relaxed text-slate-500 line-clamp-2">{hint}</p>
    </article>
  );
}
