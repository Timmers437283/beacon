/*
 * Beacon Steam integration
 * Add ONE line to index.html, directly above the big <script> block (the one that starts with
 * "const wallpaperElement"):
 *
 *     <script src="steam.js"></script>
 *
 * It adds: a Steam window (shows steam.html), a Steam icon on the desktop, and the
 * "Steam shortcut" icons that appear after someone clicks Play with the checkbox ticked.
 */
(function () {
    "use strict";

    const SHORTCUT_KEY = "beacon_steam_shortcuts";
    const STEAM_ICON = "Resources/AppBase/Steam/Steam.png";
    const STEAM_PREVIEW = "Resources/AppBase/Steam/Preview.png";

    /* ---------- window + styles (injected right away so index.html wires up drag/resize/maximize) ---------- */

    const style = document.createElement("style");
    style.textContent = `
        #steamShortcuts { position: absolute; inset: 0; pointer-events: none; }
        #steamShortcuts .desktop-icon { pointer-events: auto; }
        #steamWindow { width: 980px; height: 620px; }
    `;
    document.head.appendChild(style);

    document.body.insertAdjacentHTML("beforeend", `
<div class="window" id="steamWindow">
    <div class="titlebar">
        <span class="window-title">Steam</span>
        <div class="window-controls">
            <button onclick="minimizeWindow('steamWindow')">&minus;</button>
            <button onclick="maximizeWindow('steamWindow')">&#9633;</button>
            <button class="close" onclick="closeWindow('steamWindow')">&times;</button>
        </div>
    </div>
    <div class="window-content" style="display:block;background:#1b2838">
        <iframe id="steamFrame" src="steam.html" title="Steam" allow="fullscreen; autoplay; gamepad"
                style="width:100%;height:100%;border:0;background:#1b2838"></iframe>
    </div>
</div>`);

    /* ---------- desktop icons (need index.html's functions, so wait until the page has loaded) ---------- */

    function loadShortcuts() {
        try {
            const list = JSON.parse(localStorage.getItem(SHORTCUT_KEY) || "[]");
            return Array.isArray(list) ? list : [];
        } catch (e) { return []; }
    }

    function saveShortcuts(list) {
        try { localStorage.setItem(SHORTCUT_KEY, JSON.stringify(list)); } catch (e) {}
    }

    function launchGame(id) {
        openWindow("steamWindow");
        document.getElementById("steamFrame").src =
            "steam.html?play=" + encodeURIComponent(id) + "&_=" + Date.now();
    }

    function removeShortcut(game) {
        saveShortcuts(loadShortcuts().filter(s => s.id !== game.id));
        const key = "steam-game-" + game.id;
        try { delete desktopIconPositions[key]; localStorage.setItem("desktopIconPositions", JSON.stringify(desktopIconPositions)); } catch (e) {}
        renderShortcuts();
    }

    function renderShortcuts() {
        const box = document.getElementById("steamShortcuts");
        if (!box) return;
        box.innerHTML = "";

        loadShortcuts().forEach((game, index) => {
            const icon = document.createElement("div");
            icon.className = "desktop-icon";
            icon.title = "Click to play " + game.title + " (right-click to remove)";

            const img = document.createElement("img");
            img.src = game.icon || STEAM_ICON;
            img.alt = game.title;
            img.style.borderRadius = "6px";
            img.onerror = () => { img.onerror = null; img.src = STEAM_ICON; };

            const label = document.createElement("span");
            label.textContent = game.title;

            icon.append(img, label);
            box.appendChild(icon);

            makeDesktopIconDraggable(
                icon,
                "steam-game-" + game.id,
                130,
                20 + index * 105,
                () => launchGame(game.id)
            );

            icon.addEventListener("contextmenu", e => {
                e.preventDefault();
                if (confirm('Remove the "' + game.title + '" shortcut from the desktop?')) removeShortcut(game);
            });
        });
    }

    function init() {
        const desktop = document.querySelector(".desktop");
        if (!desktop) return;

        // Backup only: if you did NOT add Steam to availableApps in index.html, register it here.
        // (If it is already in index.html's list, this does nothing.)
        try {
            if (typeof availableApps !== "undefined" && !availableApps.some(a => a.id === "steam")) {
                availableApps.push({
                    id: "steam",
                    name: "Steam",
                    icon: STEAM_ICON,
                    preview: STEAM_PREVIEW,
                    windowId: "steamWindow"
                });
                renderApps();
                renderDesktopApps();
            }
        } catch (e) {
            console.error("Steam: could not register in the App Store", e);
        }

        // container for game shortcuts
        try {
            const box = document.createElement("div");
            box.id = "steamShortcuts";
            desktop.insertBefore(box, document.getElementById("desktopApps"));
            renderShortcuts();
        } catch (e) {
            console.error("Steam: could not set up desktop shortcuts", e);
        }
    }

    // steam.html tells us when a shortcut should appear
    window.addEventListener("message", e => {
        if (e.origin !== location.origin) return;
        if (e.data && e.data.type === "beacon-steam-shortcut") renderShortcuts();
    });

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
