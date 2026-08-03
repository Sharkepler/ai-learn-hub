import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  X,
  Calculator,
  PencilSimple,
  Trash,
  Plus,
  Coin,
  Clock,
  Camera,
} from "@phosphor-icons/react";
import { Card, Button, Field, inputCls, ConfirmDialog } from "./ui";
import AssetThumb from "./AssetThumb";
import { useToast } from "./Toast";
import {
  type Asset,
  loadAssetsRaw,
  saveAssetsRaw,
  subscribeAssets,
  daysTogether,
  dailyCost,
  fmtMoney,
} from "../lib/assets";
import { ASSET_CATALOG, findCategory, type CatalogItem } from "../lib/productCatalog";
import { uid, ymd, fmtDate } from "../lib/util";
import { fileToResizedDataURL } from "../lib/image";
import { pushAssets } from "../lib/sync";

interface FormState {
  id?: string;
  categoryId?: string;
  itemId?: string;
  name: string;
  price: string;
  date: string;
  note: string;
  photo?: string;
}

export default function AssetCalculator({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [raw, setRaw] = useState<Asset[]>([]); // 含软删除
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>({
    name: "",
    price: "",
    date: ymd(),
    note: "",
  });
  const [pendingDel, setPendingDel] = useState<Asset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const list = raw.filter((a) => !a.deleted);

  useEffect(() => {
    let alive = true;
    const reload = () =>
      loadAssetsRaw()
        .then((a) => alive && setRaw(a))
        .finally(() => alive && setLoading(false));
    reload();
    // 订阅跨设备同步：其他设备改动后本页自动刷新
    const unsub = subscribeAssets(reload);
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  function resetForm() {
    setForm({ name: "", price: "", date: ymd(), note: "" });
  }

  function selectCategory(catId: string | undefined) {
    // 切换分类时清空已选物品（除非该物品属于新分类）
    setForm((f) => ({
      ...f,
      categoryId: catId,
      itemId: catId ? undefined : f.itemId,
      name: catId ? "" : f.name,
    }));
  }

  function selectItem(cat: string, item: CatalogItem) {
    setForm((f) => ({
      ...f,
      categoryId: cat,
      itemId: item.id,
      name: item.name,
    }));
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataURL(file, 240, 0.82, 130000);
      setForm((f) => ({ ...f, photo: dataUrl }));
    } catch {
      toast("图片处理失败，请换一张试试", "err");
    }
  }

  function startEdit(a: Asset) {
    setForm({
      id: a.id,
      categoryId: a.categoryId,
      itemId: a.itemId,
      name: a.name,
      price: String(a.price),
      date: ymd(a.boughtAt),
      note: a.note || "",
      photo: a.photo,
    });
  }

  async function persist(nextRaw: Asset[]) {
    setRaw(nextRaw);
    await saveAssetsRaw(nextRaw);
    pushAssets().catch(() => {}); // 后台推云端，失败不阻塞本地
  }

  async function save() {
    const name = form.name.trim();
    const price = parseFloat(form.price);
    if (!name) {
      toast("请填写物品名称（可先选分类）", "info");
      return;
    }
    if (isNaN(price) || price < 0) {
      toast("请填写有效的价格", "info");
      return;
    }
    const boughtAt = new Date(form.date + "T00:00:00").getTime();
    const now = Date.now();
    const photo = form.photo;

    let next: Asset[];
    if (form.id) {
      next = raw.map((a) =>
        a.id === form.id
          ? {
              ...a,
              categoryId: form.categoryId,
              itemId: form.itemId,
              name,
              price,
              boughtAt,
              note: form.note.trim() || undefined,
              photo,
              updatedAt: now,
            }
          : a,
      );
      toast("已更新", "ok");
    } else {
      const created: Asset = {
        id: uid(),
        categoryId: form.categoryId,
        itemId: form.itemId,
        name,
        price,
        boughtAt,
        note: form.note.trim() || undefined,
        photo,
        updatedAt: now,
      };
      next = [created, ...raw];
      toast("已添加", "ok");
    }
    await persist(next);
    resetForm();
  }

  async function confirmDel() {
    if (!pendingDel) return;
    const next = raw.map((a) =>
      a.id === pendingDel.id ? { ...a, deleted: true, updatedAt: Date.now() } : a,
    );
    await persist(next);
    setPendingDel(null);
    toast("已删除", "ok");
  }

  const totalValue = list.reduce((s, a) => s + a.price, 0);
  const totalDaily = list.reduce(
    (s, a) => s + dailyCost(a.price, daysTogether(a.boughtAt)),
    0,
  );

  const activeCat = form.categoryId ? findCategory(form.categoryId) : undefined;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-2xl flex-col bg-bg sm:max-h-[90vh] sm:rounded-[20px] sm:shadow-2xl"
      >
        {/* header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
          <Calculator size={20} className="text-accent" />
          <h3 className="text-lg font-bold tracking-tight">资产成本计算器</h3>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="ml-auto grid h-9 w-9 place-items-center rounded-full text-text-2 transition hover:bg-surface-2"
          >
            <X size={20} />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {/* summary */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3">
              <div className="flex items-center gap-1.5 text-xs text-text-2">
                <Coin size={14} className="text-accent" /> 资产数
              </div>
              <p className="mt-1 text-xl font-bold">{list.length}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-1.5 text-xs text-text-2">
                <Coin size={14} className="text-accent" /> 总价值
              </div>
              <p className="mt-1 text-xl font-bold">{fmtMoney(totalValue)}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-1.5 text-xs text-text-2">
                <Clock size={14} className="text-accent" /> 日均合计
              </div>
              <p className="mt-1 text-xl font-bold">{fmtMoney(totalDaily)}</p>
            </Card>
          </div>

          {/* form */}
          <Card>
            <p className="mb-3 font-semibold tracking-tight">
              {form.id ? "编辑资产" : "添加资产"}
            </p>

            {/* 分类选择 */}
            <p className="mb-1.5 text-xs font-medium text-text-2">选择分类</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {ASSET_CATALOG.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectCategory(c.id)}
                  className={
                    "rounded-full px-3 py-1.5 text-sm font-medium transition " +
                    (form.categoryId === c.id
                      ? "bg-accent text-white"
                      : "bg-surface-2 text-text-2 hover:text-accent")
                  }
                >
                  {c.emoji} {c.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => selectCategory(undefined)}
                className={
                  "rounded-full px-3 py-1.5 text-sm font-medium transition " +
                  (form.categoryId === undefined
                    ? "bg-accent text-white"
                    : "bg-surface-2 text-text-2 hover:text-accent")
                }
              >
                自定义
              </button>
            </div>

            {/* 物品选择（选定分类后展开） */}
            {activeCat && (
              <div className="mb-3">
                <p className="mb-1.5 text-xs font-medium text-text-2">选择具体物品</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {activeCat.items.map((it) => {
                    const selected = form.itemId === it.id;
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => selectItem(activeCat.id, it)}
                        className={
                          "flex flex-col items-center gap-1 rounded-xl border p-2 transition " +
                          (selected
                            ? "border-accent bg-accent-soft"
                            : "border-border bg-surface hover:border-accent/50")
                        }
                      >
                        <AssetThumb
                          asset={{
                            categoryId: activeCat.id,
                            itemId: it.id,
                            name: it.name,
                          }}
                          size={40}
                        />
                        <span className="text-xs font-medium">{it.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 名称 + 价格 + 日期 + 备注 */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="物品名称">
                <input
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={activeCat ? "已自动填入，可修改" : "例如：跑鞋 / 机械键盘"}
                />
              </Field>
              <Field label="购买价格（元）">
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="0.00"
                />
              </Field>
              <Field label="购买日期">
                <input
                  className={inputCls}
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </Field>
              <Field label="备注（可选）">
                <input
                  className={inputCls}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="一句话记录"
                />
              </Field>
            </div>

            {/* 实物照片 */}
            <div className="mt-3 flex items-center gap-3">
              {form.photo ? (
                <AssetThumb
                  asset={{
                    categoryId: form.categoryId,
                    itemId: form.itemId,
                    name: form.name,
                    photo: form.photo,
                  }}
                  size={48}
                />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-surface-2 text-xl">
                  📷
                </div>
              )}
              <div className="flex flex-col gap-1">
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => fileRef.current?.click()}>
                    <Camera size={16} /> {form.photo ? "更换照片" : "上传实物照片"}
                  </Button>
                  {form.photo && (
                    <Button
                      variant="ghost"
                      onClick={() => setForm((f) => ({ ...f, photo: undefined }))}
                    >
                      移除
                    </Button>
                  )}
                </div>
                <p className="text-xs text-text-2">可选。会自动压缩后随数据同步。</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPhoto}
              />
            </div>

            <div className="mt-3 flex gap-2">
              <Button onClick={save}>
                <Plus size={16} /> {form.id ? "保存修改" : "添加"}
              </Button>
              {form.id && (
                <Button variant="ghost" onClick={resetForm}>
                  取消编辑
                </Button>
              )}
            </div>
          </Card>

          {/* list */}
          {loading ? (
            <p className="py-8 text-center text-text-2">加载中…</p>
          ) : list.length === 0 ? (
            <p className="py-10 text-center text-sm text-text-2">
              还没有资产。选择分类或直接填写，看看它陪了你多少天、日均花了多少钱。
            </p>
          ) : (
            <div className="space-y-3">
              {list.map((a) => {
                const days = daysTogether(a.boughtAt);
                const cost = dailyCost(a.price, days);
                return (
                  <Card key={a.id} className="p-3.5">
                    <div className="flex items-start gap-3">
                      <AssetThumb asset={a} size={52} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{a.name}</p>
                        <p className="mt-0.5 text-sm text-text-2">
                          购买于 {fmtDate(ymd(a.boughtAt))} · {fmtMoney(a.price)}
                        </p>
                        {a.note && <p className="mt-1 text-xs text-text-2">{a.note}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-accent">{fmtMoney(cost)}</p>
                        <p className="text-xs text-text-2">日均</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-border pt-2.5">
                      <span className="text-sm text-text-2">
                        已陪伴你 <b className="text-text">{days}</b> 天
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => startEdit(a)}
                          className="grid h-8 w-8 place-items-center rounded-md text-text-2 transition hover:bg-surface-2 hover:text-accent"
                          aria-label="编辑"
                          title="编辑"
                        >
                          <PencilSimple size={16} />
                        </button>
                        <button
                          onClick={() => setPendingDel(a)}
                          className="grid h-8 w-8 place-items-center rounded-md text-text-2 transition hover:bg-red-500/10 hover:text-red-500"
                          aria-label="删除"
                          title="删除"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      <ConfirmDialog
        open={!!pendingDel}
        title="删除资产"
        message={`确定删除「${pendingDel?.name || ""}」吗？删除会同步到所有设备，不可撤销。`}
        confirmText="删除"
        danger
        onConfirm={confirmDel}
        onCancel={() => setPendingDel(null)}
      />
    </div>
  );
}
