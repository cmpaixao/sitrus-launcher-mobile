const MODRINTH = "https://api.modrinth.com/v2";
const SETTINGS_KEY = "sitrus-mobile-settings";
const ACCOUNT_KEY = "sitrus-mobile-account";
const EXTRAS_KEY = "sitrus-mobile-extras";

const CATEGORIES = {
  mod: [
    ["adventure", "Aventura"],
    ["decoration", "Decoração"],
    ["equipment", "Equipamento"],
    ["food", "Comida"],
    ["game-mechanics", "Mecânicas"],
    ["magic", "Magia"],
    ["mobs", "Mobs"],
    ["optimization", "Otimização"],
    ["social", "Social"],
    ["storage", "Armazenamento"],
    ["technology", "Tecnologia"],
    ["transportation", "Transporte"],
    ["utility", "Utilidade"],
    ["worldgen", "Mundo"],
  ],
  resourcepack: [
    ["combat", "Combate"],
    ["cursed", "Cursed"],
    ["decoration", "Decoração"],
    ["modded", "Modded"],
    ["realistic", "Realista"],
    ["simplistic", "Simples"],
    ["themed", "Temático"],
    ["tweaks", "Tweaks"],
    ["utility", "Utilidade"],
    ["vanilla-like", "Vanilla-like"],
  ],
  shader: [
    ["cartoon", "Cartoon"],
    ["cursed", "Cursed"],
    ["fantasy", "Fantasia"],
    ["realistic", "Realista"],
    ["vanilla-like", "Vanilla-like"],
  ],
};

const FOLDERS = {
  mod: "mods",
  resourcepack: "resourcepacks",
  shader: "shaderpacks",
};

const ui = {
  layout: document.getElementById("layout"),
  homeTabBtn: document.getElementById("homeTabBtn"),
  extrasTabBtn: document.getElementById("extrasTabBtn"),
  configTabBtn: document.getElementById("configTabBtn"),
  homeTab: document.getElementById("homeTab"),
  extrasTab: document.getElementById("extrasTab"),
  configTab: document.getElementById("configTab"),
  playBtn: document.getElementById("playBtn"),
  bar: document.getElementById("bar"),
  progress: document.getElementById("progress"),
  status: document.getElementById("status"),
  packVersion: document.getElementById("packVersion"),
  launcherVersion: document.getElementById("launcherVersion"),
  launcherVersionHome: document.getElementById("launcherVersionHome"),
  offlineNick: document.getElementById("offlineNick"),
  offlineBtn: document.getElementById("offlineBtn"),
  msBtn: document.getElementById("msBtn"),
  msNote: document.getElementById("msNote"),
  logoutBtn: document.getElementById("logoutBtn"),
  accountChip: document.getElementById("accountChip"),
  chipName: document.getElementById("chipName"),
  chipAvatar: document.getElementById("chipAvatar"),
  serverDot: document.getElementById("serverDot"),
  serverLabel: document.getElementById("serverLabel"),
  serverPlayers: document.getElementById("serverPlayers"),
  ram: document.getElementById("ram"),
  ramValue: document.getElementById("ramValue"),
  renderer: document.getElementById("renderer"),
  serverAddress: document.getElementById("serverAddress"),
  extrasSearch: document.getElementById("extrasSearch"),
  extrasSort: document.getElementById("extrasSort"),
  extrasCategories: document.getElementById("extrasCategories"),
  extrasList: document.getElementById("extrasList"),
  extrasHint: document.getElementById("extrasHint"),
  installAppBtn: document.getElementById("installAppBtn"),
  uninstallBtn: document.getElementById("uninstallBtn"),
  playSheet: document.getElementById("playSheet"),
  playSheetTitle: document.getElementById("playSheetTitle"),
  playSheetText: document.getElementById("playSheetText"),
  playSheetSteps: document.getElementById("playSheetSteps"),
  playSheetZalith: document.getElementById("playSheetZalith"),
  playSheetSave: document.getElementById("playSheetSave"),
  playSheetShare: document.getElementById("playSheetShare"),
  playSheetClose: document.getElementById("playSheetClose"),
};

const state = {
  pack: null,
  settings: loadSettings(),
  account: loadAccount(),
  busy: false,
  latest: null,
  packFile: null,
  packIds: null,
  extrasType: "mod",
  extrasQuery: "",
  extrasSort: "downloads",
  extrasCategory: "",
  extrasOffset: 0,
  extrasHasMore: false,
  extrasHits: [],
  extrasOpenId: "",
  extrasVersions: {},
  installPrompt: null,
};

