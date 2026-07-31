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

  const openSettings = () => show("settings");

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
      const hitL = ls.filter((x) => (x.title + x.content + (x.tags || []).join(" ")).toLowerCase().includes(q));
      const hitI = ins.filter((x) => (x.text + (x.tags || []).join(" ")).toLowerCase().includes(q));
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
    // 关闭层
    document.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => {
      document.getElementById("modal").hidden = true;
      document.getElementById("searchSheet").hidden = true;
    }));
    initSearch();
    show("learning");
  };

  return { init, show, openSettings };
})();

document.addEventListener("DOMContentLoaded", App.app.init);
