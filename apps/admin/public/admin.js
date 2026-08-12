const byId = (id) => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing admin element: ${id}`);
  return element;
};

const message = byId('admin-message');

async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('x-requested-with', 'sparaton-admin');
  const response = await fetch(`/api/${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({ error: 'Request failed' }));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function loadDashboard() {
  const overview = await apiRequest('overview');
  byId('open-count').textContent = String(overview.tickets.open);
  byId('waiting-count').textContent = String(overview.tickets.waiting);
  byId('analytics-state').textContent = overview.analytics.configured ? 'Configured' : 'Not configured';
  byId('traffic-copy').textContent = overview.analytics.configured
    ? 'Cloudflare analytics is connected.'
    : overview.analytics.reason;

  const result = await apiRequest('tickets');
  const list = byId('ticket-list');
  list.replaceChildren();
  for (const ticket of result.tickets) {
    const card = document.createElement('article');
    card.className = 'card';
    card.style.minHeight = '0';
    const heading = document.createElement('h3');
    heading.textContent = ticket.subject;
    const meta = document.createElement('span');
    meta.className = 'eyebrow';
    meta.textContent = `${ticket.status} · ${ticket.priority}`;
    const requester = document.createElement('p');
    requester.className = 'muted';
    requester.textContent = `${ticket.requester_name} · ${ticket.requester_email_normalized}`;
    card.append(meta, heading, requester);
    list.appendChild(card);
  }
}

async function submitForm(form, path) {
  const data = Object.fromEntries(new FormData(form).entries());
  const published = form.querySelector('[name="published"]');
  data.published = published instanceof HTMLInputElement && published.checked;
  await apiRequest(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data)
  });
  message.textContent = 'Saved successfully.';
  form.reset();
}

for (const [id, path] of [['project-form', 'projects'], ['post-form', 'posts']]) {
  const form = byId(id);
  if (!(form instanceof HTMLFormElement)) throw new Error(`Expected form: ${id}`);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitForm(form, path).catch((error) => {
      message.textContent = error instanceof Error ? error.message : 'Save failed';
    });
  });
}

loadDashboard().catch((error) => {
  message.textContent = error instanceof Error ? error.message : 'Admin data is unavailable';
  byId('analytics-state').textContent = 'Unavailable';
});