function loadSettings() {
  try {
    return {
      ramGb: 2,
      renderer: "MobileGlues",
      serverAddress: "sitruscobblemon.com",
      lastTab: "home",
      downloadedVersion: "",
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"),
    };
  } catch {
    return { ramGb: 2, renderer: "MobileGlues", serverAddress: "sitruscobblemon.com", lastTab: "home", downloadedVersion: "" };
  }
}

function saveSettings(partial) {
  state.settings = { ...state.settings, ...partial };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function loadAccount() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "null");
  } catch {
    return null;
  }
}

function loadExtras() {
  try {
    const data = JSON.parse(localStorage.getItem(EXTRAS_KEY) || "{}");
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

function saveExtras(items) {
  localStorage.setItem(EXTRAS_KEY, JSON.stringify({ items }));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatCount(value) {
  const num = Number(value) || 0;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(num);
}

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
}

function setStatus(text, percent, isError = false) {
  ui.status.textContent = text;
  ui.status.classList.toggle("is-error", Boolean(isError));
  if (typeof percent === "number") {
    const value = Math.max(0, Math.min(100, percent));
    ui.bar.style.width = `${value}%`;
    ui.progress.setAttribute("aria-valuenow", String(Math.round(value)));
    ui.progress.hidden = !(state.busy || (value > 0 && value < 100));
  } else if (!state.busy) {
    ui.progress.hidden = true;
  }
}

function renderAccount() {
  const account = state.account;
  ui.playBtn.disabled = !account || state.busy;
  ui.playBtn.textContent = state.busy ? "PREPARANDO..." : "JOGAR";
  ui.playBtn.classList.toggle("is-busy", state.busy);
  ui.playBtn.title = account ? "Preparar o jogo e entrar" : "Entre com um nick para jogar";
  ui.accountChip.hidden = !account;
  ui.layout.classList.toggle("needs-login", (state.settings.lastTab || "home") === "home" && !account);
  if (!account) return;
  ui.chipName.textContent = account.name;
  const urls = [
    account.name ? `https://mc-heads.net/avatar/${encodeURIComponent(account.name)}/64` : "",
    "./assets/icon.png",
  ].filter(Boolean);
  let index = 0;
  ui.chipAvatar.onerror = () => {
    index += 1;
    if (index < urls.length) ui.chipAvatar.src = urls[index];
  };
  ui.chipAvatar.src = urls[0];
}

function bindSettings() {
  ui.ram.value = String(state.settings.ramGb || 2);
  ui.ramValue.textContent = ui.ram.value;
  ui.renderer.value = state.settings.renderer || "MobileGlues";
  ui.serverAddress.value = state.settings.serverAddress || state.pack?.server?.address || "";
  ui.offlineNick.value = state.account?.name || "";
  ui.offlineBtn.disabled = !/^[A-Za-z0-9_]{3,16}$/.test(ui.offlineNick.value.trim());
}

function showTab(tab) {
  const tabs = [
    { id: "home", button: ui.homeTabBtn, panel: ui.homeTab },
    { id: "extras", button: ui.extrasTabBtn, panel: ui.extrasTab },
    { id: "config", button: ui.configTabBtn, panel: ui.configTab },
  ];
  state.settings.lastTab = tab;
  saveSettings({ lastTab: tab });
  for (const item of tabs) {
    const selected = item.id === tab;
    item.panel.hidden = !selected;
    item.button.classList.toggle("active", selected);
    item.button.setAttribute("aria-selected", selected ? "true" : "false");
    item.button.tabIndex = selected ? 0 : -1;
  }
  ui.layout.classList.toggle("is-home", tab === "home");
  ui.layout.classList.toggle("is-sheet", tab !== "home");
  ui.layout.classList.toggle("needs-login", tab === "home" && !state.account);
  if (tab === "extras" && !state.extrasHits.length) searchExtras();
}

function renderServer(status) {
  const online = Boolean(status?.online);
  ui.serverDot.classList.toggle("is-online", online);
  ui.serverDot.classList.toggle("is-offline", status && !online);
  ui.serverLabel.textContent = state.pack?.server?.name || "Sitrus Cobblemon";
  ui.serverPlayers.textContent = online ? `Online · ${status.players}/${status.max}` : status ? "Offline" : "Verificando servidor...";
}

async function refreshServer() {
  const host = (ui.serverAddress.value || state.settings.serverAddress || "sitruscobblemon.com").trim();
  try {
    const res = await fetch(`https://api.mcstatus.io/v2/status/java/${encodeURIComponent(host)}`);
    if (!res.ok) throw new Error("status");
    const data = await res.json();
    renderServer({
      online: Boolean(data.online),
      players: Number(data.players?.online) || 0,
      max: Number(data.players?.max) || 0,
    });
  } catch {
    renderServer({ online: false });
  }
}

function packFileOf(version) {
  return (version?.files || []).find((file) => file.primary) || version?.files?.[0] || null;
}

async function fetchLatestPack() {
  const slug = state.pack?.modrinthSlug || "sitrus-cobblemon-mobile";
  const versions = await fetch(`${MODRINTH}/project/${slug}/version?limit=1`).then((res) => {
    if (!res.ok) throw new Error("Não consegui consultar o Modrinth.");
    return res.json();
  });
  const latest = versions?.[0];
  if (!latest) throw new Error("O Modrinth não devolveu uma versão do pack.");
  state.latest = latest;
  state.packIds = new Set((latest.dependencies || []).map((item) => item.project_id).filter(Boolean));
  const label = latest.version_number ? `• Mobile ${latest.version_number}` : "• Sitrus Cobblemon";
  ui.packVersion.textContent = label;
  return latest;
}

function isNativeApp() {
  return window.Capacitor?.isNativePlatform?.() === true;
}

function downloadsPlugin() {
  return window.Capacitor?.registerPlugin?.("SitrusDownloads") || null;
}

async function engineDownloadUrl() {
  const plugin = downloadsPlugin();
  const abi = (await plugin?.deviceAbi?.())?.abi || "arm64-v8a";
  const response = await fetch("https://api.github.com/repos/ZalithLauncher/ZalithLauncher2/releases/latest", {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error("Não deu para achar o motor do jogo. Confira a internet.");
  const release = await response.json();
  const match = (release.assets || []).find((asset) => asset.name.endsWith(`-${abi}.apk`) && !/mapping/i.test(asset.name));
  if (!match?.browser_download_url) throw new Error("Não encontrei o motor do jogo para este celular.");
  return match.browser_download_url;
}

async function openExternal(url) {
  if (!url) return;
  if (isNativeApp()) {
    try {
      const browser = window.Capacitor.registerPlugin("Browser");
      await browser.open({ url });
      return;
    } catch {
      // segue para a janela normal
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function saveToDownloads(url, filename, blob) {
  const plugin = isNativeApp() ? downloadsPlugin() : null;
  if (plugin && url) {
    await plugin.enqueue({ url, filename });
    return "downloads";
  }
  const data = blob || await fetchBlob(url, 0);
  saveBlob(data, filename);
  return "browser";
}

async function fetchBlob(url, size, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Não consegui baixar o arquivo.");
  const total = size || Number(res.headers.get("content-length")) || 0;
  if (!res.body) {
    onProgress?.(1);
    return res.blob();
  }
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (total) onProgress?.(received / total);
  }
  return new Blob(chunks);
}

function showEngineSheet(kind) {
  ui.playSheetTitle.textContent = kind === "allow" ? "Permissão do Android" : "Instalar o motor do jogo";
  ui.playSheetText.textContent = kind === "allow"
    ? "O Android precisa permitir que o Sitrus instale o motor do jogo. Aceite e volte para tocar em Jogar."
    : "O Android abriu a instalação. Toque em Instalar. É uma vez só. Quando voltar ao Sitrus, toque em Jogar e o pack abre sozinho. A conta Microsoft entra nesse momento.";
  ui.playSheetSteps.innerHTML = "";
  ui.playSheetSteps.hidden = true;
  ui.playSheetZalith.hidden = true;
  ui.playSheetSave.hidden = true;
  ui.playSheetShare.hidden = true;
  ui.playSheet.hidden = false;
}

async function play() {
  if (state.busy || !state.account) return;
  state.busy = true;
  renderAccount();
  let listener = null;
  try {
    setStatus("Procurando atualização do modpack...", 8);
    const latest = state.latest || await fetchLatestPack();
    const file = packFileOf(latest);
    if (!file?.url) throw new Error("Essa versão do pack não tem arquivo para baixar.");
    if (isNativeApp()) {
      const plugin = downloadsPlugin();
      if (!plugin?.play) throw new Error("Atualize o Sitrus Launcher para preparar o jogo daqui.");
      listener = await plugin.addListener("progress", (data) => {
        if (data?.message) setStatus(data.message, Number(data.percent) || 0);
      });
      const installed = await plugin.engineInstalled();
      const engineUrl = installed?.installed ? "" : await engineDownloadUrl();
      const result = await plugin.play({
        packUrl: file.url,
        filename: file.filename,
        engineUrl,
      });
      state.packFile = { ...file, name: file.filename, url: file.url, blob: null };
      saveSettings({ downloadedVersion: latest.version_number });
      if (result?.step === "allow-install") {
        showEngineSheet("allow");
        setStatus("Permita a instalação e toque em Jogar de novo.", 0);
      } else if (result?.step === "install-engine") {
        showEngineSheet("install");
        setStatus("Confirme a instalação. Depois toque em Jogar de novo.", 0);
      } else {
        ui.playSheet.hidden = true;
        setStatus("O pack está abrindo. A primeira vez baixa os mods e pode demorar. Deixe espaço livre.", 100);
      }
      return;
    }
    setStatus(`Baixando Sitrus Cobblemon Mobile ${latest.version_number}...`, 12);
    const blob = await fetchBlob(file.url, file.size, (ratio) => {
      setStatus(`Baixando o pack... ${Math.round(ratio * 100)}%`, 12 + ratio * 82);
    });
    saveBlob(blob, file.filename);
    state.packFile = { ...file, name: file.filename, url: file.url, blob };
    saveSettings({ downloadedVersion: latest.version_number });
    setStatus(`Pack ${latest.version_number} baixado. No celular, o app abre o jogo sozinho.`, 100);
  } catch (error) {
    setStatus(error.message || "Não deu para preparar o jogo. Confira sua internet e tente de novo.", 0, true);
  } finally {
    await listener?.remove?.();
    state.busy = false;
    renderAccount();
    ui.progress.hidden = true;
  }
}

function facetsFor(type, category) {
  const mcVersion = state.pack?.game?.version || "1.21.1";
  const loader = state.pack?.game?.loader || "fabric";
  const facets = [];
  if (type === "mod") facets.push(["project_type:mod"], [`versions:${mcVersion}`], [`categories:${loader}`]);
  else if (type === "resourcepack") facets.push(["project_type:resourcepack"], [`versions:${mcVersion}`, "versions:1.21"]);
  else facets.push(["project_type:shader"], ["categories:iris", "categories:optifine"]);
  if (category) facets.push([`categories:${category}`]);
  return facets;
}

function extrasHint(total) {
  const count = typeof total === "number" ? ` ${total} resultados.` : "";
  const folder = FOLDERS[state.extrasType] || "mods";
  if (state.extrasType === "shader") {
    return `Shaders pesam no celular. O arquivo vai para Downloads e entra em ${folder}.${count}`;
  }
  return `O arquivo vai para Downloads. Na pasta da instância, coloque em ${folder}.${count}`;
}

function renderCategoryFilters() {
  const categories = CATEGORIES[state.extrasType] || [];
  const all = `<button type="button" class="filter filter-cat${state.extrasCategory ? "" : " active"}" data-category="">Todas</button>`;
  ui.extrasCategories.innerHTML = all + categories.map(([id, label]) => {
    const selected = state.extrasCategory === id;
    return `<button type="button" class="filter filter-cat${selected ? " active" : ""}" data-category="${escapeHtml(id)}">${escapeHtml(label)}</button>`;
  }).join("");
}

function extraTags(item) {
  const skip = new Set(["fabric", "forge", "neoforge", "quilt", "iris", "optifine", "minecraft"]);
  const cats = (item.categories || []).filter((cat) => !skip.has(String(cat).toLowerCase())).slice(0, 3);
  const tags = [];
  if (item.installed) tags.push({ text: "Baixado", kind: "installed" });
  if (item.downloads) tags.push({ text: `${formatCount(item.downloads)} baixados` });
  for (const cat of cats) tags.push({ text: cat });
  return tags.map((tag) => `<span class="extra-tag${tag.kind ? ` ${tag.kind}` : ""}">${escapeHtml(tag.text)}</span>`).join("");
}

function renderVersionList(projectId) {
  const data = state.extrasVersions[projectId];
  if (!data) return `<div class="extra-versions"><div class="extra-empty">Carregando versões...</div></div>`;
  if (!data.versions?.length) return `<div class="extra-versions"><div class="extra-empty">Nenhuma versão publicada neste projeto.</div></div>`;
  const rows = data.versions.map((item) => {
    const type = escapeHtml(item.versionType || "release");
    const games = escapeHtml((item.gameVersions || []).slice(0, 3).join(", "));
    const action = item.compatible
      ? `<button type="button" data-id="${escapeHtml(projectId)}" data-type="${escapeHtml(state.extrasType)}" data-version="${escapeHtml(item.id)}" data-action="install">Baixar</button>`
      : `<button type="button" disabled>Incompatível</button>`;
    return `<div class="extra-version${item.compatible ? "" : " is-incompatible"}">
      <div>
        <strong>${escapeHtml(item.versionNumber || item.name)} <span class="ver-type ${type}">${type}</span></strong>
        <small>${games} · ${formatCount(item.downloads)} baixados · ${formatDate(item.date)}</small>
      </div>
      ${action}
    </div>`;
  }).join("");
  return `<div class="extra-versions">${rows}</div>`;
}

function renderExtras(hits, { append = false, hasMore = false } = {}) {
  const more = hasMore ? `<button type="button" class="ghost extra-more" data-action="more">Carregar mais</button>` : "";
  if (!hits.length && !append) {
    ui.extrasList.innerHTML = `<div class="extra-empty">Nada encontrado. Tente outra busca.</div>${more}`;
    return;
  }
  const cards = hits.map((item) => {
    const open = state.extrasOpenId === item.id;
    const action = item.installed
      ? `<button type="button" class="remove" data-id="${escapeHtml(item.id)}" data-action="remove">Remover</button>`
      : `<button type="button" data-id="${escapeHtml(item.id)}" data-type="${escapeHtml(item.type)}" data-action="install">Baixar</button>`;
    return `<article class="extra-item${open ? " is-open" : ""}">
      <img src="${escapeHtml(item.icon || "./assets/icon.png")}" alt="" onerror="this.onerror=null;this.src='./assets/icon.png'" />
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml((item.description || "").slice(0, 140))}</small>
        <div class="extra-meta">${extraTags(item)}</div>
      </div>
      <div class="extra-actions">
        ${action}
        <button type="button" class="ghost-action" data-id="${escapeHtml(item.id)}" data-type="${escapeHtml(item.type)}" data-action="versions">${open ? "Fechar" : "Versões"}</button>
      </div>
      ${open ? renderVersionList(item.id) : ""}
    </article>`;
  }).join("");
  if (append) {
    ui.extrasList.querySelector(".extra-more")?.remove();
    ui.extrasList.insertAdjacentHTML("beforeend", cards + more);
    return;
  }
  ui.extrasList.innerHTML = cards + more;
}

function keepHit(hit, type) {
  if (state.packIds?.has(hit.project_id)) return false;
  if (hit.client_side === "unsupported") return false;
  if (type === "mod" && hit.server_side === "required") return false;
  return true;
}

async function searchExtras({ append = false } = {}) {
  if (!append) {
    ui.extrasList.innerHTML = `<div class="extra-empty">Buscando no Modrinth...</div>`;
    state.extrasHits = [];
    state.extrasOffset = 0;
    state.extrasOpenId = "";
  }
  ui.extrasHint.textContent = extrasHint();
  renderCategoryFilters();
  try {
    if (!state.packIds) {
      try { await fetchLatestPack(); } catch { state.packIds = new Set(); }
    }
    const params = new URLSearchParams({
      limit: "40",
      offset: String(append ? state.extrasOffset : 0),
      index: state.extrasSort || "downloads",
      facets: JSON.stringify(facetsFor(state.extrasType, state.extrasCategory)),
    });
    if (state.extrasQuery.trim()) params.set("query", state.extrasQuery.trim());
    const res = await fetch(`${MODRINTH}/search?${params}`);
    if (!res.ok) throw new Error("Não consegui buscar os extras.");
    const data = await res.json();
    const installed = new Set(loadExtras().filter((item) => item.type === state.extrasType).map((item) => item.id));
    const hits = (data.hits || []).filter((hit) => keepHit(hit, state.extrasType)).map((hit) => ({
      id: hit.project_id,
      slug: hit.slug,
      title: hit.title,
      description: hit.description || "",
      icon: hit.icon_url,
      downloads: hit.downloads || 0,
      categories: hit.categories || [],
      type: state.extrasType,
      installed: installed.has(hit.project_id),
    }));
    state.extrasOffset = (append ? state.extrasOffset : 0) + (data.hits || []).length;
    state.extrasHasMore = state.extrasOffset < (data.total_hits || 0);
    state.extrasHits = append ? state.extrasHits.concat(hits) : hits;
    ui.extrasHint.textContent = extrasHint(data.total_hits);
    renderExtras(append ? hits : state.extrasHits, { append, hasMore: state.extrasHasMore });
  } catch (error) {
    if (!append) {
      ui.extrasList.innerHTML = `<div class="extra-empty">${escapeHtml(error.message || "Não consegui buscar os extras.")}<br><button type="button" class="ghost extra-more" data-action="retry">Tentar de novo</button></div>`;
    }
    ui.extrasHint.textContent = error.message || "Não consegui buscar os extras.";
  }
}

function compatibleVersion(version, type) {
  const games = version.game_versions || [];
  const loaders = (version.loaders || []).map((item) => String(item).toLowerCase());
  const mc = state.pack?.game?.version || "1.21.1";
  if (type === "mod") return loaders.includes("fabric") && games.includes(mc);
  if (type === "resourcepack") return games.includes(mc) || games.includes("1.21");
  if (type === "shader") return loaders.includes("iris") || loaders.includes("optifine") || !loaders.length;
  return false;
}

async function toggleVersions(id) {
  if (state.extrasOpenId === id) {
    state.extrasOpenId = "";
    renderExtras(state.extrasHits, { hasMore: state.extrasHasMore });
    return;
  }
  state.extrasOpenId = id;
  renderExtras(state.extrasHits, { hasMore: state.extrasHasMore });
  try {
    const res = await fetch(`${MODRINTH}/project/${id}/version`);
    if (!res.ok) throw new Error("Não deu para listar as versões.");
    const versions = await res.json();
    state.extrasVersions[id] = {
      versions: (versions || []).slice(0, 12).map((item) => ({
        id: item.id,
        name: item.name,
        versionNumber: item.version_number,
        versionType: item.version_type,
        gameVersions: item.game_versions || [],
        downloads: item.downloads || 0,
        date: item.date_published,
        compatible: compatibleVersion(item, state.extrasType),
        files: item.files || [],
      })),
    };
  } catch (error) {
    state.extrasVersions[id] = { versions: [] };
    ui.extrasHint.textContent = error.message || "Não deu para listar as versões.";
  }
  renderExtras(state.extrasHits, { hasMore: state.extrasHasMore });
}

async function downloadExtra(id, type, versionId) {
  const params = new URLSearchParams();
  if (type === "mod") {
    params.set("loaders", JSON.stringify(["fabric"]));
    params.set("game_versions", JSON.stringify([state.pack?.game?.version || "1.21.1"]));
  }
  const listed = versionId
    ? null
    : await fetch(`${MODRINTH}/project/${id}/version?${params}`).then((res) => res.json());
  let version = null;
  if (versionId) {
    const res = await fetch(`${MODRINTH}/version/${versionId}`);
    if (!res.ok) throw new Error("Não encontrei essa versão.");
    version = await res.json();
  } else {
    version = (listed || []).find((item) => item.version_type === "release" && item.files?.length) || listed?.[0];
  }
  const file = (version?.files || []).find((item) => item.primary) || version?.files?.[0];
  if (!file?.url) throw new Error("Essa versão não tem arquivo.");
  ui.extrasHint.textContent = `Baixando ${file.filename}...`;
  if (isNativeApp()) {
    await saveToDownloads(file.url, file.filename);
  } else {
    const blob = await fetchBlob(file.url, file.size, (ratio) => {
      ui.extrasHint.textContent = `Baixando ${file.filename}... ${Math.round(ratio * 100)}%`;
    });
    saveBlob(blob, file.filename);
  }
  const hit = state.extrasHits.find((item) => item.id === id);
  const items = loadExtras().filter((item) => item.id !== id);
  items.unshift({
    id,
    slug: hit?.slug || "",
    title: hit?.title || file.filename,
    type,
    filename: file.filename,
    versionNumber: version.version_number || "",
  });
  saveExtras(items);
  ui.extrasHint.textContent = `${file.filename} salvo em Downloads. Na pasta da instância, coloque em ${FOLDERS[type] || "mods"}.`;
}

function initSlider() {
  const slider = document.getElementById("slider");
  const slides = [...slider.querySelectorAll(".slide")];
  let index = 0;
  let timer = null;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function go(next) {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, i) => slide.classList.toggle("is-active", i === index));
  }

  function start() {
    if (timer) clearInterval(timer);
    if (reduce || slides.length < 2) return;
    timer = setInterval(() => go(index + 1), 4500);
  }

  let startX = 0;
  slider.addEventListener("touchstart", (event) => {
    startX = event.changedTouches[0].clientX;
  }, { passive: true });
  slider.addEventListener("touchend", (event) => {
    const delta = event.changedTouches[0].clientX - startX;
    if (Math.abs(delta) < 40) return;
    go(index + (delta < 0 ? 1 : -1));
    start();
  }, { passive: true });
  go(0);
  start();
}

function wire() {
  ui.homeTabBtn.onclick = () => showTab("home");
  ui.extrasTabBtn.onclick = () => showTab("extras");
  ui.configTabBtn.onclick = () => showTab("config");
  document.getElementById("railExtrasBtn").onclick = () => showTab("extras");
  document.getElementById("railConfigBtn").onclick = () => showTab("config");
  document.getElementById("discordBtn").onclick = () => openExternal(state.pack?.discord);
  document.getElementById("wikiBtn").onclick = () => openExternal(state.pack?.wiki);
  document.getElementById("storeBtn").onclick = () => openExternal(state.pack?.store);
  document.getElementById("modrinthBtn").onclick = () => openExternal(state.pack?.modrinthUrl);
  document.getElementById("helpTicketBtn").onclick = () => openExternal(state.pack?.ticket || state.pack?.discord);
  document.getElementById("shareLogBtn").onclick = () => {
    openExternal(state.pack?.ticket || state.pack?.discord);
    document.getElementById("shareLogHint").textContent = "Abrimos o Discord. Anexe o logs/latest.log da instância.";
  };

  ui.msBtn.onclick = () => {
    ui.msNote.hidden = false;
    ui.offlineNick.focus();
  };

  ui.offlineNick.addEventListener("input", () => {
    const value = ui.offlineNick.value.trim();
    const valid = !value || /^[A-Za-z0-9_]{3,16}$/.test(value);
    ui.offlineNick.setAttribute("aria-invalid", valid ? "false" : "true");
    ui.offlineBtn.disabled = !/^[A-Za-z0-9_]{3,16}$/.test(value);
  });
  ui.offlineNick.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !ui.offlineBtn.disabled) ui.offlineBtn.click();
  });
  ui.offlineBtn.onclick = () => {
    const name = ui.offlineNick.value.trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) {
      setStatus("Nick inválido. Use 3 a 16 letras, números ou _.", 0, true);
      return;
    }
    state.account = { type: "offline", name };
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(state.account));
    renderAccount();
    setStatus(`Pronto, ${name}. Toque em Jogar para baixar o pack.`);
  };
  ui.logoutBtn.onclick = () => {
    state.account = null;
    localStorage.removeItem(ACCOUNT_KEY);
    renderAccount();
    showTab("home");
    setStatus("Conta desconectada. Entre de novo em Jogar.");
  };

  ui.playBtn.onclick = play;
  ui.ram.oninput = () => {
    ui.ramValue.textContent = ui.ram.value;
    ui.ram.setAttribute("aria-valuenow", ui.ram.value);
    ui.ram.setAttribute("aria-valuetext", `${ui.ram.value} gigabytes`);
  };
  ui.ram.onchange = () => saveSettings({ ramGb: Number(ui.ram.value) });
  ui.renderer.onchange = () => saveSettings({ renderer: ui.renderer.value });
  ui.serverAddress.onchange = async () => {
    saveSettings({ serverAddress: ui.serverAddress.value.trim() });
    await refreshServer();
  };

  document.querySelectorAll(".filter-type").forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll(".filter-type").forEach((item) => {
        item.classList.remove("active");
        item.setAttribute("aria-pressed", "false");
      });
      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
      state.extrasType = button.dataset.type;
      state.extrasCategory = "";
      state.extrasOpenId = "";
      searchExtras();
    };
  });
  ui.extrasCategories.addEventListener("click", (event) => {
    const button = event.target.closest(".filter-cat");
    if (!button) return;
    state.extrasCategory = button.dataset.category || "";
    searchExtras();
  });
  ui.extrasSort.onchange = () => {
    state.extrasSort = ui.extrasSort.value;
    searchExtras();
  };
  let searchTimer = null;
  ui.extrasSearch.addEventListener("input", () => {
    state.extrasQuery = ui.extrasSearch.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => searchExtras(), 350);
  });
  ui.extrasList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "retry") {
      searchExtras();
      return;
    }
    if (action === "more") {
      button.disabled = true;
      button.textContent = "Carregando...";
      searchExtras({ append: true });
      return;
    }
    if (action === "versions") {
      toggleVersions(button.dataset.id);
      return;
    }
    if (action === "remove") {
      if (!window.confirm("Tirar este extra da lista? O arquivo que já foi para Downloads continua no celular.")) return;
      saveExtras(loadExtras().filter((item) => item.id !== button.dataset.id));
      await searchExtras();
      return;
    }
    button.disabled = true;
    const previous = button.textContent;
    button.textContent = "Baixando...";
    try {
      await downloadExtra(button.dataset.id, button.dataset.type || state.extrasType, button.dataset.version || "");
      state.extrasOpenId = "";
      await searchExtras();
    } catch (error) {
      button.disabled = false;
      button.textContent = previous;
      ui.extrasHint.textContent = error.message || "Não deu para baixar. Tente de novo.";
    }
  });

  ui.playSheetClose.onclick = () => { ui.playSheet.hidden = true; };
  document.getElementById("playSheetBackdrop").onclick = () => { ui.playSheet.hidden = true; };
  ui.playSheetSave.onclick = async () => {
    const pack = state.packFile;
    if (pack?.url || pack?.blob) {
      ui.playSheetSave.disabled = true;
      try {
        await saveToDownloads(pack.url, pack.name || pack.filename, pack.blob);
        setStatus("Download enviado para a pasta Downloads.", 0);
      } catch (error) {
        setStatus(error.message || "Não deu para baixar o pack de novo.", 0, true);
      } finally {
        ui.playSheetSave.disabled = false;
      }
      return;
    }
    ui.playSheet.hidden = true;
    saveSettings({ downloadedVersion: "" });
    state.packFile = null;
    await play();
  };
  ui.playSheetShare.onclick = async () => {
    if (!state.packFile?.blob) return;
    const filename = state.packFile.name || state.packFile.filename;
    const file = new File([state.packFile.blob], filename, { type: "application/x-modrinth-modpack+zip" });
    try {
      await navigator.share({ files: [file], title: "Sitrus Cobblemon Mobile" });
    } catch (error) {
      if (error?.name !== "AbortError") setStatus("Não deu para compartilhar. O arquivo continua em Downloads.", 0, true);
    }
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPrompt = event;
    ui.installAppBtn.hidden = false;
  });
  ui.installAppBtn.onclick = async () => {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    ui.installAppBtn.hidden = true;
  };

  ui.uninstallBtn.onclick = async () => {
    const ok = window.confirm("Desinstalar o Sitrus Launcher? Os arquivos baixados por ele saem do celular e o Android pede para remover o app.");
    if (!ok) return;
    ui.uninstallBtn.disabled = true;
    ui.uninstallBtn.textContent = "Limpando...";
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(ACCOUNT_KEY);
    localStorage.removeItem(EXTRAS_KEY);
    try {
      if (isNativeApp()) {
        await downloadsPlugin().uninstall();
        return;
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      setStatus("Dados deste launcher apagados. Remova o atalho da tela inicial para terminar.", 0);
    } catch (error) {
      setStatus(error.message || "Não deu para desinstalar. Tente de novo.", 0, true);
    } finally {
      ui.uninstallBtn.disabled = false;
      ui.uninstallBtn.textContent = "Desinstalar e limpar";
    }
  };

  document.querySelectorAll(".settings-nav-item").forEach((button) => {
    button.onclick = () => {
      const target = button.dataset.settings;
      document.querySelectorAll(".settings-nav-item").forEach((item) => item.classList.toggle("active", item === button));
      document.querySelectorAll(".settings-page").forEach((page) => {
        page.hidden = page.dataset.settingsPage !== target;
      });
    };
  });
}

