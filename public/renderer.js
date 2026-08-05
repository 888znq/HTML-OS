let openWindows = {}; 
let activeZIndex = 10;
let targetAppId = null; 

let savedApps = JSON.parse(localStorage.getItem('my_desktop_apps')) || [];

const builtinBrowser = {
  id: 'builtin_browser',
  name: 'Browser',
  icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%230078D7"/><path d="M15,50 A35,45 0 0,0 85,50 A35,45 0 0,0 15,50" fill="none" stroke="white" stroke-width="4"/><path d="M50,5 L50,95 M5,50 L95,50" stroke="white" stroke-width="4"/></svg>',
  source: 'https://www.google.com/search?igu=1', // Requires iframe friendly google
  x: 20, y: 20,
  isBrowser: true 
};

window.onload = () => {
  if (!savedApps.find(a => a.id === 'builtin_browser')) {
    savedApps.unshift(builtinBrowser);
    localStorage.setItem('my_desktop_apps', JSON.stringify(savedApps));
  }
  savedApps.forEach(app => { createDesktopIcon(app); createTaskbarPin(app); });
  updateClock();
  setInterval(updateClock, 1000);
  updateTaskbarStyles();
};

function updateClock() {
  const now = new Date();
  document.getElementById('clock-time').innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  document.getElementById('clock-date').innerText = now.toLocaleDateString();
}

function updateTaskbarStyles() {
  let highestZ = -1; let activeId = null;
  for (let id in openWindows) {
    if (openWindows[id].style.display !== 'none') {
      const z = parseInt(openWindows[id].style.zIndex || 0);
      if (z > highestZ) { highestZ = z; activeId = id; }
    }
  }
  document.querySelectorAll('.taskbar-item').forEach(pin => {
    const id = pin.getAttribute('data-id');
    pin.classList.remove('running', 'active');
    if (openWindows[id]) {
      pin.classList.add('running');
      if (id === activeId && openWindows[id].style.display !== 'none') pin.classList.add('active');
    }
  });
}

function handleTaskbarClick(app) {
  if (app.isWorkspace) { launchAppOrWorkspace(app); return; }
  const win = openWindows[app.id];
  if (!win) { openAppWindow(app); } 
  else {
     if (win.style.display === 'none') { win.style.display = 'flex'; bringToFront(win); } 
     else {
         if (document.querySelector(`.taskbar-item[data-id="${app.id}"]`).classList.contains('active')) {
             win.style.display = 'none'; updateTaskbarStyles();
         } else { bringToFront(win); }
     }
  }
}

document.getElementById('add-app-btn').onclick = () => document.getElementById('add-modal').classList.remove('hidden');
document.getElementById('close-modal').onclick = () => document.getElementById('add-modal').classList.add('hidden');

document.getElementById('combine-btn').onclick = () => {
  if (Object.values(openWindows).filter(w => w.style.display !== 'none').length === 0) return alert("No open windows to combine!");
  document.getElementById('workspace-modal').classList.remove('hidden');
};
document.getElementById('close-workspace-modal').onclick = () => document.getElementById('workspace-modal').classList.add('hidden');

document.getElementById('save-workspace-btn').onclick = () => {
  const layoutApp = {
    id: 'workspace_' + Date.now(),
    name: document.getElementById('workspace-name').value || 'New Workspace',
    isWorkspace: true,
    icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="45" height="45" fill="%23e94560"/><rect x="55" width="45" height="45" fill="%230078D7"/><rect y="55" width="45" height="45" fill="%230078D7"/><rect x="55" y="55" width="45" height="45" fill="%23e94560"/></svg>',
    x: 100, y: 100,
    windows: Object.values(openWindows).filter(w => w.style.display !== 'none').map(win => ({ id: win.id, left: win.style.left, top: win.style.top, width: win.style.width, height: win.style.height }))
  };
  savedApps.push(layoutApp); localStorage.setItem('my_desktop_apps', JSON.stringify(savedApps));
  createDesktopIcon(layoutApp); createTaskbarPin(layoutApp);
  document.getElementById('workspace-modal').classList.add('hidden');
};

