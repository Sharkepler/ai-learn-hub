import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Lightbulb,
  Trash,
  Image as ImageIcon,
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
  Lightbox,
  AiPanel,
  ConfirmDialog,
  type AiKind,
} from "../components/ui";
import DayFilter from "../components/DayFilter";
import type { InspirationItem, Item } from "../lib/types";
import { uid, ymd, extractTags, fmtDateTime, compressImage } from "../lib/util";
import { pullDayInto, getCfg } from "../lib/sync";

export default function Inspiration() {
  const { items, addItem, updateItem, removeItem, reload } = useStore();
  const toast = useToast();
  const [day, setDay] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [quick, setQuick] = useState("");

  // 详情 / 放大图（AI 面板内嵌于详情，打开即自动调用）
  const [detail, setDetail] = useState<{ item: InspirationItem; kind: AiKind } | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [pendingDel, setPendingDel] = useState<InspirationItem | null>(null);

  function askDelete(id: string) {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    setDetail(null);
    setPendingDel(it as InspirationItem);
  }

  // 选中某天时，按需拉取该天的云端数据，实现"按天搜索"
  useEffect(() => {
    if (day && getCfg().enabled) {
      pullDayInto(day)
        .then(() => reload())
        .catch(() => {});
    }
  }, [day, reload]);

  function openDetail(item: InspirationItem, kind: AiKind = "summarize") {
    setDetail({ item, kind });
  }

  const all = items.filter((i) => i.kind === "inspiration" && !i.deleted) as InspirationItem[];
  const tags = useMemo(
    () => Array.from(new Set(all.flatMap((i) => i.tags))).slice(0, 16),
    [all]
  );

  const visible = all
    .filter((i) => (day ? i.day === day : true))
    .filter((i) => (tag ? i.tags.includes(tag) : true))
    .sort((a, b) => b.createdAt - a.createdAt);

  async function quickAdd() {
    const text = quick.trim();
    if (!text) return;
    const now = Date.now();
    const item: InspirationItem = {
      id: uid(),
      kind: "inspiration",
      createdAt: now,
      updatedAt: now,
      day: ymd(now),
      text,
      tags: extractTags(text),
      mediaType: "text",
      note: "",
    };
    const synced = await addItem(item);
    setQuick("");
    if (synced) toast("灵感已记录 ✅", "ok");
    else toast("已保存到本地（未同步）", "info");
  }

  return (
    <div>
      {/* quick capture */}
      <Card className="mb-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Lightbulb size={18} className="text-accent" /> 随手记
        </div>
        <textarea
          className={inputCls + " min-h-[64px] resize-none"}
          placeholder="此刻的想法… 用 #标签 分类，回车后点记录"
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
        />
        <div className="mt-2 flex justify-end">
          <Button onClick={quickAdd} disabled={!quick.trim()}>
            <Plus size={16} /> 记录
          </Button>
        </div>
      </Card>

      <DayFilter value={day} onChange={setDay} />

      {tags.length > 0 && (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          <button
            onClick={() => setTag(null)}
            className={
              "shrink-0 rounded-full px-3 py-1 text-xs font-medium " +
              (tag === null
                ? "bg-accent text-white"
                : "bg-surface-2 text-text-2")
            }
          >
            全部标签
          </button>
          {tags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(t === tag ? null : t)}
              className={
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium " +
                (t === tag
                  ? "bg-accent text-white"
                  : "bg-surface-2 text-text-2")
              }
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          icon={<Lightbulb size={26} />}
          title="还没有灵感"
          desc="把脑子里闪过的念头记下来，随时都能回看和整理。"
        />
      ) : (
        <div className="space-y-3">
          {visible.map((it) => (
            <Reveal key={it.id}>
              <InspirationCard
                item={it}
                onOpen={() => openDetail(it, "summarize")}
                onZoom={(src) => setLightbox(src)}
                onAi={(k) => openDetail(it, k)}
                onRemove={(id) => askDelete(id)}
              />
            </Reveal>
          ))}
        </div>
      )}

      <AddFab addItem={addItem} />

      {detail && (
        <InspirationDetail
          item={detail.item}
          kind={detail.kind}
          onClose={() => setDetail(null)}
          onZoom={(src) => setLightbox(src)}
          onRemove={(id) => askDelete(id)}
        />
      )}

      {lightbox && (
        <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
      )}

      {pendingDel && (
        <ConfirmDialog
          open
          title="删除灵感"
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

function InspirationCard({
  item,
  onOpen,
  onZoom,
  onAi,
  onRemove,
}: {
  item: InspirationItem;
  onOpen: () => void;
  onZoom: (src: string) => void;
  onAi: (kind: AiKind) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Card className="cursor-pointer transition active:scale-[0.99] hover:border-accent/40">
      <div onClick={onOpen}>
        <p className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed line-clamp-4">
          {item.text}
        </p>
        {item.media && (
          <img
            src={item.media}
            alt=""
            onClick={(e) => {
              e.stopPropagation();
              onZoom(item.media!);
            }}
            className="mt-2 max-h-48 w-full cursor-zoom-in rounded-xl object-cover"
          />
        )}
        {item.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-text-2">{fmtDateTime(item.createdAt)}</p>
      </div>

      <div
        className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onOpen}
          className="flex items-center gap-1 text-xs font-medium text-text-2 transition hover:text-accent"
        >
          查看详情 <ArrowRight size={14} />
        </button>
        <button
          onClick={() => onAi("summarize")}
          className="rounded-full px-2.5 py-1.5 text-xs font-medium text-text-2 transition hover:bg-surface-2"
        >
          AI 整理
        </button>
        <button
          onClick={() => onAi("knowledgeFrame")}
          className="rounded-full px-2.5 py-1.5 text-xs font-medium text-text-2 transition hover:bg-surface-2"
        >
          知识框架
        </button>
        <button
          onClick={() => onAi("resources")}
          className="rounded-full px-2.5 py-1.5 text-xs font-medium text-text-2 transition hover:bg-surface-2"
        >
          资源推荐
        </button>
        <button
          onClick={() => onRemove(item.id)}
          className="ml-auto rounded-full p-1.5 text-text-2 transition hover:bg-red-500/10 hover:text-red-500"
        >
          <Trash size={16} />
        </button>
      </div>
    </Card>
  );
}

function InspirationDetail({
  item,
  kind,
  onClose,
  onZoom,
  onRemove,
}: {
  item: InspirationItem;
  kind: AiKind;
  onClose: () => void;
  onZoom: (src: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Modal open onClose={onClose} title="灵感详情">
      <div className="space-y-4">
        <p className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed">
          {item.text}
        </p>

        {item.media && (
          <img
            src={item.media}
            alt=""
            onClick={() => onZoom(item.media!)}
            className="max-h-80 w-full cursor-zoom-in rounded-xl object-cover"
          />
        )}

        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent"
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        {item.note && (
          <div>
            <p className="mb-1 text-xs font-medium text-text-2">备注</p>
            <p className="whitespace-pre-wrap font-serif text-sm leading-relaxed">
              {item.note}
            </p>
          </div>
        )}

        <p className="text-xs text-text-2">
          创建：{fmtDateTime(item.createdAt)}
          {item.updatedAt !== item.createdAt &&
            ` · 更新：${fmtDateTime(item.updatedAt)}`}
        </p>

        {/* 三合一 AI 面板：打开即自动调用，可切换 总结 / 知识框架 / 资源推荐 */}
        <AiPanel source={item.text} initialKind={kind} />

        <div
          className="flex flex-wrap items-center gap-2 border-t border-border pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          <button
          onClick={() => onRemove(item.id)}
            className="ml-auto flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-500/10"
          >
            <Trash size={16} /> 删除
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AddFab({ addItem }: { addItem: (i: Item) => Promise<boolean> }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [img, setImg] = useState<string | undefined>();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const d = await compressImage(f);
      setImg(d);
    } catch {
      toast("图片处理失败", "err");
    }
  }

  async function save() {
    const t = text.trim();
    if (!t) return;
    const now = Date.now();
    const tags = Array.from(
      new Set([...extractTags(t), ...tagsRaw.split(/[\s,，#]+/).map((s) => s.trim()).filter(Boolean)])
    );
    const item: InspirationItem = {
      id: uid(),
      kind: "inspiration",
      createdAt: now,
      updatedAt: now,
      day: ymd(now),
      text: t,
      tags,
      mediaType: img ? "image" : "text",
      media: img,
      note: "",
    };
    const synced = await addItem(item);
    setOpen(false);
    setText("");
    setTagsRaw("");
    setImg(undefined);
    if (synced) toast("灵感已保存 ✅", "ok");
    else toast("已保存到本地（未同步）", "info");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 transition active:scale-95 max-[420px]:right-4"
        aria-label="新建灵感"
      >
        <Plus size={26} weight="bold" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="新灵感">
        <Field label="内容">
          <textarea
            className={inputCls + " min-h-[100px] resize-none"}
            placeholder="写下你的灵感…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
        <Field label="标签（逗号分隔，或从正文提取 #标签）" hint="正文里的 #话题 会自动提取">
          <input
            className={inputCls}
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="设计, 产品"
          />
        </Field>
        <Field label="配图（可选）">
          <label className="flex cursor-pointer items-center gap-2 rounded-[12px] border border-dashed border-border px-3 py-2.5 text-sm text-text-2">
            <ImageIcon size={18} /> {img ? "已选择图片，点击替换" : "选择图片"}
            <input type="file" accept="image/*" className="hidden" onChange={onFile} />
          </label>
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={save} disabled={!text.trim()}>
            保存
          </Button>
        </div>
      </Modal>
    </>
  );
}
