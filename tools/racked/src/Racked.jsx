import { useState, useRef, useEffect, useMemo } from 'react';

// RACKED — photo of gym notes → structured strength session, WHOOP-ready export.
// Demo tool. Not affiliated with WHOOP.
// Pre-loaded with a real "Legs" session so it's alive on open. Photo upload
// posts to /api/parse-workout, a serverless proxy that holds the Anthropic
// key server-side — the browser never sees it. Everything is also editable
// by hand.

const SEED = {
  title: 'Legs',
  date: 'Jul 14, 2026',
  exercises: [
    { id: 'e1', name: 'Hip thrust', sets: [
      { r: 12, w: 135 }, { r: 12, w: 135 }, { r: 10, w: 135 }, { r: 9.5, w: 125 },
    ] },
    { id: 'e2', name: 'Leg Curls', sets: [
      { r: 12, w: 55 }, { r: 5, w: 40 }, { r: 12, w: 55 }, { r: 8, w: 40 }, { r: 12, w: 40 },
    ] },
    { id: 'e3', name: 'Leg extensions', sets: [
      { r: 12, w: 55 }, { r: 12, w: 55 }, { r: 6, w: 40 }, { r: 14, w: 40 },
    ] },
    { id: 'e4', name: 'Abduction', sets: [
      { r: 20, w: 70 }, { r: 15, w: 70 }, { r: 10, w: 70 }, { r: 10, w: 55 },
    ] },
  ],
};

let idc = 100;
const nid = () => `x${idc++}`;

const num = (n) => (n == null || isNaN(n) ? '—' : n.toLocaleString('en-US'));
const setVol = (s) => (s.w == null || s.r == null ? 0 : s.r * s.w);
const exVol = (e) => e.sets.reduce((a, s) => a + setVol(s), 0);

// WHOOP has no exercise-library API endpoint, so we mirror its movement names
// as a static dictionary and normalize parsed names to the exact WHOOP string.
// This is a starter subset — production would sync WHOOP's full library.
const CANON = [
  'Hip Thrust', 'Barbell Hip Thrust', 'Glute Bridge', 'Back Squat', 'Front Squat',
  'Goblet Squat', 'Leg Press', 'Leg Curl', 'Seated Leg Curl', 'Lying Leg Curl',
  'Leg Extension', 'Hip Abduction', 'Hip Adduction', 'Romanian Deadlift', 'Deadlift',
  'Bulgarian Split Squat', 'Walking Lunge', 'Calf Raise', 'Bench Press',
  'Incline Bench Press', 'Dumbbell Bench Press', 'Overhead Press', 'Lat Pulldown',
  'Seated Row', 'Barbell Row', 'Pull-Up', 'Chin-Up', 'Bicep Curl', 'Hammer Curl',
  'Tricep Pushdown', 'Face Pull', 'Lateral Raise', 'Chest Fly', 'Shoulder Press',
  'Plank', 'Cable Crunch', 'Hanging Leg Raise', 'Russian Twist', 'Good Morning', 'Step-Up',
];

const normEx = (s) =>
  (s || '').toLowerCase().replace(/[^a-z ]/g, ' ')
    .split(/\s+/).filter(Boolean).map((w) => w.replace(/s$/, '')).join(' ').trim();

// returns { name, exact } best canonical match, or null
function matchWhoop(raw) {
  const q = normEx(raw);
  if (!q) return null;
  let best = null, bestScore = 0;
  for (const c of CANON) {
    const cn = normEx(c);
    let score = 0;
    if (cn === q) score = 1;
    else if (cn.includes(q) || q.includes(cn)) score = 0.8 - Math.abs(cn.length - q.length) / 100;
    else {
      const qt = new Set(q.split(' ')), ct = cn.split(' ');
      const overlap = ct.filter((t) => qt.has(t)).length;
      score = overlap ? (overlap / Math.max(qt.size, ct.length)) * 0.7 : 0;
    }
    if (score > bestScore) { bestScore = score; best = c; }
  }
  if (bestScore < 0.5) return null;
  return { name: best, exact: bestScore >= 0.99 };
}