document.getElementById('save-app').onclick = () => {
  let url = document.getElementById('app-url').value;
  if (url && !url.startsWith('http')) url = `https://${url}`;
  if(url) {
    const newApp = { 
        id: 'app_' + Date.now(), 
        name: document.getElementById('app-name').value || 'New App', 
        source: url, 
        icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%230078D7"/><text x="50" y="65" font-size="50" text-anchor="middle" fill="white">App</text></svg>', 
        x: 100, y: 100 
    };
    savedApps.push(newApp); localStorage.setItem('my_desktop_apps', JSON.stringify(savedApps));
    createDesktopIcon(newApp); createTaskbarPin(newApp);
  }
  document.getElementById('add-modal').classList.add('hidden');
  document.querySelectorAll('input').forEach(el => el.value = '');
};

function createDesktopIcon(app) {
  const icon = document.createElement('div');
  icon.className = 'desktop-icon'; icon.setAttribute('data-id', app.id); 
  icon.style.left = (app.x || 20) + 'px'; icon.style.top = (app.y || 20) + 'px';
  icon.innerHTML = `<img src="${app.icon}"> <span>${app.name}</span>`;
  
  // Touch support for Android
  let moved = false;
  icon.addEventListener('pointerdown', (e) => {
      moved = false;
      const startX = e.clientX - icon.offsetLeft;
      const startY = e.clientY - icon.offsetTop;
      const moveHandler = (ev) => {
          moved = true;
          icon.style.left = (ev.clientX - startX) + 'px';
          icon.style.top = (ev.clientY - startY) + 'px';
      };
      const upHandler = () => {
          document.removeEventListener('pointermove', moveHandler);
          document.removeEventListener('pointerup', upHandler);
          if(!moved) launchAppOrWorkspace(app);
          else {
              const found = savedApps.find(a => a.id === app.id);
              if (found) { found.x = parseInt(icon.style.left); found.y = parseInt(icon.style.top); localStorage.setItem('my_desktop_apps', JSON.stringify(savedApps)); }
          }
      };
      document.addEventListener('pointermove', moveHandler);
      document.addEventListener('pointerup', upHandler);
  });
  
  icon.oncontextmenu = (e) => {
    e.preventDefault(); 
    if (app.id === 'builtin_browser') return alert("System apps cannot be unpinned.");
    targetAppId = app.id;
    const menu = document.getElementById('context-menu');
    menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px';
    menu.classList.remove('hidden');
  };
  document.getElementById('desktop').appendChild(icon);
}

function createTaskbarPin(app) {
  const pin = document.createElement('div'); pin.className = 'taskbar-item'; pin.setAttribute('data-id', app.id); 
  pin.innerHTML = `<img src="${app.icon}"> <span>${app.name}</span>`;
  pin.onclick = () => handleTaskbarClick(app);
  document.getElementById('taskbar-apps').appendChild(pin);
}

function launchAppOrWorkspace(app) {
  if (app.isWorkspace) { app.windows.forEach(w => { const realApp = savedApps.find(a => a.id === w.id); if (realApp) openAppWindow(realApp, w); }); } 
  else { openAppWindow(app); }
}

