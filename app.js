/**
 * FitLog — Advanced Fitness Tracker Application
 * Fully modular, localStorage-persistent, chart-driven
 */

/* ============================================================
   CATEGORY COLORS
   ============================================================ */
const CAT_COLORS = {
  Cardio:    '#00e5ff',
  Strength:  '#7c3aed',
  HIIT:      '#ef4444',
  Yoga:      '#10b981',
  Cycling:   '#f97316',
  Swimming:  '#3b82f6',
  Running:   '#fbbf24',
  Sports:    '#ec4899',
  Other:     '#84cc16'
};

/* ============================================================
   STATE
   ============================================================ */
const State = {
  workouts: [],
  editingId: null,
  deletingId: null,
  activeTab: 'dashboard',
  tableSort: { col: 'date', dir: 'desc' },
  filters: { search: '', category: '', from: '', to: '' },

  load() {
    try {
      const d = localStorage.getItem('fitlog_workouts');
      this.workouts = d ? JSON.parse(d) : [];
    } catch { this.workouts = []; }
  },

  save() {
    localStorage.setItem('fitlog_workouts', JSON.stringify(this.workouts));
  }
};

/* ============================================================
   WORKOUT MODEL
   ============================================================ */
const WorkoutModel = {
  create(data) {
    return {
      id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: data.name.trim(),
      category: data.category,
      calories: parseInt(data.calories) || 0,
      duration: parseInt(data.duration) || 0,
      date: data.date,
      intensity: data.intensity || 'moderate',
      notes: (data.notes || '').trim(),
      createdAt: Date.now()
    };
  },

  add(data) {
    const w = this.create(data);
    State.workouts.unshift(w);
    State.save();
    return w;
  },

  update(id, data) {
    const idx = State.workouts.findIndex(w => w.id === id);
    if (idx === -1) return null;
    State.workouts[idx] = { ...State.workouts[idx], ...this.create({ ...data, id }) };
    State.workouts[idx].id = id;
    State.save();
    return State.workouts[idx];
  },

  delete(id) {
    const idx = State.workouts.findIndex(w => w.id === id);
    if (idx === -1) return false;
    State.workouts.splice(idx, 1);
    State.save();
    return true;
  },

  getById(id) {
    return State.workouts.find(w => w.id === id);
  },

  /**
   * Return filtered and sorted workouts for the table
   */
  getFiltered() {
    let list = [...State.workouts];
    const { search, category, from, to } = State.filters;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(w => w.name.toLowerCase().includes(q) || w.category.toLowerCase().includes(q));
    }

    if (category) list = list.filter(w => w.category === category);

    if (from) list = list.filter(w => w.date >= from);
    if (to)   list = list.filter(w => w.date <= to);

    // Sort
    const { col, dir } = State.tableSort;
    list.sort((a, b) => {
      let va = a[col], vb = b[col];
      if (col === 'calories' || col === 'duration') { va = +va; vb = +vb; }
      if (va < vb) return dir === 'asc' ? -1 :  1;
      if (va > vb) return dir === 'asc' ?  1 : -1;
      return 0;
    });

    return list;
  },

  /**
   * KPI statistics
   */
  getKPIs() {
    const total = State.workouts.length;
    const totalCals = State.workouts.reduce((s, w) => s + w.calories, 0);
    const avg = total ? Math.round(totalCals / total) : 0;

    // This week (Mon–Sun)
    const now = new Date();
    const dow = (now.getDay() + 6) % 7; // 0=Mon
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dow);
    weekStart.setHours(0, 0, 0, 0);
    const weekStr = weekStart.toISOString().split('T')[0];
    const weekCount = State.workouts.filter(w => w.date >= weekStr).length;

    return { total, totalCals, avg, weekCount };
  },

  /**
   * Category statistics: { name, count, calories }[]
   */
  getCategoryStats() {
    const map = {};
    State.workouts.forEach(w => {
      if (!map[w.category]) map[w.category] = { count: 0, calories: 0 };
      map[w.category].count++;
      map[w.category].calories += w.calories;
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.calories - a.calories);
  },

  /**
   * Weekly calories for the last 7 days
   */
  getWeeklyCalories() {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { weekday: 'short' });
      const cals = State.workouts
        .filter(w => w.date === dateStr)
        .reduce((s, w) => s + w.calories, 0);
      result.push({ label, cals, dateStr });
    }
    return result;
  },

  /**
   * 30-day trend: one entry per day
   */
  get30DayTrend() {
    const result = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = i % 7 === 0
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';
      const cals = State.workouts
        .filter(w => w.date === dateStr)
        .reduce((s, w) => s + w.calories, 0);
      result.push({ label: label || dateStr.slice(5), cals });
    }
    return result;
  },

  /**
   * Personal records per category: max calories in a single session
   */
  getPersonalRecords() {
    const map = {};
    State.workouts.forEach(w => {
      if (!map[w.category] || w.calories > map[w.category].calories) {
        map[w.category] = { calories: w.calories, name: w.name, date: w.date };
      }
    });
    return Object.entries(map).map(([cat, d]) => ({ cat, ...d }));
  }
};

