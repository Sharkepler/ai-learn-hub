import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  ListChecks,
  Trash,
  Pencil,
  X,
  Spinner,
  ArrowRight,
} from "@phosphor-icons/react";
import { useStore } from "../state/store";
import { useToast } from "../components/Toast";
import {
  Card,
  Button,
  Field,
  inputCls,
  Modal,
  EmptyState,
  Reveal,
  AiPanel,
  ConfirmDialog,
} from "../components/ui";
import DayFilter from "../components/DayFilter";
import type { Item, LearningItem } from "../lib/types";
import { uid, ymd, fmtDur, fmtDateTime } from "../lib/util";
import { pullDayInto, getCfg } from "../lib/sync";

const PAGE = 12;

const TOPICS = ["编程", "设计", "产品", "语言", "阅读", "其他"];

export default function Learning({
  focusId,
  onConsumeFocus,
}: {
  focusId?: string | null;
  onConsumeFocus?: () => void;
}) {
  const { items, addItem, updateItem, removeItem, reload } = useStore();
  const toast = useToast();
  const [day, setDay] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; edit: LearningItem | null }>(
    { open: false, edit: null }
  );
  const [detail, setDetail] = useState<LearningItem | null>(null);
  const [pendingDel, setPendingDel] = useState<LearningItem | null>(null);
  const [limit, setLimit] = useState(PAGE);

  function askDelete(id: string) {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    setDetail(null);
    setPendingDel(it as LearningItem);
  }

  const all = items.filter((i) => i.kind === "learning" && !i.deleted) as LearningItem[];
  const visible = all
    .filter((i) => (day ? i.day === day : true))
    .sort((a, b) => b.createdAt - a.createdAt);

  // 分页：全部/按天筛选结果过多时，点「加载更多」增量展示
  useEffect(() => setLimit(PAGE), [day]);
  const shown = visible.slice(0, limit);
  const hasMore = visible.length > limit;

  useEffect(() => {
    if (day && getCfg().enabled) {
      pullDayInto(day)
        .then(() => reload())
        .catch(() => {});
    }
  }, [day, reload]);

  // 搜索结果跳转：定位到指定记录并打开详情
  useEffect(() => {
    if (focusId) {
      const it = all.find((i) => i.id === focusId);
      if (it) {
        setDetail(it);
        onConsumeFocus?.();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  return (
    <div>
      <DayFilter value={day} onChange={setDay} />

      <Card className="mb-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <ListChecks size={18} className="text-accent" /> 今日学习
        </div>
        <TodaySummary all={all} />
      </Card>

      {visible.length === 0 ? (
        <EmptyState
          icon={<ListChecks size={26} />}
          title="还没有学习记录"
          desc="记录你投入的时长与进度，日积月累就能看见成长曲线。"
          action={
            <Button onClick={() => setModal({ open: true, edit: null })}>
              <Plus size={16} /> 添加记录
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {shown.map((it) => (
              <Reveal key={it.id}>
                <LearningCard
                  item={it}
                  onOpen={() => setDetail(it)}
                  onEdit={() => setModal({ open: true, edit: it })}
                  onRemove={(id) => askDelete(id)}
                />
              </Reveal>
            ))}
          </div>

          {hasMore && (
            <div className="pt-1">
              <button
                onClick={() => setLimit((l) => l + PAGE)}
                className="mx-auto block w-full max-w-xs rounded-full bg-surface-2 py-2.5 text-sm font-medium text-text-2 transition hover:text-accent"
              >
                加载更多（剩余 {visible.length - limit} 条）
              </button>
            </div>
          )}
        </>
      )}

      <button
        onClick={() => setModal({ open: true, edit: null })}
        className="fixed bottom-24 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 transition active:scale-95 max-[420px]:right-4"
        aria-label="添加学习记录"
      >
        <Plus size={26} weight="bold" />
      </button>

      {modal.open && (
        <LearningForm
          edit={modal.edit}
          onClose={() => setModal({ open: false, edit: null })}
          onSave={async (item) => {
            const synced = await (modal.edit ? updateItem(item) : addItem(item));
            setModal({ open: false, edit: null });
            if (synced)
              toast(
                modal.edit ? "学习记录已更新 ✅" : "学习记录已保存 ✅",
                "ok"
              );
            else toast("已保存到本地（未同步）", "info");
          }}
        />
      )}

      {detail && (
        <LearningDetail
          item={detail}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setDetail(null);
            setModal({ open: true, edit: detail });
          }}
          onRemove={(id) => askDelete(id)}
        />
      )}

      {pendingDel && (
        <ConfirmDialog
          open
          title="删除学习记录"
          message="将标记为已删除并隐藏，记录不会被真正清除，可随时恢复。"
          confirmText="删除"
          danger
          onConfirm={async () => {
            const synced = await removeItem(pendingDel.id);
            setPendingDel(null);
            toast(
              synced ? "已删除（已同步）" : "已删除（本地标记）",
              synced ? "ok" : "info"
            );
          }}
          onCancel={() => setPendingDel(null)}
        />
      )}
    </div>
  );
}

function learningSource(it: LearningItem) {
  return [
    `主题：${it.topic}`,
    `学习时长：${it.minutes} 分钟`,
    `完成进度：${it.progress}%`,
    `备注：${it.note || "（无）"}`,
  ].join("\n");
}

function TodaySummary({ all }: { all: LearningItem[] }) {
  const todayKey = ymd();
  const todayItems = all.filter((i) => i.day === todayKey);
  const mins = todayItems.reduce((s, i) => s + i.minutes, 0);
  const avg = todayItems.length
    ? Math.round(todayItems.reduce((s, i) => s + i.progress, 0) / todayItems.length)
    : 0;
  return (
    <div className="grid grid-cols-2 gap-3">
      <Stat label="今日时长" value={fmtDur(mins)} />
      <Stat label="平均进度" value={avg + "%"} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <p className="text-xs text-text-2">{label}</p>
      <p className="mt-0.5 font-serif text-lg font-bold tracking-tight">{value}</p>
    </div>
  );
}

function LearningCard({
  item,
  onOpen,
  onEdit,
  onRemove,
}: {
  item: LearningItem;
  onOpen: () => void;
  onEdit: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Card className="cursor-pointer transition active:scale-[0.99] hover:border-accent/40">
      <div onClick={onOpen}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold tracking-tight">{item.topic}</p>
            <p className="mt-0.5 text-sm text-text-2">{fmtDur(item.minutes)}</p>
          </div>
          <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
            {item.progress}%
          </span>
        </div>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${item.progress}%` }}
          />
        </div>

        {item.note && (
          <p className="mt-2.5 line-clamp-3 whitespace-pre-wrap font-serif text-sm leading-relaxed text-text-2">
            {item.note}
          </p>
        )}
        <p className="mt-2 text-xs text-text-2">{fmtDateTime(item.createdAt)}</p>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
        <button
          onClick={onOpen}
          className="flex items-center gap-1 text-xs font-medium text-text-2 transition hover:text-accent"
        >
          查看详情 <ArrowRight size={14} />
        </button>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="rounded-full p-1.5 text-text-2 transition hover:bg-surface-2"
          >
            <Pencil size={16} />
          </button>
          <button
          onClick={() => onRemove(item.id)}
            className="rounded-full p-1.5 text-text-2 transition hover:bg-red-500/10 hover:text-red-500"
          >
            <Trash size={16} />
          </button>
        </div>
      </div>
    </Card>
  );
}

function LearningDetail({
  item,
  onClose,
  onEdit,
  onRemove,
}: {
  item: LearningItem;
  onClose: () => void;
  onEdit: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Modal open onClose={onClose} title={item.topic}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="学习时长" value={fmtDur(item.minutes)} />
          <Stat label="完成进度" value={item.progress + "%"} />
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-text-2">备注</p>
          {item.note ? (
            <p className="whitespace-pre-wrap font-serif text-sm leading-relaxed">
              {item.note}
            </p>
          ) : (
            <p className="text-sm text-text-2">（暂无备注）</p>
          )}
        </div>

        <p className="text-xs text-text-2">
          创建：{fmtDateTime(item.createdAt)}
          {item.updatedAt !== item.createdAt &&
            ` · 更新：${fmtDateTime(item.updatedAt)}`}
        </p>

        {/* 三合一 AI 面板：打开即自动调用，可切换 总结 / 知识框架 / 资源推荐 */}
        <AiPanel source={learningSource(item)} />

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="ghost" onClick={onEdit}>
            <Pencil size={16} /> 编辑
          </Button>
          <Button
            variant="danger"
          onClick={() => onRemove(item.id)}
          >
            <Trash size={16} /> 删除
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function LearningForm({
  edit,
  onClose,
  onSave,
}: {
  edit: LearningItem | null;
  onClose: () => void;
  onSave: (i: Item) => void;
}) {
  const [topic, setTopic] = useState(edit?.topic || TOPICS[0]);
  const [minutes, setMinutes] = useState(edit?.minutes || 30);
  const [progress, setProgress] = useState(edit?.progress || 0);
  const [note, setNote] = useState(edit?.note || "");
  const [custom, setCustom] = useState(
    edit ? (!TOPICS.includes(edit.topic) ? edit.topic : "") : ""
  );

  function save() {
    const finalTopic = custom.trim() || topic;
    if (!finalTopic) return;
    const now = Date.now();
    const item: LearningItem = {
      id: edit?.id || uid(),
      kind: "learning",
      createdAt: edit?.createdAt || now,
      updatedAt: now,
      day: ymd(edit?.createdAt || now),
      topic: finalTopic,
      minutes: Number(minutes) || 0,
      progress: Number(progress) || 0,
      note: note.trim(),
    };
    onSave(item);
  }

  return (
    <Modal open onClose={onClose} title={edit ? "编辑记录" : "添加学习记录"}>
      <Field label="主题">
        <select
          className={inputCls}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        >
          {TOPICS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Field>
      <Field label="或自定义主题">
        <input
          className={inputCls}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="例如：钢琴练习"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="时长（分钟）">
          <input
            type="number"
            min={0}
            className={inputCls}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </Field>
        <Field label={`进度 ${progress}%`}>
          <input
            type="range"
            min={0}
            max={100}
            className="mt-2 w-full accent-accent"
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
          />
        </Field>
      </div>
      <Field label="备注">
        <textarea
          className={inputCls + " min-h-[64px] resize-none"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="学到了什么…"
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
