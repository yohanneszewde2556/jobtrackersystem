const API_BASE = 'http://localhost:3000';
const TOKEN_KEY = 'job_tracker_token';

// ==================== State ====================
let currentUser = null;
let allApplications = [];
let currentSearch = '';
let currentStatusFilter = 'all';
let currentSort = 'date-new';
let currentView = 'board';
let barChart = null;
let pieChart = null;

// ==================== Init ====================
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    showDashboard();
  } else {
    showAuth();
  }
});

// ==================== Auth ====================
function showForm(form) {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const btnLogin = document.getElementById('btn-show-login');
  const btnRegister = document.getElementById('btn-show-register');

  if (form === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    btnLogin.classList.add('active');
    btnRegister.classList.remove('active');
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    btnLogin.classList.remove('active');
    btnRegister.classList.add('active');
  }
  clearErrors();
}

function clearErrors() {
  document.getElementById('login-error').textContent = '';
  document.getElementById('register-error').textContent = '';
  document.getElementById('add-app-error').textContent = '';
}

function showAuth() {
  document.getElementById('auth-section').classList.remove('hidden');
  document.getElementById('dashboard-section').classList.add('hidden');
  clearErrors();
}

function showDashboard() {
  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('dashboard-section').classList.remove('hidden');
  loadStats();
  loadApplications();
}

function switchView(view) {
  currentView = view;
  const boardView = document.getElementById('board-view');
  const dashboardView = document.getElementById('dashboard-view');
  const navBoard = document.getElementById('nav-board');
  const navDashboard = document.getElementById('nav-dashboard');

  if (view === 'board') {
    boardView.classList.remove('hidden');
    dashboardView.classList.add('hidden');
    navBoard.classList.add('active');
    navDashboard.classList.remove('active');
  } else {
    boardView.classList.add('hidden');
    dashboardView.classList.remove('hidden');
    navBoard.classList.remove('active');
    navDashboard.classList.add('active');
    loadDashboard();
  }
}

function loadDashboard() {
  const container = document.getElementById('analytics-content');

  if (allApplications.length === 0) {
    container.innerHTML = `
      <div class="analytics-empty">
        <div class="empty-icon">📊</div>
        <h3>No data yet</h3>
        <p>Start adding applications to see your stats</p>
      </div>
    `;
    return;
  }

  // Compute stats
  const total = allApplications.length;
  const interviews = allApplications.filter(a => a.status === 'interview' || a.status === 'offer').length;
  const offers = allApplications.filter(a => a.status === 'offer').length;
  const appliedCount = allApplications.filter(a => a.status !== 'saved').length;
  const responseRate = appliedCount > 0 ? Math.round((interviews / appliedCount) * 100) : 0;

  // Status breakdown
  const statusCounts = { saved: 0, applied: 0, interview: 0, offer: 0, rejected: 0 };
  allApplications.forEach(a => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });

  // Top 5 companies
  const companyCounts = {};
  allApplications.forEach(a => {
    const c = a.company.trim();
    companyCounts[c] = (companyCounts[c] || 0) + 1;
  });
  const topCompanies = Object.entries(companyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Weekly data (last 8 weeks)
  const weekCounts = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (i * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const count = allApplications.filter(app => {
      if (!app.date_applied) return false;
      const d = new Date(app.date_applied);
      return d >= weekStart && d <= weekEnd;
    }).length;
    weekCounts.push({ label, count });
  }

  container.innerHTML = `
    <div class="analytics-cards">
      <div class="analytics-card">
        <div class="analytics-card-value">${total}</div>
        <div class="analytics-card-label">Total Applications</div>
      </div>
      <div class="analytics-card">
        <div class="analytics-card-value">${interviews}</div>
        <div class="analytics-card-label">Total Interviews</div>
      </div>
      <div class="analytics-card">
        <div class="analytics-card-value">${offers}</div>
        <div class="analytics-card-label">Total Offers</div>
      </div>
      <div class="analytics-card">
        <div class="analytics-card-value">${responseRate}%</div>
        <div class="analytics-card-label">Response Rate</div>
      </div>
    </div>

    <div class="analytics-charts">
      <div class="chart-card">
        <h3 class="chart-title">Applications per Week (Last 8 Weeks)</h3>
        <div class="chart-wrap"><canvas id="bar-chart"></canvas></div>
      </div>
      <div class="chart-card">
        <h3 class="chart-title">Status Breakdown</h3>
        <div class="chart-wrap"><canvas id="pie-chart"></canvas></div>
      </div>
    </div>

    <div class="chart-card top-companies-card">
      <h3 class="chart-title">Top 5 Companies</h3>
      <table class="top-companies-table">
        <thead>
          <tr><th>#</th><th>Company</th><th>Applications</th></tr>
        </thead>
        <tbody>
          ${topCompanies.map(([company, count], i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${escapeHtml(company)}</td>
              <td><span class="count-badge">${count}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Destroy old charts before creating new ones
  if (barChart) { barChart.destroy(); barChart = null; }
  if (pieChart) { pieChart.destroy(); pieChart = null; }

  // Bar chart
  barChart = new Chart(document.getElementById('bar-chart'), {
    type: 'bar',
    data: {
      labels: weekCounts.map(w => w.label),
      datasets: [{
        label: 'Applications',
        data: weekCounts.map(w => w.count),
        backgroundColor: 'rgba(99, 102, 241, 0.7)',
        borderColor: '#6366f1',
        borderWidth: 1,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { color: '#8b92a8', stepSize: 1 }, grid: { color: '#333a55' } },
        x: { ticks: { color: '#8b92a8', font: { size: 11 } }, grid: { display: false } }
      }
    }
  });

  // Pie chart
  const pieLabels = Object.keys(statusCounts).filter(k => statusCounts[k] > 0);
  const pieData = pieLabels.map(k => statusCounts[k]);
  const pieColors = {
    saved: '#8b92a8',
    applied: '#6366f1',
    interview: '#f59e0b',
    offer: '#22c55e',
    rejected: '#ef4444',
  };

  pieChart = new Chart(document.getElementById('pie-chart'), {
    type: 'pie',
    data: {
      labels: pieLabels.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
      datasets: [{
        data: pieData,
        backgroundColor: pieLabels.map(s => pieColors[s] || '#6366f1'),
        borderWidth: 2,
        borderColor: '#1a1d27',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8b92a8', padding: 16, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = Math.round((ctx.raw / total) * 100);
              return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
  };
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!data.success) {
      errorEl.textContent = data.message || 'Login failed';
      return;
    }

    localStorage.setItem(TOKEN_KEY, data.data.token);
    currentUser = data.data.user;
    showDashboard();
  } catch (err) {
    errorEl.textContent = 'Unable to connect to server';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const errorEl = document.getElementById('register-error');

  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (!data.success) {
      errorEl.textContent = data.message || 'Registration failed';
      return;
    }

    localStorage.setItem(TOKEN_KEY, data.data.token);
    currentUser = data.data.user;
    showDashboard();
  } catch (err) {
    errorEl.textContent = 'Unable to connect to server';
  }
}

function handleLogout() {
  localStorage.removeItem(TOKEN_KEY);
  currentUser = null;
  showAuth();
  // Clear form fields
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('register-name').value = '';
  document.getElementById('register-email').value = '';
  document.getElementById('register-password').value = '';
}

// ==================== Stats ====================
async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/api/applications/stats`, {
      headers: getHeaders(),
    });
    const data = await res.json();

    if (!data.success) return;

    const stats = data.data;
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-interviews').textContent =
      (stats.by_status.interview || 0) + (stats.by_status.offer || 0);
    document.getElementById('stat-offers').textContent = stats.by_status.offer || 0;
    document.getElementById('stat-response').textContent = stats.response_rate + '%';
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// ==================== Applications ====================
let draggedCardId = null;

