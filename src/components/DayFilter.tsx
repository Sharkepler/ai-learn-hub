import { dayList, fmtDate } from "../lib/util";
import { cn } from "./ui";

export default function DayFilter({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (day: string | null) => void;
}) {
  const days = dayList(14);
  return (
    <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      <Chip active={value === null} onClick={() => onChange(null)}>
        全部
      </Chip>
      {days.map((d) => (
        <Chip key={d} active={value === d} onClick={() => onChange(d)}>
          {fmtDate(d).replace(" ", " ")}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition active:scale-95",
        active
          ? "border-accent bg-accent text-white"
          : "border-border bg-surface text-text-2 hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}
