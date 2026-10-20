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
    activeManagerTab: "genre",
    renamingTag: null,
    collapsedGroups: new Set(JSON.parse(localStorage.getItem("lunchdeck.collapsed_groups") || "[]")),
  };

  /* ==========================================================================
     DOM Elements
     ========================================================================== */
  const el = {
    syncStatus: document.getElementById("sync-status"),
    btnReload: document.getElementById("btn-reload"),
    btnSettings: document.getElementById("btn-settings"),
    btnAddRestaurant: document.getElementById("btn-add-restaurant"),
    btnPickOne: document.getElementById("btn-pick-one"),
    btnPickElimination: document.getElementById("btn-pick-elimination"),
    btnPickTournament: document.getElementById("btn-pick-tournament"),
    searchInput: document.getElementById("search-input"),
    btnClearSearch: document.getElementById("btn-clear-search"),
    sortSelect: document.getElementById("sort-select"),
    btnReshuffle: document.getElementById("btn-reshuffle"),
    dynamicChips: document.querySelectorAll(".chip-quick"),
    btnManageTags: document.getElementById("btn-manage-tags"),
    btnClearTags: document.getElementById("btn-clear-tags"),
    // Grouped tag chip containers & inline selected chips
    groupGenreRow: document.getElementById("group-genre-row"),
    groupGenreChips: document.getElementById("group-genre-chips"),
    groupTimeRow: document.getElementById("group-time-row"),
    groupTimeChips: document.getElementById("group-time-chips"),
    groupAreaRow: document.getElementById("group-area-row"),
    groupAreaChips: document.getElementById("group-area-chips"),
    groupOtherRow: document.getElementById("group-other-row"),
    groupOtherChips: document.getElementById("group-other-chips"),
    selectedStateChips: document.getElementById("selected-state-chips"),
    selectedGenreChips: document.getElementById("selected-genre-chips"),
    selectedTimeChips: document.getElementById("selected-time-chips"),
    selectedAreaChips: document.getElementById("selected-area-chips"),
    selectedOtherChips: document.getElementById("selected-other-chips"),
    // Restaurant list & empty
    restaurantGrid: document.getElementById("restaurant-grid"),
    emptyState: document.getElementById("empty-state"),
    emptyTitle: document.getElementById("empty-title"),
    btnEmptyClear: document.getElementById("btn-empty-clear"),
    btnEmptyAdd: document.getElementById("btn-empty-add"),
    btnEmptyAiImport: document.getElementById("btn-empty-ai-import"),
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
    // Elimination Modal
    modalElimination: document.getElementById("modal-elimination"),
    eliminationStepBadge: document.getElementById("elimination-step-badge"),
    eliminationModalTitle: document.getElementById("elimination-modal-title"),
    eliminationActiveView: document.getElementById("elimination-active-view"),
    eliminationInstruction: document.getElementById("elimination-instruction"),
    eliminationCounter: document.getElementById("elimination-counter"),
    eliminationCardsGrid: document.getElementById("elimination-cards-grid"),
    btnEliminationNext: document.getElementById("btn-elimination-next"),
    eliminationWinnerView: document.getElementById("elimination-winner-view"),
    eliminationWinnerName: document.getElementById("elimination-winner-name"),
    eliminationWinnerTags: document.getElementById("elimination-winner-tags"),
    eliminationWinnerMeta: document.getElementById("elimination-winner-meta"),
    btnEliminationAccept: document.getElementById("btn-elimination-accept"),
    btnEliminationRetry: document.getElementById("btn-elimination-retry"),
    // Tournament Modal
    modalTournament: document.getElementById("modal-tournament"),
    tournamentStepBadge: document.getElementById("tournament-step-badge"),
    tournamentModalTitle: document.getElementById("tournament-modal-title"),
    tournamentActiveView: document.getElementById("tournament-active-view"),
    tournamentInstruction: document.getElementById("tournament-instruction"),
    tournamentCounter: document.getElementById("tournament-counter"),
    tournamentCardA: document.getElementById("tournament-card-a"),
    tournamentContentA: document.getElementById("tournament-content-a"),
    tournamentCardB: document.getElementById("tournament-card-b"),
    tournamentContentB: document.getElementById("tournament-content-b"),
    tournamentWinnerView: document.getElementById("tournament-winner-view"),
    tournamentWinnerName: document.getElementById("tournament-winner-name"),
    tournamentWinnerTags: document.getElementById("tournament-winner-tags"),
    tournamentWinnerMeta: document.getElementById("tournament-winner-meta"),
    btnTournamentAccept: document.getElementById("btn-tournament-accept"),
    btnTournamentRetry: document.getElementById("btn-tournament-retry"),
    // Settings Modal
    modalSettings: document.getElementById("modal-settings"),
    btnOpenAiImport: document.getElementById("btn-open-ai-import"),
    btnOpenTagsManager: document.getElementById("btn-open-tags-manager"),
    dropboxStatusBox: document.getElementById("dropbox-status-box"),
    btnDropboxConnect: document.getElementById("btn-dropbox-connect"),
    btnDropboxLogout: document.getElementById("btn-dropbox-logout"),
    btnDropboxSyncNow: document.getElementById("btn-dropbox-sync-now"),
    btnExportJson: document.getElementById("btn-export-json"),
    fileImportJson: document.getElementById("file-import-json"),
    // AI Import Modal
    modalAiImport: document.getElementById("modal-ai-import"),
    inputAiBaseLocation: document.getElementById("input-ai-base-location"),
    selectAiRadius: document.getElementById("select-ai-radius"),
    inputAiPreferences: document.getElementById("input-ai-preferences"),
    btnCopyAiPrompt: document.getElementById("btn-copy-ai-prompt"),
    textareaAiPromptPreview: document.getElementById("textarea-ai-prompt-preview"),
    textareaAiResult: document.getElementById("textarea-ai-result"),
    btnSubmitAiImport: document.getElementById("btn-submit-ai-import"),
    // Tag Manager Modal
    modalTagsManager: document.getElementById("modal-tags-manager"),
    btnPurgeUnusedTags: document.getElementById("btn-purge-unused-tags"),
    countUnusedTags: document.getElementById("count-unused-tags"),
    tabCountGenre: document.getElementById("tab-count-genre"),
    tabCountTime: document.getElementById("tab-count-time"),
    tabCountArea: document.getElementById("tab-count-area"),
    tagsManagerList: document.getElementById("tags-manager-list"),
    inputManagerAddTag: document.getElementById("input-manager-add-tag"),
    btnManagerAddTag: document.getElementById("btn-manager-add-tag"),
    toastContainer: document.getElementById("toast-container"),
  };

  /* ==========================================================================
     Tag Management & Categorization
     ========================================================================== */
  function deduplicateTagGroups(groups) {
    if (!Array.isArray(groups)) return;
    const genreGroup = groups.find((g) => g.id === "genre");
    const timeGroup = groups.find((g) => g.id === "time");
    const areaGroup = groups.find((g) => g.id === "area");

    // Clean and deduplicate within each group
    if (areaGroup && Array.isArray(areaGroup.tags)) {
      areaGroup.tags = Array.from(new Set(areaGroup.tags.map((t) => (t || "").trim()).filter(Boolean)));
    }
    if (timeGroup && Array.isArray(timeGroup.tags)) {
      timeGroup.tags = Array.from(new Set(timeGroup.tags.map((t) => (t || "").trim()).filter(Boolean)));
    }
    if (genreGroup && Array.isArray(genreGroup.tags)) {
      genreGroup.tags = Array.from(new Set(genreGroup.tags.map((t) => (t || "").trim()).filter(Boolean)));
    }

    const areaTags = new Set(areaGroup?.tags || []);
    const timeTags = new Set(timeGroup?.tags || []);

    // 1. Time group must not contain tags that belong to Area
    if (timeGroup && Array.isArray(timeGroup.tags)) {
      timeGroup.tags = timeGroup.tags.filter((t) => !areaTags.has(t));
    }

    // 2. Genre group must not contain tags that belong to Area or Time
    if (genreGroup && Array.isArray(genreGroup.tags)) {
      const nonGenreTags = new Set([...areaTags, ...(timeGroup?.tags || [])]);
      genreGroup.tags = genreGroup.tags.filter((t) => !nonGenreTags.has(t));
    }
  }

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

    // Clean up any cross-group duplication
    deduplicateTagGroups(state.data.tagGroups);
  }

  function pruneUnusedTags() {
    ensureTagGroups();
  }

  // Lookup the group ID where the user explicitly registered this tag. Zero heuristic guessing.
  function getTagCategory(tag, customGroups = null) {
    const groups = customGroups || state.data?.tagGroups;
    if (groups && Array.isArray(groups)) {
      for (const group of groups) {
        if (group.tags && group.tags.includes(tag)) {
          return group.id;
        }
      }
    }
    return null;
  }

  function registerTagInGroup(groupId, newTag) {
    const tag = (newTag || "").trim();
    if (!tag) return;

    ensureTagGroups();

    // Enforce uniqueness across all groups: remove from other groups
    for (const g of state.data.tagGroups) {
      if (g.id !== groupId && Array.isArray(g.tags)) {
        g.tags = g.tags.filter((t) => t !== tag);
      }
    }

    let group = state.data.tagGroups.find((g) => g.id === groupId);
    if (!group) {
      group = { id: groupId, name: groupId, tags: [] };
      state.data.tagGroups.push(group);
    }

    if (!group.tags.includes(tag)) {
      group.tags.push(tag);
    }
  }

  function addTagToGroup(groupId, newTag) {
    registerTagInGroup(groupId, newTag);
    const tag = (newTag || "").trim();
    if (tag) {
      state.formTags.add(tag);
      renderFormPresetChips();
    }
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
     Multi-Device Data Merge & Concurrency Handling
     ========================================================================== */
  function mergeDatasets(localData, remoteData) {
    if (!remoteData || !Array.isArray(remoteData.restaurants)) return localData;
    if (!localData || !Array.isArray(localData.restaurants)) return remoteData;

    // 1. Merge Restaurants (Union of restaurants, visits, and tags - never lose data)
    const mergedRestaurantsMap = new Map();

    // Start with remote restaurants
    for (const r of remoteData.restaurants) {
      if (r && r.id) {
        mergedRestaurantsMap.set(r.id, JSON.parse(JSON.stringify(r)));
      }
    }

    // Merge local restaurants
    for (const localR of localData.restaurants) {
      if (!localR || !localR.id) continue;
      const remoteR = mergedRestaurantsMap.get(localR.id);
      if (!remoteR) {
        // Exists in local only: KEEP IT
        mergedRestaurantsMap.set(localR.id, JSON.parse(JSON.stringify(localR)));
      } else {
        // Exists in both: merge visits and tags
        const localTime = new Date(localR.updatedAt || 0).getTime();
        const remoteTime = new Date(remoteR.updatedAt || 0).getTime();
        const newerR = localTime >= remoteTime ? localR : remoteR;

        // Union of visits
        const visitsSet = new Set([...(localR.visits || []), ...(remoteR.visits || [])]);
        const mergedVisits = Array.from(visitsSet).sort((a, b) => new Date(b) - new Date(a));

        // Union of tags
        const tagsSet = new Set([...(localR.tags || []), ...(remoteR.tags || [])]);
        const mergedTags = Array.from(tagsSet);

        const mergedR = {
          ...newerR,
          name: newerR.name || localR.name || remoteR.name,
          visits: mergedVisits,
          tags: mergedTags,
          updatedAt: new Date(Math.max(localTime, remoteTime, Date.now())).toISOString(),
        };
        mergedRestaurantsMap.set(localR.id, mergedR);
      }
    }

    // 2. Merge Tag Groups
    const localGroups = localData.tagGroups || DEFAULT_TAG_GROUPS;
    const remoteGroups = remoteData.tagGroups || DEFAULT_TAG_GROUPS;
    const mergedTagGroups = [];

    const allGroupIds = ["genre", "time", "area"];
    for (const gid of allGroupIds) {
      const lg = localGroups.find((g) => g.id === gid) || { tags: [] };
      const rg = remoteGroups.find((g) => g.id === gid) || { tags: [] };
      const name = lg.name || rg.name || gid;

      const combined = [...(lg.tags || [])];
      for (const t of rg.tags || []) {
        if (!combined.includes(t)) {
          combined.push(t);
        }
      }
      mergedTagGroups.push({ id: gid, name, tags: combined });
    }

    // Deduplicate any cross-group duplication in merged groups
    deduplicateTagGroups(mergedTagGroups);

    const mergedRestaurants = Array.from(mergedRestaurantsMap.values());

    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      tagGroups: mergedTagGroups,
      restaurants: mergedRestaurants,
    };
  }

  /* ==========================================================================
     Data Management
     ========================================================================== */
  async function syncFromDropbox(manual = false, silent = false) {
    const authToken = await token();
    if (!authToken) {
      if (manual) {
        showToast("先に Dropbox と連携してください");
        connectDropbox();
      }
      return;
    }

    if (!silent) setSyncingUI(true);
    try {
      const res = await dbx("files/download", { path: DROPBOX_FILE_PATH });
      if (res && res.content) {
        const cloudData = JSON.parse(res.content);
        if (cloudData && Array.isArray(cloudData.restaurants)) {
          const isDifferentRev = state.rev !== (res.metadata?.rev || null);
          if (manual || isDifferentRev) {
            state.data = mergeDatasets(state.data, cloudData);
            state.rev = res.metadata?.rev || null;
            ensureTagGroups();
            localStorage.setItem(STORAGE.cache, JSON.stringify(state.data));
            render();
            if (manual) {
              showToast("最新データに同期しました");
            } else if (isDifferentRev && !silent) {
              showToast("他端末の更新を反映しました");
            }
          } else if (manual) {
            showToast("データは最新です");
          }
        }
      }
      if (!silent) setSyncingUI(false);
    } catch (err) {
      if (err.status === 409 || err.tag?.includes("not_found")) {
        await saveToDropbox();
        if (!silent) setSyncingUI(false);
      } else {
        console.error(err);
        if (!silent) {
          setSyncingUI(false, true);
          showToast("Dropbox読み込み失敗");
        }
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
        // Concurrency conflict! Merge remote and local data
        try {
          const res = await dbx("files/download", { path: DROPBOX_FILE_PATH });
          if (res && res.content) {
            const remoteData = JSON.parse(res.content);
            state.data = mergeDatasets(state.data, remoteData);
            state.rev = res.metadata?.rev || null;
            ensureTagGroups();
            render();

            const mergedContent = JSON.stringify(state.data, null, 2);
            const retryArgs = {
              path: DROPBOX_FILE_PATH,
              mode: state.rev ? { ".tag": "update", update: state.rev } : "overwrite",
              autorename: false,
              mute: true,
            };
            const meta = await dbx("files/upload", retryArgs, mergedContent);
            state.rev = meta.rev;
            localStorage.setItem(STORAGE.cache, mergedContent);
            setSyncingUI(false);
            showToast("他端末の更新と自動マージしました");
            return;
          }
        } catch (mergeErr) {
          console.error("Conflict merge failed:", mergeErr);
        }
        setSyncingUI(false, true);
        showToast("競合が発生しました。再読み込みしてください");
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

    // 3. Tags filter: OR within the same group, AND across different groups
    if (state.filter.tags.size > 0) {
      const activeGroups = new Map();
      for (const tag of state.filter.tags) {
        const cat = getTagCategory(tag) || "other";
        if (!activeGroups.has(cat)) {
          activeGroups.set(cat, []);
        }
        activeGroups.get(cat).push(tag);
      }

      list = list.filter((r) => {
        const rTags = new Set(r.tags || []);
        // Inter-group AND: must satisfy every selected tag group
        for (const tagsInGroup of activeGroups.values()) {
          // Intra-group OR: must match at least one tag in this group
          if (!tagsInGroup.some((t) => rTags.has(t))) {
            return false;
          }
        }
        return true;
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

    // Respect user-configured ordering
    const genreTags = (genreGroup.tags || []).filter((t) => usedTags.has(t));
    const timeTags = (timeGroup.tags || []).filter((t) => usedTags.has(t));
    const areaTags = (areaGroup.tags || []).filter((t) => usedTags.has(t));

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

    // When collapsed, render only selected tags next to group name
    const makeSelectedChips = (tags) => {
      const activeTags = tags.filter((t) => state.filter.tags.has(t));
      return makeChips(activeTags);
    };

    if (el.selectedGenreChips) {
      el.selectedGenreChips.innerHTML = makeSelectedChips(genreTags);
      el.selectedGenreChips.style.display = el.selectedGenreChips.innerHTML ? "flex" : "none";
    }
    if (el.selectedTimeChips) {
      el.selectedTimeChips.innerHTML = makeSelectedChips(timeTags);
      el.selectedTimeChips.style.display = el.selectedTimeChips.innerHTML ? "flex" : "none";
    }
    if (el.selectedAreaChips) {
      el.selectedAreaChips.innerHTML = makeSelectedChips(areaTags);
      el.selectedAreaChips.style.display = el.selectedAreaChips.innerHTML ? "flex" : "none";
    }
    if (el.selectedOtherChips) {
      el.selectedOtherChips.innerHTML = makeSelectedChips(otherTags);
      el.selectedOtherChips.style.display = el.selectedOtherChips.innerHTML ? "flex" : "none";
    }

    if (el.selectedStateChips) {
      if (state.filter.dynamic) {
        const labels = {
          unvisited: "🌱 未訪問",
          neglected: "⏳ ご無沙汰",
          recent: "🕒 最近",
          frequent: "⭐️ 定番",
        };
        const label = labels[state.filter.dynamic] || state.filter.dynamic;
        el.selectedStateChips.innerHTML = `
          <button type="button" class="chip chip-quick active" data-filter="${escapeHtml(state.filter.dynamic)}">
            ${escapeHtml(label)}
          </button>
        `;
        el.selectedStateChips.style.display = "flex";
      } else {
        el.selectedStateChips.innerHTML = "";
        el.selectedStateChips.style.display = "none";
      }
    }

    // Update collapsed class on group rows
    const updateGroupCollapsed = (rowEl, groupId) => {
      if (rowEl) {
        const isCollapsed = state.collapsedGroups.has(groupId);
        rowEl.classList.toggle("collapsed", isCollapsed);
      }
    };

    updateGroupCollapsed(document.getElementById("group-state-row"), "state");
    updateGroupCollapsed(el.groupGenreRow, "genre");
    updateGroupCollapsed(el.groupTimeRow, "time");
    updateGroupCollapsed(el.groupAreaRow, "area");
    updateGroupCollapsed(el.groupOtherRow, "other");

    // Update active class on static dynamic chips in state row
    el.dynamicChips.forEach((btn) => {
      const filterType = btn.getAttribute("data-filter");
      btn.classList.toggle("active", state.filter.dynamic === filterType);
    });

    const hasActive = state.filter.tags.size > 0 || state.filter.dynamic !== null;
    el.btnClearTags.style.display = hasActive ? "inline-block" : "none";
  }

  // Render ultra-simple restaurant list (Name + Meta + Went / Edit)
  function renderRestaurantList() {
    const filtered = getFilteredRestaurants();
    const total = state.data.restaurants?.length || 0;

    const isShuffleSort = state.filter.sort === "smart" || state.filter.sort === "random";
    el.btnReshuffle.style.display = isShuffleSort ? "inline-flex" : "none";
    const hasFiltered = filtered.length > 0;
    el.btnPickOne.disabled = !hasFiltered;
    if (el.btnPickElimination) el.btnPickElimination.disabled = !hasFiltered;
    if (el.btnPickTournament) el.btnPickTournament.disabled = !hasFiltered;

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
        if (el.btnEmptyAiImport) el.btnEmptyAiImport.style.display = "none";
        if (el.btnEmptyConnect) el.btnEmptyConnect.style.display = "inline-flex";
      } else {
        if (el.emptyDesc) el.emptyDesc.style.display = "none";
        if (el.btnEmptyConnect) el.btnEmptyConnect.style.display = "none";

        if (total === 0) {
          el.emptyTitle.textContent = "まだお店がありません";
          el.btnEmptyAdd.style.display = "inline-flex";
          if (el.btnEmptyAiImport) el.btnEmptyAiImport.style.display = "inline-flex";
          el.btnEmptyClear.style.display = "none";
        } else {
          el.emptyTitle.textContent = "一致するお店がありません";
          el.btnEmptyAdd.style.display = "none";
          if (el.btnEmptyAiImport) el.btnEmptyAiImport.style.display = "none";
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

    if (el.inputAddGenre) el.inputAddGenre.value = "";
    if (el.inputAddTime) el.inputAddTime.value = "";
    if (el.inputAddArea) el.inputAddArea.value = "";

    renderFormPresetChips();
    el.modalRestaurant.style.display = "flex";
    el.restaurantName.focus();
    lucide.createIcons();
  }

  // Render preset chips inside modal by category in configured order
  function renderFormPresetChips() {
    ensureTagGroups();

    const renderGroup = (container, groupTags, groupId) => {
      const tagsInGroup = [...(groupTags || [])];
      state.formTags.forEach((t) => {
        if (getTagCategory(t) === groupId && !tagsInGroup.includes(t)) {
          tagsInGroup.push(t);
        }
      });

      container.innerHTML = tagsInGroup
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

    el.inputAddGenre.value = "";
    el.inputAddTime.value = "";
    el.inputAddArea.value = "";

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
     Elimination Decider (消去法で決める)
     ========================================================================== */
  let eliminationState = null;

  function startElimination() {
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

    if (filtered.length === 1) {
      showEliminationWinner(filtered[0]);
      return;
    }

    // Candidate genres from the current filtered restaurants
    const availableGenres = Array.from(
      new Set(
        filtered.flatMap((r) =>
          (r.tags || []).filter((t) => getTagCategory(t) === "genre")
        )
      )
    );

    el.modalElimination.style.display = "flex";
    el.eliminationActiveView.style.display = "flex";
    el.eliminationWinnerView.style.display = "none";

    // If we have 2 or more genre tags, start with Genre Elimination!
    if (availableGenres.length >= 2) {
      eliminationState = {
        phase: "genre",
        allCandidates: uniformShuffle(availableGenres, Math.random()),
        candidateIndex: 0,
        eliminatedInBatch: new Set(),
        survivingInRound: [],
        filteredPool: filtered,
      };
    } else {
      // Skip directly to Restaurant Elimination!
      eliminationState = {
        phase: "restaurant",
        allCandidates: uniformShuffle(filtered, Math.random()),
        candidateIndex: 0,
        eliminatedInBatch: new Set(),
        survivingInRound: [],
        filteredPool: filtered,
      };
    }

    renderEliminationBatch();
  }

  function renderEliminationBatch() {
    if (!eliminationState) return;

    const { phase, allCandidates, candidateIndex } = eliminationState;
    const batchSize = 4;
    const currentBatch = allCandidates.slice(candidateIndex, candidateIndex + batchSize);
    eliminationState.currentBatch = currentBatch;
    eliminationState.eliminatedInBatch = new Set();

    const isGenre = phase === "genre";
    el.eliminationStepBadge.textContent = isGenre ? "STEP 1: ジャンル" : "STEP 2: お店";
    el.eliminationInstruction.textContent = isGenre
      ? "「今回は違うな」というジャンルを除外"
      : "「今回は違うな」というお店を除外";

    const remainingTotal = allCandidates.length - candidateIndex;
    el.eliminationCounter.textContent = `残り ${remainingTotal} 個`;

    el.eliminationCardsGrid.innerHTML = currentBatch
      .map((item, idx) => {
        if (isGenre) {
          const tag = item;
          return `
            <div class="elimination-card" data-elim-idx="${idx}">
              <span class="elimination-badge-status">✕ 除外</span>
              <div class="elimination-card-name">${escapeHtml(tag)}</div>
            </div>
          `;
        } else {
          const restaurant = item;
          const meta = formatCompactMeta(restaurant);
          const tagsStr = (restaurant.tags || []).slice(0, 3).join(" · ");
          return `
            <div class="elimination-card" data-elim-idx="${idx}">
              <span class="elimination-badge-status">✕ 除外</span>
              <div class="elimination-card-name">${escapeHtml(restaurant.name)}</div>
              ${tagsStr ? `<div class="elimination-card-meta">${escapeHtml(tagsStr)}</div>` : ""}
              ${meta.text ? `<div class="elimination-card-meta">${escapeHtml(meta.text)}</div>` : ""}
            </div>
          `;
        }
      })
      .join("");

    updateEliminationNextButtonText();
    lucide.createIcons();
  }

  function updateEliminationNextButtonText() {
    if (!eliminationState) return;
    const count = eliminationState.eliminatedInBatch.size;
    const btnSpan = el.btnEliminationNext.querySelector("span");
    if (btnSpan) {
      if (count === 0) {
        btnSpan.textContent = "すべて残して次へ";
      } else {
        btnSpan.textContent = `${count}個を除外して次へ`;
      }
    }
  }

  function handleEliminationCardClick(idx) {
    if (!eliminationState || !eliminationState.currentBatch) return;
    const item = eliminationState.currentBatch[idx];
    if (!item) return;

    if (eliminationState.eliminatedInBatch.has(item)) {
      eliminationState.eliminatedInBatch.delete(item);
    } else {
      eliminationState.eliminatedInBatch.add(item);
    }

    const card = el.eliminationCardsGrid.querySelector(`[data-elim-idx="${idx}"]`);
    if (card) {
      card.classList.toggle("eliminated", eliminationState.eliminatedInBatch.has(item));
    }
    updateEliminationNextButtonText();
  }

  function handleEliminationNext() {
    if (!eliminationState) return;

    // Filter out eliminated items from currentBatch and add survivors
    const survivors = eliminationState.currentBatch.filter(
      (item) => !eliminationState.eliminatedInBatch.has(item)
    );
    eliminationState.survivingInRound.push(...survivors);

    eliminationState.candidateIndex += 4;

    // If there are more candidates in the current round
    if (eliminationState.candidateIndex < eliminationState.allCandidates.length) {
      renderEliminationBatch();
      return;
    }

    // End of round!
    let roundSurvivors = eliminationState.survivingInRound;

    // Safety: If user eliminated literally everything in the round, restore all
    if (roundSurvivors.length === 0) {
      showToast("すべて除外されたため、全員復活します！");
      roundSurvivors = [...eliminationState.allCandidates];
    }

    if (eliminationState.phase === "genre") {
      // Transition from Genre phase to Restaurant phase
      const survivingGenreSet = new Set(roundSurvivors);
      let matchingRestaurants = eliminationState.filteredPool.filter((r) =>
        (r.tags || []).some((t) => survivingGenreSet.has(t))
      );
      if (matchingRestaurants.length === 0) {
        matchingRestaurants = eliminationState.filteredPool;
      }

      if (matchingRestaurants.length === 1) {
        showEliminationWinner(matchingRestaurants[0]);
        return;
      }

      eliminationState.phase = "restaurant";
      eliminationState.allCandidates = uniformShuffle(matchingRestaurants, Math.random());
      eliminationState.candidateIndex = 0;
      eliminationState.survivingInRound = [];
      renderEliminationBatch();
      return;
    }

    // In Restaurant phase:
    if (roundSurvivors.length === 1) {
      showEliminationWinner(roundSurvivors[0]);
      return;
    }

    // Still > 1 restaurants! Start next reduction round
    eliminationState.allCandidates = uniformShuffle(roundSurvivors, Math.random());
    eliminationState.candidateIndex = 0;
    eliminationState.survivingInRound = [];
    renderEliminationBatch();
  }

  function showEliminationWinner(restaurant) {
    el.modalElimination.style.display = "flex";
    el.eliminationActiveView.style.display = "none";
    el.eliminationWinnerView.style.display = "flex";

    el.eliminationWinnerName.textContent = restaurant.name;
    const meta = formatCompactMeta(restaurant);
    el.eliminationWinnerMeta.textContent = meta.text;

    el.eliminationWinnerTags.innerHTML = (restaurant.tags || [])
      .map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
      .join("");

    if (typeof confetti === "function") {
      try {
        confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
      } catch {}
    }

    el.btnEliminationAccept.onclick = () => {
      recordVisit(restaurant.id);
      closeModal(el.modalElimination);
    };
    el.btnEliminationRetry.onclick = () => {
      startElimination();
    };
    lucide.createIcons();
  }

  /* ==========================================================================
     Tournament Decider (勝ち抜き制で決める)
     ========================================================================== */
  let tournamentState = null;

  function startTournament() {
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

    if (filtered.length === 1) {
      showTournamentWinner(filtered[0]);
      return;
    }

    // Candidate genres from current filtered restaurants
    const availableGenres = uniformShuffle(
      Array.from(
        new Set(
          filtered.flatMap((r) =>
            (r.tags || []).filter((t) => getTagCategory(t) === "genre")
          )
        )
      ),
      Math.random()
    );

    el.modalTournament.style.display = "flex";
    el.tournamentActiveView.style.display = "flex";
    el.tournamentWinnerView.style.display = "none";

    if (availableGenres.length >= 2) {
      tournamentState = {
        phase: "genre",
        champion: availableGenres[0],
        challengers: availableGenres.slice(1),
        challengerIndex: 0,
        totalMatches: availableGenres.length - 1,
        matchNum: 1,
        filteredPool: filtered,
      };
    } else {
      // Skip directly to Restaurant Tournament!
      const shuffledRestaurants = uniformShuffle(filtered, Math.random());
      tournamentState = {
        phase: "restaurant",
        champion: shuffledRestaurants[0],
        challengers: shuffledRestaurants.slice(1),
        challengerIndex: 0,
        totalMatches: shuffledRestaurants.length - 1,
        matchNum: 1,
        filteredPool: filtered,
      };
    }

    renderTournamentMatch();
  }

  function renderTournamentMatch() {
    if (!tournamentState) return;

    const { phase, champion, challengers, challengerIndex, totalMatches, matchNum } = tournamentState;
    const isGenre = phase === "genre";

    el.tournamentStepBadge.textContent = isGenre ? "ジャンル対決" : "お店対決";
    el.tournamentInstruction.textContent = isGenre
      ? "強いて言うならどっちの気分？"
      : "強いて言うならどっちに行きたい？";
    el.tournamentCounter.textContent = `第 ${matchNum} / ${totalMatches} 戦`;

    const challenger = challengers[challengerIndex];

    const renderCardContent = (item) => {
      if (isGenre) {
        return `<div class="tournament-card-title">${escapeHtml(item)}</div>`;
      } else {
        const r = item;
        const meta = formatCompactMeta(r);
        const tagsStr = (r.tags || []).slice(0, 3).join(" · ");
        return `
          <div class="tournament-card-title">${escapeHtml(r.name)}</div>
          ${tagsStr ? `<div class="tournament-card-meta">${escapeHtml(tagsStr)}</div>` : ""}
          ${meta.text ? `<div class="tournament-card-meta">${escapeHtml(meta.text)}</div>` : ""}
        `;
      }
    };

    el.tournamentContentA.innerHTML = renderCardContent(champion);
    el.tournamentContentB.innerHTML = renderCardContent(challenger);

    lucide.createIcons();
  }

  function handleTournamentChoice(chosen) {
    if (!tournamentState) return;

    const challenger = tournamentState.challengers[tournamentState.challengerIndex];
    if (chosen === "B") {
      tournamentState.champion = challenger;
    }

    tournamentState.challengerIndex++;
    tournamentState.matchNum++;

    // More challengers in current phase?
    if (tournamentState.challengerIndex < tournamentState.challengers.length) {
      renderTournamentMatch();
      return;
    }

    // End of phase!
    if (tournamentState.phase === "genre") {
      const winningGenre = tournamentState.champion;
      let matchingRestaurants = tournamentState.filteredPool.filter((r) =>
        (r.tags || []).includes(winningGenre)
      );
      if (matchingRestaurants.length === 0) {
        matchingRestaurants = tournamentState.filteredPool;
      }

      if (matchingRestaurants.length === 1) {
        showTournamentWinner(matchingRestaurants[0]);
        return;
      }

      const shuffledRestaurants = uniformShuffle(matchingRestaurants, Math.random());
      tournamentState.phase = "restaurant";
      tournamentState.champion = shuffledRestaurants[0];
      tournamentState.challengers = shuffledRestaurants.slice(1);
      tournamentState.challengerIndex = 0;
      tournamentState.totalMatches = shuffledRestaurants.length - 1;
      tournamentState.matchNum = 1;

      renderTournamentMatch();
      return;
    }

    // Winner of restaurant tournament!
    showTournamentWinner(tournamentState.champion);
  }

  function showTournamentWinner(restaurant) {
    el.modalTournament.style.display = "flex";
    el.tournamentActiveView.style.display = "none";
    el.tournamentWinnerView.style.display = "flex";

    el.tournamentWinnerName.textContent = restaurant.name;
    const meta = formatCompactMeta(restaurant);
    el.tournamentWinnerMeta.textContent = meta.text;

    el.tournamentWinnerTags.innerHTML = (restaurant.tags || [])
      .map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
      .join("");

    if (typeof confetti === "function") {
      try {
        confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
      } catch {}
    }

    el.btnTournamentAccept.onclick = () => {
      recordVisit(restaurant.id);
      closeModal(el.modalTournament);
    };
    el.btnTournamentRetry.onclick = () => {
      startTournament();
    };
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
     AI Restaurant Generator / Importer
     ========================================================================== */
  function generateAiPrompt(baseLoc, radiusMinutes, preferences) {
    const prefSection = preferences
      ? `\n【希望・こだわり条件】\n${preferences}\n`
      : "";

    return `以下の【基準地点】から【徒歩範囲】にある、ランチ営業を行っている実在の飲食店をできるだけ多く（30〜50店舗以上を目標に）リストアップして、指定のJSON形式で出力してください。

【基準地点】
${baseLoc}

【徒歩範囲】
徒歩${radiusMinutes}分以内${prefSection}
【出力形式の絶対ルール】
1. チャット上のメッセージとして直接コピー＆ペーストできるよう、全体を単一の \`\`\`json ... \`\`\` コードブロックのみで出力してください。
2. 会話文、挨拶、前置き、末尾のまとめ、注釈などは一切出力しないでください（コードブロックのみを出力してください）。
3. ファイルのダウンロードリンクや、Canvas / Artifacts などの独立UI機能は使わず、チャット本文中に直接テキストとしてコードブロックを出力してください。
4. 架空の店舗は含めず、実際にランチ営業をしている実在の店舗のみを挙げてください。
5. 各店舗の情報は以下のJSON配列形式にしてください。

\`\`\`json
[
  {
    "name": "店舗名（正確な店名）",
    "genre": "代表的なジャンル（例: ラーメン, カレー, 和食, 定食, 中華, イタリアン, カフェ, そば, 焼肉, うどん 等から1つ）",
    "time_walk": 5,
    "area": "方角やエリア名（例: 東口, 西口, 南口, 宮益坂, 道玄坂, 駅直結 等から簡潔に）"
  }
]
\`\`\`

【各項目の詳細ルール】
・name: 実在する飲食店の正確な名称（支店名がある場合は「〇〇 渋谷店」のように明記）
・genre: 料理のジャンル（1店舗につき1つの簡潔な単語）
・time_walk: 基準地点からの推定徒歩分数（「分」などの単位は含めず、半角数値の整数のみ。例: 3, 5, 8, 10）
・area: 基準地点から見た方角や通りの名前など、大まかな位置がわかる短い単語（例: 東口、西口、〇〇通り）`;
  }

  function updateAiPromptPreview() {
    if (!el.textareaAiPromptPreview) return;
    const baseLoc = (el.inputAiBaseLocation?.value || "").trim() || "（基準地点を入力）";
    const radius = el.selectAiRadius?.value || "10";
    const preferences = (el.inputAiPreferences?.value || "").trim();
    el.textareaAiPromptPreview.value = generateAiPrompt(baseLoc, radius, preferences);
  }

  async function copyAiPrompt() {
    const baseLoc = (el.inputAiBaseLocation?.value || "").trim();
    if (!baseLoc) {
      showToast("基準となる場所を入力してください");
      el.inputAiBaseLocation?.focus();
      return;
    }
    const radius = el.selectAiRadius?.value || "10";
    const preferences = (el.inputAiPreferences?.value || "").trim();
    const promptText = generateAiPrompt(baseLoc, radius, preferences);

    localStorage.setItem("lunchdeck.ai_base_location", baseLoc);

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(promptText);
      } else {
        const ta = document.createElement("textarea");
        ta.value = promptText;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      showToast("プロンプトをコピーしました！AIに貼り付けてください");

      if (el.btnCopyAiPrompt) {
        const origHtml = el.btnCopyAiPrompt.innerHTML;
        el.btnCopyAiPrompt.innerHTML = '<i data-lucide="check"></i> <span>コピー完了！</span>';
        if (window.lucide && typeof window.lucide.createIcons === "function") {
          window.lucide.createIcons();
        }
        setTimeout(() => {
          el.btnCopyAiPrompt.innerHTML = origHtml;
          if (window.lucide && typeof window.lucide.createIcons === "function") {
            window.lucide.createIcons();
          }
        }, 2500);
      }
    } catch (err) {
      console.error("Clipboard copy failed", err);
      showToast("クリップボードへのコピーに失敗しました");
    }
  }

  function openAiImportModal() {
    if (!getAuth()) {
      showToast("先に Dropbox と連携してください");
      connectDropbox();
      return;
    }
    const savedBaseLoc = localStorage.getItem("lunchdeck.ai_base_location") || "";
    if (savedBaseLoc && el.inputAiBaseLocation && !el.inputAiBaseLocation.value) {
      el.inputAiBaseLocation.value = savedBaseLoc;
    }
    updateAiPromptPreview();
    el.modalAiImport.style.display = "flex";
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  function handleAiImport() {
    const rawText = (el.textareaAiResult?.value || "").trim();
    if (!rawText) {
      showToast("AIの返答テキストを貼り付けてください");
      el.textareaAiResult?.focus();
      return;
    }

    // 1. Sanitize & extract JSON content
    let textToParse = rawText;

    // Check markdown code blocks: ```json ... ``` or ``` ... ```
    const codeBlockMatch = textToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      textToParse = codeBlockMatch[1].trim();
    }

    // Find array [ ... ] or object { ... }
    const firstBracket = textToParse.indexOf("[");
    const lastBracket = textToParse.lastIndexOf("]");

    let items = null;

    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      let arrayJson = textToParse.substring(firstBracket, lastBracket + 1);
      // Clean trailing commas before closing brackets or braces
      arrayJson = arrayJson.replace(/,\s*([}\]])/g, "$1");
      try {
        const parsed = JSON.parse(arrayJson);
        if (Array.isArray(parsed)) {
          items = parsed;
        }
      } catch (err) {
        console.warn("Array parse failed, fallback to full parse", err);
      }
    }

    if (!items) {
      try {
        let sanitized = textToParse.replace(/,\s*([}\]])/g, "$1");
        const parsed = JSON.parse(sanitized);
        if (Array.isArray(parsed)) {
          items = parsed;
        } else if (parsed && typeof parsed === "object") {
          const potentialArray = parsed.restaurants || parsed.stores || parsed.shops || parsed.data || parsed.items;
          if (Array.isArray(potentialArray)) {
            items = potentialArray;
          }
        }
      } catch (err) {
        console.error("JSON parse error", err);
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      showToast("JSONの解析に失敗しました。AIの出力形式を確認してください");
      return;
    }

    // 2. Validate items
    const validItems = items.filter(
      (item) => item && typeof item === "object" && typeof item.name === "string" && item.name.trim().length > 0
    );

    if (validItems.length === 0) {
      showToast("店舗データが見つかりませんでした。店名(name)が含まれているか確認してください");
      return;
    }

    // 3. Process items and deduplicate
    const existingNames = new Set(
      (state.data.restaurants || []).map((r) => r.name.trim().toLowerCase())
    );
    const newRestaurants = [];
    let skippedCount = 0;

    for (const item of validItems) {
      const name = item.name.trim();
      if (!name) continue;
      if (existingNames.has(name.toLowerCase())) {
        skippedCount++;
        continue;
      }
      existingNames.add(name.toLowerCase());

      // Walking time tag normalization: round to 5-minute multiples (e.g. 1~5 -> 徒歩5分, 6~10 -> 徒歩10分)
      let rawMinutes = null;
      const rawVal = item.time_walk ?? item.time ?? item.walk_time ?? item.walk;
      if (typeof rawVal === "number") {
        rawMinutes = rawVal;
      } else if (typeof rawVal === "string") {
        const match = rawVal.match(/\d+/);
        if (match) rawMinutes = parseInt(match[0], 10);
      }
      if (!rawMinutes || isNaN(rawMinutes) || rawMinutes <= 0) {
        rawMinutes = 5;
      }
      const roundedMinutes = Math.max(5, Math.ceil(rawMinutes / 5) * 5);
      const timeTag = `徒歩${roundedMinutes}分`;

      // Genre tag
      const rawGenre = item.genre || item.category || "";
      const genreTag = typeof rawGenre === "string" ? rawGenre.trim() : "";

      // Area tag
      const rawArea = item.area || item.location || "";
      const areaTag = typeof rawArea === "string" ? rawArea.trim() : "";

      // Register tags into tag groups
      const tags = [];
      if (genreTag) {
        registerTagInGroup("genre", genreTag);
        tags.push(genreTag);
      }
      registerTagInGroup("time", timeTag);
      tags.push(timeTag);
      if (areaTag) {
        registerTagInGroup("area", areaTag);
        tags.push(areaTag);
      }

      newRestaurants.push({
        id: uuid(),
        name,
        tags,
        visits: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    if (newRestaurants.length === 0) {
      if (skippedCount > 0) {
        showToast(`すべて登録済みのお店でした（${skippedCount}件スキップ）`);
      } else {
        showToast("取り込めるお店がありませんでした");
      }
      return;
    }

    // Sort time tags numerically for clean presentation
    const timeGroup = state.data.tagGroups?.find((g) => g.id === "time");
    if (timeGroup && Array.isArray(timeGroup.tags)) {
      timeGroup.tags.sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
        const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
        return numA - numB;
      });
    }

    const baseLoc = (el.inputAiBaseLocation?.value || "").trim();
    if (baseLoc) {
      localStorage.setItem("lunchdeck.ai_base_location", baseLoc);
    }

    if (!state.data.restaurants) state.data.restaurants = [];
    state.data.restaurants.unshift(...newRestaurants);

    pruneUnusedTags();
    closeModal(el.modalAiImport);
    if (el.textareaAiResult) el.textareaAiResult.value = "";
    scheduleSave();
    render();

    const skipMsg = skippedCount > 0 ? ` (${skippedCount}件は既存のためスキップ)` : "";
    showToast(`${newRestaurants.length}件のお店を一括登録しました！${skipMsg}`);

    if (typeof confetti === "function") {
      try {
        confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
      } catch (_) {}
    }
  }

  /* ==========================================================================
     Tag Management (Reorder, Rename, Delete Unused)
     ========================================================================== */
  function openTagManagerModal(tab = null) {
    if (tab) state.activeManagerTab = tab;
    renderTagManagerList();
    el.modalTagsManager.style.display = "flex";
    lucide.createIcons();
  }

  function renderTagManagerList() {
    ensureTagGroups();

    // Count restaurant usage per tag
    const usageCounts = {};
    (state.data.restaurants || []).forEach((r) => {
      (r.tags || []).forEach((t) => {
        usageCounts[t] = (usageCounts[t] || 0) + 1;
      });
    });

    // Count unused across ALL groups
    let totalUnused = 0;
    for (const group of state.data.tagGroups) {
      for (const t of group.tags || []) {
        if (!usageCounts[t]) totalUnused++;
      }
    }
    el.countUnusedTags.textContent = totalUnused;
    el.btnPurgeUnusedTags.disabled = totalUnused === 0;

    // Update tab counts
    const genreGroup = state.data.tagGroups.find((g) => g.id === "genre") || { tags: [] };
    const timeGroup = state.data.tagGroups.find((g) => g.id === "time") || { tags: [] };
    const areaGroup = state.data.tagGroups.find((g) => g.id === "area") || { tags: [] };

    el.tabCountGenre.textContent = (genreGroup.tags || []).length;
    el.tabCountTime.textContent = (timeGroup.tags || []).length;
    el.tabCountArea.textContent = (areaGroup.tags || []).length;

    // Tab buttons active state
    document.querySelectorAll("[data-manager-tab]").forEach((btn) => {
      const tabId = btn.getAttribute("data-manager-tab");
      btn.classList.toggle("active", tabId === state.activeManagerTab);
    });

    const currentGroup = state.data.tagGroups.find((g) => g.id === state.activeManagerTab) || { tags: [] };
    const tags = currentGroup.tags || [];

    if (tags.length === 0) {
      el.tagsManagerList.innerHTML = '<div class="tags-manager-empty">このグループに登録されたタグはありません</div>';
      return;
    }

    el.tagsManagerList.innerHTML = tags
      .map((tag, idx) => {
        const count = usageCounts[tag] || 0;
        const isFirst = idx === 0;
        const isLast = idx === tags.length - 1;
        const isRenaming =
          state.renamingTag &&
          state.renamingTag.groupId === state.activeManagerTab &&
          state.renamingTag.tag === tag;

        if (isRenaming) {
          return `
            <div class="tag-manager-item renaming" data-tag="${escapeHtml(tag)}">
              <div class="tag-manager-rename-form">
                <input type="text" class="input-inline-rename" id="input-rename-tag" value="${escapeHtml(tag)}" autocomplete="off" />
                <button type="button" class="btn-icon-xs btn-save-rename" data-save-rename="${escapeHtml(tag)}" title="保存" aria-label="保存">
                  <i data-lucide="check"></i>
                </button>
                <button type="button" class="btn-icon-xs btn-cancel-rename" data-cancel-rename title="キャンセル" aria-label="キャンセル">
                  <i data-lucide="x"></i>
                </button>
              </div>
            </div>
          `;
        }

        return `
          <div class="tag-manager-item" data-tag="${escapeHtml(tag)}">
            <div class="tag-manager-item-left">
              <span class="tag-manager-name">${escapeHtml(tag)}</span>
              ${
                count > 0
                  ? `<span class="tag-manager-badge used">${count}店舗</span>`
                  : '<span class="tag-manager-badge unused">未使用</span>'
              }
            </div>
            <div class="tag-manager-actions">
              <button type="button" class="btn-icon-xs btn-tag-up" data-tag-up="${escapeHtml(tag)}" title="上へ移動" aria-label="上へ移動" ${isFirst ? "disabled" : ""}>
                <i data-lucide="arrow-up"></i>
              </button>
              <button type="button" class="btn-icon-xs btn-tag-down" data-tag-down="${escapeHtml(tag)}" title="下へ移動" aria-label="下へ移動" ${isLast ? "disabled" : ""}>
                <i data-lucide="arrow-down"></i>
              </button>
              <button type="button" class="btn-icon-xs btn-tag-rename" data-tag-rename="${escapeHtml(tag)}" title="名前変更" aria-label="名前変更">
                <i data-lucide="pencil"></i>
              </button>
              <button type="button" class="btn-icon-xs btn-tag-delete" data-tag-delete="${escapeHtml(tag)}" title="削除" aria-label="削除">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    lucide.createIcons();

    if (state.renamingTag) {
      const input = document.getElementById("input-rename-tag");
      if (input) {
        input.focus();
        input.select();
      }
    }
  }

  function reorderTag(groupId, tag, direction) {
    ensureTagGroups();
    const group = state.data.tagGroups.find((g) => g.id === groupId);
    if (!group || !Array.isArray(group.tags)) return;

    const idx = group.tags.indexOf(tag);
    if (idx < 0) return;

    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= group.tags.length) return;

    const temp = group.tags[idx];
    group.tags[idx] = group.tags[newIdx];
    group.tags[newIdx] = temp;

    scheduleSave();
    render();
    renderTagManagerList();
  }

  function commitTagRename(groupId, oldTag, newName) {
    state.renamingTag = null;
    const trimmed = (newName || "").trim();
    if (!trimmed || trimmed === oldTag) {
      renderTagManagerList();
      return;
    }

    ensureTagGroups();

    // Remove new tag name from other groups if it existed there
    for (const g of state.data.tagGroups) {
      if (g.id !== groupId && Array.isArray(g.tags)) {
        g.tags = g.tags.filter((t) => t !== trimmed);
      }
    }

    const group = state.data.tagGroups.find((g) => g.id === groupId);
    if (!group) return;

    const idx = group.tags.indexOf(oldTag);
    if (idx >= 0) {
      if (group.tags.includes(trimmed)) {
        group.tags.splice(idx, 1);
      } else {
        group.tags[idx] = trimmed;
      }
    }

    let affectedCount = 0;
    (state.data.restaurants || []).forEach((r) => {
      if (r.tags && r.tags.includes(oldTag)) {
        r.tags = r.tags.map((t) => (t === oldTag ? trimmed : t));
        r.tags = Array.from(new Set(r.tags));
        r.updatedAt = new Date().toISOString();
        affectedCount++;
      }
    });

    if (state.filter.tags.has(oldTag)) {
      state.filter.tags.delete(oldTag);
      state.filter.tags.add(trimmed);
    }

    scheduleSave();
    render();
    renderTagManagerList();
    showToast(`「${oldTag}」を「${trimmed}」に変更しました（${affectedCount}店舗更新）`);
  }

  function deleteSingleTag(groupId, tag) {
    ensureTagGroups();
    const group = state.data.tagGroups.find((g) => g.id === groupId);
    if (!group) return;

    const usedCount = (state.data.restaurants || []).filter((r) => (r.tags || []).includes(tag)).length;
    if (usedCount > 0) {
      if (!confirm(`「${tag}」は ${usedCount}店舗 で使用されています。本当に削除しますか？\n（各店舗のタグからも削除されます）`)) {
        return;
      }
      (state.data.restaurants || []).forEach((r) => {
        if (r.tags && r.tags.includes(tag)) {
          r.tags = r.tags.filter((t) => t !== tag);
          r.updatedAt = new Date().toISOString();
        }
      });
    }

    group.tags = (group.tags || []).filter((t) => t !== tag);
    state.filter.tags.delete(tag);

    scheduleSave();
    render();
    renderTagManagerList();
    showToast(`タグ「${tag}」を削除しました`);
  }

  function purgeAllUnusedTags() {
    ensureTagGroups();
    const usedTags = new Set();
    (state.data.restaurants || []).forEach((r) => {
      (r.tags || []).forEach((t) => usedTags.add(t));
    });

    let totalUnused = 0;
    for (const group of state.data.tagGroups) {
      for (const t of group.tags || []) {
        if (!usedTags.has(t)) totalUnused++;
      }
    }

    if (totalUnused === 0) {
      showToast("未使用のタグはありません");
      return;
    }

    if (!confirm(`現在使われていないタグ ${totalUnused} 個を一括削除しますか？`)) {
      return;
    }

    for (const group of state.data.tagGroups) {
      group.tags = (group.tags || []).filter((t) => usedTags.has(t));
    }

    scheduleSave();
    render();
    renderTagManagerList();
    showToast(`未使用タグ ${totalUnused} 個を削除しました`);
  }

  function addNewTagInManager(groupId, tagName) {
    const tag = (tagName || "").trim();
    if (!tag) return;

    ensureTagGroups();

    // Remove from other groups if it existed there
    for (const g of state.data.tagGroups) {
      if (g.id !== groupId && Array.isArray(g.tags)) {
        g.tags = g.tags.filter((t) => t !== tag);
      }
    }

    const group = state.data.tagGroups.find((g) => g.id === groupId);
    if (!group) return;

    if (!group.tags.includes(tag)) {
      group.tags.push(tag);
      deduplicateTagGroups(state.data.tagGroups);
      scheduleSave();
      render();
      renderTagManagerList();
      showToast(`タグ「${tag}」を追加しました`);
    } else {
      showToast("既に存在するタグです");
    }
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

    // Clear Tags & Dynamic Filter
    el.btnClearTags.addEventListener("click", () => {
      state.filter.tags.clear();
      state.filter.dynamic = null;
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

    // Pick One Deciders (Random, Elimination, Tournament)
    el.btnPickOne.addEventListener("click", startRoulette);
    if (el.btnPickElimination) el.btnPickElimination.addEventListener("click", startElimination);
    if (el.btnPickTournament) el.btnPickTournament.addEventListener("click", startTournament);

    // Roulette Accept & Retry
    el.btnRouletteAccept.addEventListener("click", () => {
      if (rouletteCandidate) {
        recordVisit(rouletteCandidate.id);
        closeModal(el.modalRoulette);
      }
    });
    el.btnRouletteRetry.addEventListener("click", startRoulette);

    // Elimination Decider Events
    if (el.eliminationCardsGrid) {
      el.eliminationCardsGrid.addEventListener("click", (e) => {
        const card = e.target.closest("[data-elim-idx]");
        if (card) {
          const idx = parseInt(card.getAttribute("data-elim-idx"), 10);
          handleEliminationCardClick(idx);
        }
      });
    }
    if (el.btnEliminationNext) {
      el.btnEliminationNext.addEventListener("click", handleEliminationNext);
    }

    // Tournament Decider Events
    if (el.tournamentCardA) {
      el.tournamentCardA.addEventListener("click", () => handleTournamentChoice("A"));
    }
    if (el.tournamentCardB) {
      el.tournamentCardB.addEventListener("click", () => handleTournamentChoice("B"));
    }

    // Reload / Sync button
    el.btnReload.addEventListener("click", async () => {
      const icon = el.btnReload.querySelector("i");
      if (icon) icon.classList.add("spinning");
      await syncFromDropbox(true);
      if (icon) icon.classList.remove("spinning");
    });

    // Window focus & visibility for multi-device sync
    window.addEventListener("focus", () => {
      if (getAuth() && el.modalRestaurant.style.display !== "flex" && el.modalTagsManager.style.display !== "flex") {
        syncFromDropbox(false, true);
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && getAuth() && el.modalRestaurant.style.display !== "flex") {
        syncFromDropbox(false, true);
      }
    });

    // Collapsible Tag Groups (toggles when clicking bar, ignoring chip clicks)
    document.querySelectorAll(".tag-group-header-bar").forEach((bar) => {
      bar.addEventListener("click", (e) => {
        if (e.target.closest(".chip")) return;
        const groupId = bar.getAttribute("data-toggle-group");
        const row = bar.closest(".tag-group-row");
        if (!row) return;
        const isCollapsed = row.classList.toggle("collapsed");
        if (isCollapsed) {
          state.collapsedGroups.add(groupId);
        } else {
          state.collapsedGroups.delete(groupId);
        }
        localStorage.setItem("lunchdeck.collapsed_groups", JSON.stringify(Array.from(state.collapsedGroups)));
      });
    });

    // Delegated click handler on tag container for all chips (regular & inline selected)
    const tagGroupsContainer = document.querySelector(".tag-groups-container");
    if (tagGroupsContainer) {
      tagGroupsContainer.addEventListener("click", (e) => {
        const chip = e.target.closest(".chip");
        if (!chip) return;

        const dynFilter = chip.getAttribute("data-filter");
        if (dynFilter) {
          state.filter.dynamic = state.filter.dynamic === dynFilter ? null : dynFilter;
          render();
          return;
        }

        const tag = chip.getAttribute("data-tag");
        if (tag) {
          if (state.filter.tags.has(tag)) {
            state.filter.tags.delete(tag);
          } else {
            state.filter.tags.add(tag);
          }
          render();
          return;
        }
      });
    }

    // Open Tag Manager
    if (el.btnManageTags) {
      el.btnManageTags.addEventListener("click", () => openTagManagerModal());
    }
    if (el.btnOpenTagsManager) {
      el.btnOpenTagsManager.addEventListener("click", () => {
        closeModal(el.modalSettings);
        openTagManagerModal();
      });
    }

    // Tag Manager Tabs & List Actions
    document.querySelectorAll("[data-manager-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeManagerTab = btn.getAttribute("data-manager-tab");
        renderTagManagerList();
      });
    });

    el.btnPurgeUnusedTags.addEventListener("click", purgeAllUnusedTags);

    el.tagsManagerList.addEventListener("click", (e) => {
      const btnUp = e.target.closest("[data-tag-up]");
      if (btnUp) {
        reorderTag(state.activeManagerTab, btnUp.getAttribute("data-tag-up"), -1);
        return;
      }
      const btnDown = e.target.closest("[data-tag-down]");
      if (btnDown) {
        reorderTag(state.activeManagerTab, btnDown.getAttribute("data-tag-down"), 1);
        return;
      }
      const btnRename = e.target.closest("[data-tag-rename]");
      if (btnRename) {
        state.renamingTag = {
          groupId: state.activeManagerTab,
          tag: btnRename.getAttribute("data-tag-rename"),
        };
        renderTagManagerList();
        return;
      }
      const btnSaveRename = e.target.closest("[data-save-rename]");
      if (btnSaveRename) {
        const input = document.getElementById("input-rename-tag");
        commitTagRename(state.activeManagerTab, btnSaveRename.getAttribute("data-save-rename"), input ? input.value : "");
        return;
      }
      const btnCancelRename = e.target.closest("[data-cancel-rename]");
      if (btnCancelRename) {
        state.renamingTag = null;
        renderTagManagerList();
        return;
      }
      const btnDelete = e.target.closest("[data-tag-delete]");
      if (btnDelete) {
        deleteSingleTag(state.activeManagerTab, btnDelete.getAttribute("data-tag-delete"));
        return;
      }
    });

    // Keyboard handling for inline rename in Tag Manager
    let renameIsComposing = false;
    let renameJustEnded = false;
    el.tagsManagerList.addEventListener("compositionstart", (e) => {
      if (e.target.id === "input-rename-tag") {
        renameIsComposing = true;
        renameJustEnded = false;
      }
    });
    el.tagsManagerList.addEventListener("compositionend", (e) => {
      if (e.target.id === "input-rename-tag") {
        renameIsComposing = false;
        renameJustEnded = true;
        setTimeout(() => { renameJustEnded = false; }, 60);
      }
    });
    el.tagsManagerList.addEventListener("keydown", (e) => {
      if (e.target.id === "input-rename-tag") {
        if (e.key === "Escape") {
          e.preventDefault();
          state.renamingTag = null;
          renderTagManagerList();
          return;
        }
        if (e.key === "Enter") {
          if (e.isComposing || e.keyCode === 229 || renameIsComposing || renameJustEnded) return;
          e.preventDefault();
          if (state.renamingTag) {
            commitTagRename(state.renamingTag.groupId, state.renamingTag.tag, e.target.value);
          }
        }
      }
    });

    // Add Tag in Tag Manager (with IME protection)
    let managerAddIsComposing = false;
    let managerAddJustEnded = false;
    el.inputManagerAddTag.addEventListener("compositionstart", () => {
      managerAddIsComposing = true;
      managerAddJustEnded = false;
    });
    el.inputManagerAddTag.addEventListener("compositionend", () => {
      managerAddIsComposing = false;
      managerAddJustEnded = true;
      setTimeout(() => { managerAddJustEnded = false; }, 60);
    });
    el.inputManagerAddTag.addEventListener("keydown", (e) => {
      if (e.isComposing || e.keyCode === 229 || managerAddIsComposing || managerAddJustEnded) return;
      if (e.key === "Enter") {
        e.preventDefault();
        const val = el.inputManagerAddTag.value;
        if (val.trim()) {
          addNewTagInManager(state.activeManagerTab, val);
          el.inputManagerAddTag.value = "";
        }
      }
    });
    el.btnManagerAddTag.addEventListener("click", () => {
      const val = el.inputManagerAddTag.value;
      if (val.trim()) {
        addNewTagInManager(state.activeManagerTab, val);
        el.inputManagerAddTag.value = "";
      }
    });

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
        if (e.key === "Enter") {
          // Prevent premature form submit during IME conversion
          if (e.isComposing || e.keyCode === 229 || isComposing || justEndedComposition) {
            e.preventDefault();
            return;
          }
          e.preventDefault();
          const val = inputEl.value.trim().replace(/^,+|,+$/g, "");
          if (val) {
            addTagToGroup(groupId, val);
            inputEl.value = "";
          }
          return;
        }

        if (e.key === ",") {
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

    // AI Import Assistant
    if (el.btnEmptyAiImport) {
      el.btnEmptyAiImport.addEventListener("click", openAiImportModal);
    }
    if (el.btnOpenAiImport) {
      el.btnOpenAiImport.addEventListener("click", () => {
        closeModal(el.modalSettings);
        openAiImportModal();
      });
    }
    if (el.btnCopyAiPrompt) {
      el.btnCopyAiPrompt.addEventListener("click", copyAiPrompt);
    }
    if (el.btnSubmitAiImport) {
      el.btnSubmitAiImport.addEventListener("click", handleAiImport);
    }
    if (el.inputAiBaseLocation) {
      el.inputAiBaseLocation.addEventListener("input", updateAiPromptPreview);
    }
    if (el.selectAiRadius) {
      el.selectAiRadius.addEventListener("change", updateAiPromptPreview);
    }
    if (el.inputAiPreferences) {
      el.inputAiPreferences.addEventListener("input", updateAiPromptPreview);
    }
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