async function boot() {
  initSlider();
  wire();
  try {
    state.pack = await fetch("./sitrus.config.json").then((res) => res.json());
  } catch {
    state.pack = {
      launcherName: "Sitrus Launcher",
      launcherVersion: "1.0.2",
      modrinthSlug: "sitrus-cobblemon-mobile",
      modrinthUrl: "https://modrinth.com/modpack/sitrus-cobblemon-mobile",
      runtimeUrl: "https://github.com/ZalithLauncher/ZalithLauncher2/releases/latest",
      discord: "https://discord.gg/wbavFswmkr",
      wiki: "https://sitruscoblemon.gitbook.io/sitruscoblemon-docs",
      store: "https://sitruscobblemon.craftingstore.net/",
      server: { name: "Sitrus Cobblemon", address: "sitruscobblemon.com" },
      game: { version: "1.21.1", loader: "fabric" },
    };
  }
  if (!state.settings.serverAddress) state.settings.serverAddress = state.pack.server?.address || "sitruscobblemon.com";
  bindSettings();
  renderAccount();
  const versionLabel = state.pack.launcherVersion ? `v${state.pack.launcherVersion}` : "dev";
  ui.launcherVersion.textContent = versionLabel;
  ui.launcherVersionHome.textContent = `Sitrus Launcher ${versionLabel}`;
  showTab(["home", "extras", "config"].includes(state.settings.lastTab) ? state.settings.lastTab : "home");
  setStatus(state.account ? `Bem-vindo, ${state.account.name}.` : "Entre com um nick para jogar.");
  refreshServer();
  setInterval(refreshServer, 60000);
  fetchLatestPack().catch(() => {
    ui.packVersion.textContent = "• Sitrus Cobblemon";
  });
  if ("serviceWorker" in navigator && !isNativeApp()) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

boot();
