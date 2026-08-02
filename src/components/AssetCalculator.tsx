import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  X,
  Calculator,
  PencilSimple,
  Trash,
  Plus,
  Coin,
  Clock,
} from "@phosphor-icons/react";
import { Card, Button, Field, inputCls, ConfirmDialog } from "./ui";
import { useToast } from "./Toast";
import {
  type Asset,
  loadAssets,
  saveAssets,
  daysTogether,
  dailyCost,
  fmtMoney,
} from "../lib/assets";
import { uid, ymd, fmtDate } from "../lib/util";
import { pushAssets } from "../lib/sync";

interface FormState {
  id?: string;
  name: string;
  price: string;
  date: string;
  note: string;
}

export default function AssetCalculator({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [list, setList] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>({
    name: "",
    price: "",
    date: ymd(),
    note: "",
  });
  const [pendingDel, setPendingDel] = useState<Asset | null>(null);

  useEffect(() => {
    loadAssets()
      .then((a) => setList(a))
      .finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setForm({ name: "", price: "", date: ymd(), note: "" });
  }

  function startEdit(a: Asset) {
    setForm({
      id: a.id,
      name: a.name,
      price: String(a.price),
      date: ymd(a.boughtAt),
      note: a.note || "",
    });
  }

  async function persist(next: Asset[]) {
    setList(next);
    await saveAssets(next);
    pushAssets().catch(() => {});
  }

  async function save() {
    const name = form.name.trim();
    const price = parseFloat(form.price);
    if (!name) {
      toast("请填写物品名称", "info");
      return;
    }
    if (isNaN(price) || price < 0) {
      toast("请填写有效的价格", "info");
      return;
    }
    const boughtAt = new Date(form.date + "T00:00:00").getTime();
    const note = form.note.trim() || undefined;

    let next: Asset[];
    if (form.id) {
      next = list.map((a) =>
        a.id === form.id ? { ...a, name, price, boughtAt, note } : a
      );
      toast("已更新", "ok");
    } else {
      next = [{ id: uid(), name, price, boughtAt, note }, ...list];
      toast("已添加", "ok");
    }
    await persist(next);
    resetForm();
  }

  async function confirmDel() {
    if (!pendingDel) return;
    await persist(list.filter((a) => a.id !== pendingDel.id));
    setPendingDel(null);
    toast("已删除", "ok");
  }

  const totalValue = list.reduce((s, a) => s + a.price, 0);
  const totalDaily = list.reduce(
    (s, a) => s + dailyCost(a.price, daysTogether(a.boughtAt)),
    0
  );

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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="物品名称">
                <input
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例如：跑鞋 / 机械键盘"
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
              还没有资产。添加第一件物品，看看它陪了你多少天、日均花了多少钱。
            </p>
          ) : (
            <div className="space-y-3">
              {list.map((a) => {
                const days = daysTogether(a.boughtAt);
                const cost = dailyCost(a.price, days);
                return (
                  <Card key={a.id} className="p-3.5">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{a.name}</p>
                        <p className="mt-0.5 text-sm text-text-2">
                          购买于 {fmtDate(ymd(a.boughtAt))} · {fmtMoney(a.price)}
                        </p>
                        {a.note && (
                          <p className="mt-1 text-xs text-text-2">{a.note}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-accent">
                          {fmtMoney(cost)}
                        </p>
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
        message={`确定删除「${pendingDel?.name || ""}」吗？此操作不可撤销。`}
        confirmText="删除"
        danger
        onConfirm={confirmDel}
        onCancel={() => setPendingDel(null)}
      />
    </div>
  );
}
