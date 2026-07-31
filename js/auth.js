/* ===== GitHub 账号鉴权（仅放行授权账号） =====
 * 打开网页先要求登录：粘贴 GitHub Token，调用 /user 校验该 Token 所属账号
 * 是否在授权名单内。校验通过后才放行，且 Token 直接复用为云同步凭证。
 * 注意：GitHub 已不支持账号密码直连 API，Token 即等价于账号凭据。
 */
App.auth = (function () {
  const API = "https://api.github.com";
  // 授权账号白名单（仅这些 GitHub 登录名可进入）
  const ALLOWED = (window.App && App.ALLOWED_GITHUB_LOGINS) || ["Sharkepler"];
  const KEY = "auth.session";

  const getSession = () => App.db.getSetting(KEY, null);
  const setSession = (s) => App.db.setSetting(KEY, s);
  const clearSession = () => App.db.setSetting(KEY, null);

  const isAuthed = async () => {
    const s = await getSession();
    return !!(s && s.token && s.login && ALLOWED.includes(s.login));
  };
  const getToken = async () => { const s = await getSession(); return s ? s.token : ""; };
  const getLogin = async () => { const s = await getSession(); return s ? s.login : ""; };

  // 校验 Token 所属账号是否为授权账号
  const verify = async (token) => {
    const res = await fetch(`${API}/user`, {
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "User-Agent": "ai-learn-hub" },
    });
    if (!res.ok) {
      let msg = `GitHub 校验失败 (HTTP ${res.status})`;
      try { const j = await res.json(); if (j && j.message) msg = j.message; } catch (e) {}
      throw new Error(msg);
    }
    const u = await res.json();
    if (!ALLOWED.includes(u.login)) {
      throw new Error(`该 Token 属于 @${u.login}，不在授权账号列表中`);
    }
    return u.login;
  };

  const login = async (token) => {
    token = (token || "").trim();
    if (!token) throw new Error("请输入 GitHub Token");
    const login = await verify(token);
    await setSession({ token, login, ts: Date.now() });
    return login;
  };

  const logout = async () => { await clearSession(); };

  return { isAuthed, getToken, getLogin, login, logout, verify, ALLOWED };
})();
