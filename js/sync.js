/* ===== 云同步（基于 GitHub Contents API，按天分文件） =====
 * 数据按「记录创建日」分文件存于私有仓库（默认 Sharkepler/ai-learn-hub-data）：
 *   data/YYYY-MM-DD.json  —— 当天创建的学习/灵感记录
 * 优点：单文件小、不会无限膨胀；可按天搜索与拉取。
 * 合并策略：按记录 id + updatedAt 做 last-write-wins；删除以软删除(tombstone)同步。
 * 冲突处理：Contents API 用乐观锁 sha，遇 409（并发修改）自动 拉取->合并->重推，最多重试 5 次。
 * 同步凭证：直接使用 GitHub 登录后的 Token（App.auth）。
 */
App.sync = (function () {
  const API = "https://api.github.com";

  const state = {
    enabled: false,
    repo: "Sharkepler/ai-learn-hub-data",
    branch: "main",
    auto: true,
  };

  let _busy = false;
  const _dayTimers = {};   // 按天防抖的自动推送定时器

  const reloadCfg = async () => {
    state.enabled = !!(await App.db.getSetting("syncEnabled", false));
    state.repo = (await App.db.getSetting("syncRepo", "Sharkepler/ai-learn-hub-data")) || "Sharkepler/ai-learn-hub-data";
    state.branch = (await App.db.getSetting("syncBranch", "main")) || "main";
    state.auto = await App.db.getSetting("syncAuto", true);
    return state;
  };

  const saveCfg = async (patch) => {
    if ("enabled" in patch) await App.db.setSetting("syncEnabled", !!patch.enabled);
    if ("repo" in patch) await App.db.setSetting("syncRepo", patch.repo || "Sharkepler/ai-learn-hub-data");
    if ("branch" in patch) await App.db.setSetting("syncBranch", patch.branch || "main");
    if ("auto" in patch) await App.db.setSetting("syncAuto", !!patch.auto);
    await reloadCfg();
  };

  const token = async () => (await App.auth.getToken()) || "";

  // 日期键（本地时区）
  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (ts) => { const d = new Date(ts || Date.now()); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

  // ---- 合并（last-write-wins） ----
  const mergeRecords = (local, remote) => {
    const map = new Map();
    for (const r of (local || [])) if (r && r.id) map.set(r.id, r);
    for (const r of (remote || [])) {
      if (!r || !r.id) continue;
      const cur = map.get(r.id);
      if (!cur) { map.set(r.id, r); continue; }
      const cu = cur.updatedAt || cur.createdAt || 0;
      const ru = r.updatedAt || r.createdAt || 0;
      if (ru >= cu) map.set(r.id, r);
    }
    return Array.from(map.values());
  };

  // ---- 图片 Blob <-> dataURL ----
  const blobToDataURL = (blob) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
  const dataURLToBlob = (dataUrl) => new Promise((res) => {
    const [head, body] = dataUrl.split(",");
    const mime = (head.match(/:(.*?);/) || [, "image/png"])[1];
    const bin = atob(body);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    res(new Blob([arr], { type: mime }));
  });

  const serialize = async (learnings, inspirations, day) => {
    const ins = await Promise.all((inspirations || []).map(async (x) => {
      const y = { ...x };
      if (x.images && x.images.length) {
        y.images = await Promise.all(x.images.map(async (im) => ({
          name: im.name, type: im.type,
          data: im.blob ? await blobToDataURL(im.blob) : im.data,
        })));
      }
      return y;
    }));
    return { _app: "ai-learn-hub", _ver: 2, _day: day, updatedAt: Date.now(), learnings: learnings || [], inspirations: ins };
  };

  const deserialize = async (data) => {
    if (data && data.inspirations) {
      data.inspirations = await Promise.all(data.inspirations.map(async (x) => {
        if (x.images && x.images.length) {
          x.images = await Promise.all(x.images.map(async (im) => ({
            name: im.name, type: im.type,
            blob: im.data ? await dataURLToBlob(im.data) : im.blob,
          })));
        }
        return x;
      }));
    }
    return data;
  };

  const b64encode = (str) => btoa(new TextEncoder().encode(str).reduce((s, b) => s + String.fromCharCode(b), ""));
  const b64decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));

  const headers = async () => ({
    Authorization: "Bearer " + (await token()),
    Accept: "application/vnd.github+json",
    "User-Agent": "ai-learn-hub",
  });

  // 拉取某天文件：返回 {data, sha} 或 null（不存在）
  const pullDay = async (day) => {
    const path = `data/${day}.json`;
    const res = await fetch(`${API}/repos/${state.repo}/contents/${path}?ref=${state.branch}`, { headers: await headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`拉取 ${day} 失败 HTTP ${res.status}`);
    const j = await res.json();
    const data = await deserialize(JSON.parse(b64decode(j.content)));
    return { data, sha: j.sha };
  };

  // 推某天文件（带乐观锁 sha）
  const putDay = async (day, payload, sha) => {
    const path = `data/${day}.json`;
    const body = { message: `sync ${day} ${new Date().toISOString()}`, content: b64encode(JSON.stringify(payload)), branch: state.branch };
    if (sha) body.sha = sha;
    const res = await fetch(`${API}/repos/${state.repo}/contents/${path}?ref=${state.branch}`, {
      method: "PUT", headers: Object.assign({ "Content-Type": "application/json" }, await headers()), body: JSON.stringify(body),
    });
    if (res.status === 200 || res.status === 201) { const j = await res.json(); return { ok: true, sha: (j.content && j.content.sha) || sha }; }
    if (res.status === 409) return { conflict: true };
    const txt = await res.text().catch(() => "");
    return { ok: false, error: `推送 ${day} 失败 HTTP ${res.status} ${txt.slice(0, 60)}` };
  };

  // 列出远程已有的天数
  const listRemoteDays = async () => {
    const res = await fetch(`${API}/repos/${state.repo}/contents/data?ref=${state.branch}`, { headers: await headers() });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`列目录失败 HTTP ${res.status}`);
    const arr = await res.json();
    const re = /^\d{4}-\d{2}-\d{2}\.json$/;
    return (Array.isArray(arr) ? arr : []).map((f) => f.name).filter((n) => re.test(n)).map((n) => n.replace(/\.json$/, ""));
  };

  const localRecordsForDay = async (day) => {
    const [ls, ins] = await Promise.all([App.db.getAll("learnings"), App.db.getAll("inspirations")]);
    return {
      learnings: ls.filter((x) => x && x.id && dayKey(x.createdAt) === day),
      inspirations: ins.filter((x) => x && x.id && dayKey(x.createdAt) === day),
    };
  };

  const allLocalDays = async () => {
    const [ls, ins] = await Promise.all([App.db.getAll("learnings"), App.db.getAll("inspirations")]);
    const set = new Set();
    ls.forEach((x) => x && x.createdAt && set.add(dayKey(x.createdAt)));
    ins.forEach((x) => x && x.createdAt && set.add(dayKey(x.createdAt)));
    return Array.from(set);
  };

  const applyLocal = async (learnings, inspirations) => {
    await App.db.bulkPut("learnings", learnings);
    await App.db.bulkPut("inspirations", inspirations);
  };

  // 推送某一天：拉取->合并->落地->推送，遇 409 自动重试
  const pushDay = async (day) => {
    for (let tries = 0; tries < 5; tries++) {
      const remote = await pullDay(day);
      const local = await localRecordsForDay(day);
      const mergedL = mergeRecords(local.learnings, remote ? remote.data.learnings : []);
      const mergedI = mergeRecords(local.inspirations, remote ? remote.data.inspirations : []);
      await applyLocal(mergedL, mergedI);
      const payload = await serialize(mergedL, mergedI, day);
      const res = await putDay(day, payload, remote ? remote.sha : null);
      if (res.ok) return res;
      if (res.conflict) continue;        // 并发修改，重新拉取合并再推
      throw new Error(res.error);
    }
    throw new Error(`推送 ${day} 冲突重试次数过多，请稍后再试`);
  };

  // 仅把某天云端文件拉取到本地（用于「按天搜索」按需加载）
  const pullDayInto = async (day) => {
    if (!(await token())) return;
    const remote = await pullDay(day);
    if (!remote) return;
    const [lL, lI] = await Promise.all([App.db.getAll("learnings"), App.db.getAll("inspirations")]);
    const mL = mergeRecords(lL, remote.data.learnings);
    const mI = mergeRecords(lI, remote.data.inspirations);
    await applyLocal(mL, mI);
  };

  // 一次完整同步：遍历所有涉及的天数，逐天 拉取+合并+推送
  const syncNow = async (opts = {}) => {
    if (_busy) return { skipped: true, reason: "busy" };
    if (!state.enabled || !(await token())) { updateStatus("未登录"); return { skipped: true, reason: "not-configured" }; }
    _busy = true; updateStatus("同步中…");
    try {
      const localDays = await allLocalDays();
      let remoteDays = [];
      try { remoteDays = await listRemoteDays(); } catch (e) { /* 忽略列目录失败，按本地天数推 */ }
      const days = Array.from(new Set([...localDays, ...remoteDays])).sort();
      let okCount = 0, fail = null;
      for (const d of days) {
        try { await pushDay(d); okCount++; }
        catch (e) { fail = e.message; break; }
      }
      await App.db.setMeta("lastSyncAt", Date.now());
      updateStatus(fail ? "部分失败" : "已同步");
      if (opts.refresh) { try { App.app.show(App.app.current || "learning"); } catch (e) {} }
      return { ok: !fail, okCount, fail };
    } catch (e) {
      updateStatus("同步失败"); return { ok: false, error: e.message };
    } finally { _busy = false; }
  };

  // 本地有改动 -> 立即（防抖 ~800ms）推送当天文件
  const schedulePushDay = (record) => {
    updateStatus("待同步");
    if (!state.enabled || !state.auto) return;
    const day = dayKey(record && record.createdAt ? record.createdAt : Date.now());
    clearTimeout(_dayTimers[day]);
    _dayTimers[day] = setTimeout(() => {
      pushDay(day).then(() => updateStatus("已同步")).catch(() => updateStatus("同步失败"));
    }, 800);
  };

  const updateStatus = async (override) => {
    const btn = document.getElementById("syncBtn");
    if (!btn) return;
    const authed = !!(await token());
    let label = override;
    if (!label) label = state.enabled ? "已同步" : "未开启";
    const last = await App.db.getMeta("lastSyncAt", null);
    btn.title = state.enabled
      ? `云同步 · ${label}${last ? " · " + App.util.fmtDateTime(last) : ""}（点击立即同步）`
      : "云同步未开启，去设置开启";
    btn.dataset.state = state.enabled ? (override === "同步中…" ? "syncing" : (override === "待同步" ? "pending" : "ok")) : "off";
    btn.textContent = override === "同步中…" ? "🔄" : (state.enabled ? "☁️" : "🚫");
  };

  const init = async () => {
    await reloadCfg();
    updateStatus();
    if (state.enabled && (await token())) {
      const r = await syncNow({ refresh: false });
      if (r && r.ok && App.app.current) App.app.show(App.app.current);
    }
  };

  return {
    init, syncNow, schedulePushDay, pullDayInto, reloadCfg, saveCfg, mergeRecords, updateStatus, dayKey,
    getState: () => state,
    getLastSync: () => App.db.getMeta("lastSyncAt", null),
  };
})();
