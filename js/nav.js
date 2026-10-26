/* Premium Liquid Glass Navigation with Spotlight-inspired Search */
const Nav = (() => {
  const nav = document.getElementById("glass-nav");
  const items = Array.from(nav.querySelectorAll(".nav-item:not(.nav-search-btn)"));
  const searchBtn = document.getElementById("nav-search-btn");
  const searchOverlay = document.getElementById("search-overlay");
  const searchInput = document.getElementById("search-input");
  const searchClose = document.getElementById("search-close");
  const searchClear = document.getElementById("search-clear");
  const searchResults = document.getElementById("search-results");
  const searchRecent = document.getElementById("search-recent");
  const searchSuggestions = document.getElementById("search-suggestions");
  const backdrop = document.getElementById("search-backdrop");

  // Navigation items for magnification
  const magItems = Array.from(nav.querySelectorAll(".nav-item:not(.nav-search-btn)"));
  const navRect = nav.getBoundingClientRect();

  // Magnification settings - reduced for more subtle effect but smooth feel
  const MAX_SCALE = 1.6;
  const SIGMA = 85;
  // Smoothing factor for spring-like easing (0 = instant, 1 = no movement)
  const SMOOTHING = 0.15;
  let currentScales = [];
  let pointerX = 0;
  let rafId = null;
  let isSearchOpen = false;

  // Search data - all searchable sections and controls
  const searchIndex = [
    // Navigation destinations
    { id: "dashboard", label: "Dashboard", category: "Navigation", icon: "📊", view: "dashboard", keywords: ["overview", "balance", "profit", "stats"] },
    { id: "scanner", label: "Arbitrage Scanner", category: "Navigation", icon: "🔍", view: "scanner", keywords: ["arbitrage", "opportunities", "prices", "spreads"] },
    { id: "flash", label: "Flash Loan", category: "Navigation", icon: "⚡", view: "flash", keywords: ["flash loan", "aave", "defi", "borrow"] },
    { id: "withdrawals", label: "Withdrawals", category: "Navigation", icon: "💸", view: "withdrawals", keywords: ["withdraw", "withdrawal", "history", "pending"] },
    { id: "profits", label: "Profits", category: "Navigation", icon: "📈", view: "dashboard", keywords: ["performance", "pnl", "equity", "returns"] },
    { id: "exchanges", label: "Exchange Connections", category: "Navigation", icon: "🔗", view: "exchanges", keywords: ["binance", "kucoin", "api", "connect", "keys"] },
    { id: "history", label: "Transaction History", category: "Navigation", icon: "📜", view: "history", keywords: ["trades", "log", "transactions", "records"] },
    { id: "settings", label: "Settings", category: "Navigation", icon: "⚙️", view: "settings", keywords: ["config", "preferences", "threshold", "position"] },

    // Dashboard controls
    { id: "start-bot", label: "Start Bot", category: "Dashboard", icon: "▶️", action: "start-bot", keywords: ["start", "run", "begin"] },
    { id: "stop-bot", label: "Stop Bot", category: "Dashboard", icon: "⏸️", action: "stop-bot", keywords: ["stop", "pause", "halt"] },
    { id: "reset-demo", label: "Reset Demo", category: "Dashboard", icon: "🔄", action: "reset-demo", keywords: ["reset", "restart", "clear"] },

    // Scanner controls
    { id: "min-spread", label: "Min Net Spread", category: "Scanner", icon: "📏", action: "min-spread", keywords: ["spread", "threshold", "minimum"] },
    { id: "max-position", label: "Max Position", category: "Scanner", icon: "💰", action: "max-position", keywords: ["position", "size", "amount"] },
    { id: "tick-speed", label: "Tick Speed", category: "Scanner", icon: "⚡", action: "tick-speed", keywords: ["speed", "interval", "rate"] },
    { id: "auto-trade", label: "Auto Trade", category: "Scanner", icon: "🤖", action: "auto-trade", keywords: ["auto", "automatic", "automated"] },

    // Flash Loan
    { id: "flash-asset", label: "Flash Loan Asset", category: "Flash Loan", icon: "💎", action: "flash-asset", keywords: ["asset", "token", "coin"] },
    { id: "flash-amount", label: "Flash Loan Amount", category: "Flash Loan", icon: "💰", action: "flash-amount", keywords: ["amount", "size", "quantity"] },
    { id: "flash-exec", label: "Execute Flash Loan", category: "Flash Loan", icon: "⚡", action: "flash-exec", keywords: ["execute", "run", "trigger"] },
    { id: "flash-start", label: "Start Auto Flash", category: "Flash Loan", icon: "🔄", action: "flash-start", keywords: ["auto", "automatic", "continuous"] },
    { id: "flash-stop", label: "Stop Auto Flash", category: "Flash Loan", icon: "⏹️", action: "flash-stop", keywords: ["stop", "halt", "pause"] },

    // Withdrawals
    { id: "withdraw-amount", label: "Withdraw Amount", category: "Withdrawals", icon: "💸", action: "withdraw-amount", keywords: ["withdraw", "amount", "withdrawal"] },
    { id: "withdraw-btn", label: "Execute Withdrawal", category: "Withdrawals", icon: "✅", action: "withdraw-btn", keywords: ["withdraw", "execute", "confirm"] },

    // Exchange Connections
    { id: "binance-key", label: "Binance API Key", category: "Exchanges", icon: "🔑", action: "binance-key", keywords: ["binance", "api", "key", "secret"] },
    { id: "kucoin-key", label: "KuCoin API Key", category: "Exchanges", icon: "🔑", action: "kucoin-key", keywords: ["kucoin", "api", "key", "secret", "passphrase"] },
    { id: "test-binance", label: "Test Binance Connection", category: "Exchanges", icon: "🔗", action: "test-binance", keywords: ["test", "connection", "binance"] },
    { id: "test-kucoin", label: "Test KuCoin Connection", category: "Exchanges", icon: "🔗", action: "test-kucoin", keywords: ["test", "connection", "kucoin"] },
    { id: "arm-trading", label: "Arm Real Trading", category: "Exchanges", icon: "🛡️", action: "arm-trading", keywords: ["arm", "enable", "real", "trading"] },

    // Settings
    { id: "reset-all", label: "Reset All Data", category: "Settings", icon: "🗑️", action: "reset-all", keywords: ["reset", "clear", "delete", "wipe"] },
  ];

  // Recent searches stored in localStorage
  let recentSearches = [];
  try {
    recentSearches = JSON.parse(localStorage.getItem("search-recent") || "[]");
  } catch (e) {
    recentSearches = [];
  }

  // Save recent searches
  function saveRecentSearches() {
    try {
      localStorage.setItem("search-recent", JSON.stringify(recentSearches.slice(0, 8)));
    } catch (e) {}
  }

  // Add to recent searches
  function addRecentSearch(query) {
    const trimmed = query.trim();
    if (!trimmed) return;
    recentSearches = recentSearches.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
    recentSearches.unshift(trimmed);
    saveRecentSearches();
  }

  // Render recent searches
  function renderRecentSearches() {
    if (!searchRecent) return;
    if (recentSearches.length === 0) {
      searchRecent.innerHTML = "";
      return;
    }
    searchRecent.innerHTML = `
      <div class="search-section-header">
        <span>Recent Searches</span>
        <button class="search-clear-recent" id="search-clear-recent" aria-label="Clear recent searches">Clear</button>
      </div>
      <div class="search-recent-list">
        ${recentSearches.map(q => `<button class="search-recent-item" data-query="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join("")}
      </div>
    `;
  }

  // Render search suggestions based on query
  function renderSuggestions(query) {
    if (!searchSuggestions) return;
    const term = query.toLowerCase().trim();
    if (!term) {
      searchSuggestions.innerHTML = "";
      renderRecentSearches();
      return;
    }

    const matches = searchIndex.filter(item => {
      const haystack = `${item.label} ${item.category} ${item.keywords.join(" ")}`.toLowerCase();
      return haystack.includes(term);
    }).slice(0, 10);

    if (matches.length === 0) {
      searchSuggestions.innerHTML = `
        <div class="search-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
          <p>No matches found</p>
        </div>
      `;
      return;
    }

    searchSuggestions.innerHTML = matches.map(item => `
      <button class="search-result-item" data-action="${item.action || ""}" data-view="${item.view || ""}" data-id="${item.id}">
        <span class="search-result-icon">${item.icon}</span>
        <div class="search-result-info">
          <span class="search-result-label">${highlightMatch(item.label, term)}</span>
          <span class="search-result-category">${item.category}</span>
        </div>
      </button>
    `).join("");
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function highlightMatch(text, term) {
    if (!term) return escapeHtml(text);
    const regex = new RegExp(`(${escapeRegExp(term)})`, "gi");
    return escapeHtml(text).replace(regex, "<mark>$1</mark>");
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Open search overlay
  function openSearch() {
    if (isSearchOpen) return;
    isSearchOpen = true;
    document.body.style.overflow = "hidden";
    searchOverlay.hidden = false;
    searchOverlay.classList.add("open");
    backdrop.hidden = false;
    backdrop.classList.add("open");
    searchInput.focus();
    renderRecentSearches();
  }

  // Close search overlay
  function closeSearch() {
    if (!isSearchOpen) return;
    isSearchOpen = false;
    document.body.style.overflow = "";
    searchOverlay.classList.remove("open");
    backdrop.classList.remove("open");
    setTimeout(() => {
      searchOverlay.hidden = true;
      backdrop.hidden = true;
      searchInput.value = "";
      if (searchSuggestions) searchSuggestions.innerHTML = "";
    }, 300);
  }

  // Handle search input
  function handleSearchInput(e) {
    const query = e.target.value;
    renderSuggestions(query);
    if (searchClear) searchClear.hidden = !query;
  }

  // Clear search input
  function clearSearch() {
    searchInput.value = "";
    searchInput.focus();
    renderSuggestions("");
    if (searchClear) searchClear.hidden = true;
  }

  // Handle result click
  function handleResultClick(e) {
    const result = e.target.closest(".search-result-item");
    if (!result) return;

    const action = result.dataset.action;
    const view = result.dataset.view;
    const id = result.dataset.id;

    // Add to recent searches
    const label = result.querySelector(".search-result-label")?.textContent || "";
    if (label) addRecentSearch(label);

    closeSearch();

    // Handle navigation
    if (view && window.Nav && typeof window.Nav.activate === "function") {
      window.Nav.activate(view);
    }

    // Handle specific actions
    if (action) {
      handleAction(action, view);
    }
  }

  function handleAction(action, view) {
    // Map actions to existing UI handlers
    const actionMap = {
      "start-bot": () => document.getElementById("btn-toggle")?.click(),
      "stop-bot": () => document.getElementById("btn-toggle")?.click(),
      "reset-demo": () => document.getElementById("btn-reset")?.click(),
      "min-spread": () => document.getElementById("set-minspread")?.focus(),
      "max-position": () => document.getElementById("set-maxpos")?.focus(),
      "tick-speed": () => document.getElementById("set-speed")?.focus(),
      "auto-trade": () => document.getElementById("set-autotrade")?.click(),
      "flash-exec": () => document.getElementById("flash-exec")?.click(),
      "flash-start": () => document.getElementById("flash-start")?.click(),
      "flash-stop": () => document.getElementById("flash-stop")?.click(),
      "withdraw-btn": () => document.getElementById("wd-btn")?.click(),
      "test-binance": () => document.getElementById("rt-test-bin")?.click(),
      "test-kucoin": () => document.getElementById("rt-test-kc")?.click(),
      "arm-trading": () => document.getElementById("rt-enable")?.click(),
      "reset-all": () => document.getElementById("btn-reset")?.click(),
    };

    if (actionMap[action]) {
      setTimeout(actionMap[action], 100);
    }
  }

  // Magnification logic - wave-like animation following finger position
  function updateMagnification() {
    const rect = nav.getBoundingClientRect();
    const navItems = Array.from(nav.querySelectorAll(".nav-item:not(.nav-search-btn)"));

    // Initialize currentScales array if needed
    if (currentScales.length !== navItems.length) {
      currentScales = new Array(navItems.length).fill(1);
    }

    navItems.forEach((item, index) => {
      const itemRect = item.getBoundingClientRect();
      const itemCenter = itemRect.left - rect.left + itemRect.width / 2;
      // Use pointerX (finger position) instead of centerX for wave-like animation
      const itemDist = Math.abs(itemCenter - pointerX);

      // Gaussian falloff for smooth spring-like feel
      const targetScale = 1 + (MAX_SCALE - 1) * Math.exp(-(itemDist * itemDist) / (2 * SIGMA * SIGMA));

      // Spring-like smoothing: lerp towards target scale
      currentScales[index] += (targetScale - currentScales[index]) * SMOOTHING;
      const scale = currentScales[index];

      item.style.transform = `scale(${scale})`;
      // grow icon slightly with the item
      const svg = item.querySelector("svg");
      if (svg) svg.style.transform = `scale(${1 + (scale - 1) * 0.6})`;
    });
    rafId = requestAnimationFrame(updateMagnification);
  }
  function handlePointer(e) {
    // ignore pointer events on the search button
    if (e.target.closest(".nav-search-btn")) return;
    const rect = nav.getBoundingClientRect();
    pointerX = e.clientX - rect.left;
    if (!rafId) rafId = requestAnimationFrame(updateMagnification);
  }

  function resetMagnification() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    const navItems = Array.from(nav.querySelectorAll(".nav-item:not(.nav-search-btn)"));
    navItems.forEach(item => {
      item.style.transform = "";
      const svg = item.querySelector("svg");
      if (svg) svg.style.transform = "";
    });
  }

  // Navigation activation
  function activate(id, save = true) {
    const view = document.getElementById("view-" + id);
    if (!view) return;

    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    view.classList.add("active");

    items.forEach(btn => btn.classList.toggle("active", btn.dataset.view === id));

    const btn = items.find(b => b.dataset.view === id);
    if (btn) {
      btn.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }

    if (save) {
      try { localStorage.setItem("arb-bot-view", id); } catch (e) {}
    }
  }

  // Initialize navigation
  items.forEach(btn => {
    btn.addEventListener("click", () => activate(btn.dataset.view));
  });

  // Search button click
  if (searchBtn) {
    searchBtn.addEventListener("click", openSearch);
  }

  // Close search
  if (searchClose) searchClose.addEventListener("click", closeSearch);
  if (backdrop) backdrop.addEventListener("click", closeSearch);
  if (searchClear) searchClear.addEventListener("click", clearSearch);

  // Search input
  if (searchInput) {
    searchInput.addEventListener("input", handleSearchInput);
    searchInput.addEventListener("keydown", e => {
      if (e.key === "Escape") closeSearch();
      if (e.key === "Enter") {
        const firstResult = searchSuggestions?.querySelector(".search-result-item");
        if (firstResult) firstResult.click();
      }
    });
  }

  // Recent searches click
  document.addEventListener("click", e => {
    const recentItem = e.target.closest(".search-recent-item");
    if (recentItem) {
      const query = recentItem.dataset.query;
      searchInput.value = query;
      handleSearchInput({ target: { value: query } });
      searchInput.focus();
    }
  });

  // Clear recent searches
  document.addEventListener("click", e => {
    if (e.target.id === "search-clear-recent") {
      recentSearches = [];
      saveRecentSearches();
      renderRecentSearches();
    }
  });

  // Result clicks
  if (searchSuggestions) {
    searchSuggestions.addEventListener("click", handleResultClick);
  }

  // Keyboard navigation for results
  searchInput?.addEventListener("keydown", e => {
    if (!searchSuggestions) return;
    const results = Array.from(searchSuggestions.querySelectorAll(".search-result-item"));
    if (results.length === 0) return;

    let currentIndex = results.findIndex(el => el.classList.contains("focused"));
    if (e.key === "ArrowDown") {
      e.preventDefault();
      currentIndex = Math.min(currentIndex + 1, results.length - 1);
      results.forEach((r, i) => r.classList.toggle("focused", i === currentIndex));
      results[currentIndex]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      currentIndex = Math.max(currentIndex - 1, 0);
      results.forEach((r, i) => r.classList.toggle("focused", i === currentIndex));
      results[currentIndex]?.scrollIntoView({ block: "nearest" });
    }
  });

  // Pointer events for magnification
  nav.addEventListener("pointermove", handlePointer);
  nav.addEventListener("pointerleave", resetMagnification);
  nav.addEventListener("pointerdown", handlePointer);

  // Touch support
  nav.addEventListener("touchmove", e => {
    if (e.touches[0]) {
      const touch = e.touches[0];
      const rect = nav.getBoundingClientRect();
      pointerX = touch.clientX - rect.left;
      if (!rafId) rafId = requestAnimationFrame(updateMagnification);
    }
  }, { passive: true });

  nav.addEventListener("touchend", resetMagnification, { passive: true });

  // Reduced motion
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (prefersReducedMotion.matches) {
    nav.style.setProperty("--magnification", "0");
  }

  // Expose activate for search results
  return { activate, openSearch, closeSearch };
})();

// Expose for search results
window.Nav = Nav;