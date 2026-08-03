import { useEffect, useMemo, useState } from "react";
import { X, Plus, Pencil, Trash, Star, CalendarBlank } from "@phosphor-icons/react";
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
import { loadReviews, saveReviews, newReview, type ReviewItem } from "../lib/review";
import { fmtDateTime } from "../lib/util";

export default function MonthlyReview({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<{ open: boolean; edit: ReviewItem | null }>({
    open: false,
    edit: null,
  });
  const [detail, setDetail] = useState<ReviewItem | null>(null);
  const [pendingDel, setPendingDel] = useState<ReviewItem | null>(null);

  useEffect(() => {
    loadReviews()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  function persist(next: ReviewItem[]) {
    setItems(next);
    void saveReviews(next);
  }

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const k = q.trim().toLowerCase();
    return items.filter((i) =>
      (i.month + " " + i.highlights + " " + i.lows + " " + i.next)
        .toLowerCase()
        .includes(k),
    );
  }, [items, q]);

  const stats = useMemo(() => {
    const rated = items.filter((i) => i.rating > 0);
    const avg = rated.length
      ? (rated.reduce((a, i) => a + i.rating, 0) / rated.length).toFixed(1)
      : "—";
    return { months: items.length, last: items[0]?.month || "—", avg };
  }, [items]);

  function askDelete(it: ReviewItem) {
    setDetail(null);
    setPendingDel(it);
  }

  return (
    <div className="fixed inset-0 z-[75] flex flex-col bg-bg">
      <div className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <span className="text-lg">🗓️</span>
          <p className="text-base font-bold tracking-tight">月度复盘</p>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="ml-auto grid h-9 w-9 place-items-center rounded-full text-text-2 transition hover:bg-surface-2"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mx-auto flex max-w-2xl flex-wrap gap-2 px-4 pb-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索高光、不足或计划…"
            className={cn(inputCls, "flex-1 min-w-[160px]")}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-2xl space-y-3 px-4 py-3">
          <Card>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="已复盘" value={stats.months} />
              <Stat label="最近" value={stats.last} />
              <Stat label="均分" value={stats.avg} />
            </div>
          </Card>

          {items.length === 0 ? (
            <EmptyState
              icon={<CalendarBlank size={26} />}
              title="还没有复盘记录"
              desc="每月花几分钟写下高光、不足与下月计划，让成长有迹可循。"
              action={
                <Button onClick={() => setForm({ open: true, edit: null })}>
                  <Plus size={16} /> 写本月复盘
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-2">
              没有匹配当前搜索的复盘
            </p>
          ) : (
            filtered.map((it) => (
              <Reveal key={it.id}>
                <ReviewCard
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
        aria-label="写复盘"
      >
        <Plus size={26} weight="bold" />
      </button>

      {form.open && (
        <ReviewForm
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
        <ReviewDetail
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
          title="删除复盘"
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

function Stars({
  value,
  onChange,
  size = 14,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        return (
          <button
            key={n}
            type="button"
            disabled={!onChange}
            onClick={() => onChange?.(n)}
            className={cn(onChange ? "transition hover:scale-110" : "cursor-default")}
            aria-label={`${n} 星`}
          >
            <Star
              size={size}
              weight={filled ? "fill" : "regular"}
              className={filled ? "text-amber-400" : "text-text-2"}
            />
          </button>
        );
      })}
    </div>
  );
}

function ReviewCard({
  item,
  onOpen,
  onEdit,
  onRemove,
}: {
  item: ReviewItem;
  onOpen: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const preview = (item.highlights || item.next || item.lows).replace(/[#*`>_~]/g, "");
  return (
    <Card className="cursor-pointer transition active:scale-[0.99] hover:border-accent/40">
      <div onClick={onOpen}>
        <div className="flex items-center justify-between gap-3">
          <p className="font-serif text-lg font-bold tracking-tight">{item.month} 复盘</p>
          <Stars value={item.rating} />
        </div>
        {preview && (
          <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap font-serif text-sm leading-relaxed text-text-2">
            {preview}
          </p>
        )}
        <p className="mt-2 text-xs text-text-2">{fmtDateTime(item.updatedAt)}</p>
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

function ReviewDetail({
  item,
  onClose,
  onEdit,
  onRemove,
}: {
  item: ReviewItem;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <Modal open onClose={onClose} title={`${item.month} 复盘`}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Stars value={item.rating} />
          <span className="text-xs text-text-2">
            {item.rating ? `${item.rating}/5` : "未评分"}
          </span>
        </div>

        <Section title="🌟 本月高光">
          {item.highlights || "（空）"}
          {!!item.highlights && renderMarkdown(item.highlights)}
        </Section>
        <Section title="🔧 本月不足">
          {item.lows || "（空）"}
          {!!item.lows && renderMarkdown(item.lows)}
        </Section>
        <Section title="🎯 下月计划">
          {item.next || "（空）"}
          {!!item.next && renderMarkdown(item.next)}
        </Section>

        <p className="text-xs text-text-2">
          创建：{fmtDateTime(item.createdAt)}
          {item.updatedAt !== item.createdAt && ` · 更新：${fmtDateTime(item.updatedAt)}`}
        </p>

        <AiPanel source={reviewSource(item)} />

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-text-2">{title}</p>
      {typeof children === "string" ? (
        <p className="text-text-2">{children}</p>
      ) : (
        <div
          className="font-serif text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: children as string }}
        />
      )}
    </div>
  );
}

function ReviewForm({
  edit,
  onClose,
  onSave,
}: {
  edit: ReviewItem | null;
  onClose: () => void;
  onSave: (i: ReviewItem) => void;
}) {
  const [month, setMonth] = useState(edit?.month || newReview().month);
  const [highlights, setHighlights] = useState(edit?.highlights || "");
  const [lows, setLows] = useState(edit?.lows || "");
  const [next, setNext] = useState(edit?.next || "");
  const [rating, setRating] = useState(edit?.rating || 0);

  function save() {
    if (!month.trim()) return;
    const now = Date.now();
    onSave(
      newReview({
        id: edit?.id,
        month: month.trim(),
        highlights,
        lows,
        next,
        rating,
        createdAt: edit?.createdAt || now,
        updatedAt: now,
      }),
    );
  }

  return (
    <Modal open onClose={onClose} title={edit ? "编辑复盘" : "写复盘"}>
      <Field label="月份">
        <input
          type="month"
          className={inputCls}
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </Field>
      <Field label="本月高光 / 成就">
        <MarkdownEditor
          value={highlights}
          onChange={setHighlights}
          placeholder="这个月做了哪些值得骄傲的事？"
          minHeight={70}
        />
      </Field>
      <Field label="本月不足 / 待改进">
        <MarkdownEditor
          value={lows}
          onChange={setLows}
          placeholder="哪些地方没做好、下月想改？"
          minHeight={70}
        />
      </Field>
      <Field label="下月计划 / 目标">
        <MarkdownEditor
          value={next}
          onChange={setNext}
          placeholder="下个月想完成什么？"
          minHeight={70}
        />
      </Field>
      <Field label={`整体自评 ${rating ? rating + "/5" : "未评"}`}>
        <div className="py-1">
          <Stars value={rating} onChange={setRating} size={22} />
        </div>
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

function reviewSource(it: ReviewItem): string {
  return [
    `月份：${it.month}`,
    it.rating ? `自评：${it.rating}/5` : "",
    `本月高光：${it.highlights || "（无）"}`,
    `本月不足：${it.lows || "（无）"}`,
    `下月计划：${it.next || "（无）"}`,
  ]
    .filter(Boolean)
    .join("\n");
}
