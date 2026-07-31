/* ===== 通用工具函数 ===== */
window.App = window.App || {};
App.util = (function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k === "text") node.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    }
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  };

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let toastTimer;
  const toast = (msg, ms = 2200) => {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), ms);
  };

  // 打开通用模态框，content 为 DOM 节点或字符串
  const openModal = (content) => {
    const m = $("#modal"), panel = $("#modalPanel");
    panel.innerHTML = "";
    if (typeof content === "string") panel.innerHTML = content;
    else panel.appendChild(content);
    m.hidden = false;
  };
  const closeModal = () => ($("#modal").hidden = true);

  // 日期工具
  const today = () => new Date().toISOString().slice(0, 10);
  const fmtDate = (d) => {
    const dt = new Date(d);
    return `${dt.getMonth() + 1}月${dt.getDate()}日`;
  };
  const fmtDateTime = (ts) => {
    const dt = new Date(ts);
    const p = (n) => String(n).padStart(2, "0");
    return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
  };
  const weekStart = (d = new Date()) => {
    const dt = new Date(d); const day = (dt.getDay() + 6) % 7; // 周一为 0
    dt.setDate(dt.getDate() - day); dt.setHours(0, 0, 0, 0);
    return dt;
  };
  const weekKey = (d = new Date()) => weekStart(d).toISOString().slice(0, 10);
  const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const fmtDur = (min) => {
    min = Math.round(min || 0);
    if (min < 60) return `${min} 分钟`;
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h} 小时 ${m} 分` : `${h} 小时`;
  };

  // 从文本中提取标签（#xxx）和关键词
  const extractTags = (text) => {
    const tags = new Set();
    (text || "").replace(/#([^\s#]+)/g, (_, t) => { tags.add(t); return ""; });
    return Array.from(tags);
  };

  return { $, $$, el, esc, toast, openModal, closeModal, today, fmtDate, fmtDateTime,
    weekStart, weekKey, monthKey, addDays, uid, fmtDur, extractTags };
})();