function openAppWindow(app, layoutOverrides = null) {
  if(openWindows[app.id]) {
     const win = openWindows[app.id]; win.style.display = 'flex';
     if (layoutOverrides) { win.style.left = layoutOverrides.left; win.style.top = layoutOverrides.top; win.style.width = layoutOverrides.width; win.style.height = layoutOverrides.height; }
     bringToFront(win); return;
  }
  const win = document.createElement('div'); win.className = 'app-window'; win.id = app.id;
  if (layoutOverrides) { win.style.left = layoutOverrides.left; win.style.top = layoutOverrides.top; win.style.width = layoutOverrides.width; win.style.height = layoutOverrides.height; } 
  else { win.style.left = '10px'; win.style.top = '10px'; win.style.width = '90%'; win.style.height = '80%'; }
  
  const webContent = app.isBrowser ? `
    <div class="browser-bar">
      <button class="b-ref" title="Reload">↻</button>
      <input type="text" class="b-url" value="${app.source}" placeholder="Search Google or type a URL">
      <button class="b-go">Go</button>
    </div>
    <iframe src="${app.source}"></iframe>` : `<iframe src="${app.source}"></iframe>`;

  win.innerHTML = `
    <div class="resizer e"></div><div class="resizer s"></div>
    <div class="window-header">
      <span class="title"><img src="${app.icon}" style="width:16px; height:16px; border-radius:2px;"> ${app.name}</span>
      <div class="controls">
        <button class="btn-min">─</button>
        <div class="max-container">
          <button class="btn-max">☐</button>
          <div class="snap-menu">
            <div class="snap-icon snap-full" onclick="snap('${app.id}', 'full')"></div>
            <div class="snap-icon snap-left" onclick="snap('${app.id}', 'left')"></div>
            <div class="snap-icon snap-right" onclick="snap('${app.id}', 'right')"></div>
          </div>
        </div>
        <button class="btn-close">✕</button>
      </div>
    </div>
    <div class="window-content">${webContent}</div>
  `;

  document.getElementById('desktop').appendChild(win); openWindows[app.id] = win; bringToFront(win);
  
  makeDraggable(win, win.querySelector('.title'));
  makeResizable(win);

  win.onpointerdown = () => bringToFront(win);
  win.querySelector('.btn-close').onclick = () => { win.remove(); delete openWindows[app.id]; updateTaskbarStyles(); };
  win.querySelector('.btn-min').onclick = () => { win.style.display = 'none'; updateTaskbarStyles(); };
  win.querySelector('.btn-max').onclick = () => snap(app.id, 'full');

  if (app.isBrowser) {
    const iframe = win.querySelector('iframe');
    const urlInput = win.querySelector('.b-url');
    win.querySelector('.b-ref').onclick = () => iframe.src = iframe.src;
    const navigate = () => {
       let url = urlInput.value.trim();
       if (!url) return;
       if (!url.startsWith('http')) url = url.includes(' ') || !url.includes('.') ? 'https://www.google.com/search?igu=1&q=' + encodeURIComponent(url) : 'https://' + url;
       iframe.src = url;
    };
    win.querySelector('.b-go').onclick = navigate;
  }
}

window.snap = (id, position) => {
  const win = openWindows[id]; win.style.transition = 'all 0.15s ease-out';
  if (position === 'full') { win.style.left = '0'; win.style.top = '0'; win.style.width = '100%'; win.style.height = '100%'; } 
  else if (position === 'left') { win.style.left = '0'; win.style.top = '0'; win.style.width = '50%'; win.style.height = '100%'; } 
  else if (position === 'right') { win.style.left = '50%'; win.style.top = '0'; win.style.width = '50%'; win.style.height = '100%'; }
  setTimeout(() => win.style.transition = 'none', 200);
};

function bringToFront(winElement) { activeZIndex++; winElement.style.zIndex = activeZIndex; updateTaskbarStyles(); }

function makeDraggable(win, handle) {
  handle.onpointerdown = (e) => {
    bringToFront(win);
    const startX = e.clientX - win.offsetLeft; const startY = e.clientY - win.offsetTop;
    const move = (ev) => { win.style.left = (ev.clientX - startX) + 'px'; win.style.top = (ev.clientY - startY) + 'px'; };
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  };
}

function makeResizable(win) {
  win.querySelectorAll('.resizer').forEach(resizer => {
    resizer.onpointerdown = (e) => {
      const startX = e.clientX; const startY = e.clientY;
      const startWidth = win.offsetWidth; const startHeight = win.offsetHeight;
      const iframe = win.querySelector('iframe'); if(iframe) iframe.style.pointerEvents = 'none';
      
      const move = (ev) => {
        if (resizer.classList.contains('e')) win.style.width = startWidth + (ev.clientX - startX) + 'px';
        if (resizer.classList.contains('s')) win.style.height = startHeight + (ev.clientY - startY) + 'px';
      };
      const up = () => { 
          document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); 
          if(iframe) iframe.style.pointerEvents = 'auto';
      };
      document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
    };
  });
}

document.addEventListener('pointerdown', () => document.getElementById('context-menu').classList.add('hidden'));

document.getElementById('delete-app-btn').onclick = () => {
  if (!targetAppId) return;
  savedApps = savedApps.filter(app => app.id !== targetAppId); localStorage.setItem('my_desktop_apps', JSON.stringify(savedApps));
  const icon = document.querySelector(`.desktop-icon[data-id="${targetAppId}"]`); const pin = document.querySelector(`.taskbar-item[data-id="${targetAppId}"]`);
  if (icon) icon.remove(); if (pin) pin.remove();
  if (openWindows[targetAppId]) { openWindows[targetAppId].remove(); delete openWindows[targetAppId]; updateTaskbarStyles(); }
  targetAppId = null; 
};