function useCountUp(target, ms = 650) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setV(a + (target - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export default function Racked() {
  const [session, setSession] = useState(SEED);
  const [status, setStatus] = useState('idle'); // idle | reading | parsing | ok | error
  const [errMsg, setErrMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);

  const totals = useMemo(() => {
    let sets = 0, reps = 0, vol = 0;
    session.exercises.forEach((e) => e.sets.forEach((s) => {
      sets += 1;
      reps += s.r || 0;
      vol += setVol(s);
    }));
    const max = Math.max(1, ...session.exercises.map(exVol));
    return { sets, reps, vol, max };
  }, [session]);

  const animVol = useCountUp(totals.vol);

  // ---- photo upload, parsed server-side at /api/parse-workout ----
  async function handleFile(file) {
    if (!file) return;
    setErrMsg('');
    setStatus('reading');
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(',')[1]);
        r.onerror = () => rej(new Error('Could not read that file.'));
        r.readAsDataURL(file);
      });
      setStatus('parsing');
      const resp = await fetch('/api/parse-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: b64, media: file.type || 'image/png' }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || "Couldn't parse that photo.");
      const next = {
        title: data.title || 'Session',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        exercises: data.exercises.map((e) => ({
          id: nid(),
          name: e.name || 'Exercise',
          sets: e.sets.map((s) => ({ r: s.r ?? null, w: s.w ?? null })),
        })),
      };
      setSession(next);
      setStatus('ok');
      setTimeout(() => setStatus('idle'), 1800);
    } catch (e) {
      setStatus('error');
      setErrMsg(e.message || "Couldn't parse that one. Try a clearer, straight-on photo.");
    }
  }

  // ---- editing ----
  const patchSet = (ei, si, k, val) => setSession((p) => {
    const ex = p.exercises.slice();
    const sets = ex[ei].sets.slice();
    const n = val === '' ? null : Number(val);
    sets[si] = { ...sets[si], [k]: n };
    ex[ei] = { ...ex[ei], sets };
    return { ...p, exercises: ex };
  });
  const renameEx = (ei, val) => setSession((p) => {
    const ex = p.exercises.slice();
    ex[ei] = { ...ex[ei], name: val };
    return { ...p, exercises: ex };
  });
  const addSet = (ei) => setSession((p) => {
    const ex = p.exercises.slice();
    const last = ex[ei].sets[ex[ei].sets.length - 1] || { r: 10, w: 45 };
    ex[ei] = { ...ex[ei], sets: [...ex[ei].sets, { ...last }] };
    return { ...p, exercises: ex };
  });
  const rmSet = (ei, si) => setSession((p) => {
    const ex = p.exercises.slice();
    ex[ei] = { ...ex[ei], sets: ex[ei].sets.filter((_, i) => i !== si) };
    return { ...p, exercises: ex };
  });
  const rmEx = (ei) => setSession((p) => ({ ...p, exercises: p.exercises.filter((_, i) => i !== ei) }));
  const addEx = () => setSession((p) => ({
    ...p,
    exercises: [...p.exercises, { id: nid(), name: 'New exercise', sets: [{ r: 10, w: 45 }] }],
  }));

  // ---- exports ----
  const whoopText = useMemo(() => {
    const lines = [`${session.title} — ${session.date}`, ''];
    session.exercises.forEach((e) => {
      const parts = e.sets.map((s) => `${num(s.r)}×${num(s.w)}`).join(', ');
      const wm = matchWhoop(e.name);
      const label = wm ? wm.name : e.name;
      lines.push(`${label}: ${parts}`);
    });
    lines.push('', `Total volume: ${num(Math.round(totals.vol))} lb  ·  ${totals.sets} sets  ·  ${num(totals.reps)} reps`);
    return lines.join('\n');
  }, [session, totals]);

  const copyWhoop = async () => {
    try { await navigator.clipboard.writeText(whoopText); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch {}
  };
  const downloadCsv = () => {
    const rows = [['exercise', 'set', 'reps', 'weight_lb', 'volume_lb']];
    session.exercises.forEach((e) => e.sets.forEach((s, i) =>
      rows.push([e.name, i + 1, s.r ?? '', s.w ?? '', setVol(s)])));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${session.title.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const busy = status === 'reading' || status === 'parsing';

  return (
    <div className="rk">
      <style>{CSS}</style>
      <div className="bgfix" aria-hidden />
      <datalist id="canon">{CANON.map((c) => <option key={c} value={c} />)}</datalist>

      <header className="top">
        <div className="brand">
          <span className="mark" aria-hidden>▚</span>
          <div>
            <div className="word">RACKED</div>
            <div className="tag">photo → strength session</div>
          </div>
        </div>
        <div className="disc">demo · not affiliated with WHOOP</div>
      </header>

      <p className="intro">
        Gym notes are rarely more than reps and weight scrawled between sets — this turns
        a photo of them into a structured session, matched against WHOOP's exercise names,
        and formatted for a single paste into Strength Trainer. Upload a photo below, or
        edit the pre-loaded demo by hand.
      </p>

      <div className="uploader">
        <label className={`drop ${busy ? 'busy' : ''}`}>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <span className="drop-ico" aria-hidden>{busy ? '◔' : '＋'}</span>
          <span className="drop-main">
            {status === 'reading' && 'Reading photo…'}
            {status === 'parsing' && 'Racked is reading your sets…'}
            {status === 'ok' && 'Parsed. Check the numbers below.'}
            {status === 'error' && "Couldn't parse that photo"}
            {status === 'idle' && 'Drop a photo of your gym notes'}
          </span>
          <span className="drop-sub">
            {status === 'error' ? errMsg : 'or tap to choose — reps first, then weight'}
          </span>
        </label>
      </div>

      <div className="grid">
        {/* session */}
        <section className="col-main">
          <div className="shead">
            <input className="stitle" value={session.title}
              onChange={(e) => setSession((p) => ({ ...p, title: e.target.value }))} />
            <span className="sdate">{session.date}</span>
          </div>

          {session.exercises.map((e, ei) => {
            const ev = exVol(e);
            const pct = Math.round((ev / totals.max) * 100);
            const wm = matchWhoop(e.name);
            return (
              <div className="ex" key={e.id}>
                <div className="ex-top">
                  <div className="ex-id">
                    <input className="ex-name" value={e.name} list="canon"
                      onChange={(ev2) => renameEx(ei, ev2.target.value)} />
                    {wm ? (
                      <span className={`wtag ${wm.exact ? '' : 'approx'}`}>
                        {wm.exact ? 'WHOOP' : '≈ WHOOP'}: {wm.name}
                      </span>
                    ) : (
                      <span className="wtag none">no WHOOP match — pick one</span>
                    )}
                  </div>
                  <button className="x" onClick={() => rmEx(ei)} title="Remove exercise">✕</button>
                </div>

                <div className="sets">
                  <div className="srow shead-row">
                    <span>set</span><span>reps</span><span>lb</span><span>vol</span><span></span>
                  </div>
                  {e.sets.map((s, si) => (
                    <div className="srow" key={si}>
                      <span className="sidx">{si + 1}</span>
                      <input className="cell" type="number" inputMode="decimal" value={s.r ?? ''}
                        onChange={(ev2) => patchSet(ei, si, 'r', ev2.target.value)} />
                      <input className="cell" type="number" inputMode="decimal" value={s.w ?? ''}
                        onChange={(ev2) => patchSet(ei, si, 'w', ev2.target.value)} />
                      <span className="svol">{num(setVol(s))}</span>
                      <button className="x sm" onClick={() => rmSet(ei, si)} title="Remove set">−</button>
                    </div>
                  ))}
                </div>

                <div className="ex-foot">
                  <button className="addset" onClick={() => addSet(ei)}>+ set</button>
                  <div className="ex-vol">
                    <div className="bar"><div className="fill" style={{ width: pct + '%' }} /></div>
                    <span className="ev-num">{num(ev)} <em>lb</em></span>
                  </div>
                </div>
              </div>
            );
          })}

          <button className="addex" onClick={addEx}>+ add exercise</button>
        </section>

        {/* summary */}
        <aside className="col-side">
          <div className="totals">
            <div className="t-label">session volume</div>
            <div className="t-big">{num(Math.round(animVol))}<em>lb</em></div>
            <div className="t-mini">
              <span><b>{totals.sets}</b> sets</span>
              <span><b>{num(totals.reps)}</b> reps</span>
              <span><b>{session.exercises.length}</b> lifts</span>
            </div>
          </div>

          <div className="panel">
            <div className="p-head">WHOOP entry</div>
            <pre className="whoop">{whoopText}</pre>
            <button className="primary" onClick={copyWhoop}>{copied ? 'Copied ✓' : 'Copy for WHOOP'}</button>
            <button className="ghost" onClick={downloadCsv}>Download CSV</button>
          </div>

          <p className="note">
            Volume is sets × reps × weight — the input WHOOP's Strength Trainer
            uses to derive muscular load. The strain score itself is theirs to
            compute. WHOOP's API is read-only today, so the last step is a fast
            paste, not a sync. <b>That gap is the whole point.</b>
          </p>
        </aside>
      </div>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');
.rk{
  --bg:#0A0B0D; --surface:#131519; --surface2:#1A1D23; --line:#262A31; --line2:#333842;
  --text:#F4F6F8; --muted:#8B929C; --muted2:#5E656F;
  --indigo:#7C83FF; --indigoD:#3A3E7a; --amber:#F5A524; --good:#34D399;
  background:var(--bg); color:var(--text); min-height:100vh; position:relative;
  font-family:'Inter',system-ui,sans-serif; padding:22px; box-sizing:border-box;
  -webkit-font-smoothing:antialiased; overflow-x:hidden;
}
.rk .bgfix{position:fixed;inset:0;background:var(--bg);z-index:-1}
.rk *{box-sizing:border-box}
.rk input, .rk button{font-family:inherit}

.top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:12px}
.mark{color:var(--indigo);font-size:26px;line-height:1;transform:translateY(1px)}
.word{font-family:'Archivo';font-weight:800;letter-spacing:2px;font-size:20px}
.tag{font-size:11px;color:var(--muted);letter-spacing:.5px;margin-top:1px}
.disc{font-size:10.5px;color:var(--muted2);letter-spacing:.4px;font-family:'JetBrains Mono';text-transform:uppercase}

.intro{font-size:13px;line-height:1.6;color:var(--muted);max-width:640px;margin:0 0 18px}

.uploader{margin-bottom:20px}
.drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
  border:1.5px dashed var(--line2);border-radius:14px;padding:22px 16px;cursor:pointer;
  background:linear-gradient(180deg,var(--surface),#0e1013);transition:border-color .2s,background .2s;text-align:center}
.drop:hover{border-color:var(--indigo);background:linear-gradient(180deg,#171a2b,#0e1013)}
.drop.busy{border-color:var(--indigo);cursor:progress}
.drop input{display:none}
.drop-ico{font-size:22px;color:var(--indigo);font-weight:700}
.drop.busy .drop-ico{animation:spin 1s linear infinite;display:inline-block}
@keyframes spin{to{transform:rotate(360deg)}}
.drop-main{font-weight:600;font-size:14.5px}
.drop-sub{font-size:12px;color:var(--muted)}

.grid{display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start}
@media(max-width:760px){.grid{grid-template-columns:1fr}.col-side{order:-1}}

.shead{display:flex;align-items:baseline;gap:12px;margin-bottom:14px}
.stitle{background:none;border:none;color:var(--text);font-family:'Archivo';font-weight:800;
  font-size:26px;letter-spacing:.5px;padding:2px 4px;border-radius:6px;width:auto;min-width:60px;max-width:100%}
.stitle:focus{outline:none;background:var(--surface2)}
.sdate{font-family:'JetBrains Mono';font-size:12px;color:var(--muted)}

.ex{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px 14px 12px;margin-bottom:12px}
.ex-top{display:flex;align-items:flex-start;gap:8px;margin-bottom:10px}
.ex-id{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.ex-name{width:100%;background:none;border:none;border-bottom:1px solid transparent;color:var(--text);
  font-size:15px;font-weight:600;padding:3px 2px}
.ex-name:focus{outline:none;border-bottom-color:var(--indigoD)}
.wtag{font-family:'JetBrains Mono';font-size:10px;letter-spacing:.4px;color:var(--good);
  padding:1px 2px;opacity:.85}
.wtag.approx{color:var(--indigo)}
.wtag.none{color:var(--amber);text-transform:none}

.sets{display:flex;flex-direction:column;gap:5px}
.srow{display:grid;grid-template-columns:26px 1fr 1fr 62px 24px;gap:8px;align-items:center}
.shead-row{font-family:'JetBrains Mono';font-size:10px;text-transform:uppercase;letter-spacing:1px;
  color:var(--muted2);padding:0 0 2px}
.shead-row span:nth-child(4){text-align:right}
.sidx{font-family:'JetBrains Mono';font-size:12px;color:var(--muted2);text-align:center}
.cell{background:var(--surface2);border:1px solid var(--line);border-radius:8px;color:var(--text);
  font-family:'JetBrains Mono';font-size:14px;font-weight:500;padding:7px 8px;width:100%;text-align:center;
  -moz-appearance:textfield}
.cell::-webkit-outer-spin-button,.cell::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.cell:focus{outline:none;border-color:var(--indigo)}
.svol{font-family:'JetBrains Mono';font-size:13px;color:var(--amber);text-align:right;font-weight:500}
.x{background:none;border:none;color:var(--muted2);cursor:pointer;font-size:13px;padding:4px;border-radius:6px;line-height:1}
.x:hover{color:#ff6b6b;background:var(--surface2)}
.x.sm{font-size:16px}

.ex-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:11px;padding-top:10px;border-top:1px solid var(--line)}
.addset{background:none;border:1px solid var(--line2);color:var(--muted);border-radius:8px;
  font-size:12px;padding:5px 11px;cursor:pointer;font-weight:500}
.addset:hover{border-color:var(--indigo);color:var(--text)}
.ex-vol{display:flex;align-items:center;gap:10px;flex:1;justify-content:flex-end}
.bar{width:110px;height:5px;background:var(--surface2);border-radius:3px;overflow:hidden}
.fill{height:100%;background:linear-gradient(90deg,var(--amber),#ffd27a);border-radius:3px;transition:width .5s cubic-bezier(.2,.7,.2,1)}
.ev-num{font-family:'JetBrains Mono';font-size:13px;font-weight:700;min-width:66px;text-align:right}
.ev-num em{color:var(--muted2);font-style:normal;font-weight:400;font-size:11px}

.addex{width:100%;background:none;border:1px dashed var(--line2);color:var(--muted);border-radius:12px;
  padding:11px;cursor:pointer;font-size:13px;font-weight:500;margin-top:2px}
.addex:hover{border-color:var(--indigo);color:var(--text)}

.col-side{position:sticky;top:22px;display:flex;flex-direction:column;gap:14px}
.totals{background:linear-gradient(160deg,#181b2e,var(--surface));border:1px solid var(--line);
  border-radius:16px;padding:18px}
.t-label{font-family:'JetBrains Mono';font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted)}
.t-big{font-family:'Archivo';font-weight:800;font-size:44px;line-height:1.05;margin:6px 0 10px;letter-spacing:-.5px}
.t-big em{font-style:normal;font-size:16px;color:var(--muted);font-weight:600;margin-left:6px}
.t-mini{display:flex;gap:16px;font-size:12px;color:var(--muted);flex-wrap:wrap}
.t-mini b{color:var(--text);font-family:'JetBrains Mono';font-weight:700}

.panel{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px}
.p-head{font-family:'JetBrains Mono';font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin-bottom:10px}
.whoop{font-family:'JetBrains Mono';font-size:11.5px;line-height:1.6;color:#cfd4db;white-space:pre-wrap;
  background:#0d0f12;border:1px solid var(--line);border-radius:10px;padding:11px;margin:0 0 12px;max-height:210px;overflow:auto}
.primary{width:100%;background:var(--indigo);color:#0b0c14;border:none;border-radius:10px;padding:11px;
  font-weight:700;font-size:13.5px;cursor:pointer;margin-bottom:8px}
.primary:hover{background:#8f95ff}
.ghost{width:100%;background:none;color:var(--muted);border:1px solid var(--line2);border-radius:10px;
  padding:10px;font-weight:500;font-size:13px;cursor:pointer}
.ghost:hover{color:var(--text);border-color:var(--muted2)}

.note{font-size:11.5px;line-height:1.6;color:var(--muted);padding:0 2px;margin:0}
.note b{color:var(--amber);font-weight:600}
`;
