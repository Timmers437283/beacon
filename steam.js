(function () {
    "use strict";

    const SHORTCUT_KEY = "beacon_steam_shortcuts";
    const STEAM_ICON = "Resources/AppBase/Steam/Steam.png";
    const STEAM_PREVIEW = "Resources/AppBase/Steam/Preview.png";

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

        // Register Steam as an installable app in the App Store.
        // Once installed, index.html's own code puts the icon on the desktop.
        if (!availableApps.some(a => a.id === "steam")) {
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

        const box = document.createElement("div");
        box.id = "steamShortcuts";
        desktop.insertBefore(box, document.getElementById("desktopApps"));
        renderShortcuts();
    }

    window.addEventListener("message", e => {
        if (e.origin !== location.origin) return;
        if (e.data && e.data.type === "beacon-steam-shortcut") renderShortcuts();
    });

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
