import { useEffect, useMemo, useState } from "react";
import { X, Plus, Pencil, Trash, Smiley } from "@phosphor-icons/react";
import {
  Card,
  Button,
  Field,
  inputCls,
  Modal,
  EmptyState,
  Reveal,
  ConfirmDialog,
  MarkdownEditor,
  AiPanel,
  cn,
} from "./ui";
import { renderMarkdown } from "../lib/markdown";
import {
  loadMoods,
  saveMoods,
  newMood,
  moodOf,
  MOODS,
  type MoodItem,
} from "../lib/mood";
import { dayList, fmtDate, fmtDateTime } from "../lib/util";

export default function MoodLog({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<MoodItem[]>([]);
  const [form, setForm] = useState<{ open: boolean; edit: MoodItem | null }>({
    open: false,
    edit: null,
  });
  const [detail, setDetail] = useState<MoodItem | null>(null);
  const [pendingDel, setPendingDel] = useState<MoodItem | null>(null);

  useEffect(() => {
    loadMoods()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  function persist(next: MoodItem[]) {
    setItems(next);
    void saveMoods(next);
  }

  const stats = useMemo(() => {
    const days = new Set(items.map((i) => i.day)).size;
    const withE = items.filter((i) => i.energy > 0);
    const avgE = withE.length
      ? (withE.reduce((a, i) => a + i.energy, 0) / withE.length).toFixed(1)
      : "—";
    const moodCount = new Map<string, number>();
    items.forEach((i) => moodCount.set(i.mood, (moodCount.get(i.mood) || 0) + 1));
    let topKey = "";
    let topN = 0;
    moodCount.forEach((n, k) => {
      if (n > topN) {
        topN = n;
        topKey = k;
      }
    });
    return { days, avgE, topEmoji: topKey ? moodOf(topKey).emoji : "—" };
  }, [items]);

  const trend = useMemo(() => {
    const days = dayList(14);
    return days.map((d) => {
      const recs = items.filter((i) => i.day === d);
      const avg = recs.length
        ? recs.reduce((a, i) => a + i.energy, 0) / recs.length
        : 0;
      return { day: d, avg };
    });
  }, [items]);

  function askDelete(it: MoodItem) {
    setDetail(null);
    setPendingDel(it);
  }

  return (
    <div className="fixed inset-0 z-[75] flex flex-col bg-bg">
      <div className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <span className="text-lg">🌈</span>
          <p className="text-base font-bold tracking-tight">心情 / 精力日记</p>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="ml-auto grid h-9 w-9 place-items-center rounded-full text-text-2 transition hover:bg-surface-2"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-2xl space-y-3 px-4 py-3">
          <Card>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="记录天数" value={stats.days} />
              <Stat label="平均精力" value={stats.avgE} />
              <Stat label="常驻情绪" value={stats.topEmoji} />
            </div>
          </Card>

          <Card>
            <p className="mb-2 text-xs font-medium text-text-2">近 14 天精力</p>
            <div className="flex h-24 items-end gap-1.5">
              {trend.map((t) => {
                const h = t.avg ? (t.avg / 5) * 100 : 2;
                const c =
                  t.avg >= 4
                    ? "bg-emerald-500/80"
                    : t.avg >= 3
                    ? "bg-amber-500/80"
                    : t.avg > 0
                    ? "bg-red-500/70"
                    : "bg-surface-2";
                return (
                  <div
                    key={t.day}
                    className="flex flex-1 flex-col items-center justify-end gap-1"
                  >
                    <div
                      className={cn("w-full rounded-t-md transition-all", c)}
                      style={{ height: `${h}%` }}
                      title={`${fmtDate(t.day)}: ${t.avg ? t.avg.toFixed(1) : "无"}`}
                    />
                    <span className="text-[9px] text-text-2">
                      {t.day.slice(5, 7)}/{t.day.slice(8, 10)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          {items.length === 0 ? (
            <EmptyState
              icon={<Smiley size={26} />}
              title="还没有心情记录"
              desc="每天记一个情绪和精力值，慢慢看清自己的波动规律。"
              action={
                <Button onClick={() => setForm({ open: true, edit: null })}>
                  <Plus size={16} /> 记一条
                </Button>
              }
            />
          ) : (
            items.map((it) => (
              <Reveal key={it.id}>
                <MoodCard
                  item={it}
                  onOpen={() => setDetail(it)}
                  onEdit={() => setForm({ open: true, edit: it })}
                  onRemove={() => askDelete(it)}
                />
              </Reveal>
            ))
          )}
        </div>
      </div>

      <button
        onClick={() => setForm({ open: true, edit: null })}
        className="fixed bottom-24 right-5 z-[80] grid h-14 w-14 place-items-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 transition active:scale-95 max-[420px]:right-4"
        aria-label="记一条"
      >
        <Plus size={26} weight="bold" />
      </button>

      {form.open && (
        <MoodForm
          edit={form.edit}
          onClose={() => setForm({ open: false, edit: null })}
          onSave={(item) => {
            const exists = items.some((i) => i.id === item.id);
            const next = exists
              ? items.map((i) => (i.id === item.id ? item : i))
              : [item, ...items];
            persist(next);
            setForm({ open: false, edit: null });
          }}
        />
      )}

      {detail && (
        <MoodDetail
          item={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setDetail(null);
            setForm({ open: true, edit: detail });
          }}
          onRemove={() => askDelete(detail)}
        />
      )}

      {pendingDel && (
        <ConfirmDialog
          open
          title="删除记录"
          message="将从本地记录中移除，无法恢复。"
          confirmText="删除"
          danger
          onConfirm={() => {
            persist(items.filter((i) => i.id !== pendingDel.id));
            setPendingDel(null);
          }}
          onCancel={() => setPendingDel(null)}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="font-serif text-xl font-bold tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-text-2">{label}</p>
    </div>
  );
}

function MoodCard({
  item,
  onOpen,
  onEdit,
  onRemove,
}: {
  item: MoodItem;
  onOpen: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const m = moodOf(item.mood);
  return (
    <Card className="cursor-pointer transition active:scale-[0.99] hover:border-accent/40">
      <div onClick={onOpen}>
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none">{m.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{m.label}</p>
            {item.note && (
              <p className="truncate text-xs text-text-2">
                {item.note.replace(/[#*`>_~]/g, "")}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-text-2">精力</p>
            <p className="font-serif text-lg font-bold">{item.energy}/5</p>
          </div>
        </div>
        <p className="mt-1.5 text-xs text-text-2">
          {item.day} · {fmtDateTime(item.createdAt)}
        </p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
        <button
          onClick={onOpen}
          className="text-xs font-medium text-text-2 transition hover:text-accent"
        >
          查看
        </button>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="rounded-full p-1.5 text-text-2 transition hover:bg-surface-2"
            aria-label="编辑"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={onRemove}
            className="rounded-full p-1.5 text-text-2 transition hover:bg-red-500/10 hover:text-red-500"
            aria-label="删除"
          >
            <Trash size={16} />
          </button>
        </div>
      </div>
    </Card>
  );
}

function MoodDetail({
  item,
  onClose,
  onEdit,
  onRemove,
}: {
  item: MoodItem;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const m = moodOf(item.mood);
  return (
    <Modal open onClose={onClose} title={`${m.emoji} ${m.label}`}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-text-2">
          <span>精力</span>
          <span className="font-serif text-lg font-bold">{item.energy}/5</span>
          <span>· {item.day}</span>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-text-2">短记</p>
          {item.note ? (
            <div
              className="font-serif text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(item.note) }}
            />
          ) : (
            <p className="text-sm text-text-2">（暂无短记）</p>
          )}
        </div>

        <p className="text-xs text-text-2">
          创建：{fmtDateTime(item.createdAt)}
          {item.updatedAt !== item.createdAt &&
            ` · 更新：${fmtDateTime(item.updatedAt)}`}
        </p>

        <AiPanel source={moodSource(item)} />

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="ghost" onClick={onEdit}>
            <Pencil size={16} /> 编辑
          </Button>
          <Button variant="danger" onClick={onRemove}>
            <Trash size={16} /> 删除
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function MoodForm({
  edit,
  onClose,
  onSave,
}: {
  edit: MoodItem | null;
  onClose: () => void;
  onSave: (i: MoodItem) => void;
}) {
  const [mood, setMood] = useState(edit?.mood || "neutral");
  const [energy, setEnergy] = useState(edit?.energy || 3);
  const [note, setNote] = useState(edit?.note || "");
  const [day, setDay] = useState(edit?.day || newMood().day);

  function save() {
    if (!day.trim()) return;
    const now = Date.now();
    const init = moodOf(mood);
    onSave(
      newMood({
        id: edit?.id,
        mood: init.key,
        emoji: init.emoji,
        energy,
        note,
        day: day.trim(),
        createdAt: edit?.createdAt || now,
        updatedAt: now,
      })
    );
  }

  return (
    <Modal open onClose={onClose} title={edit ? "编辑记录" : "记一条"}>
      <Field label="今天的心情">
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMood(m.key)}
              className={cn(
                "grid h-11 w-11 place-items-center rounded-full text-xl transition",
                mood === m.key
                  ? "bg-accent text-white"
                  : "bg-surface-2 hover:bg-accent-soft"
              )}
              aria-label={m.label}
            >
              {m.emoji}
            </button>
          ))}
        </div>
      </Field>
      <Field label={`精力 ${energy}/5`}>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={energy}
          onChange={(e) => setEnergy(Number(e.target.value))}
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-[10px] text-text-2">
          <span>很低</span>
          <span>很高</span>
        </div>
      </Field>
      <Field label="日期">
        <input
          type="date"
          className={inputCls}
          value={day}
          onChange={(e) => setDay(e.target.value)}
        />
      </Field>
      <Field label="短记（可选）">
        <MarkdownEditor
          value={note}
          onChange={setNote}
          placeholder="发生了什么？为什么是这个状态？"
          minHeight={70}
        />
      </Field>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          取消
        </Button>
        <Button onClick={save}>保存</Button>
      </div>
    </Modal>
  );
}

function moodSource(it: MoodItem): string {
  const m = moodOf(it.mood);
  return [
    `日期：${it.day}`,
    `心情：${m.label}（${m.emoji}）`,
    `精力：${it.energy}/5`,
    `短记：${it.note || "（无）"}`,
  ].join("\n");
}
