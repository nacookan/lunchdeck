(() => {
  "use strict";

  /* ==========================================================================
     Configuration & Constants
     ========================================================================== */
  const APP_KEY = window.LUNCHDECK_CONFIG?.dropboxAppKey || "";
  const PLACEHOLDER_KEY = "PASTE_YOUR_DROPBOX_APP_KEY_HERE";
  const DROPBOX_FILE_PATH = "/lunchdeck.json";

  const STORAGE = {
    auth: "lunchdeck.auth",
    cache: "lunchdeck.cache",
    pkce: "lunchdeck.pkce",
  };

  const DEFAULT_TAG_GROUPS = [
    {
      id: "genre",
      name: "ジャンル",
      tags: [],
    },
    {
      id: "time",
      name: "時間",
      tags: [],
    },
    {
      id: "area",
      name: "方面",
      tags: [],
    },
  ];

  /* ==========================================================================
     Application State
     ========================================================================== */
  const state = {
    data: {
      version: 1,
      updatedAt: new Date().toISOString(),
      tagGroups: JSON.parse(JSON.stringify(DEFAULT_TAG_GROUPS)),
      restaurants: [],
    },
    rev: null,
    filter: {
      search: "",
      dynamic: null, // 'unvisited' | 'neglected' | 'recent' | 'frequent' | null
      tags: new Set(),
      sort: "smart",
    },
    randomSeed: Math.random(),
    isSyncing: false,
    saveDebounceTimer: null,
    lastUndoableAction: null,
    formTags: new Set(),
  };

  /* ==========================================================================
     DOM Elements
     ========================================================================== */
  const el = {
    syncStatus: document.getElementById("sync-status"),
    btnSettings: document.getElementById("btn-settings"),
    btnAddRestaurant: document.getElementById("btn-add-restaurant"),
    btnPickOne: document.getElementById("btn-pick-one"),
    searchInput: document.getElementById("search-input"),
    btnClearSearch: document.getElementById("btn-clear-search"),
    sortSelect: document.getElementById("sort-select"),
    btnReshuffle: document.getElementById("btn-reshuffle"),
    dynamicChips: document.querySelectorAll(".chip-quick"),
    btnClearTags: document.getElementById("btn-clear-tags"),
    // Grouped tag chip containers
    groupGenreRow: document.getElementById("group-genre-row"),
    groupGenreChips: document.getElementById("group-genre-chips"),
    groupTimeRow: document.getElementById("group-time-row"),
    groupTimeChips: document.getElementById("group-time-chips"),
    groupAreaRow: document.getElementById("group-area-row"),
    groupAreaChips: document.getElementById("group-area-chips"),
    groupOtherRow: document.getElementById("group-other-row"),
    groupOtherChips: document.getElementById("group-other-chips"),
    // Restaurant list & empty
    restaurantGrid: document.getElementById("restaurant-grid"),
    emptyState: document.getElementById("empty-state"),
    emptyTitle: document.getElementById("empty-title"),
    btnEmptyClear: document.getElementById("btn-empty-clear"),
    btnEmptyAdd: document.getElementById("btn-empty-add"),
    emptyDesc: document.getElementById("empty-desc"),
    btnEmptyConnect: document.getElementById("btn-empty-connect"),
    // Restaurant Modal
    modalRestaurant: document.getElementById("modal-restaurant"),
    modalRestaurantTitle: document.getElementById("modal-restaurant-title"),
    formRestaurant: document.getElementById("form-restaurant"),
    restaurantId: document.getElementById("restaurant-id"),
    restaurantName: document.getElementById("restaurant-name"),
    formGenreChips: document.getElementById("form-genre-chips"),
    formTimeChips: document.getElementById("form-time-chips"),
    formAreaChips: document.getElementById("form-area-chips"),
    inputAddGenre: document.getElementById("input-add-genre"),
    inputAddTime: document.getElementById("input-add-time"),
    inputAddArea: document.getElementById("input-add-area"),
    historySection: document.getElementById("history-management-section"),
    historyCount: document.getElementById("history-count"),
    historyList: document.getElementById("history-list"),
    btnAddManualVisit: document.getElementById("btn-add-manual-visit"),
    btnDeleteRestaurant: document.getElementById("btn-delete-restaurant"),
    // Roulette Modal
    modalRoulette: document.getElementById("modal-roulette"),
    rouletteDisplay: document.getElementById("roulette-display"),
    rouletteStoreName: document.getElementById("roulette-store-name"),
    rouletteMeta: document.getElementById("roulette-meta"),
    btnRouletteAccept: document.getElementById("btn-roulette-accept"),
    btnRouletteRetry: document.getElementById("btn-roulette-retry"),
    // Settings Modal
    modalSettings: document.getElementById("modal-settings"),
    dropboxStatusBox: document.getElementById("dropbox-status-box"),
    btnDropboxConnect: document.getElementById("btn-dropbox-connect"),
    btnDropboxLogout: document.getElementById("btn-dropbox-logout"),
    btnDropboxSyncNow: document.getElementById("btn-dropbox-sync-now"),
    btnExportJson: document.getElementById("btn-export-json"),
    fileImportJson: document.getElementById("file-import-json"),
    toastContainer: document.getElementById("toast-container"),
  };

  /* ==========================================================================
     Tag Management & Categorization
     ========================================================================== */
  function ensureTagGroups() {
    if (!state.data.tagGroups || !Array.isArray(state.data.tagGroups) || state.data.tagGroups.length === 0) {
      state.data.tagGroups = JSON.parse(JSON.stringify(DEFAULT_TAG_GROUPS));
    }
    for (const def of DEFAULT_TAG_GROUPS) {
      let g = state.data.tagGroups.find((x) => x.id === def.id);
      if (!g) {
        state.data.tagGroups.push({ id: def.id, name: def.name, tags: [] });
      }
    }
    // Track any existing restaurant tags into corresponding groups if not present
    (state.data.restaurants || []).forEach((r) => {
      (r.tags || []).forEach((t) => {
        let cat = getTagCategory(t);
        if (cat === "other") cat = "genre";
        let grp = state.data.tagGroups.find((g) => g.id === cat);
        if (grp && !grp.tags.includes(t)) {
          grp.tags.push(t);
        }
      });
    });
  }

  function pruneUnusedTags() {
    ensureTagGroups();
    const usedTags = new Set(state.formTags);
    (state.data.restaurants || []).forEach((r) => {
      (r.tags || []).forEach((t) => usedTags.add(t));
    });
    for (const group of state.data.tagGroups) {
      if (Array.isArray(group.tags)) {
        group.tags = group.tags.filter((t) => usedTags.has(t));
      }
    }
  }

  function getTagCategory(tag) {
    if (state.data?.tagGroups && Array.isArray(state.data.tagGroups)) {
      for (const group of state.data.tagGroups) {
        if (group.tags && group.tags.includes(tag)) return group.id;
      }
    }
    // Heuristic categorization for legacy tags
    if (/(?:分|歩|自転車|駅)/.test(tag)) return "time";
    if (/(?:口|街|通り|側|北|南|東|西)/.test(tag)) return "area";
    return "other";
  }

  function addTagToGroup(groupId, newTag) {
    const tag = (newTag || "").trim();
    if (!tag) return;

    ensureTagGroups();
    let group = state.data.tagGroups.find((g) => g.id === groupId);
    if (!group) {
      group = { id: groupId, name: groupId, tags: [] };
      state.data.tagGroups.push(group);
    }

    if (!group.tags.includes(tag)) {
      group.tags.push(tag);
    }

    state.formTags.add(tag);
    renderFormPresetChips();
  }

  /* ==========================================================================
     Utility Functions
     ========================================================================== */
  const uuid = () =>
    crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

  const escapeHtml = (str) => {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const getDaysAgoNumber = (dateStr) => {
    if (!dateStr) return 9999;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 9999;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    return Math.max(0, Math.floor((startOfToday - startOfTarget) / 86400000));
  };

  const getLastVisit = (restaurant) => {
    if (!restaurant.visits || restaurant.visits.length === 0) return null;
    const sorted = [...restaurant.visits].sort((a, b) => new Date(b) - new Date(a));
    return sorted[0];
  };

  const formatCompactMeta = (restaurant) => {
    const visits = restaurant.visits || [];
    const count = visits.length;
    if (count === 0) {
      return { text: "🌱 未訪問", type: "unvisited" };
    }

    const last = getLastVisit(restaurant);
    const days = getDaysAgoNumber(last);
    let timeText = "";
    if (days === 0) timeText = "今日";
    else if (days === 1) timeText = "昨日";
    else if (days <= 6) timeText = `${days}日前`;
    else if (days <= 30) timeText = `${Math.floor(days / 7)}週間前`;
    else timeText = `${days}日前`;

    const type = days <= 6 ? "recent" : "normal";
    return { text: `${timeText} · ${count}回`, type };
  };

  /* ==========================================================================
     Dropbox PKCE OAuth & Sync
     ========================================================================== */
  const configured = () => Boolean(APP_KEY && APP_KEY.trim() !== "" && APP_KEY !== PLACEHOLDER_KEY);

  function showConfigError() {
    const appEl = document.getElementById("app");
    if (!appEl) return;
    appEl.innerHTML = `
      <div class="config-error-screen">
        <div class="config-error-card">
          <img src="assets/icon.svg" alt="LunchDeck" class="config-error-logo" />
          <h2 class="config-error-title">Dropbox App Key が設定されていません</h2>
          <p class="config-error-desc">
            LunchDeck はお店のデータを Dropbox に保存して利用するツールです。<br>利用を開始するには App Key の設定が必要です。
          </p>
          <div class="config-error-box">
            <p><strong>ローカル環境の場合:</strong></p>
            <p><code>config.local.js</code> を作成して App Key を設定してください。</p>
            <pre><code>window.LUNCHDECK_CONFIG = {
  dropboxAppKey: "PASTE_YOUR_APP_KEY"
};</code></pre>
            <p style="margin-top: 0.8rem;"><strong>GitHub Pages の場合:</strong></p>
            <p>リポジトリの <code>Settings &gt; Secrets and variables &gt; Actions</code> で <code>DROPBOX_APP_KEY</code> を登録してください。</p>
          </div>
        </div>
      </div>
    `;
  }

  const getAuth = () => {
    try {
      const raw = localStorage.getItem(STORAGE.auth);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const setAuth = (authData) => {
    if (authData) {
      localStorage.setItem(STORAGE.auth, JSON.stringify(authData));
    } else {
      localStorage.removeItem(STORAGE.auth);
    }
    updateSyncStatusUI();
  };

  async function sha256base64url(str) {
    const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return btoa(String.fromCharCode(...new Uint8Array(raw)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  const redirectUri = () => `${location.origin}${location.pathname}`;

  async function connectDropbox() {
    if (!configured()) {
      showToast("config.local.js に App Key が未設定です");
      return;
    }

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    const verifier = Array.from(
      crypto.getRandomValues(new Uint8Array(64)),
      (v) => chars[v % chars.length]
    ).join("");
    const oauthState = uuid();
    sessionStorage.setItem(STORAGE.pkce, JSON.stringify({ verifier, oauthState }));

    const params = new URLSearchParams({
      client_id: APP_KEY,
      response_type: "code",
      redirect_uri: redirectUri(),
      code_challenge_method: "S256",
      code_challenge: await sha256base64url(verifier),
      token_access_type: "offline",
      state: oauthState,
    });
    location.assign(`https://www.dropbox.com/oauth2/authorize?${params}`);
  }

  async function finishOAuth() {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    if (!code) return false;

    const clean = () => history.replaceState({}, "", `${location.pathname}${location.hash}`);
    const pending = JSON.parse(sessionStorage.getItem(STORAGE.pkce) || "null");

    if (!pending || pending.oauthState !== params.get("state")) {
      clean();
      showToast("認証セッション無効。再接続してください");
      return false;
    }

    const body = new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: APP_KEY,
      redirect_uri: redirectUri(),
      code_verifier: pending.verifier,
    });

    try {
      const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      if (!response.ok) {
        sessionStorage.removeItem(STORAGE.pkce);
        clean();
        showToast("Dropbox認証に失敗しました");
        return false;
      }

      const result = await response.json();
      setAuth({
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
        expiresAt: Date.now() + (result.expires_in || 14400) * 1000,
      });
      sessionStorage.removeItem(STORAGE.pkce);
      clean();
      showToast("Dropboxに接続しました！");
      return true;
    } catch (err) {
      clean();
      showToast(`接続失敗: ${err.message}`);
      return false;
    }
  }

  async function refreshAccessToken(saved) {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: saved.refreshToken,
      client_id: APP_KEY,
    });
    const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) {
      setAuth(null);
      throw new Error("セッション終了");
    }
    const result = await response.json();
    const renewed = {
      ...saved,
      accessToken: result.access_token,
      refreshToken: result.refresh_token || saved.refreshToken,
      expiresAt: Date.now() + (result.expires_in || 14400) * 1000,
    };
    setAuth(renewed);
    return renewed.accessToken;
  }

  async function token() {
    const saved = getAuth();
    if (!saved) return null;
    if (saved.expiresAt < Date.now() + 60000) {
      if (saved.refreshToken) return refreshAccessToken(saved);
      return null;
    }
    return saved.accessToken;
  }

  async function dbx(endpoint, args, content) {
    const accessToken = await token();
    if (!accessToken) throw new Error("認証が必要です");

    const headers = { Authorization: `Bearer ${accessToken}` };
    const options = { method: "POST", headers };

    if (content !== undefined) {
      headers["Content-Type"] = "application/octet-stream";
      headers["Dropbox-API-Arg"] = JSON.stringify(args);
      options.body = content;
    } else if (endpoint === "files/download") {
      headers["Dropbox-API-Arg"] = JSON.stringify(args);
    } else {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(args);
    }

    const isContentHost = content !== undefined || endpoint === "files/download";
    const host = isContentHost ? "content.dropboxapi.com" : "api.dropboxapi.com";
    const response = await fetch(`https://${host}/2/${endpoint}`, options);

    if (!response.ok) {
      if (response.status === 401) setAuth(null);
      const text = await response.text();
      let errInfo;
      try { errInfo = JSON.parse(text); } catch {}
      const errTag = errInfo?.error?.[".tag"] || errInfo?.error_summary || "";
      const error = new Error(`Dropbox error: ${errTag || text}`);
      error.status = response.status;
      error.tag = errTag;
      throw error;
    }

    if (endpoint === "files/download") {
      const metadata = JSON.parse(response.headers.get("Dropbox-API-Result") || "{}");
      return { content: await response.text(), metadata };
    }

    return response.json();
  }

  /* ==========================================================================
     Data Management
     ========================================================================== */
  async function syncFromDropbox() {
    const authToken = await token();
    if (!authToken) return;

    setSyncingUI(true);
    try {
      const res = await dbx("files/download", { path: DROPBOX_FILE_PATH });
      if (res && res.content) {
        state.rev = res.metadata?.rev || null;
        try {
          const cloudData = JSON.parse(res.content);
          if (cloudData && Array.isArray(cloudData.restaurants)) {
            state.data = cloudData;
            ensureTagGroups();
            pruneUnusedTags();
            localStorage.setItem(STORAGE.cache, JSON.stringify(state.data));
          }
        } catch (parseErr) {
          console.error("Failed to parse cloud data:", parseErr);
        }
      }
      setSyncingUI(false);
    } catch (err) {
      if (err.status === 409 || err.tag?.includes("not_found")) {
        await saveToDropbox();
        setSyncingUI(false);
      } else {
        console.error(err);
        setSyncingUI(false, true);
        showToast("Dropbox読み込み失敗");
      }
    }
  }

  async function saveToDropbox() {
    const authToken = await token();
    if (!authToken) return;

    setSyncingUI(true);
    try {
      const content = JSON.stringify(state.data, null, 2);
      const args = {
        path: DROPBOX_FILE_PATH,
        mode: state.rev ? { ".tag": "update", update: state.rev } : "add",
        autorename: false,
        mute: true,
      };

      const meta = await dbx("files/upload", args, content);
      state.rev = meta.rev;
      localStorage.setItem(STORAGE.cache, content);
      setSyncingUI(false);
    } catch (err) {
      if (err.status === 409) {
        await syncFromDropbox();
        const content = JSON.stringify(state.data, null, 2);
        const args = {
          path: DROPBOX_FILE_PATH,
          mode: state.rev ? { ".tag": "update", update: state.rev } : "overwrite",
          autorename: false,
          mute: true,
        };
        const meta = await dbx("files/upload", args, content);
        state.rev = meta.rev;
        localStorage.setItem(STORAGE.cache, content);
        setSyncingUI(false);
      } else {
        setSyncingUI(false, true);
        showToast("Dropbox保存失敗");
      }
    }
  }

  function scheduleSave() {
    state.data.updatedAt = new Date().toISOString();
    if (getAuth()) {
      localStorage.setItem(STORAGE.cache, JSON.stringify(state.data));
      setSyncingUI(true);
      if (state.saveDebounceTimer) clearTimeout(state.saveDebounceTimer);
      state.saveDebounceTimer = setTimeout(saveToDropbox, 600);
    } else {
      updateSyncStatusUI();
    }
  }

  function setSyncingUI(syncing, isError = false) {
    state.isSyncing = syncing;
    el.syncStatus.className = "sync-dot " + (syncing ? "syncing" : isError ? "error" : getAuth() ? "online" : "");
  }

  function updateSyncStatusUI() {
    const isOnline = Boolean(getAuth());
    el.syncStatus.className = "sync-dot " + (isOnline ? "online" : "");
    renderSettingsModalState();
  }

  /* ==========================================================================
     Filtering & Sorting
     ========================================================================== */
  function getFilteredRestaurants() {
    let list = [...(state.data.restaurants || [])];

    // 1. Search (Name or Tags)
    if (state.filter.search) {
      const q = state.filter.search.toLowerCase().trim();
      list = list.filter((r) => {
        const nameMatch = r.name.toLowerCase().includes(q);
        const tagMatch = (r.tags || []).some((t) => t.toLowerCase().includes(q));
        return nameMatch || tagMatch;
      });
    }

    // 2. Dynamic filter
    if (state.filter.dynamic) {
      switch (state.filter.dynamic) {
        case "unvisited":
          list = list.filter((r) => !r.visits || r.visits.length === 0);
          break;
        case "neglected":
          list = list.filter((r) => getDaysAgoNumber(getLastVisit(r)) >= 14);
          break;
        case "recent":
          list = list.filter((r) => {
            const last = getLastVisit(r);
            return last && getDaysAgoNumber(last) <= 7;
          });
          break;
        case "frequent":
          list = list.filter((r) => (r.visits?.length || 0) >= 3);
          break;
      }
    }

    // 3. Tags filter (AND match across selected tags)
    if (state.filter.tags.size > 0) {
      const selected = Array.from(state.filter.tags);
      list = list.filter((r) => {
        const rTags = new Set(r.tags || []);
        return selected.every((t) => rTags.has(t));
      });
    }

    // 4. Sort
    list = sortRestaurants(list, state.filter.sort);

    return list;
  }

  function sortRestaurants(list, sortKey) {
    const copy = [...list];

    switch (sortKey) {
      case "smart":
        return weightedShuffle(copy, state.randomSeed);
      case "random":
        return uniformShuffle(copy, state.randomSeed);
      case "recent":
        return copy.sort((a, b) => getDaysAgoNumber(getLastVisit(a)) - getDaysAgoNumber(getLastVisit(b)));
      case "oldest":
        return copy.sort((a, b) => getDaysAgoNumber(getLastVisit(b)) - getDaysAgoNumber(getLastVisit(a)));
      case "most":
        return copy.sort((a, b) => (b.visits?.length || 0) - (a.visits?.length || 0));
      case "least":
        return copy.sort((a, b) => (a.visits?.length || 0) - (b.visits?.length || 0));
      case "name":
        return copy.sort((a, b) => a.name.localeCompare(b.name, "ja"));
      default:
        return copy;
    }
  }

  function weightedShuffle(items, seed) {
    if (items.length <= 1) return items;
    let s = seed;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    return items
      .map((item) => {
        const days = getDaysAgoNumber(getLastVisit(item));
        const visits = item.visits?.length || 0;

        let recencyWeight = 1.0;
        if (days === 0) recencyWeight = 0.05;
        else if (days === 1) recencyWeight = 0.15;
        else if (days <= 3) recencyWeight = 0.4;
        else if (days <= 6) recencyWeight = 0.7;
        else if (days >= 9999) recencyWeight = 2.0;
        else recencyWeight = 1.0 + Math.min(days - 7, 30) * 0.05;

        const freqWeight = 1.0 + Math.min(visits, 5) * 0.06;
        const totalWeight = Math.max(0.01, recencyWeight * freqWeight);
        const u = Math.max(0.0001, rnd());
        const key = -Math.log(u) / totalWeight;

        return { item, key };
      })
      .sort((a, b) => a.key - b.key)
      .map((x) => x.item);
  }

  function uniformShuffle(items, seed) {
    let s = seed;
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    return items
      .map((item) => ({ item, key: rnd() }))
      .sort((a, b) => a.key - b.key)
      .map((x) => x.item);
  }

  /* ==========================================================================
     UI Rendering
     ========================================================================== */
  function render() {
    renderGroupedTagFilter();
    renderRestaurantList();
    lucide.createIcons();
  }

  // Render grouped tag filters in header
  function renderGroupedTagFilter() {
    ensureTagGroups();

    // Collect all registered tags currently used in restaurants or currently active
    const usedTags = new Set(state.filter.tags);
    (state.data.restaurants || []).forEach((r) => {
      (r.tags || []).forEach((t) => usedTags.add(t));
    });

    const genreGroup = state.data.tagGroups.find((g) => g.id === "genre") || { tags: [] };
    const timeGroup = state.data.tagGroups.find((g) => g.id === "time") || { tags: [] };
    const areaGroup = state.data.tagGroups.find((g) => g.id === "area") || { tags: [] };

    const genreTags = genreGroup.tags.filter((t) => usedTags.has(t));
    const timeTags = timeGroup.tags.filter((t) => usedTags.has(t));
    const areaTags = areaGroup.tags.filter((t) => usedTags.has(t));

    // Other tags: usedTags that are not in genre, time, or area
    const knownSet = new Set([...genreGroup.tags, ...timeGroup.tags, ...areaGroup.tags]);
    const otherTags = Array.from(usedTags).filter((t) => !knownSet.has(t));

    const makeChips = (tags) => {
      return tags
        .map((tag) => {
          const isActive = state.filter.tags.has(tag);
          return `
            <button type="button" class="chip ${isActive ? "active" : ""}" data-tag="${escapeHtml(tag)}">
              ${escapeHtml(tag)}
            </button>
          `;
        })
        .join("");
    };

    el.groupGenreChips.innerHTML = makeChips(genreTags);
    el.groupGenreRow.style.display = genreTags.length > 0 ? "flex" : "none";

    el.groupTimeChips.innerHTML = makeChips(timeTags);
    el.groupTimeRow.style.display = timeTags.length > 0 ? "flex" : "none";

    el.groupAreaChips.innerHTML = makeChips(areaTags);
    el.groupAreaRow.style.display = areaTags.length > 0 ? "flex" : "none";

    el.groupOtherChips.innerHTML = makeChips(otherTags);
    el.groupOtherRow.style.display = otherTags.length > 0 ? "flex" : "none";

    const hasActive = state.filter.tags.size > 0 || state.filter.dynamic !== null;
    el.btnClearTags.style.display = hasActive ? "inline-block" : "none";
  }

  // Render ultra-simple restaurant list (Name + Meta + Went / Edit)
  function renderRestaurantList() {
    const filtered = getFilteredRestaurants();
    const total = state.data.restaurants?.length || 0;

    const isShuffleSort = state.filter.sort === "smart" || state.filter.sort === "random";
    el.btnReshuffle.style.display = isShuffleSort ? "inline-flex" : "none";
    el.btnPickOne.disabled = filtered.length === 0;

    if (filtered.length === 0) {
      el.restaurantGrid.innerHTML = "";
      el.emptyState.style.display = "flex";

      if (!getAuth()) {
        el.emptyTitle.textContent = "Dropbox と未接続です";
        if (el.emptyDesc) {
          el.emptyDesc.textContent = "お店のデータは Dropbox に保存されます。連携して始めましょう。";
          el.emptyDesc.style.display = "block";
        }
        el.btnEmptyClear.style.display = "none";
        el.btnEmptyAdd.style.display = "none";
        if (el.btnEmptyConnect) el.btnEmptyConnect.style.display = "inline-flex";
      } else {
        if (el.emptyDesc) el.emptyDesc.style.display = "none";
        if (el.btnEmptyConnect) el.btnEmptyConnect.style.display = "none";

        if (total === 0) {
          el.emptyTitle.textContent = "まだお店がありません";
          el.btnEmptyAdd.style.display = "inline-flex";
          el.btnEmptyClear.style.display = "none";
        } else {
          el.emptyTitle.textContent = "一致するお店がありません";
          el.btnEmptyAdd.style.display = "none";
          el.btnEmptyClear.style.display = "inline-flex";
        }
      }
      return;
    }

    el.emptyState.style.display = "none";

    el.restaurantGrid.innerHTML = filtered
      .map((r) => {
        const meta = formatCompactMeta(r);

        return `
          <article class="restaurant-item" data-id="${r.id}">
            <div class="item-main">
              <h3 class="item-name">${escapeHtml(r.name)}</h3>
              <span class="item-meta ${meta.type}">${meta.text}</span>
            </div>
            <div class="item-actions">
              <button type="button" class="btn-went" data-visit-id="${r.id}" title="行った！">
                <i data-lucide="utensils"></i>
                <span>行った</span>
              </button>
              <button type="button" class="btn-item-more btn-edit-restaurant" data-id="${r.id}" title="編集" aria-label="編集">
                <i data-lucide="pencil"></i>
              </button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  /* ==========================================================================
     Actions: Visit Recording, Adding, Editing, Deleting
     ========================================================================== */
  function recordVisit(restaurantId, customTimestamp = null) {
    if (!getAuth()) {
      showToast("先に Dropbox と連携してください");
      connectDropbox();
      return;
    }
    const restaurant = (state.data.restaurants || []).find((r) => r.id === restaurantId);
    if (!restaurant) return;

    if (!restaurant.visits) restaurant.visits = [];
    const timestamp = customTimestamp || new Date().toISOString();

    restaurant.visits.push(timestamp);
    restaurant.updatedAt = new Date().toISOString();

    state.lastUndoableAction = {
      type: "visit",
      restaurantId,
      timestamp,
      restaurantName: restaurant.name,
    };

    scheduleSave();
    render();

    showToast(`「${restaurant.name}」に行った！`, {
      actionText: "取消",
      onAction: () => undoLastAction(),
    });
  }

  function undoLastAction() {
    if (!state.lastUndoableAction) return;
    const { type, restaurantId, timestamp, restaurantName } = state.lastUndoableAction;

    if (type === "visit") {
      const restaurant = (state.data.restaurants || []).find((r) => r.id === restaurantId);
      if (restaurant && restaurant.visits) {
        const idx = restaurant.visits.lastIndexOf(timestamp);
        if (idx !== -1) {
          restaurant.visits.splice(idx, 1);
          restaurant.updatedAt = new Date().toISOString();
          scheduleSave();
          render();
          showToast(`「${restaurantName}」の訪問を取り消しました`);
        }
      }
    }
    state.lastUndoableAction = null;
  }

  function openRestaurantModal(restaurantId = null) {
    if (!getAuth()) {
      showToast("先に Dropbox と連携してください");
      connectDropbox();
      return;
    }
    el.formRestaurant.reset();
    state.formTags.clear();
    pruneUnusedTags();

    if (restaurantId) {
      const r = (state.data.restaurants || []).find((x) => x.id === restaurantId);
      if (!r) return;

      el.modalRestaurantTitle.textContent = "お店を編集";
      el.restaurantId.value = r.id;
      el.restaurantName.value = r.name || "";
      (r.tags || []).forEach((t) => state.formTags.add(t));

      el.historySection.style.display = "block";
      renderHistoryList(r);
      el.btnDeleteRestaurant.style.display = "inline-flex";
    } else {
      el.modalRestaurantTitle.textContent = "お店を追加";
      el.restaurantId.value = "";
      el.historySection.style.display = "none";
      el.btnDeleteRestaurant.style.display = "none";
    }

    renderFormPresetChips();
    el.modalRestaurant.style.display = "flex";
    el.restaurantName.focus();
    lucide.createIcons();
  }

  // Render preset chips inside modal by category
  function renderFormPresetChips() {
    ensureTagGroups();

    // Only tags actually used in restaurants or currently selected in form
    const usedTags = new Set(state.formTags);
    (state.data.restaurants || []).forEach((r) => {
      (r.tags || []).forEach((t) => usedTags.add(t));
    });

    const renderGroup = (container, groupTags, groupId) => {
      const tagsInGroup = new Set((groupTags || []).filter((t) => usedTags.has(t)));
      usedTags.forEach((t) => {
        if (getTagCategory(t) === groupId) {
          tagsInGroup.add(t);
        }
      });

      const list = Array.from(tagsInGroup);
      container.innerHTML = list
        .map((tag) => {
          const isSelected = state.formTags.has(tag);
          return `
            <button type="button" class="chip ${isSelected ? "active" : ""}" data-form-toggle-tag="${escapeHtml(tag)}">
              ${escapeHtml(tag)}
            </button>
          `;
        })
        .join("");
    };

    const genreGroup = state.data.tagGroups.find((g) => g.id === "genre") || { tags: [] };
    const timeGroup = state.data.tagGroups.find((g) => g.id === "time") || { tags: [] };
    const areaGroup = state.data.tagGroups.find((g) => g.id === "area") || { tags: [] };

    renderGroup(el.formGenreChips, genreGroup.tags, "genre");
    renderGroup(el.formTimeChips, timeGroup.tags, "time");
    renderGroup(el.formAreaChips, areaGroup.tags, "area");
  }

  function renderHistoryList(restaurant) {
    const visits = [...(restaurant.visits || [])].sort((a, b) => new Date(b) - new Date(a));
    el.historyCount.textContent = visits.length;

    if (visits.length === 0) {
      el.historyList.innerHTML = '<span class="text-muted" style="font-size: 0.78rem; padding: 0.2rem;">訪問履歴なし</span>';
      return;
    }

    el.historyList.innerHTML = visits
      .map((iso, idx) => {
        const d = new Date(iso);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const dateStr = `${y}/${m}/${day}`;

        return `
          <div class="history-item">
            <span>${dateStr}</span>
            <button type="button" class="btn-delete-visit" data-visit-index="${idx}" data-timestamp="${iso}">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        `;
      })
      .join("");

    lucide.createIcons();
  }

  function saveRestaurantFromForm(e) {
    e.preventDefault();
    const id = el.restaurantId.value;
    const name = el.restaurantName.value.trim();
    if (!name) return;

    // Check if any tag inputs have pending text
    const pendingGenre = el.inputAddGenre.value.trim();
    if (pendingGenre) addTagToGroup("genre", pendingGenre);
    const pendingTime = el.inputAddTime.value.trim();
    if (pendingTime) addTagToGroup("time", pendingTime);
    const pendingArea = el.inputAddArea.value.trim();
    if (pendingArea) addTagToGroup("area", pendingArea);

    const tags = Array.from(state.formTags);

    if (id) {
      const r = (state.data.restaurants || []).find((x) => x.id === id);
      if (r) {
        r.name = name;
        r.tags = tags;
        r.updatedAt = new Date().toISOString();
      }
    } else {
      const newRestaurant = {
        id: uuid(),
        name,
        tags,
        visits: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (!state.data.restaurants) state.data.restaurants = [];
      state.data.restaurants.unshift(newRestaurant);
    }

    pruneUnusedTags();
    closeModal(el.modalRestaurant);
    scheduleSave();
    render();
    showToast(id ? "更新しました" : "登録しました");
  }

  function deleteRestaurant(id) {
    const r = (state.data.restaurants || []).find((x) => x.id === id);
    if (!r) return;

    if (!confirm(`「${r.name}」を削除しますか？`)) return;

    state.data.restaurants = state.data.restaurants.filter((x) => x.id !== id);
    pruneUnusedTags();
    closeModal(el.modalRestaurant);
    scheduleSave();
    render();
    showToast(`削除しました`);
  }

  /* ==========================================================================
     Pick One (Roulette / Decider)
     ========================================================================== */
  let rouletteCandidate = null;
  let rouletteTimer = null;

  function startRoulette() {
    if (!getAuth()) {
      showToast("先に Dropbox と連携してください");
      connectDropbox();
      return;
    }
    const filtered = getFilteredRestaurants();
    if (filtered.length === 0) {
      showToast("条件に合うお店がありません");
      return;
    }

    el.modalRoulette.style.display = "flex";
    el.btnRouletteAccept.style.display = "none";
    el.btnRouletteRetry.style.display = "none";
    el.rouletteMeta.textContent = "";

    const targetRestaurant = weightedShuffle(filtered, Math.random())[0] || filtered[0];
    rouletteCandidate = targetRestaurant;

    let iterations = 0;
    const maxIterations = 18;
    let delay = 45;

    function step() {
      iterations++;
      const temp = filtered[Math.floor(Math.random() * filtered.length)];
      el.rouletteStoreName.textContent = temp.name;

      if (iterations < maxIterations) {
        delay += 12;
        rouletteTimer = setTimeout(step, delay);
      } else {
        finalizeRoulette(targetRestaurant);
      }
    }

    step();
  }

  function finalizeRoulette(restaurant) {
    el.rouletteStoreName.textContent = restaurant.name;
    const meta = formatCompactMeta(restaurant);
    el.rouletteMeta.textContent = meta.text;

    el.btnRouletteAccept.style.display = "inline-flex";
    el.btnRouletteRetry.style.display = "inline-flex";

    if (typeof confetti === "function") {
      try {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.6 },
          colors: ["#ff5722", "#ffb703", "#10b981"],
        });
      } catch {}
    }

    lucide.createIcons();
  }

  /* ==========================================================================
     Settings
     ========================================================================== */
  function renderSettingsModalState() {
    const authData = getAuth();

    if (authData) {
      el.dropboxStatusBox.innerHTML = `
        <div style="color: #15803d; font-weight: 700;">✅ Dropbox 接続中</div>
        <div>アプリフォルダ（${DROPBOX_FILE_PATH}）と自動同期しています。</div>
      `;
      el.btnDropboxConnect.style.display = "none";
      el.btnDropboxLogout.style.display = "inline-flex";
      el.btnDropboxSyncNow.style.display = "inline-flex";
    } else {
      el.dropboxStatusBox.innerHTML = `
        <div style="color: #c2410c; font-weight: 700;">⚠️ Dropbox 未接続</div>
        <div>お店のデータを保存するには Dropbox と連携してください。</div>
      `;
      el.btnDropboxConnect.style.display = "inline-flex";
      el.btnDropboxLogout.style.display = "none";
      el.btnDropboxSyncNow.style.display = "none";
    }
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  function exportJson() {
    const dataStr = JSON.stringify(state.data, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `lunchdeck-${d}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("ダウンロードしました");
  }

  function importJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (!imported || !Array.isArray(imported.restaurants)) throw new Error("不正な形式");
        state.data = imported;
        ensureTagGroups();
        pruneUnusedTags();
        scheduleSave();
        render();
        closeModal(el.modalSettings);
        showToast("データを復元しました");
      } catch (err) {
        showToast("読み込み失敗");
      }
    };
    reader.readAsText(file);
  }

  /* ==========================================================================
     Toast & Modal Utilities
     ========================================================================== */
  function showToast(message, options = {}) {
    const toast = document.createElement("div");
    toast.className = "toast";

    const msgSpan = document.createElement("span");
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    if (options.actionText && options.onAction) {
      const actionBtn = document.createElement("button");
      actionBtn.className = "toast-action";
      actionBtn.textContent = options.actionText;
      actionBtn.addEventListener("click", () => {
        options.onAction();
        toast.remove();
      });
      toast.appendChild(actionBtn);
    }

    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "all 0.15s ease";
      setTimeout(() => toast.remove(), 150);
    }, options.duration || 3000);
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.style.display = "none";
    if (modal === el.modalRestaurant) {
      state.formTags.clear();
      pruneUnusedTags();
    }
    if (rouletteTimer) clearTimeout(rouletteTimer);
  }

  /* ==========================================================================
     Event Listeners
     ========================================================================== */
  function setupEventListeners() {
    // Search
    el.searchInput.addEventListener("input", (e) => {
      state.filter.search = e.target.value;
      el.btnClearSearch.style.display = e.target.value ? "flex" : "none";
      render();
    });

    el.btnClearSearch.addEventListener("click", () => {
      el.searchInput.value = "";
      state.filter.search = "";
      el.btnClearSearch.style.display = "none";
      render();
    });

    // Sort
    el.sortSelect.addEventListener("change", (e) => {
      state.filter.sort = e.target.value;
      state.randomSeed = Math.random();
      render();
    });

    // Reshuffle
    el.btnReshuffle.addEventListener("click", () => {
      state.randomSeed = Math.random();
      render();
      showToast("シャッフルしました");
    });

    // Dynamic Filter Chips (状態)
    el.dynamicChips.forEach((btn) => {
      btn.addEventListener("click", () => {
        const filterType = btn.getAttribute("data-filter");
        if (state.filter.dynamic === filterType) {
          state.filter.dynamic = null;
          btn.classList.remove("active");
        } else {
          state.filter.dynamic = filterType;
          el.dynamicChips.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
        }
        render();
      });
    });

    // Tag Group Chips (Filter toggle)
    const handleTagClick = (e) => {
      const btn = e.target.closest("[data-tag]");
      if (!btn) return;
      const tag = btn.getAttribute("data-tag");
      if (state.filter.tags.has(tag)) {
        state.filter.tags.delete(tag);
      } else {
        state.filter.tags.add(tag);
      }
      render();
    };

    el.groupGenreChips.addEventListener("click", handleTagClick);
    el.groupTimeChips.addEventListener("click", handleTagClick);
    el.groupAreaChips.addEventListener("click", handleTagClick);
    el.groupOtherChips.addEventListener("click", handleTagClick);

    // Clear Tags & Dynamic Filter
    el.btnClearTags.addEventListener("click", () => {
      state.filter.tags.clear();
      state.filter.dynamic = null;
      el.dynamicChips.forEach((b) => b.classList.remove("active"));
      render();
    });

    // Empty state buttons
    el.btnEmptyClear.addEventListener("click", () => {
      state.filter.search = "";
      state.filter.dynamic = null;
      state.filter.tags.clear();
      el.searchInput.value = "";
      el.btnClearSearch.style.display = "none";
      el.dynamicChips.forEach((b) => b.classList.remove("active"));
      render();
    });

    el.btnEmptyAdd.addEventListener("click", () => openRestaurantModal());
    if (el.btnEmptyConnect) el.btnEmptyConnect.addEventListener("click", connectDropbox);

    // Restaurant List Actions (Went & Edit)
    el.restaurantGrid.addEventListener("click", (e) => {
      const visitBtn = e.target.closest("[data-visit-id]");
      if (visitBtn) {
        const id = visitBtn.getAttribute("data-visit-id");
        recordVisit(id);
        return;
      }

      const editBtn = e.target.closest(".btn-edit-restaurant");
      if (editBtn) {
        const id = editBtn.getAttribute("data-id");
        openRestaurantModal(id);
        return;
      }
    });

    // Pick One Decider
    el.btnPickOne.addEventListener("click", startRoulette);

    // Roulette Accept & Retry
    el.btnRouletteAccept.addEventListener("click", () => {
      if (rouletteCandidate) {
        recordVisit(rouletteCandidate.id);
        closeModal(el.modalRoulette);
      }
    });

    el.btnRouletteRetry.addEventListener("click", startRoulette);

    // Header buttons
    el.btnAddRestaurant.addEventListener("click", () => openRestaurantModal());
    el.btnSettings.addEventListener("click", () => {
      renderSettingsModalState();
      el.modalSettings.style.display = "flex";
      lucide.createIcons();
    });

    // Modal close
    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        closeModal(e.target.closest(".modal-backdrop"));
      });
    });

    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) closeModal(backdrop);
      });
    });

    // Restaurant Form Submit
    el.formRestaurant.addEventListener("submit", saveRestaurantFromForm);

    // Modal Preset Chip toggle
    const handleFormToggleTag = (e) => {
      const btn = e.target.closest("[data-form-toggle-tag]");
      if (!btn) return;
      const tag = btn.getAttribute("data-form-toggle-tag");
      if (state.formTags.has(tag)) {
        state.formTags.delete(tag);
        btn.classList.remove("active");
      } else {
        state.formTags.add(tag);
        btn.classList.add("active");
      }
    };

    el.formGenreChips.addEventListener("click", handleFormToggleTag);
    el.formTimeChips.addEventListener("click", handleFormToggleTag);
    el.formAreaChips.addEventListener("click", handleFormToggleTag);

    // Prevent premature form submit during IME conversion on restaurant name
    let restaurantNameIsComposing = false;
    let restaurantNameJustEnded = false;

    el.restaurantName.addEventListener("compositionstart", () => {
      restaurantNameIsComposing = true;
      restaurantNameJustEnded = false;
    });

    el.restaurantName.addEventListener("compositionend", () => {
      restaurantNameIsComposing = false;
      restaurantNameJustEnded = true;
      setTimeout(() => {
        restaurantNameJustEnded = false;
      }, 60);
    });

    el.restaurantName.addEventListener("keydown", (e) => {
      if (
        e.key === "Enter" &&
        (e.isComposing || e.keyCode === 229 || restaurantNameIsComposing || restaurantNameJustEnded)
      ) {
        e.preventDefault();
      }
    });

    // Inline input helpers for adding tags to specific groups
    const setupInlineTagInput = (inputEl, groupId) => {
      let isComposing = false;
      let justEndedComposition = false;

      inputEl.addEventListener("compositionstart", () => {
        isComposing = true;
        justEndedComposition = false;
      });

      inputEl.addEventListener("compositionend", () => {
        isComposing = false;
        justEndedComposition = true;
        setTimeout(() => {
          justEndedComposition = false;
        }, 60);
      });

      inputEl.addEventListener("keydown", (e) => {
        // Ignore Enter while IME conversion is in progress or just confirmed
        if (e.isComposing || e.keyCode === 229 || isComposing || justEndedComposition) {
          return;
        }

        if (e.key === "Enter" || e.key === ",") {
          e.preventDefault();
          const val = inputEl.value.trim().replace(/^,+|,+$/g, "");
          if (val) {
            addTagToGroup(groupId, val);
            inputEl.value = "";
          }
        }
      });
    };

    setupInlineTagInput(el.inputAddGenre, "genre");
    setupInlineTagInput(el.inputAddTime, "time");
    setupInlineTagInput(el.inputAddArea, "area");

    // Delete Restaurant
    el.btnDeleteRestaurant.addEventListener("click", () => {
      const id = el.restaurantId.value;
      if (id) deleteRestaurant(id);
    });

    // History Add & Delete
    el.btnAddManualVisit.addEventListener("click", () => {
      const id = el.restaurantId.value;
      const r = (state.data.restaurants || []).find((x) => x.id === id);
      if (!r) return;

      const dateStr = prompt("日付を入力 (例: 2026-10-15):");
      if (!dateStr) return;

      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) {
        alert("日時の形式が正しくありません");
        return;
      }

      if (!r.visits) r.visits = [];
      r.visits.push(parsed.toISOString());
      r.updatedAt = new Date().toISOString();
      renderHistoryList(r);
    });

    el.historyList.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-visit-index]");
      if (!btn) return;
      const timestamp = btn.getAttribute("data-timestamp");
      const id = el.restaurantId.value;
      const r = (state.data.restaurants || []).find((x) => x.id === id);
      if (!r || !r.visits) return;

      const idx = r.visits.indexOf(timestamp);
      if (idx !== -1) {
        r.visits.splice(idx, 1);
        r.updatedAt = new Date().toISOString();
        renderHistoryList(r);
      }
    });

    // Settings actions
    el.btnDropboxConnect.addEventListener("click", connectDropbox);
    el.btnDropboxLogout.addEventListener("click", () => {
      if (confirm("Dropbox連携を解除しますか？")) {
        setAuth(null);
        localStorage.removeItem(STORAGE.cache);
        state.data.restaurants = [];
        state.rev = null;
        render();
        updateSyncStatusUI();
        showToast("ログアウトしました");
      }
    });

    el.btnDropboxSyncNow.addEventListener("click", async () => {
      await syncFromDropbox();
      render();
      showToast("同期完了");
    });

    el.btnExportJson.addEventListener("click", exportJson);
    el.fileImportJson.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) importJson(file);
      e.target.value = "";
    });
  }

  /* ==========================================================================
     Initialization
     ========================================================================== */
  async function init() {
    if (!configured()) {
      showConfigError();
      return;
    }

    setupEventListeners();

    const returnedFromOAuth = await finishOAuth();
    if (returnedFromOAuth || getAuth()) {
      const cached = localStorage.getItem(STORAGE.cache);
      if (cached) {
        try {
          state.data = JSON.parse(cached);
          ensureTagGroups();
          pruneUnusedTags();
        } catch {}
      }
      await syncFromDropbox();
    } else {
      updateSyncStatusUI();
    }

    pruneUnusedTags();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
