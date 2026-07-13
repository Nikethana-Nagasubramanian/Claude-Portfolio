/*!
 * gh-contrib-chart — animated GitHub contribution graph, as a custom element.
 * https://itsmenike.com/tools/contribution-animator
 *
 * Usage:
 *   <script src="https://itsmenike.com/tools/gh-contrib-widget.js"></script>
 *   <gh-contrib-chart username="octocat"></gh-contrib-chart>
 *
 * Optional attributes:
 *   range   "1" | "3" | "6" | "12"           (months, default 12)
 *   style   "column" | "wave" | "random"      (default "column")
 *   speed   milliseconds, lower = faster      (default 2000)
 *   palette comma-separated hex x5, level0..level4 (default GitHub green)
 *
 * No dependencies. Fetches its own data from the public jogruber.de API
 * (CORS-enabled), so it works on any page with no backend of its own.
 */
(function () {
  if (typeof customElements === 'undefined' || customElements.get('gh-contrib-chart')) return;

  var DEFAULT_PALETTE = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
  var CELL = 11, GAP = 3, STEP = CELL + GAP, RADIUS = 2.5, PAD = 8;
  var LABEL_LEFT = 30, LABEL_TOP = 18, CELL_DUR = 0.18;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var WEEKDAY_ROWS = { 1: 'Mon', 3: 'Wed', 5: 'Fri' };
  var STYLES = {
    column: function (c, r, cols) { return cols <= 1 ? 0 : (c / (cols - 1)) * (1 - CELL_DUR); },
    wave: function (c, r, cols) { var m = (cols - 1) + 6 || 1; return ((c + r) / m) * (1 - CELL_DUR); },
    random: function (c, r, cols, rnd) { return rnd() * (1 - CELL_DUR); }
  };

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function ymdToUTC(ymd) { var p = ymd.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
  function easeOutBack(x) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); }
  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
  function roundRect(c, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    c.beginPath(); c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr); c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr); c.arcTo(x, y, x + w, y, rr); c.closePath();
  }

  function filterByRange(data, months) {
    if (months >= 12 || !data.length) return data;
    var last = ymdToUTC(data[data.length - 1].date);
    var cutoff = new Date(last); cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
    var cutMs = cutoff.getTime();
    return data.filter(function (d) { return ymdToUTC(d.date) >= cutMs; });
  }

  function buildWeeks(data) {
    if (!data.length) return { weeks: [], monthLabels: [] };
    var first = ymdToUTC(data[0].date);
    var gridStart = first - new Date(first).getUTCDay() * 86400000;
    var weeks = [];
    data.forEach(function (cell) {
      var ms = ymdToUTC(cell.date);
      var col = Math.floor((ms - gridStart) / (7 * 86400000));
      var row = new Date(ms).getUTCDay();
      if (!weeks[col]) weeks[col] = new Array(7).fill(null);
      weeks[col][row] = cell;
    });
    for (var i = 0; i < weeks.length; i++) if (!weeks[i]) weeks[i] = new Array(7).fill(null);
    var monthLabels = [], prevMonth = -1;
    for (var c = 0; c < weeks.length; c++) {
      var cell = weeks[c].filter(Boolean)[0];
      if (!cell) continue;
      var month = new Date(ymdToUTC(cell.date)).getUTCMonth();
      if (month !== prevMonth) {
        var lastLabel = monthLabels[monthLabels.length - 1];
        if (!lastLabel || c - lastLabel.col >= 3) monthLabels.push({ col: c, label: MONTHS[month] });
        prevMonth = month;
      }
    }
    return { weeks: weeks, monthLabels: monthLabels };
  }

  function buildSchedule(weeks, styleKey) {
    var cols = weeks.length, fn = STYLES[styleKey] || STYLES.column;
    var rnd = mulberry32(0x9e3779b1 ^ (cols * 2654435761));
    var sched = [];
    for (var c = 0; c < cols; c++) { sched[c] = []; for (var r = 0; r < 7; r++) sched[c][r] = fn(c, r, cols, rnd); }
    return sched;
  }

  function render(ctx, progress, layout, weeks, monthLabels, sched, palette) {
    ctx.clearRect(0, 0, layout.width, layout.height);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, layout.width, layout.height);
    ctx.fillStyle = '#a3a3a3'; ctx.font = '600 10px system-ui, sans-serif';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    Object.keys(WEEKDAY_ROWS).forEach(function (row) {
      ctx.fillText(WEEKDAY_ROWS[row], PAD - 2, LABEL_TOP + row * STEP + CELL / 2);
    });
    ctx.textBaseline = 'alphabetic';
    monthLabels.forEach(function (m) { ctx.fillText(m.label, LABEL_LEFT + m.col * STEP, LABEL_TOP - 6); });
    weeks.forEach(function (week, col) {
      week.forEach(function (cell, row) {
        if (!cell) return;
        var local = (progress - sched[col][row]) / CELL_DUR;
        if (local <= 0) return;
        var t = local >= 1 ? 1 : local;
        var scale = easeOutBack(t), alpha = easeOutCubic(t);
        var size = CELL * scale;
        var cx = LABEL_LEFT + col * STEP + CELL / 2, cy = LABEL_TOP + row * STEP + CELL / 2;
        ctx.globalAlpha = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
        ctx.fillStyle = palette[cell.level];
        roundRect(ctx, cx - size / 2, cy - size / 2, size, size, RADIUS * scale);
        ctx.fill();
      });
    });
    ctx.globalAlpha = 1;
  }

  function GHContribChart() {
    return Reflect.construct(HTMLElement, [], GHContribChart);
  }
  GHContribChart.prototype = Object.create(HTMLElement.prototype);
  GHContribChart.prototype.constructor = GHContribChart;

  GHContribChart.prototype.connectedCallback = function () {
    if (this._ghInitialized) return;
    this._ghInitialized = true;

    var username = this.getAttribute('username');
    var root = this.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = ':host{ display:block; max-width:100%; overflow-x:auto; } canvas{ display:block; } .gh-err{ font:13px system-ui, sans-serif; color:#b4442e; }';
    root.appendChild(style);

    if (!username) {
      var err = document.createElement('div');
      err.className = 'gh-err';
      err.textContent = 'gh-contrib-chart: missing required "username" attribute.';
      root.appendChild(err);
      return;
    }

    var rangeMonths = parseInt(this.getAttribute('range'), 10) || 12;
    var speedMs = parseInt(this.getAttribute('speed'), 10) || 2000;
    var styleKey = this.getAttribute('style') || 'column';
    var paletteAttr = this.getAttribute('palette');
    var palette = paletteAttr
      ? paletteAttr.split(',').map(function (s) { return s.trim(); })
      : DEFAULT_PALETTE;

    fetch('https://github-contributions-api.jogruber.de/v4/' + encodeURIComponent(username) + '?y=last')
      .then(function (r) { if (!r.ok) throw new Error('fetch failed'); return r.json(); })
      .then(function (json) {
        var data = (json.contributions || []).map(function (d) {
          return { date: d.date, count: Number(d.count) || 0, level: Math.max(0, Math.min(4, Number(d.level) || 0)) };
        });
        var scoped = filterByRange(data, rangeMonths);
        var built = buildWeeks(scoped);
        var cols = built.weeks.length;
        var layout = { width: LABEL_LEFT + cols * STEP - GAP + PAD, height: LABEL_TOP + 7 * STEP - GAP + PAD };
        var dpr = window.devicePixelRatio || 1;
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(layout.width * dpr); canvas.height = Math.round(layout.height * dpr);
        canvas.style.width = layout.width + 'px'; canvas.style.height = layout.height + 'px';
        root.appendChild(canvas);
        var ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var sched = buildSchedule(built.weeks, styleKey);
        var start = performance.now();
        (function tick(now) {
          var progress = Math.min(1, (now - start) / speedMs);
          render(ctx, progress, layout, built.weeks, built.monthLabels, sched, palette);
          if (progress < 1) requestAnimationFrame(tick);
        })(start);
      })
      .catch(function () {
        var err = document.createElement('div');
        err.className = 'gh-err';
        err.textContent = 'Could not load contributions for ' + username + '.';
        root.appendChild(err);
      });
  };

  customElements.define('gh-contrib-chart', GHContribChart);
})();
