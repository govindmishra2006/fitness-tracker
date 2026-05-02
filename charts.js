/**
 * FitLog Charts — Pure Canvas Chart Engine (no external libs)
 * Supports: bar charts, horizontal bar charts, line charts
 */

const ChartEngine = {
  COLORS: [
    '#00e5ff','#7c3aed','#10b981','#f97316','#fbbf24',
    '#ef4444','#3b82f6','#ec4899','#84cc16'
  ],

  /**
   * Clear a canvas and return its 2D context
   */
  prep(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    const w = rect.width || 500;
    const h = rect.height || 260;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  },

  /**
   * Draw a vertical bar chart
   * @param {HTMLCanvasElement} canvas
   * @param {string[]} labels
   * @param {number[]} values
   * @param {object} opts
   */
  barChart(canvas, labels, values, opts = {}) {
    if (!canvas) return;
    const { ctx, w, h } = this.prep(canvas);
    if (!values.length || values.every(v => v === 0)) {
      this._noDataMessage(ctx, w, h);
      return;
    }

    const padL = 56, padR = 16, padT = 20, padB = 48;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;
    const max = Math.max(...values) * 1.15 || 1;
    const color = opts.color || this.COLORS[0];

    // Grid lines
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const y = padT + chartH - (i / steps) * chartH;
      const val = Math.round((i / steps) * max);
      ctx.strokeStyle = '#1e2a3a';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + chartW, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#5a7090';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val, padL - 8, y + 3);
    }

    // Bars
    const barW = Math.max(8, (chartW / labels.length) * 0.6);
    const barSpacing = chartW / labels.length;

    labels.forEach((lbl, i) => {
      const x = padL + i * barSpacing + barSpacing / 2;
      const barH = (values[i] / max) * chartH;
      const y = padT + chartH - barH;

      // Bar glow
      const grd = ctx.createLinearGradient(0, y, 0, y + barH);
      grd.addColorStop(0, color);
      grd.addColorStop(1, color + '40');
      ctx.fillStyle = grd;
      this._roundRect(ctx, x - barW / 2, y, barW, barH, 4);
      ctx.fill();

      // Value on top
      if (values[i] > 0) {
        ctx.fillStyle = '#e2eaf6';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(values[i], x, y - 6);
      }

      // X label
      ctx.fillStyle = '#5a7090';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      const shortLbl = lbl.length > 6 ? lbl.slice(0, 5) + '…' : lbl;
      ctx.fillText(shortLbl, x, h - padB + 16);
    });
  },

  /**
   * Draw a horizontal bar chart
   */
  hBarChart(canvas, labels, values, colors) {
    if (!canvas) return;
    const { ctx, w, h } = this.prep(canvas);
    if (!values.length || values.every(v => v === 0)) {
      this._noDataMessage(ctx, w, h);
      return;
    }

    const padL = 90, padR = 60, padT = 16, padB = 16;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;
    const max = Math.max(...values) || 1;
    const barH = Math.min(28, (chartH / labels.length) * 0.6);
    const barSpacing = chartH / labels.length;

    labels.forEach((lbl, i) => {
      const y = padT + i * barSpacing + barSpacing / 2;
      const barW = (values[i] / max) * chartW;
      const col = colors ? colors[i % colors.length] : this.COLORS[i % this.COLORS.length];

      // Background track
      ctx.fillStyle = '#1e2a3a';
      this._roundRect(ctx, padL, y - barH / 2, chartW, barH, 3);
      ctx.fill();

      // Bar
      if (barW > 0) {
        const grd = ctx.createLinearGradient(padL, 0, padL + barW, 0);
        grd.addColorStop(0, col + 'cc');
        grd.addColorStop(1, col);
        ctx.fillStyle = grd;
        this._roundRect(ctx, padL, y - barH / 2, barW, barH, 3);
        ctx.fill();
      }

      // Label
      ctx.fillStyle = '#e2eaf6';
      ctx.font = '11px Cabinet Grotesk, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(lbl, padL - 8, y + 4);

      // Value
      ctx.fillStyle = col;
      ctx.font = 'bold 11px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(values[i].toLocaleString(), padL + chartW + 8, y + 4);
    });
  },

  /**
   * Draw a line chart
   */
  lineChart(canvas, labels, values, opts = {}) {
    if (!canvas) return;
    const { ctx, w, h } = this.prep(canvas);
    if (!values.length || values.every(v => v === 0)) {
      this._noDataMessage(ctx, w, h);
      return;
    }

    const padL = 60, padR = 20, padT = 20, padB = 44;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;
    const max = Math.max(...values) * 1.2 || 1;
    const color = opts.color || this.COLORS[0];

    // Grid
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const y = padT + chartH - (i / steps) * chartH;
      ctx.strokeStyle = '#1e2a3a';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + chartW, y);
      ctx.stroke();
      ctx.setLineDash([]);
      const val = Math.round((i / steps) * max);
      ctx.fillStyle = '#5a7090';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(val, padL - 8, y + 3);
    }

    // Points
    const points = values.map((v, i) => ({
      x: padL + (i / (values.length - 1 || 1)) * chartW,
      y: padT + chartH - (v / max) * chartH
    }));

    // Area fill
    const areaGrd = ctx.createLinearGradient(0, padT, 0, padT + chartH);
    areaGrd.addColorStop(0, color + '40');
    areaGrd.addColorStop(1, color + '00');
    ctx.fillStyle = areaGrd;
    ctx.beginPath();
    ctx.moveTo(points[0].x, padT + chartH);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, padT + chartH);
    ctx.closePath();
    ctx.fill();

    // Line
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();

    // Dots
    points.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#0f1520';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // X labels (show subset)
    const step = Math.ceil(labels.length / 8);
    labels.forEach((lbl, i) => {
      if (i % step !== 0 && i !== labels.length - 1) return;
      const p = points[i];
      ctx.fillStyle = '#5a7090';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(lbl, p.x, h - padB + 16);
    });
  },

  _noDataMessage(ctx, w, h) {
    ctx.fillStyle = '#5a7090';
    ctx.font = '13px Cabinet Grotesk, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No data yet', w / 2, h / 2);
  },

  _roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
};
