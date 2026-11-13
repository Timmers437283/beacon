/*
 * Beacon desktop extras: Steam + NGames windows, game shortcuts, right-click menu, icon placement.
 * Needs ONE line in index.html, directly above the big <script> block (the one that starts with
 * "const wallpaperElement"):
 *
 *     <script src="steam.js"></script>
 */
(function () {
    "use strict";

    const STEAM_ICON = "Resources/AppBase/Steam/Steam.png";
    const STEAM_PREVIEW = "Resources/AppBase/Steam/Preview.png";
    const NGAMES_ICON = "Resources/AppBase/NGames/NGames.png";
    const NGAMES_PREVIEW = "Resources/AppBase/NGames/Preview.png";

    // The two game launchers. Each has its own window, page, saved shortcuts and desktop-icon id prefix.
    const SOURCES = [
        {
            name: "steam", title: "Steam", background: "#1b2838", icon: STEAM_ICON, preview: STEAM_PREVIEW,
            page: "steam.html", windowId: "steamWindow", frameId: "steamFrame",
            storage: "beacon_steam_shortcuts", prefix: "steam-game-", message: "beacon-steam-shortcut",
            width: 980, height: 620
        },
        {
            name: "ngames", title: "NGames", background: "#ebebeb", icon: NGAMES_ICON, preview: NGAMES_PREVIEW,
            page: "ngames.html", windowId: "ngamesWindow", frameId: "ngamesFrame",
            storage: "beacon_ngames_shortcuts", prefix: "ngames-game-", message: "beacon-ngames-shortcut",
            width: 980, height: 620
        }
    ];

    // desktop grid (matches the snapping in index.html)
    const ICON_W = 90, ICON_H = 100, STEP_X = 110, STEP_Y = 105, START = 20, TASKBAR = 48;

    /* ---------- windows, menu and styles (injected right away so index.html wires up drag/resize/maximize) ---------- */

    const style = document.createElement("style");
    style.textContent = `
        #gameShortcuts { position: absolute; inset: 0; pointer-events: none; }
        #gameShortcuts .desktop-icon { pointer-events: auto; }
        ${SOURCES.map(s => `#${s.windowId} { width: ${s.width}px; height: ${s.height}px; }`).join("\n")}

        #desktopMenu {
            position: fixed; z-index: 2000; min-width: 190px; padding: 5px; display: none;
            background: #202020f2; backdrop-filter: blur(20px);
            border: 1px solid #ffffff22; border-radius: 8px; box-shadow: 0 10px 35px #0009;
        }
        #desktopMenu.open { display: block; }
        #desktopMenu button {
            display: block; width: 100%; text-align: left; padding: 8px 12px; border: 0;
            border-radius: 5px; background: transparent; color: #fff; font-size: 13px; cursor: pointer;
        }
        #desktopMenu button:hover { background: #ffffff18; }
        #desktopMenu button.danger:hover { background: #c42b2b; }
        #desktopMenu .menu-sep { height: 1px; background: #ffffff18; margin: 5px 4px; }
    `;
    document.head.appendChild(style);

    SOURCES.forEach(s => {
        document.body.insertAdjacentHTML("beforeend", `
<div class="window" id="${s.windowId}">
    <div class="titlebar">
        <span class="window-title">${s.title}</span>
        <div class="window-controls">
            <button onclick="minimizeWindow('${s.windowId}')">&minus;</button>
            <button onclick="maximizeWindow('${s.windowId}')">&#9633;</button>
            <button class="close" onclick="closeWindow('${s.windowId}')">&times;</button>
        </div>
    </div>
    <div class="window-content" style="display:block;background:${s.background}">
        <iframe id="${s.frameId}" src="${s.page}" title="${s.title}" allow="fullscreen; autoplay; gamepad"
                style="width:100%;height:100%;border:0;background:${s.background}"></iframe>
    </div>
