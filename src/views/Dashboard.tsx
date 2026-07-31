import { useMemo } from "react";
import { ChartLineUp, Fire, Clock, Lightbulb } from "@phosphor-icons/react";
import { useStore } from "../state/store";
import { Card, EmptyState, Reveal } from "../components/ui";
import type { Item, InspirationItem, LearningItem } from "../lib/types";
import { dayList, ymd, fmtDur, fmtDate } from "../lib/util";

export default function Dashboard() {
  const { items } = useStore();
  const active = items.filter((i) => !i.deleted);

  const m = useMemo(() => compute(active), [active]);

  if (active.length === 0) {
    return (
      <EmptyState
        icon={<ChartLineUp size={26} />}
        title="数据看板空空如也"
        desc="开始记录学习与灵感，这里会呈现你的时长、进度与坚持曲线。"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Reveal>
          <Card>
            <div className="flex items-center gap-2 text-text-2">
              <Clock size={16} className="text-accent" /> 累计学习
            </div>
            <p className="mt-1.5 text-2xl font-bold tracking-tight">
              {fmtDur(m.totalMin)}
            </p>
          </Card>
        </Reveal>
        <Reveal delay={0.05}>
          <Card>
            <div className="flex items-center gap-2 text-text-2">
              <Fire size={16} className="text-accent" /> 连续坚持
            </div>
            <p className="mt-1.5 text-2xl font-bold tracking-tight">
              {m.streak} <span className="text-base font-medium">天</span>
            </p>
          </Card>
        </Reveal>
        <Reveal delay={0.1}>
          <Card>
            <div className="flex items-center gap-2 text-text-2">
              <Lightbulb size={16} className="text-accent" /> 灵感
            </div>
            <p className="mt-1.5 text-2xl font-bold tracking-tight">
              {m.inspCount}
            </p>
          </Card>
        </Reveal>
        <Reveal delay={0.15}>
          <Card>
            <div className="flex items-center gap-2 text-text-2">
              <ChartLineUp size={16} className="text-accent" /> 本周时长
            </div>
            <p className="mt-1.5 text-2xl font-bold tracking-tight">
              {fmtDur(m.weekMin)}
            </p>
            <p className="mt-0.5 text-xs text-text-2">
              上周 {fmtDur(m.lastWeekMin)}
            </p>
          </Card>
        </Reveal>
      </div>

      <Reveal>
        <Card>
          <p className="mb-3 font-semibold tracking-tight">近 14 天活跃度</p>
          <Bars data={m.daily} />
        </Card>
      </Reveal>

      {m.topics.length > 0 && (
        <Reveal>
          <Card>
            <p className="mb-3 font-semibold tracking-tight">学习主题分布</p>
            <div className="space-y-2.5">
              {m.topics.map((t) => (
                <div key={t.name}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{t.name}</span>
                    <span className="text-text-2">{fmtDur(t.min)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${t.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Reveal>
      )}

      {m.topTags.length > 0 && (
        <Reveal>
          <Card>
            <p className="mb-3 font-semibold tracking-tight">高频标签</p>
            <div className="flex flex-wrap gap-2">
              {m.topTags.map((t) => (
                <span
                  key={t.name}
                  className="rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent"
                >
                  #{t.name} {t.count}
                </span>
              ))}
            </div>
          </Card>
        </Reveal>
      )}
    </div>
  );
}

function Bars({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-32 items-end gap-1.5">
      {data.map((d) => (
        <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-md bg-accent/80 transition-all"
            style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 4 : 2 }}
            title={`${fmtDate(d.day)}: ${d.count}`}
          />
          <span className="text-[9px] text-text-2">
            {d.day.slice(5, 7)}/{d.day.slice(8, 10)}
          </span>
        </div>
      ))}
    </div>
  );
}

function compute(active: Item[]) {
  const learn = active.filter((i) => i.kind === "learning") as LearningItem[];
  const insp = active.filter((i) => i.kind === "inspiration") as InspirationItem[];
  const totalMin = learn.reduce((s, i) => s + i.minutes, 0);

  const days = dayList(14);
  const daily = days.map((d) => ({
    day: d,
    count: active.filter((i) => i.day === d).length,
  }));

  // streak: consecutive days ending today (or most recent day) with >=1 item
  let streak = 0;
  const daySet = new Set(active.map((i) => i.day));
  const todayKey = ymd();
  let cursor = daySet.has(todayKey) ? todayKey : [...daySet].sort().reverse()[0];
  if (cursor) {
    // walk backwards while days are consecutive
    let d = new Date(cursor);
    while (daySet.has(ymd(d))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
  }

  const weekDays = dayList(7);
  const lastWeekDays = dayList(14).slice(7);
  const weekMin = learn
    .filter((i) => weekDays.includes(i.day))
    .reduce((s, i) => s + i.minutes, 0);
  const lastWeekMin = learn
    .filter((i) => lastWeekDays.includes(i.day))
    .reduce((s, i) => s + i.minutes, 0);

  const topicMap = new Map<string, number>();
  learn.forEach((i) => topicMap.set(i.topic, (topicMap.get(i.topic) || 0) + i.minutes));
  const maxTopic = Math.max(1, ...topicMap.values());
  const topics = Array.from(topicMap.entries())
    .map(([name, min]) => ({ name, min, pct: Math.round((min / maxTopic) * 100) }))
    .sort((a, b) => b.min - a.min)
    .slice(0, 6);

  const tagMap = new Map<string, number>();
  insp.forEach((i) => i.tags.forEach((t) => tagMap.set(t, (tagMap.get(t) || 0) + 1)));
  const topTags = Array.from(tagMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalMin,
    inspCount: insp.length,
    streak,
    weekMin,
    lastWeekMin,
    daily,
    topics,
    topTags,
  };
}