/* ============================================================
   RENDERER — DASHBOARD
   ============================================================ */
const DashRenderer = {
  render() {
    this.renderKPIs();
    this.renderRecent();
    this.renderWeeklyChart();
    this.renderCategoryGrid();
  },

  renderKPIs() {
    const { total, totalCals, avg, weekCount } = WorkoutModel.getKPIs();
    document.getElementById('kpi-cals').textContent  = totalCals.toLocaleString();
    document.getElementById('kpi-total').textContent = total;
    document.getElementById('kpi-week').textContent  = weekCount;
    document.getElementById('kpi-avg').textContent   = avg;
  },

  renderRecent() {
    const list = document.getElementById('recent-list');
    const recent = [...State.workouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

    if (!recent.length) {
      list.innerHTML = '<div class="no-data-msg">No workouts yet. Log your first one!</div>';
      return;
    }

    list.innerHTML = recent.map(w => {
      const col = CAT_COLORS[w.category] || '#00e5ff';
      return `
        <div class="recent-item">
          <span class="recent-cat-badge" style="background:${col}22;color:${col};border:1px solid ${col}44">
            ${w.category}
          </span>
          <span class="recent-name">${escHtml(w.name)}</span>
          <span class="recent-cal">${w.calories} kcal</span>
          <span class="recent-date">${formatDate(w.date)}</span>
        </div>
      `;
    }).join('');
  },

  renderWeeklyChart() {
    const canvas = document.getElementById('weekly-chart');
    const data = WorkoutModel.getWeeklyCalories();
    ChartEngine.barChart(canvas, data.map(d => d.label), data.map(d => d.cals), { color: '#00e5ff' });
  },

  renderCategoryGrid() {
    const stats = WorkoutModel.getCategoryStats();
    const grid = document.getElementById('category-grid');

    if (!stats.length) {
      grid.innerHTML = '<p class="no-data-msg">No data yet.</p>';
      return;
    }

    grid.innerHTML = stats.map(s => {
      const col = CAT_COLORS[s.name] || '#00e5ff';
      return `
        <div class="cat-card" style="--cat-col:${col}">
          <div class="cat-card-name" style="color:${col}">${s.name}</div>
          <div class="cat-card-cals">${s.calories.toLocaleString()}</div>
          <div class="cat-card-meta">${s.count} session${s.count !== 1 ? 's' : ''} · ${Math.round(s.calories / s.count)} avg kcal</div>
          <style>.cat-card[style*="${col}"]::before { background: ${col}; }</style>
        </div>
      `;
    }).join('');

    // Inline the ::before colours properly
    grid.querySelectorAll('.cat-card').forEach((card, i) => {
      const col = (CAT_COLORS[stats[i]?.name] || '#00e5ff');
      card.style.setProperty('--cat-col', col);
      card.style.borderTopColor = col + '66';
    });
  }
};

/* ============================================================
   RENDERER — WORKOUT TABLE
   ============================================================ */
const TableRenderer = {
  render() {
    const workouts = WorkoutModel.getFiltered();
    const tbody = document.getElementById('workout-tbody');
    const emptyMsg = document.getElementById('empty-table');

    if (!workouts.length) {
      tbody.innerHTML = '';
      emptyMsg.style.display = 'block';
      return;
    }

    emptyMsg.style.display = 'none';

    tbody.innerHTML = workouts.map(w => {
      const col = CAT_COLORS[w.category] || '#00e5ff';
      const intClass = `intensity-${w.intensity}`;
      return `
        <tr data-id="${w.id}">
          <td>
            <span class="intensity-dot ${intClass}"></span>
            <strong>${escHtml(w.name)}</strong>
            ${w.notes ? `<br><small style="color:var(--muted);font-size:11px">${escHtml(w.notes.slice(0, 60))}${w.notes.length > 60 ? '…' : ''}</small>` : ''}
          </td>
          <td>
            <span class="cat-badge" style="background:${col}22;color:${col};border:1px solid ${col}44">${w.category}</span>
          </td>
          <td style="font-family:var(--mono);color:var(--accent)">${w.calories.toLocaleString()}</td>
          <td style="font-family:var(--mono)">${w.duration ? w.duration + ' min' : '—'}</td>
          <td style="font-family:var(--mono);color:var(--muted)">${formatDate(w.date)}</td>
          <td>
            <button class="tbl-action edit" title="Edit" onclick="Controller.openEditModal('${w.id}')">✎</button>
            <button class="tbl-action del"  title="Delete" onclick="Controller.promptDelete('${w.id}')">✕</button>
          </td>
        </tr>
      `;
    }).join('');
  }
};

/* ============================================================
   RENDERER — STATS
   ============================================================ */
const StatsRenderer = {
  render() {
    const catStats = WorkoutModel.getCategoryStats();
    const labels = catStats.map(s => s.name);
    const calVals = catStats.map(s => s.calories);
    const cntVals = catStats.map(s => s.count);
    const colors  = catStats.map(s => CAT_COLORS[s.name] || '#00e5ff');

    ChartEngine.hBarChart(document.getElementById('cat-cal-chart'),   labels, calVals, colors);
    ChartEngine.hBarChart(document.getElementById('cat-count-chart'), labels, cntVals, colors);

    const trend = WorkoutModel.get30DayTrend();
    ChartEngine.lineChart(
      document.getElementById('trend-chart'),
      trend.map(d => d.label),
      trend.map(d => d.cals),
      { color: '#00e5ff' }
    );

    this.renderPRs();
  },

  renderPRs() {
    const prs = WorkoutModel.getPersonalRecords();
    const grid = document.getElementById('pr-grid');

    if (!prs.length) {
      grid.innerHTML = '<p class="no-data-msg" style="padding:20px">No records yet.</p>';
      return;
    }

    grid.innerHTML = prs.map(r => {
      const col = CAT_COLORS[r.cat] || '#00e5ff';
      return `
        <div class="pr-card">
          <div class="pr-cat" style="color:${col}">${r.cat}</div>
          <div class="pr-val" style="color:${col}">${r.calories.toLocaleString()} kcal</div>
          <div class="pr-label">${escHtml(r.name)} · ${formatDate(r.date)}</div>
        </div>
      `;
    }).join('');
  }
};

/* ============================================================
   MODAL MANAGER
   ============================================================ */
const Modal = {
  overlay: document.getElementById('modal-overlay'),

  open(mode, workout = null) {
    this.reset();
    document.getElementById('modal-title').textContent = mode === 'edit' ? 'Edit Workout' : 'Log Workout';

    if (mode === 'edit' && workout) {
      document.getElementById('f-name').value      = workout.name;
      document.getElementById('f-category').value  = workout.category;
      document.getElementById('f-calories').value  = workout.calories;
      document.getElementById('f-duration').value  = workout.duration || '';
      document.getElementById('f-date').value      = workout.date;
      document.getElementById('f-intensity').value = workout.intensity;
      document.getElementById('f-notes').value     = workout.notes || '';
    } else {
      // Default date to today
      document.getElementById('f-date').value = new Date().toISOString().split('T')[0];
    }

    this.overlay.classList.add('open');
    setTimeout(() => document.getElementById('f-name').focus(), 150);
  },

  close() {
    this.overlay.classList.remove('open');
  },

  reset() {
    ['f-name','f-category','f-calories','f-duration','f-date','f-notes'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('f-intensity').value = 'moderate';
  },

  getValues() {
    return {
      name:      document.getElementById('f-name').value,
      category:  document.getElementById('f-category').value,
      calories:  document.getElementById('f-calories').value,
      duration:  document.getElementById('f-duration').value,
      date:      document.getElementById('f-date').value,
      intensity: document.getElementById('f-intensity').value,
      notes:     document.getElementById('f-notes').value
    };
  },

  validate() {
    const vals = this.getValues();
    if (!vals.name.trim())    { flashField('f-name');     return false; }
    if (!vals.category)       { flashField('f-category'); return false; }
    if (!vals.calories || parseInt(vals.calories) < 1) { flashField('f-calories'); return false; }
    if (!vals.date)           { flashField('f-date');     return false; }
    return true;
  }
};

const ConfirmDialog = {
  overlay: document.getElementById('confirm-overlay'),
  open()  { this.overlay.classList.add('open'); },
  close() { this.overlay.classList.remove('open'); }
};

/* ============================================================
   TOAST
   ============================================================ */
const Toast = {
  el: document.getElementById('toast'),
  t: null,
  show(msg, type = 'info') {
    clearTimeout(this.t);
    this.el.textContent = msg;
    this.el.className = `toast show ${type}`;
    this.t = setTimeout(() => this.el.classList.remove('show'), 2800);
  }
};

/* ============================================================
   CONTROLLER
   ============================================================ */
const Controller = {
  init() {
    State.load();
    this.bindEvents();
    this.renderAll();
  },

  bindEvents() {
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const tabId = `tab-${btn.dataset.tab}`;
        document.getElementById(tabId).classList.add('active');
        State.activeTab = btn.dataset.tab;

        if (State.activeTab === 'dashboard') DashRenderer.render();
        if (State.activeTab === 'workouts')  TableRenderer.render();
        if (State.activeTab === 'stats')     StatsRenderer.render();
      });
    });

    // Add modal
    document.getElementById('open-add-modal').addEventListener('click', () => {
      State.editingId = null;
      Modal.open('add');
    });

    // Modal events
    document.getElementById('modal-close').addEventListener('click',  () => Modal.close());
    document.getElementById('modal-cancel').addEventListener('click', () => Modal.close());
    document.getElementById('modal-save').addEventListener('click',   () => this.saveWorkout());
    Modal.overlay.addEventListener('click', e => { if (e.target === Modal.overlay) Modal.close(); });

    // Confirm dialog
    document.getElementById('confirm-close').addEventListener('click', () => ConfirmDialog.close());
    document.getElementById('confirm-no').addEventListener('click',    () => ConfirmDialog.close());
    document.getElementById('confirm-yes').addEventListener('click',   () => this.confirmDelete());
    ConfirmDialog.overlay.addEventListener('click', e => {
      if (e.target === ConfirmDialog.overlay) ConfirmDialog.close();
    });

    // Table filters
    document.getElementById('workout-search').addEventListener('input', e => {
      State.filters.search = e.target.value;
      TableRenderer.render();
    });

    document.getElementById('filter-category').addEventListener('change', e => {
      State.filters.category = e.target.value;
      TableRenderer.render();
    });

    document.getElementById('filter-date-from').addEventListener('change', e => {
      State.filters.from = e.target.value;
      TableRenderer.render();
    });

    document.getElementById('filter-date-to').addEventListener('change', e => {
      State.filters.to = e.target.value;
      TableRenderer.render();
    });

    document.getElementById('reset-filters').addEventListener('click', () => {
      State.filters = { search: '', category: '', from: '', to: '' };
      document.getElementById('workout-search').value    = '';
      document.getElementById('filter-category').value  = '';
      document.getElementById('filter-date-from').value = '';
      document.getElementById('filter-date-to').value   = '';
      TableRenderer.render();
    });

    // Table sort headers
    document.querySelectorAll('.workout-table th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (State.tableSort.col === col) {
          State.tableSort.dir = State.tableSort.dir === 'asc' ? 'desc' : 'asc';
        } else {
          State.tableSort.col = col;
          State.tableSort.dir = 'desc';
        }
        // Update arrows
        document.querySelectorAll('.sort-arrow').forEach(a => a.textContent = '↕');
        th.querySelector('.sort-arrow').textContent = State.tableSort.dir === 'asc' ? '↑' : '↓';
        TableRenderer.render();
      });
    });

    // Keyboard
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { Modal.close(); ConfirmDialog.close(); }
    });

    // Redraw charts on resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (State.activeTab === 'dashboard') DashRenderer.render();
        if (State.activeTab === 'stats')     StatsRenderer.render();
      }, 200);
    });
  },

  saveWorkout() {
    if (!Modal.validate()) return;
    const vals = Modal.getValues();

    if (State.editingId) {
      WorkoutModel.update(State.editingId, vals);
      Toast.show('Workout updated ✓', 'success');
      State.editingId = null;
    } else {
      WorkoutModel.add(vals);
      Toast.show('Workout logged ✓', 'success');
    }

    Modal.close();
    this.renderAll();
  },

  openEditModal(id) {
    const workout = WorkoutModel.getById(id);
    if (!workout) return;
    State.editingId = id;
    Modal.open('edit', workout);
  },

  promptDelete(id) {
    State.deletingId = id;
    ConfirmDialog.open();
  },

  confirmDelete() {
    if (!State.deletingId) return;
    WorkoutModel.delete(State.deletingId);
    State.deletingId = null;
    ConfirmDialog.close();
    Toast.show('Workout deleted', 'error');
    this.renderAll();
  },

  renderAll() {
    DashRenderer.render();
    TableRenderer.render();
    if (State.activeTab === 'stats') StatsRenderer.render();
  }
};

/* ============================================================
   HELPERS
   ============================================================ */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function flashField(id) {
  const el = document.getElementById(id);
  el.style.borderColor = 'var(--red)';
  el.focus();
  setTimeout(() => { el.style.borderColor = ''; }, 1500);
}

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => Controller.init());