</div>`);
    });
    document.body.insertAdjacentHTML("beforeend", `<div id="desktopMenu"></div>`);

    /* ---------- game shortcuts (one list per launcher) ---------- */

    function loadShortcuts(source) {
        try {
            const list = JSON.parse(localStorage.getItem(source.storage) || "[]");
            return Array.isArray(list) ? list : [];
        } catch (e) { return []; }
    }

    function saveShortcuts(source, list) {
        try { localStorage.setItem(source.storage, JSON.stringify(list)); } catch (e) {}
    }

    function sourceForIconId(id) {
        return SOURCES.find(s => id.startsWith(s.prefix));
    }

    function launchGame(source, id) {
        openWindow(source.windowId);
        document.getElementById(source.frameId).src =
            source.page + "?play=" + encodeURIComponent(id) + "&_=" + Date.now();
    }

    function savePositions() {
        try { localStorage.setItem("desktopIconPositions", JSON.stringify(desktopIconPositions)); } catch (e) {}
    }

    function removeShortcut(source, gameId) {
        saveShortcuts(source, loadShortcuts(source).filter(s => s.id !== gameId));
        delete desktopIconPositions[source.prefix + gameId];
        savePositions();
        renderShortcuts();
    }

    function renderShortcuts() {
        const box = document.getElementById("gameShortcuts");
        if (!box) return;
        box.innerHTML = "";

        SOURCES.forEach(source => {
            loadShortcuts(source).forEach(game => {
                const icon = document.createElement("div");
                icon.className = "desktop-icon";
                icon.title = "Click to play " + game.title;

                const img = document.createElement("img");
                img.src = game.icon || source.icon;
                img.alt = game.title;
                img.style.borderRadius = "6px";
                img.onerror = () => { img.onerror = null; img.src = source.icon; };

                const label = document.createElement("span");
                label.textContent = game.title;

                icon.append(img, label);
                box.appendChild(icon);

                // position comes from the free-slot logic below (no saved spot yet = first empty spot)
                makeDesktopIconDraggable(icon, source.prefix + game.id, START, START, () => launchGame(source, game.id));
            });
        });
    }

    /* ---------- free-slot placement ---------- */

    function validIconIds() {
        const ids = new Set(["app-store"]);
        try { installedApps.forEach(id => ids.add(id)); } catch (e) {}
        SOURCES.forEach(source => loadShortcuts(source).forEach(s => ids.add(source.prefix + s.id)));
        return ids;
    }

    function takenSpots(exceptId) {
        const spots = [];
        document.querySelectorAll(".desktop-icon[data-desktop-id]").forEach(el => {
            if (el.dataset.desktopId === exceptId) return;
            const l = parseFloat(el.style.left), t = parseFloat(el.style.top);
            if (isFinite(l) && isFinite(t)) spots.push([l, t]);
        });
        const valid = validIconIds();
        Object.keys(desktopIconPositions).forEach(id => {
            if (id === exceptId || !valid.has(id)) return;
            const p = desktopIconPositions[id];
            if (p && isFinite(p.left) && isFinite(p.top)) spots.push([p.left, p.top]);
        });
        return spots;
    }

    function rowsPerColumn() {
        return Math.max(1, Math.floor((window.innerHeight - TASKBAR - START) / STEP_Y));
    }

    function findFreeSpot(exceptId) {
        const spots = takenSpots(exceptId);
        const rows = rowsPerColumn();
        const cols = Math.max(1, Math.floor((window.innerWidth - START) / STEP_X));

        for (let col = 0; col < cols; col++) {
            for (let row = 0; row < rows; row++) {
                const left = START + col * STEP_X;
                const top = START + row * STEP_Y;
                const busy = spots.some(([l, t]) => Math.abs(l - left) < ICON_W && Math.abs(t - top) < ICON_H);
                if (!busy) return { left, top };
            }
        }
        return { left: START, top: START };
    }

    // closest empty grid spot to a given position
    function nearestFreeSpot(exceptId, nearLeft, nearTop) {
        const spots = takenSpots(exceptId);
        const rows = rowsPerColumn();
        const cols = Math.max(1, Math.floor((window.innerWidth - START) / STEP_X));
        let best = null, bestDistance = Infinity;

        for (let col = 0; col < cols; col++) {
            for (let row = 0; row < rows; row++) {
                const left = START + col * STEP_X;
                const top = START + row * STEP_Y;
                const busy = spots.some(([l, t]) => Math.abs(l - left) < ICON_W && Math.abs(t - top) < ICON_H);
                if (busy) continue;
                const distance = Math.hypot(left - nearLeft, top - nearTop);
                if (distance < bestDistance) { bestDistance = distance; best = { left, top }; }
            }
        }
        return best;
    }

    // true if this icon's box touches any other icon's box on screen
    function overlapsOther(icon) {
        const a = icon.getBoundingClientRect();
        const margin = 8;
        return Array.from(document.querySelectorAll(".desktop-icon[data-desktop-id]")).some(other => {
            if (other === icon) return false;
            const b = other.getBoundingClientRect();
            if (!b.width || !b.height) return false;
            return a.left < b.right - margin && a.right > b.left + margin &&
                   a.top < b.bottom - margin && a.bottom > b.top + margin;
        });
    }

    function moveIcon(icon, spot) {
        const id = icon.dataset.desktopId;
        icon.style.left = spot.left + "px";
        icon.style.top = spot.top + "px";
        desktopIconPositions[id] = { left: spot.left, top: spot.top };
        savePositions();
    }

    // icons that are already stacked on each other get separated
    function separateStackedIcons() {
        document.querySelectorAll(".desktop-icon[data-desktop-id]").forEach(icon => {
            if (!overlapsOther(icon)) return;
            const spot = nearestFreeSpot(icon.dataset.desktopId, parseFloat(icon.style.left) || 0, parseFloat(icon.style.top) || 0);
            if (spot) moveIcon(icon, spot);
        });
    }

    // if an icon is dropped on top of another one, send it back to where it was grabbed
    function preventOverlap(icon) {
        if (icon.dataset.beaconNoOverlap) return;
        icon.dataset.beaconNoOverlap = "1";

        let before = null;

        icon.addEventListener("pointerdown", event => {
            if (event.button !== 0) return;
            before = { left: parseFloat(icon.style.left), top: parseFloat(icon.style.top) };
        });

        icon.addEventListener("pointerup", () => {
            const id = icon.dataset.desktopId;
            const left = parseFloat(icon.style.left);
            const top = parseFloat(icon.style.top);
            if (!id || !before || !isFinite(left) || !isFinite(top)) return;
            if (left === before.left && top === before.top) return;   // was only a click

            if (!overlapsOther(icon)) return;

            moveIcon(icon, before);

            // if that old spot was somehow also stacked, use the nearest empty one instead
            if (overlapsOther(icon)) {
                const spot = nearestFreeSpot(id, before.left, before.top);
                if (spot) moveIcon(icon, spot);
            }
        });
    }

    function installPlacementHook() {
        if (typeof makeDesktopIconDraggable !== "function" || makeDesktopIconDraggable.__beaconHooked) return;

        const original = makeDesktopIconDraggable;

        const hooked = function (icon, id, defaultLeft, defaultTop, onOpen) {
            const saved = desktopIconPositions[id];
            if (!saved || !isFinite(saved.left) || !isFinite(saved.top)) {
                const spot = findFreeSpot(id);
                desktopIconPositions[id] = spot;
                savePositions();
            }
            const result = original.call(this, icon, id, defaultLeft, defaultTop, onOpen);
            preventOverlap(icon);   // registered after the original drag code, so it runs after it
            return result;
        };
        hooked.__beaconHooked = true;
        window.makeDesktopIconDraggable = hooked;

        // icons already on the desktop: give them a spot if they have none, and guard them too
        document.querySelectorAll(".desktop-icon[data-desktop-id]").forEach(icon => {
            const id = icon.dataset.desktopId;
            const saved = desktopIconPositions[id];
            if (!saved || !isFinite(saved.left) || !isFinite(saved.top)) {
                const spot = findFreeSpot(id);
                icon.style.left = spot.left + "px";
                icon.style.top = spot.top + "px";
                desktopIconPositions[id] = spot;
            }
            preventOverlap(icon);
        });
        savePositions();
    }

    function arrangeIcons() {
        const icons = Array.from(document.querySelectorAll(".desktop-icon[data-desktop-id]"));
        icons.sort((a, b) => (a.dataset.desktopId === "app-store" ? -1 : 0) - (b.dataset.desktopId === "app-store" ? -1 : 0));

        const rows = rowsPerColumn();
        icons.forEach((icon, i) => {
            const left = START + Math.floor(i / rows) * STEP_X;
            const top = START + (i % rows) * STEP_Y;
            icon.style.left = left + "px";
            icon.style.top = top + "px";
            desktopIconPositions[icon.dataset.desktopId] = { left, top };
        });
        savePositions();
    }

    /* ---------- delete / uninstall ---------- */

    function uninstallApp(id) {
        const i = installedApps.indexOf(id);
        if (i > -1) installedApps.splice(i, 1);
        try { localStorage.setItem("installedApps", JSON.stringify(installedApps)); } catch (e) {}

        delete desktopIconPositions[id];
        savePositions();

        const app = availableApps.find(a => a.id === id);
        if (app && app.windowId) closeWindow(app.windowId);

        const source = SOURCES.find(s => s.name === id);
        if (source) document.getElementById(source.frameId).src = source.page;   // leave any running game

        renderApps();
        renderDesktopApps();
    }

    /* ---------- right-click menu ---------- */

    const menu = document.getElementById("desktopMenu");

    function hideMenu() { menu.classList.remove("open"); }

    function showMenu(x, y, items) {
        menu.innerHTML = "";
        items.forEach(item => {
            if (item === "sep") {
                const sep = document.createElement("div");
                sep.className = "menu-sep";
                menu.appendChild(sep);
                return;
            }
            const button = document.createElement("button");
            button.textContent = item.label;
            if (item.danger) button.className = "danger";
            button.onclick = () => { hideMenu(); item.action(); };
            menu.appendChild(button);
        });

        menu.classList.add("open");
        const w = menu.offsetWidth, h = menu.offsetHeight;
        menu.style.left = Math.max(0, Math.min(x, window.innerWidth - w - 4)) + "px";
        menu.style.top = Math.max(0, Math.min(y, window.innerHeight - h - 4)) + "px";
    }

    function iconMenu(icon) {
        const id = icon.dataset.desktopId;
        const items = [{ label: "Open", action: () => icon.click() }];
        const source = sourceForIconId(id);

        if (source) {
            items.push("sep", { label: "Remove shortcut", danger: true, action: () => removeShortcut(source, id.slice(source.prefix.length)) });
        } else if (id !== "app-store") {
            items.push("sep", { label: "Delete", danger: true, action: () => uninstallApp(id) });
        }
        return items;
    }

    function desktopMenu() {
        return [
            { label: "Open App Store", action: () => openWindow("storeWindow") },
            { label: "Settings", action: () => openWindow("settingsWindow") },
            "sep",
            { label: "Arrange icons", action: arrangeIcons },
            { label: "Refresh", action: () => location.reload() }
        ];
    }

    document.addEventListener("contextmenu", e => {
        if (e.target.closest("input, textarea")) return;   // keep normal copy/paste menu in text boxes
        e.preventDefault();
        if (e.target.closest("#desktopMenu")) return;

        const icon = e.target.closest(".desktop-icon[data-desktop-id]");
        if (icon) { showMenu(e.clientX, e.clientY, iconMenu(icon)); return; }

        if (e.target.closest(".window, .taskbar, #calendarPanel")) { hideMenu(); return; }

        showMenu(e.clientX, e.clientY, desktopMenu());
    });

    document.addEventListener("pointerdown", e => {
        if (!e.target.closest("#desktopMenu")) hideMenu();
    }, true);
    document.addEventListener("keydown", e => { if (e.key === "Escape") hideMenu(); });
    window.addEventListener("blur", hideMenu);
    window.addEventListener("resize", hideMenu);

    /* ---------- start up ---------- */

    function init() {
        const desktop = document.querySelector(".desktop");
        if (!desktop) return;

        try { installPlacementHook(); }
        catch (e) { console.error("Beacon: could not set up icon placement", e); }

        // Backup only: if Steam / NGames are NOT in index.html's availableApps list, register them here.
        try {
            if (typeof availableApps !== "undefined") {
                let added = false;
                SOURCES.forEach(s => {
                    if (availableApps.some(a => a.id === s.name)) return;
                    availableApps.push({ id: s.name, name: s.title, icon: s.icon, preview: s.preview, windowId: s.windowId });
                    added = true;
                });
                if (added) { renderApps(); renderDesktopApps(); }
            }
        } catch (e) {
            console.error("Beacon: could not register apps in the App Store", e);
        }

        try {
            const box = document.createElement("div");
            box.id = "gameShortcuts";
            desktop.insertBefore(box, document.getElementById("desktopApps"));
            renderShortcuts();
        } catch (e) {
            console.error("Beacon: could not set up desktop shortcuts", e);
        }

        try { separateStackedIcons(); }
        catch (e) { console.error("Beacon: could not separate stacked icons", e); }
    }

    // the launcher pages tell us when a shortcut should appear
    window.addEventListener("message", e => {
        if (e.origin !== location.origin) return;
        if (e.data && SOURCES.some(s => s.message === e.data.type)) renderShortcuts();
    });

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
