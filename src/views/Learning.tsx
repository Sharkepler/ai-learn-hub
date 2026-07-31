import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  ListChecks,
  Trash,
  Pencil,
  X,
  Spinner,
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
} from "../components/ui";
import DayFilter from "../components/DayFilter";
import type { Item, LearningItem } from "../lib/types";
import { uid, ymd, fmtDur, fmtDateTime } from "../lib/util";
import { pullDayInto, getCfg } from "../lib/sync";

const TOPICS = ["编程", "设计", "产品", "语言", "阅读", "其他"];

export default function Learning() {
  const { items, addItem, updateItem, removeItem, reload } = useStore();
  const toast = useToast();
  const [day, setDay] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: boolean; edit: LearningItem | null }>(
    { open: false, edit: null }
  );

  const all = items.filter((i) => i.kind === "learning" && !i.deleted) as LearningItem[];
  const visible = all
    .filter((i) => (day ? i.day === day : true))
    .sort((a, b) => b.createdAt - a.createdAt);

  useEffect(() => {
    if (day && getCfg().enabled) {
      pullDayInto(day)
        .then(() => reload())
        .catch(() => {});
    }
  }, [day, reload]);

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
        <div className="space-y-3">
          {visible.map((it) => (
            <Reveal key={it.id}>
              <LearningCard
                item={it}
                onEdit={() => setModal({ open: true, edit: it })}
                onRemove={removeItem}
              />
            </Reveal>
          ))}
        </div>
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
          onSave={(item) => {
            if (modal.edit) updateItem(item);
            else addItem(item);
            setModal({ open: false, edit: null });
            toast(modal.edit ? "已更新" : "已记录 ✅", "ok");
          }}
        />
      )}
    </div>
  );
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
      <p className="mt-0.5 text-lg font-bold tracking-tight">{value}</p>
    </div>
  );
}

function LearningCard({
  item,
  onEdit,
  onRemove,
}: {
  item: LearningItem;
  onEdit: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Card>
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
        <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-text-2">
          {item.note}
        </p>
      )}
      <p className="mt-2 text-xs text-text-2">{fmtDateTime(item.createdAt)}</p>

      <div className="mt-2 flex justify-end gap-1 border-t border-border pt-2">
        <button
          onClick={onEdit}
          className="rounded-full p-1.5 text-text-2 transition hover:bg-surface-2"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() => {
            if (confirm("删除这条记录？")) onRemove(item.id);
          }}
          className="rounded-full p-1.5 text-text-2 transition hover:bg-red-500/10 hover:text-red-500"
        >
          <Trash size={16} />
        </button>
      </div>
    </Card>
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
