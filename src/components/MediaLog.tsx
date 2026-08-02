import { useEffect, useMemo, useState } from "react";
import {
  X,
  Plus,
  Pencil,
  Trash,
  BookOpen,
  FilmStrip,
  Television,
  GameController,
  Star,
} from "@phosphor-icons/react";
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
  loadMedia,
  saveMedia,
  newMedia,
  type MediaItem,
  type MediaType,
  type MediaStatus,
} from "../lib/media";
import { fmtDateTime } from "../lib/util";

const TYPE_META: Record<MediaType, { label: string; icon: any; emoji: string }> = {
  book: { label: "书", icon: BookOpen, emoji: "📚" },
  movie: { label: "电影", icon: FilmStrip, emoji: "🎬" },
  tv: { label: "剧集", icon: Television, emoji: "📺" },
  game: { label: "游戏", icon: GameController, emoji: "🎮" },
};

const STATUS_META: Record<MediaStatus, { label: string; cls: string }> = {
  want: { label: "想看", cls: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" },
  doing: { label: "进行中", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-300" },
  done: { label: "已看完", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" },
};

const TYPES = Object.keys(TYPE_META) as MediaType[];
const STATUSES = Object.keys(STATUS_META) as MediaStatus[];

export default function MediaLog({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [type, setType] = useState<MediaType | "all">("all");
  const [status, setStatus] = useState<MediaStatus | "all">("all");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<{ open: boolean; edit: MediaItem | null }>({
    open: false,
    edit: null,
  });
  const [detail, setDetail] = useState<MediaItem | null>(null);
  const [pendingDel, setPendingDel] = useState<MediaItem | null>(null);

  useEffect(() => {
    loadMedia()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  function persist(next: MediaItem[]) {
    setItems(next);
    void saveMedia(next);
  }

  const filtered = useMemo(() => {
    let r = items;
    if (type !== "all") r = r.filter((i) => i.type === type);
    if (status !== "all") r = r.filter((i) => i.status === status);
    if (q.trim()) {
      const k = q.trim().toLowerCase();
      r = r.filter((i) =>
        (i.title + " " + (i.creator || "")).toLowerCase().includes(k)
      );
    }
    return r;
  }, [items, type, status, q]);

  const stats = useMemo(() => {
    const cnt = (s: MediaStatus) => items.filter((i) => i.status === s).length;
    const done = items.filter((i) => i.status === "done" && i.rating > 0);
    const avg = done.length
      ? (done.reduce((a, i) => a + i.rating, 0) / done.length).toFixed(1)
      : "—";
    return { want: cnt("want"), doing: cnt("doing"), done: cnt("done"), avg };
  }, [items]);

  function askDelete(it: MediaItem) {
    setDetail(null);
    setPendingDel(it);
  }

  return (
    <div className="fixed inset-0 z-[75] flex flex-col bg-bg">
      {/* 顶部栏 */}
      <div className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <span className="text-lg">📚</span>
          <p className="text-base font-bold tracking-tight">读书影视记录</p>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="ml-auto grid h-9 w-9 place-items-center rounded-full text-text-2 transition hover:bg-surface-2"
          >
            <X size={20} />
          </button>
        </div>
        {/* 筛选 */}
        <div className="mx-auto flex max-w-2xl flex-wrap gap-2 px-4 pb-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索名称或作者…"
            className={cn(inputCls, "flex-1 min-w-[140px]")}
          />
          {(["all", ...TYPES] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition",
                type === t
                  ? "bg-accent text-white"
                  : "bg-surface-2 text-text-2 hover:text-accent"
              )}
            >
              {t === "all" ? "全部类型" : TYPE_META[t].label}
            </button>
          ))}
          {(["all", ...STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition",
                status === s
                  ? "bg-accent text-white"
                  : "bg-surface-2 text-text-2 hover:text-accent"
              )}
            >
              {s === "all" ? "全部状态" : STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-2xl space-y-3 px-4 py-3">
          {/* 统计 */}
          <Card>
            <div className="grid grid-cols-4 gap-2 text-center">
              <Stat label="想看" value={stats.want} />
              <Stat label="进行中" value={stats.doing} />
              <Stat label="已看完" value={stats.done} />
              <Stat label="均分" value={stats.avg} />
            </div>
          </Card>

          {items.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={26} />}
              title="还没有记录"
              desc="把正在读的书、想看的电影、在玩的剧集记下来，进度和评分一目了然。"
              action={
                <Button onClick={() => setForm({ open: true, edit: null })}>
                  <Plus size={16} /> 添加记录
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-2">
              没有匹配当前筛选的记录
            </p>
          ) : (
            filtered.map((it) => (
              <Reveal key={it.id}>
                <MediaCard
                  item={it}
                  onOpen={() => setDetail(it)}
                  onEdit={() => setForm({ open: true, edit: it })}
                  onRemove={(id) => askDelete(it)}
                />
              </Reveal>
            ))
          )}
        </div>
      </div>

      {/* 悬浮添加 */}
      <button
        onClick={() => setForm({ open: true, edit: null })}
        className="fixed bottom-24 right-5 z-[80] grid h-14 w-14 place-items-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 transition active:scale-95 max-[420px]:right-4"
        aria-label="添加记录"
      >
        <Plus size={26} weight="bold" />
      </button>

      {form.open && (
        <MediaForm
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
        <MediaDetail
          item={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setDetail(null);
            setForm({ open: true, edit: detail });
          }}
          onRemove={(id) => askDelete(detail)}
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

function MediaCard({
  item,
  onOpen,
  onEdit,
  onRemove,
}: {
  item: MediaItem;
  onOpen: () => void;
  onEdit: () => void;
  onRemove: (id: string) => void;
}) {
  const tm = TYPE_META[item.type];
  const Icon = tm.icon;
  const sm = STATUS_META[item.status];
  return (
    <Card className="cursor-pointer transition active:scale-[0.99] hover:border-accent/40">
      <div onClick={onOpen}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
              <Icon size={18} />
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold tracking-tight">{item.title}</p>
              {item.creator && (
                <p className="truncate text-xs text-text-2">{item.creator}</p>
              )}
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
              sm.cls
            )}
          >
            {sm.label}
          </span>
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <Stars value={item.rating} />
          <span className="text-xs text-text-2">
            {item.rating ? `${item.rating}/5` : "未评分"}
          </span>
        </div>

        {item.review && (
          <p className="mt-2 line-clamp-2 whitespace-pre-wrap font-serif text-sm leading-relaxed text-text-2">
            {item.review.replace(/[#*`>_~]/g, "")}
          </p>
        )}
        <p className="mt-2 text-xs text-text-2">{fmtDateTime(item.updatedAt)}</p>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
        <button
          onClick={onOpen}
          className="flex items-center gap-1 text-xs font-medium text-text-2 transition hover:text-accent"
        >
          查看详情
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
            onClick={() => onRemove(item.id)}
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

function MediaDetail({
  item,
  onClose,
  onEdit,
  onRemove,
}: {
  item: MediaItem;
  onClose: () => void;
  onEdit: () => void;
  onRemove: (id: string) => void;
}) {
  const tm = TYPE_META[item.type];
  const Icon = tm.icon;
  return (
    <Modal open onClose={onClose} title={item.title || "未命名"}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
            <Icon size={14} /> {tm.label}
          </span>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              STATUS_META[item.status].cls
            )}
          >
            {STATUS_META[item.status].label}
          </span>
          {item.creator && (
            <span className="text-xs text-text-2">· {item.creator}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Stars value={item.rating} />
          <span className="text-xs text-text-2">
            {item.rating ? `${item.rating}/5` : "未评分"}
          </span>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-text-2">短评</p>
          {item.review ? (
            <div
              className="font-serif text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(item.review) }}
            />
          ) : (
            <p className="text-sm text-text-2">（暂无短评）</p>
          )}
        </div>

        <p className="text-xs text-text-2">
          创建：{fmtDateTime(item.createdAt)}
          {item.updatedAt !== item.createdAt &&
            ` · 更新：${fmtDateTime(item.updatedAt)}`}
        </p>

        <AiPanel source={mediaSource(item)} />

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="ghost" onClick={onEdit}>
            <Pencil size={16} /> 编辑
          </Button>
          <Button variant="danger" onClick={() => onRemove(item.id)}>
            <Trash size={16} /> 删除
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function MediaForm({
  edit,
  onClose,
  onSave,
}: {
  edit: MediaItem | null;
  onClose: () => void;
  onSave: (i: MediaItem) => void;
}) {
  const [type, setType] = useState<MediaType>(edit?.type || "book");
  const [title, setTitle] = useState(edit?.title || "");
  const [creator, setCreator] = useState(edit?.creator || "");
  const [status, setStatus] = useState<MediaStatus>(edit?.status || "want");
  const [rating, setRating] = useState(edit?.rating || 0);
  const [review, setReview] = useState(edit?.review || "");

  function save() {
    if (!title.trim()) return;
    const now = Date.now();
    const item = newMedia({
      id: edit?.id,
      type,
      title: title.trim(),
      creator: creator.trim(),
      status,
      rating,
      review,
      createdAt: edit?.createdAt || now,
      updatedAt: now,
    });
    onSave(item);
  }

  return (
    <Modal open onClose={onClose} title={edit ? "编辑记录" : "添加记录"}>
      <Field label="类型">
        <select
          className={inputCls}
          value={type}
          onChange={(e) => setType(e.target.value as MediaType)}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_META[t].emoji} {TYPE_META[t].label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="名称">
        <input
          className={inputCls}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：百年孤独 / 奥本海默"
        />
      </Field>
      <Field label="作者 / 导演（可选）">
        <input
          className={inputCls}
          value={creator}
          onChange={(e) => setCreator(e.target.value)}
          placeholder="例如：马尔克斯 / 诺兰"
        />
      </Field>
      <Field label="状态">
        <select
          className={inputCls}
          value={status}
          onChange={(e) => setStatus(e.target.value as MediaStatus)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
      </Field>
      <Field label={`评分 ${rating ? rating + "/5" : "未评分"}`}>
        <div className="py-1">
          <Stars value={rating} onChange={setRating} size={22} />
        </div>
      </Field>
      <Field label="短评">
        <MarkdownEditor
          value={review}
          onChange={setReview}
          placeholder="一句话感受、金句、是否推荐…"
          minHeight={80}
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

function mediaSource(it: MediaItem): string {
  return [
    `类型：${TYPE_META[it.type].label}`,
    `名称：${it.title}`,
    it.creator ? `作者/导演：${it.creator}` : "",
    `状态：${STATUS_META[it.status].label}`,
    it.rating ? `评分：${it.rating}/5` : "",
    `短评：${it.review || "（无）"}`,
  ]
    .filter(Boolean)
    .join("\n");
}
