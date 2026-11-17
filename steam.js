/*
 * Beacon desktop extras: Steam window + right-click menu.
 * Needs this line in index.html, directly above the big <script> block:
 *
 *     <script src="steam.js"></script>
 */
(function () {
    "use strict";

    // Windows are only created here if index.html did not already make them
    // (index.html makes the NGames one itself, so it is never duplicated).
    const SOURCES = [
        {
            name: "steam", title: "Steam", background: "#1b2838",
            page: "steam.html", windowId: "steamWindow", width: 980, height: 620
        },
        {
            name: "ngames", title: "NGames", background: "#ebebeb",
            page: "https://timmers437283.github.io/beacon/Resources/AppBase/NGames/ngames.html",
            windowId: "ngamesWindow", width: 980, height: 620
        }
    ];

    const style = document.createElement("style");
    style.textContent = `
        ${SOURCES.map(s => `#${s.windowId} { width: ${s.width}px; height: ${s.height}px; }`).join("\n")}

        #desktopMenu {
            position: fixed; z-index: 60000; min-width: 190px; padding: 5px; display: none;
            background: #202020f2; backdrop-filter: blur(20px);
            border: 1px solid #ffffff22; border-radius: 8px; box-shadow: 0 10px 35px #0009;
        }
        #desktopMenu.open { display: block; }
        #desktopMenu button {
            display: block; width: 100%; text-align: left; padding: 8px 12px; border: 0;
            border-radius: 5px; background: transparent; color: #fff; font-size: 13px; cursor: pointer;
        }
        #desktopMenu button:hover { background: #ffffff18; }
        #desktopMenu .menu-sep { height: 1px; background: #ffffff18; margin: 5px 4px; }
    `;
    document.head.appendChild(style);

    /* ---------- windows ---------- */

    function ensureWindows() {
        SOURCES.forEach(s => {
            let win = document.getElementById(s.windowId);

            if (!win) {
                // The buttons use data-act, which index.html's window code handles (close / maximize / minimize).
                document.body.insertAdjacentHTML("beforeend", `
<div class="window" id="${s.windowId}">
    <div class="titlebar">
        <span class="window-title">${s.title}</span>
        <div class="window-controls">
            <button data-act="min">&minus;</button>
            <button data-act="max">&#9633;</button>
            <button class="close" data-act="close">&times;</button>
        </div>
    </div>
    <div class="window-content" style="display:block;background:${s.background}">
        <iframe src="${s.page}" title="${s.title}" allow="fullscreen; autoplay; gamepad"
                style="width:100%;height:100%;border:0;background:${s.background}"></iframe>
    </div>
</div>`);
                win = document.getElementById(s.windowId);
            }

            // remember the app's home page so closing + reopening starts it fresh (not on the last game)
            const frame = win && win.querySelector("iframe");
            if (frame && !frame.dataset.home) frame.dataset.home = frame.getAttribute("src");
        });
    }

    /* ---------- right-click menu ---------- */

    let menu;

    function hideMenu() { if (menu) menu.classList.remove("open"); }

    function openApp(id) {
        if (typeof launch === "function") launch(id);
        else if (typeof openWindow === "function") openWindow(id);
    }

    function showMenu(x, y) {
        const items = [
            { label: "Open App Store", action: () => openApp("storeWindow") },
            { label: "Settings", action: () => openApp("settingsWindow") },
            "sep",
            { label: "Refresh", action: () => location.reload() }
        ];

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
            button.onclick = () => { hideMenu(); item.action(); };
            menu.appendChild(button);
        });

        menu.classList.add("open");
        const w = menu.offsetWidth, h = menu.offsetHeight;
        menu.style.left = Math.max(0, Math.min(x, window.innerWidth - w - 4)) + "px";
        menu.style.top = Math.max(0, Math.min(y, window.innerHeight - h - 4)) + "px";
    }

    function setupMenu() {
        menu = document.createElement("div");
        menu.id = "desktopMenu";
        document.body.appendChild(menu);

        document.addEventListener("contextmenu", e => {
            if (e.target.closest("input, textarea")) return;   // keep the normal copy/paste menu in text boxes
            e.preventDefault();
            if (e.target.closest("#desktopMenu")) return;
            if (e.target.closest(".window, .taskbar, #startMenu, #calendarPanel, #announcePanel")) { hideMenu(); return; }
            showMenu(e.clientX, e.clientY);
        });

        document.addEventListener("pointerdown", e => {
            if (!e.target.closest("#desktopMenu")) hideMenu();
        }, true);
        document.addEventListener("keydown", e => { if (e.key === "Escape") hideMenu(); });
        window.addEventListener("blur", hideMenu);
        window.addEventListener("resize", hideMenu);
    }

    /* ---------- start up ---------- */

    function init() {
        try { ensureWindows(); }
        catch (e) { console.error("Beacon: could not set up app windows", e); }

        try { setupMenu(); }
        catch (e) { console.error("Beacon: could not set up the right-click menu", e); }
    }

    // wait for the page so index.html has already built its own windows
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