async function loadApplications() {
  try {
    const res = await fetch(`${API_BASE}/api/applications`, {
      headers: getHeaders(),
    });
    const data = await res.json();

    if (!data.success) return;

    allApplications = data.data;
    applyFilters();
  } catch (err) {
    console.error('Failed to load applications:', err);
  }
}

function applyFilters() {
  let filtered = [...allApplications];

  // Apply search
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    filtered = filtered.filter(app =>
      app.company.toLowerCase().includes(q) ||
      app.role.toLowerCase().includes(q)
    );
  }

  // Apply status filter
  if (currentStatusFilter !== 'all') {
    filtered = filtered.filter(app => app.status === currentStatusFilter);
  }

  // Apply sort
  filtered.sort((a, b) => {
    switch (currentSort) {
      case 'date-new':
        return new Date(b.date_applied || 0) - new Date(a.date_applied || 0);
      case 'date-old':
        return new Date(a.date_applied || 0) - new Date(b.date_applied || 0);
      case 'company-az':
        return a.company.localeCompare(b.company);
      default:
        return 0;
    }
  });

  renderBoard(filtered);
  updateClearButton();
}

function renderBoard(apps) {
  // Clear all columns
  const columns = document.querySelectorAll('.column-body');
  columns.forEach(col => {
    col.innerHTML = '';
  });

  const counts = { saved: 0, applied: 0, interview: 0, offer: 0, rejected: 0 };

  for (const app of apps) {
    const col = document.querySelector(`.kanban-column[data-status="${app.status}"] .column-body`);
    if (!col) continue;

    col.appendChild(createCard(app));
    counts[app.status] = (counts[app.status] || 0) + 1;
  }

  // Add empty state to each column
  columns.forEach(col => {
    if (col.children.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'column-empty';
      empty.textContent = 'No applications';
      col.appendChild(empty);
    }
  });

  // Update counts
  for (const [status, count] of Object.entries(counts)) {
    const el = document.getElementById(`count-${status}`);
    if (el) el.textContent = count;
  }
}

function handleSearchInput() {
  currentSearch = document.getElementById('search-input').value.trim();
  applyFilters();
}

