import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Lightbulb,
  Trash,
  Image as ImageIcon,
  ArrowRight,
  Download,
  PencilSimple,
  Check,
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
  MarkdownEditor,
  type AiKind,
} from "../components/ui";
import DayFilter from "../components/DayFilter";
import type { InspirationItem, Item } from "../lib/types";
import { uid, ymd, extractTags, fmtDateTime, compressImage } from "../lib/util";
import {
  inspirationToMarkdown,
  inspirationsToMarkdown,
  downloadText,
  inspirationFileName,
  inspirationsFileName,
  renderMarkdown,
} from "../lib/markdown";
import { pullDayInto, getCfg } from "../lib/sync";

const PAGE = 12;

export default function Inspiration({
  focusId,
  onConsumeFocus,
}: {
  focusId?: string | null;
  onConsumeFocus?: () => void;
}) {
  const { items, addItem, updateItem, removeItem, reload } = useStore();
  const toast = useToast();
  const [day, setDay] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [quick, setQuick] = useState("");
  const [quickTags, setQuickTags] = useState("");
  const [quickImg, setQuickImg] = useState<string | undefined>();
  const [limit, setLimit] = useState(PAGE);

  // 详情 / 放大图（AI 面板内嵌于详情；autoRun 控制打开是否自动调用 AI）
  const [detail, setDetail] = useState<{ item: InspirationItem; kind: AiKind; autoRun: boolean } | null>(null);
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

  function openDetail(item: InspirationItem, kind: AiKind = "summarize", autoRun = false) {
    setDetail({ item, kind, autoRun });
  }

  // 搜索结果跳转：定位到指定记录并打开详情
  useEffect(() => {
    if (focusId) {
      const it = all.find((i) => i.id === focusId);
      if (it) {
        openDetail(it, "summarize", false);
        onConsumeFocus?.();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  const all = items.filter((i) => i.kind === "inspiration" && !i.deleted) as InspirationItem[];
  const tags = useMemo(
    () => Array.from(new Set(all.flatMap((i) => i.tags))).slice(0, 16),
    [all]
  );

  const visible = all
    .filter((i) => (day ? i.day === day : true))
    .filter((i) => (tag ? i.tags.includes(tag) : true))
    .sort((a, b) => b.createdAt - a.createdAt);

  // 分页：全部/筛选结果过多时，点「加载更多」增量展示
  useEffect(() => setLimit(PAGE), [day, tag]);
  const shown = visible.slice(0, limit);
  const hasMore = visible.length > limit;

  async function quickAdd() {
    const text = quick.trim();
    if (!text) return;
    const now = Date.now();
    const tags = Array.from(
      new Set([...extractTags(text), ...quickTags.split(/[\s,，#]+/).map((s) => s.trim()).filter(Boolean)])
    );
    const item: InspirationItem = {
      id: uid(),
      kind: "inspiration",
      createdAt: now,
      updatedAt: now,
      day: ymd(now),
      text,
      tags,
      mediaType: quickImg ? "image" : "text",
      media: quickImg,
      note: "",
    };
    const synced = await addItem(item);
    setQuick("");
    setQuickTags("");
    setQuickImg(undefined);
    if (synced) toast("灵感已记录 ✅", "ok");
    else toast("已保存到本地（未同步）", "info");
  }

  async function onQuickImg(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setQuickImg(await compressImage(f));
    } catch {
      toast("图片处理失败", "err");
    }
  }

  return (
    <div>
      {/* quick capture */}
      <Card className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Lightbulb size={18} className="text-accent" /> 随手记
          </div>
          {all.length > 0 && (
            <button
              onClick={() => {
                downloadText(
                  inspirationsFileName(),
                  inspirationsToMarkdown(all)
                );
                toast(`已导出全部灵感（${all.length} 条）`, "ok");
              }}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-text-2 transition hover:bg-surface-2"
            >
              <Download size={15} /> 导出全部 MD
            </button>
          )}
        </div>
        <MarkdownEditor
          value={quick}
          onChange={setQuick}
          placeholder="此刻的想法… 用 #标签 分类，支持 Markdown 标注重点"
          minHeight={64}
        />
        <Field label="标签（逗号分隔）" hint="正文里的 #话题 会自动提取">
          <input
            className={inputCls}
            value={quickTags}
            onChange={(e) => setQuickTags(e.target.value)}
            placeholder="设计, 产品"
          />
        </Field>
        <Field label="配图（可选）">
          <label className="flex cursor-pointer items-center gap-2 rounded-[12px] border border-dashed border-border px-3 py-2.5 text-sm text-text-2">
            <ImageIcon size={18} /> {quickImg ? "已选择图片，点击替换" : "选择图片"}
            <input type="file" accept="image/*" className="hidden" onChange={onQuickImg} />
          </label>
        </Field>
        {quickImg && (
          <img src={quickImg} alt="" className="mt-2 max-h-40 w-full rounded-xl object-cover" />
        )}
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
        <>
          <div className="space-y-3">
            {shown.map((it) => (
              <Reveal key={it.id}>
                <InspirationCard
                  item={it}
                  onOpen={() => openDetail(it, "summarize", false)}
                  onZoom={(src) => setLightbox(src)}
                  onAi={(k) => openDetail(it, k, true)}
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

      <AddFab addItem={addItem} />

      {detail && (
        <InspirationDetail
          item={detail.item}
          kind={detail.kind}
          autoRun={detail.autoRun}
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
        <div
          className="md leading-relaxed max-h-40 overflow-hidden text-[15px]"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(item.text) }}
        />
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
  autoRun,
  onClose,
  onZoom,
  onRemove,
}: {
  item: InspirationItem;
  kind: AiKind;
  autoRun?: boolean;
  onClose: () => void;
  onZoom: (src: string) => void;
  onRemove: (id: string) => void;
}) {
  const toast = useToast();
  const { updateItem } = useStore();
  const [current, setCurrent] = useState(item);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);

  function startEdit() {
    setDraft(current.text);
    setEditing(true);
  }
  async function saveEdit() {
    const t = draft.trim();
    if (!t) return;
    const updated: InspirationItem = {
      ...current,
      text: t,
      tags: extractTags(t),
      updatedAt: Date.now(),
    };
    const synced = await updateItem(updated);
    setCurrent(updated);
    setEditing(false);
    toast(synced ? "已更新 ✅" : "已保存（未同步）", synced ? "ok" : "info");
  }

  return (
    <Modal open onClose={onClose} title="灵感详情">
      <div className="space-y-4">
        {editing ? (
          <MarkdownEditor
            value={draft}
            onChange={setDraft}
            placeholder="支持 Markdown：**重点** # 标题 > 引用 - 列表 `代码`"
            minHeight={128}
          />
        ) : (
          <div
            className="md font-serif text-[15px] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(current.text) }}
          />
        )}

        {current.media && (
          <img
            src={current.media}
            alt=""
            onClick={() => onZoom(current.media!)}
            className="max-h-80 w-full cursor-zoom-in rounded-xl object-cover"
          />
        )}

        {current.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {current.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent"
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        {current.note && (
          <div>
            <p className="mb-1 text-xs font-medium text-text-2">备注</p>
            <p className="whitespace-pre-wrap font-serif text-sm leading-relaxed">
              {current.note}
            </p>
          </div>
        )}

        <p className="text-xs text-text-2">
          创建：{fmtDateTime(current.createdAt)}
          {current.updatedAt !== current.createdAt &&
            ` · 更新：${fmtDateTime(current.updatedAt)}`}
        </p>

        {/* 三合一 AI 面板：autoRun=false 时打开不自动调用，点击按钮才生成 */}
        <AiPanel source={current.text} initialKind={kind} autoRun={autoRun} />

        <div
          className="flex flex-wrap items-center gap-2 border-t border-border pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          {editing ? (
            <>
              <button
                onClick={() => {
                  setEditing(false);
                  setDraft(current.text);
                }}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-text-2 transition hover:bg-surface-2"
              >
                取消
              </button>
              <button
                onClick={saveEdit}
                disabled={!draft.trim()}
                className="ml-auto flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-strong disabled:opacity-50"
              >
                <Check size={16} /> 保存
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startEdit}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-text-2 transition hover:bg-surface-2"
              >
                <PencilSimple size={16} /> 编辑
              </button>
              <button
                onClick={() => {
                  downloadText(
                    inspirationFileName(current),
                    inspirationToMarkdown(current)
                  );
                  toast("已导出为 Markdown", "ok");
                }}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-text-2 transition hover:bg-surface-2"
              >
                <Download size={16} /> 另存为 Markdown
              </button>
              <button
                onClick={() => onRemove(current.id)}
                className="ml-auto flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-500/10"
              >
                <Trash size={16} /> 删除
              </button>
            </>
          )}
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
          <MarkdownEditor
            value={text}
            onChange={setText}
            placeholder="写下你的灵感… 支持 Markdown：**重点** # 标题 > 引用 - 列表"
            minHeight={100}
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
