/* ===== 主控制器 ===== */
App.app = (function () {
  const { el, toast, openModal, closeModal, esc } = App.util;
  let current = "learning";

  const modules = {
    learning: () => App.modules.learning.render(view()),
    inspiration: () => App.modules.inspiration.render(view()),
    dashboard: () => App.modules.dashboard.render(view()),
    settings: () => App.modules.settings.render(view()),
  };

  const view = () => document.getElementById("view");

  const show = (tab) => {
    current = tab;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
    if (modules[tab]) modules[tab]();
  };

  // 手动触发云同步
  const doSync = async () => {
    const btn = document.getElementById("syncBtn");
    if (btn) btn.disabled = true;
    const r = await App.sync.syncNow({ refresh: true });
    if (btn) btn.disabled = false;
    if (r && r.skipped) { if (r.reason === "not-configured") { toast("未配置云同步，去设置开启"); App.app.openSettings(); } }
    else if (r && r.ok) toast("已同步 ✅");
    else if (r && !r.ok) toast("同步失败：" + (r.error || "").slice(0, 40));
    App.app.show(current);
  };

  const openSettings = () => show("settings");

  // 立即锁定：应用已初始化时，仅覆盖锁屏，解锁后无需重新启动
  const lockNow = () => presentLock(() => {});

  // FAB：按当前页决定动作
  const fabAction = () => {
    if (current === "learning") App.modules.learning.openForm(null, view());
    else if (current === "inspiration") {
      const ta = view().querySelector("textarea");
      if (ta) { ta.focus(); ta.scrollIntoView({ behavior: "smooth" }); }
    } else show("learning");
  };

  // 全局搜索
  const initSearch = () => {
    const sheet = document.getElementById("searchSheet");
    const input = document.getElementById("searchInput");
    const results = document.getElementById("searchResults");
    document.getElementById("btnGlobalSearch").onclick = () => { sheet.hidden = false; input.value = ""; results.innerHTML = ""; setTimeout(() => input.focus(), 50); };
    input.oninput = async () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { results.innerHTML = ""; return; }
      const [ls, ins] = await Promise.all([App.db.getAll("learnings"), App.db.getAll("inspirations")]);
      const hitL = ls.filter((x) => !x.deleted && (x.title + x.content + (x.tags || []).join(" ")).toLowerCase().includes(q));
      const hitI = ins.filter((x) => !x.deleted && (x.text + (x.tags || []).join(" ")).toLowerCase().includes(q));
      results.innerHTML = "";
      if (!hitL.length && !hitI.length) { results.appendChild(el("div", { class: "empty" }, "无匹配结果")); return; }
      results.appendChild(el("div", { class: "muted tiny", style: "margin-bottom:8px" }, `学习 ${hitL.length} 条 · 灵感 ${hitI.length} 条`));
      hitL.forEach((x) => results.appendChild(searchRow("📚 " + x.title, (x.content || "").slice(0, 60), "学习 · " + x.topic, () => { sheet.hidden = true; show("learning"); })));
      hitI.forEach((x) => results.appendChild(searchRow("💡 " + (x.text || "[图片]").slice(0, 40), "", "灵感" + (x.tags ? " · #" + x.tags.join(" #") : ""), () => { sheet.hidden = true; show("inspiration"); })));
    };
  };

  const searchRow = (title, sub, meta, onClick) => {
    const r = el("div", { class: "item", onclick: onClick }, [
      el("div", { class: "title" }, title),
      sub ? el("div", { class: "body" }, sub) : null,
      el("div", { class: "meta" }, [el("span", { class: "muted tiny" }, meta)]),
    ]);
    return r;
  };

  const init = async () => {
    await App.db.open();
    // 导航
    document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => show(t.dataset.tab)));
    document.getElementById("fab").onclick = fabAction;
    document.getElementById("btnSettings").onclick = openSettings;
    document.getElementById("syncBtn").onclick = doSync;
    // 关闭层
    document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => {
      document.getElementById("modal").hidden = true;
      document.getElementById("searchSheet").hidden = true;
    }));
    initSearch();
    show("learning");
    // 云同步：进入即拉取一次（若已配置）
    App.sync.init();
  };

  return { init, show, openSettings, lockNow, get current() { return current; } };
})();

/* ===== 访问密码锁 ===== */
App.lock = (function () {
  const { sha256 } = App.util;
  const SALT = "ai-learn-hub::access::v1";
  const hashOf = (pin) => sha256(pin + SALT);
  const getRec = () => App.db.getMeta("lock", null);
  const isSet = async () => { const r = await getRec(); return !!(r && r.hash); };
  const verify = async (pin) => {
    const r = await getRec();
    if (!r || !r.hash) return true;
    return (await hashOf(pin)) === r.hash;
  };
  const set = async (pin) => { await App.db.setMeta("lock", { hash: await hashOf(pin), setAt: Date.now() }); };
  const remove = async () => { await App.db.setMeta("lock", null); };
  return { isSet, verify, set, remove };
})();

const startApp = async () => { await App.app.init(); };

const presentLock = (onUnlock) => {
  const ls = document.getElementById("lockScreen");
  const pin = document.getElementById("lockPin");
  const err = document.getElementById("lockErr");
  const submit = document.getElementById("lockSubmit");
  ls.hidden = false; err.textContent = ""; pin.value = "";
  const tryUnlock = async () => {
    const v = pin.value;
    if (!v) { err.textContent = "请输入密码"; return; }
    if (await App.lock.verify(v)) {
      pin.value = ""; ls.hidden = true; onUnlock();
    } else { err.textContent = "密码错误，请重试"; pin.value = ""; pin.focus(); }
  };
  submit.onclick = tryUnlock;
  pin.onkeydown = (e) => { if (e.key === "Enter") tryUnlock(); };
  setTimeout(() => pin.focus(), 60);
};

document.addEventListener("DOMContentLoaded", async () => {
  try { await App.db.open(); } catch (e) {}
  if (await App.lock.isSet()) {
    presentLock(startApp); // 已设密码：先锁屏，验证通过再启动
  } else {
    startApp(); // 未设密码：直接启动
  }
});