function handleStatusFilter() {
  currentStatusFilter = document.getElementById('status-filter').value;
  applyFilters();
}

function handleSort() {
  currentSort = document.getElementById('sort-select').value;
  applyFilters();
}

function clearFilters() {
  currentSearch = '';
  currentStatusFilter = 'all';
  currentSort = 'date-new';
  document.getElementById('search-input').value = '';
  document.getElementById('status-filter').value = 'all';
  document.getElementById('sort-select').value = 'date-new';
  applyFilters();
}

function updateClearButton() {
  const btn = document.getElementById('btn-clear-filters');
  const hasFilters = currentSearch || currentStatusFilter !== 'all' || currentSort !== 'date-new';
  if (hasFilters) {
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
}

function createCard(app) {
  const card = document.createElement('div');
  card.className = 'app-card';
  card.draggable = true;
  card.dataset.id = app.id;

  const dateStr = app.date_applied
    ? new Date(app.date_applied).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  card.innerHTML = `
    <div class="card-company" title="${escapeHtml(app.company)}">${escapeHtml(app.company)}</div>
    <div class="card-role" title="${escapeHtml(app.role)}">${escapeHtml(app.role)}</div>
    ${dateStr ? `<div class="card-date">${dateStr}</div>` : ''}
    <div class="card-actions">
      <button class="btn-delete" title="Delete" onclick="handleDelete('${app.id}', event)">&times;</button>
    </div>
  `;

  card.addEventListener('dragstart', handleDragStart);
  card.addEventListener('dragend', handleDragEnd);

  return card;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== Add Application ====================
function openModal() {
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('add-app-form').reset();
  clearErrors();
  document.getElementById('app-company').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function closeModalOnOverlay(e) {
  if (e.target === e.currentTarget) closeModal();
}

async function handleAddApp(e) {
  e.preventDefault();
  const company = document.getElementById('app-company').value.trim();
  const role = document.getElementById('app-role').value.trim();
  const job_url = document.getElementById('app-url').value.trim();
  const date_applied = document.getElementById('app-date').value;
  const notes = document.getElementById('app-notes').value.trim();
  const errorEl = document.getElementById('add-app-error');

  try {
    const res = await fetch(`${API_BASE}/api/applications`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ company, role, job_url, date_applied, notes }),
    });

    const data = await res.json();

    if (!data.success) {
      errorEl.textContent = data.message || 'Failed to add application';
      return;
    }

    closeModal();
    loadApplications();
    loadStats();
    showToast('Application added!', 'success');
  } catch (err) {
    errorEl.textContent = 'Unable to connect to server';
  }
}

// ==================== Delete ====================
async function handleDelete(id, e) {
  e.stopPropagation();

  if (!confirm('Delete this application?')) return;

  try {
    const res = await fetch(`${API_BASE}/api/applications/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });

    const data = await res.json();

    if (!data.success) {
      showToast(data.message || 'Failed to delete', 'error');
      return;
    }

    loadApplications();
    loadStats();
    showToast('Application deleted', 'success');
  } catch (err) {
    showToast('Unable to connect to server', 'error');
  }
}

// ==================== Drag and Drop ====================
function handleDragStart(e) {
  draggedCardId = e.target.dataset.id;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('.column-body').forEach(col => {
    col.classList.remove('drag-over');
  });
  draggedCardId = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

async function handleDrop(e, newStatus) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');

  if (!draggedCardId) return;

  // Check if already in this column
  const card = document.querySelector(`[data-id="${draggedCardId}"]`);
  const currentCol = card?.closest('.kanban-column')?.dataset.status;
  if (currentCol === newStatus) return;

  // Optimistic update — move card visually
  const targetCol = document.querySelector(`.kanban-column[data-status="${newStatus}"] .column-body`);
  if (targetCol && card) {
    const emptyEl = targetCol.querySelector('.column-empty');
    if (emptyEl) emptyEl.remove();
    targetCol.appendChild(card);
    updateColumnCount(currentCol, -1);
    updateColumnCount(newStatus, +1);
  }

  // Send update to backend
  try {
    const res = await fetch(`${API_BASE}/api/applications/${draggedCardId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status: newStatus }),
    });

    const data = await res.json();

    if (!data.success) {
      // Revert on failure
      loadApplications();
      showToast(data.message || 'Failed to update status', 'error');
      return;
    }

    // Update the local array so filters stay correct
    const app = allApplications.find(a => a.id === draggedCardId);
    if (app) app.status = newStatus;

    loadStats();
    showToast(`Moved to ${capitalize(newStatus)}`, 'success');
  } catch (err) {
    loadApplications();
    showToast('Unable to connect to server', 'error');
  }
}

function updateColumnCount(status, delta) {
  const el = document.getElementById(`count-${status}`);
  if (el) {
    const current = parseInt(el.textContent, 10);
    el.textContent = Math.max(0, current + delta);
  }
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ==================== Toast ====================
function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ==================== Keyboard Shortcuts ====================
document.addEventListener('keydown', (e) => {
  // Escape closes modal
  if (e.key === 'Escape') {
    closeModal();
  }
});