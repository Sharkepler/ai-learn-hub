/* ===== 本地数据层（IndexedDB） ===== */
App.db = (function () {
  const DB_NAME = "ai-learn-hub";
  const DB_VER = 1;
  let _db = null;

  const open = () => new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("learnings"))
        db.createObjectStore("learnings", { keyPath: "id" });
      if (!db.objectStoreNames.contains("inspirations"))
        db.createObjectStore("inspirations", { keyPath: "id" });
      if (!db.objectStoreNames.contains("settings"))
        db.createObjectStore("settings", { keyPath: "k" });
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });

  const tx = (store, mode) => _db.transaction(store, mode).objectStore(store);

  const getAll = (store) => new Promise((res, rej) => {
    const r = tx(store, "readonly").getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => rej(r.error);
  });

  const get = (store, id) => new Promise((res, rej) => {
    const r = tx(store, "readonly").get(id);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

  let _suppressSync = false;
  const put = (store, obj) => new Promise((res, rej) => {
    // 数据记录自动打时间戳（用于跨设备同步合并）
    if (store === "learnings" || store === "inspirations") {
      obj.updatedAt = Date.now();
      if (!obj.createdAt) obj.createdAt = obj.updatedAt;
      if (!_suppressSync && App.sync && App.sync.schedulePush) App.sync.schedulePush();
    }
    const r = tx(store, "readwrite").put(obj);
    r.onsuccess = () => res(obj);
    r.onerror = () => rej(r.error);
  });

  // 批量写入（用于同步落地，抑制自动同步循环）
  const bulkPut = async (store, arr) => {
    _suppressSync = true;
    try {
      for (const o of (arr || [])) {
        if ((store === "learnings" || store === "inspirations") && !o.updatedAt)
          o.updatedAt = o.createdAt || Date.now();
        await put(store, o);
      }
    } finally { _suppressSync = false; }
  };

  // 软删除：标记 deleted，便于跨设备同步删除
  const markDeleted = async (store, id) => {
    const rec = await get(store, id);
    if (!rec) return;
    rec.deleted = true; rec.updatedAt = Date.now();
    await put(store, rec);
  };

  // 同步元数据
  const getMeta = (k, def) => getSetting("__meta_" + k, def);
  const setMeta = (k, v) => setSetting("__meta_" + k, v);

  const del = (store, id) => new Promise((res, rej) => {
    const r = tx(store, "readwrite").delete(id);
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });

  const clear = (store) => new Promise((res, rej) => {
    const r = tx(store, "readwrite").clear();
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });

  // 设置（key-value）
  const getSetting = async (k, def) => {
    const r = await get("settings", k);
    return r ? r.v : def;
  };
  const setSetting = (k, v) => put("settings", { k, v });

  // 导出全部数据为 JSON 字符串
  const exportAll = async () => {
    const [learnings, inspirations, settings] = await Promise.all([
      getAll("learnings"), getAll("inspirations"), getAll("settings"),
    ]);
    // 将 Blob 图片转为 dataURL，便于导出/迁移
    for (const ins of inspirations) {
      if (ins.images && ins.images.length) {
        ins.images = await Promise.all(ins.images.map(async (im) => ({
          name: im.name,
          type: im.type,
          data: im.blob ? await blobToDataURL(im.blob) : im.data,
        })));
      }
    }
    return JSON.stringify({ _app: "ai-learn-hub", _ver: 1, exportedAt: Date.now(),
      learnings, inspirations, settings }, null, 2);
  };

  const blobToDataURL = (blob) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });

  // 导入数据（合并，重复 id 覆盖）
  const importAll = async (jsonStr) => {
    const data = JSON.parse(jsonStr);
    if (data.learnings) for (const x of data.learnings) await put("learnings", x);
    if (data.inspirations) for (const x of data.inspirations) {
      if (x.images && x.images.length) {
        x.images = await Promise.all(x.images.map(async (im) => ({
          name: im.name, type: im.type,
          blob: im.data ? await dataURLToBlob(im.data) : im.blob,
        })));
      }
      await put("inspirations", x);
    }
    if (data.settings) for (const s of data.settings) await put("settings", s);
  };

  const dataURLToBlob = (dataUrl) => new Promise((res) => {
    const [head, body] = dataUrl.split(",");
    const mime = head.match(/:(.*?);/)[1];
    const bin = atob(body);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    res(new Blob([arr], { type: mime }));
  });

  return { open, getAll, get, put, bulkPut, markDeleted, del, clear, getSetting, setSetting,
    getMeta, setMeta, exportAll, importAll };
})();
