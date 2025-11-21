const endpoints = {
  premium: 'https://rumedia.io/media/admin-cp/manage-songs?check_pro=1',
  singles: 'https://rumedia.io/media/admin-cp/manage-songs?check=1'
};

const proxyEndpoint = 'proxy.php';

const toggles = document.querySelectorAll('.toggle');
const trackGrid = document.getElementById('tracks');
const emptyState = document.getElementById('empty-state');
const toast = document.getElementById('toast');
const timestamp = document.getElementById('timestamp');
const loaded = document.getElementById('loaded');
const sessionInput = document.getElementById('session');
const saveSession = document.getElementById('save-session');
let currentSource = 'premium';
let sessionId = localStorage.getItem('rumedia_session') || '';

if (sessionId) {
  sessionInput.value = sessionId;
}

saveSession.addEventListener('click', () => {
  sessionId = sessionInput.value.trim();
  if (sessionId) {
    localStorage.setItem('rumedia_session', sessionId);
    showToast('PHPSESSID сохранён');
  } else {
    localStorage.removeItem('rumedia_session');
    showToast('PHPSESSID очищен');
  }
});

async function fetchDirect(url) {
  const target = sessionId
    ? `${url}${url.includes('?') ? '&' : '?'}PHPSESSID=${encodeURIComponent(sessionId)}`
    : url;
  const response = await fetch(target, { mode: 'cors', credentials: 'include' });
  if (!response.ok) throw new Error(`Ошибка загрузки: ${response.status}`);
  return response.text();
}

async function fetchViaProxy(url) {
  const searchParams = new URLSearchParams({ url });
  if (sessionId) searchParams.set('phpsessid', sessionId);
  const proxyUrl = `${proxyEndpoint}?${searchParams.toString()}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) throw new Error('Прокси недоступен');
  return response.text();
}

async function fetchAllOrigins(url) {
  const target = sessionId
    ? `${url}${url.includes('?') ? '&' : '?'}PHPSESSID=${encodeURIComponent(sessionId)}`
    : url;
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) throw new Error('Не удалось получить данные: проверьте доступ к источнику или CORS.');
  return response.text();
}

async function fetchHtml(url) {
  const attempts = [];
  if (sessionId) attempts.push(() => fetchViaProxy(url));
  attempts.push(() => fetchDirect(url));
  attempts.push(() => fetchViaProxy(url));
  attempts.push(() => fetchAllOrigins(url));

  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      console.warn('Fetch attempt failed:', error.message);
    }
  }
  throw new Error('Все попытки загрузки завершились неудачей');
}

function extractFirstText(node) {
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const value = child.textContent.trim();
      if (value) return value;
    }
  }
  return node.textContent.trim();
}

function parseTracks(markup, sourceLabel) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(markup, 'text/html');
  const rows = Array.from(doc.querySelectorAll('table tbody tr'));

  return rows.map((row) => {
    const cover = row.querySelector('td:nth-child(2) img')?.src ?? '';
    const performer = row.querySelector('td:nth-child(3) a')?.textContent.trim() ?? 'Неизвестно';
    const titleCell = row.querySelector('td:nth-child(4)');
    const title = titleCell ? extractFirstText(titleCell) : 'Без названия';
    const genre = row.querySelector('td:nth-child(5) b')?.textContent.trim() ?? '—';
    const uploaded = row.querySelector('td:nth-child(8)')?.textContent.trim() ?? '—';
    const action = row.querySelector('td:nth-child(9) a[href]')?.href ?? '';
    const audio = row.querySelector('audio source')?.src ?? '';

    return { cover, performer, title, genre, uploaded, action, audio, sourceLabel };
  });
}

function renderTracks(tracks) {
  trackGrid.innerHTML = '';
  emptyState.hidden = tracks.length > 0;
  loaded.textContent = tracks.length;

  tracks.forEach((track) => {
    const card = document.createElement('article');
    card.className = 'card';

    const cover = document.createElement('div');
    cover.className = 'cover';
    if (track.cover) {
      const img = document.createElement('img');
      img.src = track.cover;
      img.alt = track.title;
      cover.appendChild(img);
    }
    const badge = document.createElement('div');
    badge.className = 'badge';
    badge.textContent = track.sourceLabel;
    cover.appendChild(badge);

    const content = document.createElement('div');
    content.className = 'content';

    const title = document.createElement('h3');
    title.className = 'title';
    title.textContent = track.title;

    const performer = document.createElement('p');
    performer.className = 'meta';
    performer.textContent = track.performer;

    const tags = document.createElement('div');
    tags.className = 'tags';

    const genre = document.createElement('span');
    genre.className = 'tag';
    genre.textContent = track.genre;

    const uploaded = document.createElement('span');
    uploaded.className = 'tag badge-muted';
    uploaded.textContent = `Загружено: ${track.uploaded}`;

    tags.appendChild(genre);
    tags.appendChild(uploaded);

    const footer = document.createElement('div');
    footer.className = 'footer';

    const action = document.createElement('a');
    action.className = 'action';
    action.textContent = 'Действие';
    if (track.action) {
      action.href = track.action;
      action.target = '_blank';
    } else {
      action.classList.add('ghost');
      action.textContent = 'Нет действия';
    }

    const player = document.createElement('div');
    if (track.audio) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = track.audio;
      player.appendChild(audio);
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'meta';
      placeholder.textContent = 'Аудио отсутствует';
      player.appendChild(placeholder);
    }

    footer.appendChild(action);

    content.appendChild(title);
    content.appendChild(performer);
    content.appendChild(tags);
    content.appendChild(player);
    content.appendChild(footer);

    card.appendChild(cover);
    card.appendChild(content);
    trackGrid.appendChild(card);
  });
}

async function loadTracks(source) {
  try {
    showToast('Загрузка...');
    const html = await fetchHtml(endpoints[source]);
    const data = parseTracks(html, source === 'premium' ? 'Премиум' : 'Сингл');
    renderTracks(data);
    timestamp.textContent = new Date().toLocaleTimeString('ru-RU', { hour12: false });
    showToast('Готово', 1400);
  } catch (error) {
    showToast(error.message, 2600);
    renderTracks([]);
  }
}

function showToast(message, duration = 1000) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => (toast.hidden = true), duration);
}

function setActiveToggle(source) {
  toggles.forEach((btn) => btn.classList.toggle('active', btn.dataset.source === source));
}

toggles.forEach((btn) =>
  btn.addEventListener('click', () => {
    currentSource = btn.dataset.source;
    setActiveToggle(currentSource);
    loadTracks(currentSource);
  })
);

document.getElementById('refresh').addEventListener('click', () => loadTracks(currentSource));

loadTracks(currentSource);
