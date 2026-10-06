import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, CircleHelp, Crosshair, Download, FlaskConical, Layers3, Map, Orbit, Pause, Play, RotateCcw, Send, SlidersHorizontal, Trophy, Wind, X, Zap } from 'lucide-react';
import { DESIGNS, getDesign } from './lib/designs';
import { DEFAULT_SETTINGS, simulateFlight } from './lib/physics';
import { compareDesigns, optimizeDesigns } from './lib/experiments';
import { FlightScene } from './lib/scene';
import { useFlightTools } from './lib/webmcp';
import type { FlightResult, LaunchSettings, RankedFlight } from './lib/types';
import benchmark from '../public/reports/benchmark.json';

type CameraMode = 'orbit' | 'follow' | 'top';
type ModalMode = 'model' | 'folds' | null;
const fmt = (n: number, digits = 1) => Number.isFinite(n) ? n.toFixed(digits) : '—';
const TESTED_OPTIMIZED: RankedFlight[] = benchmark.optimization.ranking.map(row => ({ rank: row.rank, design: getDesign(row.designId), flight: simulateFlight(getDesign(row.designId), row.flight.settings) }));
const FIRST_FLIGHT = TESTED_OPTIMIZED[0].flight;

function RangeControl({ label, value, min, max, step = 1, unit = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (n: number) => void }) {
  const id = label.toLowerCase().replaceAll(' ', '-');
  return <div className="slider-control">
    <div className="slider-label"><label htmlFor={id}>{label}</label><span className="slider-value">{fmt(value, step < 1 ? 1 : 0)}<span>{unit}</span></span></div>
    <input id={id} type="range" min={min} max={max} step={step} value={value} style={{ '--range-progress': `${(value - min) / (max - min) * 100}%` } as React.CSSProperties} onChange={e => onChange(Number(e.target.value))} />
    <div className="slider-limits"><span>{min}{unit}</span><span>{max}{unit}</span></div>
  </div>;
}

function Modal({ mode, designId, onClose }: { mode: ModalMode; designId: string; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const design = getDesign(designId);
  useEffect(() => {
    if (!mode) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const elements = dialog.current?.querySelectorAll<HTMLElement>('button, a, input, select, [tabindex="0"]');
        if (elements?.length) {
          const first = elements[0], last = elements[elements.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [mode, onClose]);
  if (!mode) return null;
  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={dialog} className={`modal ${mode === 'model' ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div className="modal-header"><div><p className="eyebrow">{mode === 'model' ? 'BEHIND THE FLIGHT' : 'ONE SHEET. NO CUTS.'}</p><h2 id="dialog-title">{mode === 'model' ? 'Model & assumptions' : `Fold a ${design.name}`}</h2></div><button className="modal-close icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>
      <div className="modal-body">
        {mode === 'folds' ? <>
          <p className="design-description">A starting guide for a representative {design.name.toLowerCase()}. Use one A4 sheet of 80 g/m² paper and press every crease firmly. Small differences in your folds will change the real flight.</p>
          <ol className="fold-list">{design.foldSteps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, '0')}</span><p>{step}</p></li>)}</ol>
          <div className="modal-note">Keep both wings symmetric. Begin with a gentle, level throw; adjust the trailing edges a little at a time.</div>
        </> : <>
          <p>This is an exploratory flight model. Airframe coefficients are estimates for representative folds, so a simulated winner is a hypothesis to test with real paper.</p>
          <div className="model-grid">
            <div className="model-card"><Wind size={21} /><h3>Lift, drag & gravity</h3><p>Flights use air-relative velocity, angle of attack, induced drag and a stall response. Gravity is 9.81 m/s²; air density is 1.225 kg/m³.</p></div>
            <div className="model-card"><Layers3 size={21} /><h3>The same sheet</h3><p>Every design uses one A4 sheet: 4.99 g at 80 g/m². Changing paper weight changes mass. The fold determines the exposed wing area and span.</p></div>
            <div className="model-card"><FlaskConical size={21} /><h3>A fair comparison</h3><p>Matched launches use identical speed, angle, height, wind and seed. Optimization gives all designs the same grid of speeds, angles and trim settings.</p></div>
            <div className="model-card"><CircleHelp size={21} /><h3>What it leaves out</h3><p>Paper flexibility, imperfect folds, detailed rotational dynamics and thermals are approximations or omitted. This is not CFD or a calibrated physical experiment.</p></div>
          </div>
          <h3>Selected airframe · {design.name}</h3>
          <table className="coefficient-table"><tbody><tr><th>Wing area</th><td>{fmt(design.wingArea * 10000, 0)} cm²</td><th>Span</th><td>{fmt(design.span * 100, 1)} cm</td></tr><tr><th>Zero-lift drag coefficient</th><td>{fmt(design.cd0, 3)}</td><th>Maximum lift coefficient</th><td>{fmt(design.maxCl, 2)}</td></tr><tr><th>Lift slope</th><td>{fmt(design.liftSlope, 2)} / rad</td><th>Neutral trim</th><td>{fmt(design.trimAngle, 1)}°</td></tr></tbody></table>
          <div className="modal-note">The default physics step is 1/120 s. Aircraft are rendered at 3× size for visibility; paths and measurements stay in metres. Flights stop at ground contact or the 60-second cap. Capped flights cannot win the optimization.</div>
        </>}
      </div>
    </div>
  </div>;
}

export default function App() {
  const [selectedId, setSelectedId] = useState(FIRST_FLIGHT.designId);
  const [settings, setSettings] = useState<LaunchSettings>({ ...FIRST_FLIGHT.settings });
  const [advanced, setAdvanced] = useState(false);
  const [flight, setFlight] = useState<FlightResult>(FIRST_FLIGHT);
  const [matched, setMatched] = useState<RankedFlight[]>(() => compareDesigns(DEFAULT_SETTINGS));
  const [optimized, setOptimized] = useState<RankedFlight[]>(TESTED_OPTIMIZED);
  const [tab, setTab] = useState<'matched' | 'optimized'>('optimized');
  const [hasLaunched, setHasLaunched] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [camera, setCamera] = useState<CameraMode>('orbit');
  const [comparison, setComparison] = useState(false);
  const [modal, setModal] = useState<ModalMode>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [trialCount, setTrialCount] = useState(benchmark.optimization.trials);
  const [error, setError] = useState('');
  const stage = useRef<HTMLDivElement>(null);
  const scene = useRef<FlightScene | null>(null);
  const abort = useRef<AbortController | null>(null);
  const design = getDesign(selectedId);
  const ranking = tab === 'matched' ? matched : optimized;
  const playbackDuration = comparison ? Math.max(...ranking.map(r => r.flight.duration), 0) : flight.duration;
  const winner = ranking[0];
  const completedWinner = winner?.flight.landed && !winner.flight.truncated;
  const closeModal = useCallback(() => setModal(null), []);
  const activeSample = useMemo(() => {
    if (!hasLaunched) return flight.samples[0];
    let low = 0, high = Math.max(0, flight.samples.length - 1);
    while (low < high) { const mid = Math.ceil((low + high) / 2); if (flight.samples[mid].t <= time) low = mid; else high = mid - 1; }
    return flight.samples[low];
  }, [flight, hasLaunched, time]);
  const liveSpeed = activeSample ? Math.hypot(activeSample.vx, activeSample.vy, activeSample.vz) : settings.speed;
  const liveDistance = activeSample ? Math.hypot(activeSample.x, activeSample.z) : 0;
  const liveHeight = activeSample?.y ?? settings.height;

  useEffect(() => {
    if (!stage.current) return;
    try { scene.current = new FlightScene(stage.current, setError); scene.current.setDesign(getDesign(FIRST_FLIGHT.designId)); }
    catch { setError('The 3D view could not start. You can still compare and test all designs below.'); }
    return () => { scene.current?.destroy(); scene.current = null; abort.current?.abort(); };
  }, []);
  useEffect(() => { if (!hasLaunched) scene.current?.setDesign(design); }, [design, hasLaunched]);
  useEffect(() => { if (hasLaunched) scene.current?.setFlight(flight); }, [flight, hasLaunched]);
  useEffect(() => { scene.current?.setComparison(comparison && hasLaunched ? ranking.map(row => row.flight) : null); }, [comparison, ranking, hasLaunched]);
  useEffect(() => { scene.current?.setCamera(camera); }, [camera]);
  useEffect(() => { scene.current?.setTime(time); }, [time]);
  useEffect(() => {
    if (!playing) return;
    let frame = 0, previous = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min((now - previous) / 1000, 0.08) * playbackRate;
      previous = now;
      setTime(old => Math.min(old + elapsed, playbackDuration));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, playbackDuration, playbackRate]);
  useEffect(() => { if (playing && time >= playbackDuration) setPlaying(false); }, [time, playing, playbackDuration]);

  const updateSetting = (key: keyof LaunchSettings, value: number) => {
    setSettings(old => ({ ...old, [key]: value }));
    setPlaying(false); setHasLaunched(false); setComparison(false); setTime(0);
  };
  const selectDesign = (id: string) => {
    setSelectedId(id); setPlaying(false); setHasLaunched(false); setComparison(false); setTime(0);
    setFlight(simulateFlight(getDesign(id), settings));
  };
  const launch = () => {
    setFlight(simulateFlight(design, settings)); setComparison(false); setHasLaunched(true); setTime(0); setPlaying(true); setCamera('follow');
  };
  const compare = () => {
    const results = compareDesigns(settings);
    setMatched(results); setTab('matched'); setFlight(results.find(r => r.design.id === selectedId)!.flight);
    setHasLaunched(true); setComparison(true); setTime(0); setPlaying(true); setCamera('orbit');
    return results;
  };
  const optimize = async () => {
    const controller = new AbortController(); abort.current = controller;
    setProgress({ done: 0, total: 840 });
    try {
      const result = await optimizeDesigns({ ...settings }, (done, total) => setProgress({ done, total }), controller.signal);
      setOptimized(result.ranking); setTrialCount(result.trials); setTab('optimized');
      if (result.ranking.length) {
        const best = result.ranking[0]; setSelectedId(best.design.id); setFlight(best.flight); setSettings({ ...best.flight.settings });
        setHasLaunched(true); setComparison(true); setTime(0); setPlaying(true); setCamera('orbit');
      }
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'The launch search could not finish.'); }
    finally { setProgress(null); abort.current = null; }
  };
  const replay = () => { if (!hasLaunched) { launch(); return; } setTime(0); setPlaying(true); };
  const inspectFlight = (row: RankedFlight) => {
    setSelectedId(row.design.id); setSettings({ ...row.flight.settings }); setFlight(row.flight); setComparison(false);
    setTime(0); setHasLaunched(true); setPlaying(true); setCamera('follow'); stage.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const exportResults = () => {
    const columns = ['rank', 'design', 'duration_s', 'distance_m', 'max_height_m', 'speed_mps', 'angle_deg', 'trim_deg', 'height_m', 'paper_gsm', 'wind_mps', 'wind_direction_deg', 'turbulence', 'seed', 'landed', 'time_capped'];
    const csv = [columns.join(','), ...ranking.map(r => [r.rank, r.design.name, r.flight.duration, r.flight.distance, r.flight.maxHeight, r.flight.settings.speed, r.flight.settings.angle, r.flight.settings.trim, r.flight.settings.height, r.flight.settings.paperWeight, r.flight.settings.windSpeed, r.flight.settings.windDirection, r.flight.settings.turbulence, r.flight.settings.seed, r.flight.landed, r.flight.truncated].join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a'); link.href = url; link.download = `fold-flight-${tab}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const environment = settings.windSpeed === 0 && settings.turbulence === 0 ? 'Still air' : `${fmt(settings.windSpeed)} m/s wind`;
  const status = !hasLaunched ? 'Ready to launch' : time >= playbackDuration ? (flight.truncated ? 'Time limit reached' : 'Flight complete') : playing ? 'In flight' : 'Paused';
  useFlightTools({ selectedId, settings, ranking, comparisonMethod: tab, playing }, compare);

  return <>
    <header className="app-header"><div className="brand"><span className="brand-mark"><Send size={23} strokeWidth={1.6} /></span><div><span className="brand-name">FOLD <span>/</span> FLIGHT</span><span className="brand-sub">PAPER PLANE LAB</span></div></div><div className="header-right"><span className="engine-badge">THREE.JS <b>r186</b></span><button className="header-action" onClick={() => setModal('model')}><CircleHelp size={17} /><span>How it works</span></button></div></header>
    <main className="app-main">
      <div className="intro-row"><div><p className="eyebrow">THE ART OF STAYING AIRBORNE</p><h1 className="page-title">A little paper. A lot of possibility.</h1><p className="page-description">Fold it. Fly it. Find the design that stays up longest.</p></div><span className="condition-pill"><Wind size={16} />{environment}<span>·</span> No thermals</span></div>
      <div className="lab-layout">
        <aside className="control-panel" aria-label="Airframe and launch controls">
          <section className="panel-section"><div className="section-heading"><h2>Choose your airframe</h2><span>01</span></div>
            <div className="design-options">{DESIGNS.map(d => <button key={d.id} className={`design-option ${d.id === selectedId ? 'selected' : ''}`} aria-pressed={d.id === selectedId} onClick={() => selectDesign(d.id)}><Send className="design-icon" size={19} style={{ color: d.color, transform: `rotate(${d.shape === 'wide' || d.shape === 'glider' ? '-18' : '0'}deg)` }} strokeWidth={1.4} /><span><span className="design-option-name">{d.name}</span><span className="design-option-kind">{d.category}</span></span></button>)}</div>
            <div className="selected-design"><div><span className="design-category">{design.subtitle}</span><button className="text-button" onClick={() => setModal('folds')}><Layers3 size={14} />Fold guide</button></div><p className="design-description" title={design.description}>{design.description}</p></div>
          </section>
          <section className="panel-section launch-section"><div className="section-heading"><h2>Set your launch</h2><span>02</span></div>
            <RangeControl label="Launch speed" value={settings.speed} min={2} max={12} step={0.5} unit=" m/s" onChange={value => updateSetting('speed', value)} />
            <RangeControl label="Launch angle" value={settings.angle} min={-10} max={40} unit="°" onChange={value => updateSetting('angle', value)} />
            <RangeControl label="Release height" value={settings.height} min={0.5} max={5} step={0.1} unit=" m" onChange={value => updateSetting('height', value)} />
            <button className="advanced-toggle" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}><SlidersHorizontal size={15} />Paper, wind & trim{advanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>
            {advanced && <div className="advanced-controls">
              <RangeControl label="Paper weight" value={settings.paperWeight} min={60} max={120} step={5} unit=" g/m²" onChange={value => updateSetting('paperWeight', value)} />
              <RangeControl label="Wind speed" value={settings.windSpeed} min={0} max={6} step={0.5} unit=" m/s" onChange={value => updateSetting('windSpeed', value)} />
              <div className="slider-label"><label htmlFor="wind-direction">Wind direction</label><select id="wind-direction" value={settings.windDirection} onChange={e => updateSetting('windDirection', Number(e.target.value))}><option value={0}>Tailwind</option><option value={180}>Headwind</option><option value={90}>Crosswind</option></select></div>
              <RangeControl label="Gust intensity" value={settings.turbulence} min={0} max={1} step={0.1} onChange={value => updateSetting('turbulence', value)} />
              <RangeControl label="Elevator trim" value={settings.trim} min={-5} max={5} unit="°" onChange={value => updateSetting('trim', value)} />
              <button className="text-button" onClick={() => { setSettings({ ...DEFAULT_SETTINGS }); setHasLaunched(false); setPlaying(false); setComparison(false); setTime(0); }}><RotateCcw size={13} />Reset conditions</button>
            </div>}
            <button className="launch-button" onClick={launch}><Send size={18} />Launch plane<span>SPACE</span></button>
            <div className="launch-actions"><button className="secondary-button" onClick={compare} disabled={!!progress}><Layers3 size={16} />Compare all designs</button></div>
          </section>
        </aside>
        <section className="flight-panel" aria-label="3D flight simulator">
          <div className="scene-shell"><div ref={stage} className="scene-host" />
            <div className="scene-topbar"><div className="scene-label"><span className="scene-index">FLIGHT DECK 01</span><span className="live-pill"><span className={playing ? 'status-dot active' : 'status-dot'} />{status}</span></div><div className="scene-tools">{([{ id: 'orbit', label: 'Orbit camera', icon: Orbit }, { id: 'follow', label: 'Follow camera', icon: Crosshair }, { id: 'top', label: 'Top camera', icon: Map }] as const).map(c => <button key={c.id} className={`icon-button ${camera === c.id ? 'active' : ''}`} title={c.label} aria-label={c.label} aria-pressed={camera === c.id} onClick={() => setCamera(c.id)}><c.icon size={18} /></button>)}</div></div>
            {error && <div className="error-state" role="status"><CircleHelp size={24} /><p>{error}</p><button className="text-button" onClick={() => setError('')}>Dismiss</button></div>}
            <div className="scene-bottom-overlay"><div className="scene-caption"><span>{comparison ? 'Eight airframes. One sky.' : design.name}</span><small>{comparison ? `Telemetry follows ${design.name}` : 'Drag to orbit · Scroll to zoom'}</small></div><div className="scene-scale"><span />METRES · Y UP</div></div>
          </div>
          <div className="telemetry-row" aria-live="off"><div className="metric"><span className="metric-label">AIRTIME</span><span className="metric-value">{fmt(hasLaunched ? Math.min(time, flight.duration) : 0, 2)}<span className="metric-unit">s</span></span></div><div className="metric"><span className="metric-label">DISTANCE</span><span className="metric-value">{fmt(hasLaunched ? liveDistance : 0)}<span className="metric-unit">m</span></span></div><div className="metric"><span className="metric-label">ALTITUDE</span><span className="metric-value">{fmt(hasLaunched ? liveHeight : settings.height)}<span className="metric-unit">m</span></span></div><div className="metric"><span className="metric-label">GROUND SPEED</span><span className="metric-value">{fmt(hasLaunched ? liveSpeed : settings.speed)}<span className="metric-unit">m/s</span></span></div></div>
          <div className="playback-bar"><button className="icon-button" aria-label={playing ? 'Pause flight' : 'Play flight'} onClick={() => { if (!hasLaunched || time >= playbackDuration) replay(); else setPlaying(!playing); }}>{playing ? <Pause size={17} /> : <Play size={17} />}</button><button className="icon-button" aria-label="Replay flight" title="Replay flight" onClick={replay}><RotateCcw size={16} /></button><input aria-label="Flight timeline" type="range" min={0} max={Math.max(playbackDuration, 0.01)} step={0.01} value={Math.min(time, playbackDuration)} disabled={!hasLaunched} onChange={e => { setPlaying(false); setTime(Number(e.target.value)); }} /><span className="time-label">{fmt(time)} / {fmt(playbackDuration)} s</span><select className="speed-select" aria-label="Playback speed" value={playbackRate} onChange={e => setPlaybackRate(Number(e.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></div>
        </section>
      </div>
      <section className="results-panel" aria-label="Design comparison results"><div className="results-header"><div className="results-heading"><p className="eyebrow">LET THE FLIGHTS DECIDE</p><h2>The airtime leaderboard</h2><p className="results-description">{tab === 'matched' ? `Shared release: ${fmt(matched[0].flight.settings.speed)} m/s · ${matched[0].flight.settings.angle}° · ${fmt(matched[0].flight.settings.height)} m high. Ranked by airtime.` : `${trialCount.toLocaleString()} launches. The best completed flight for each design in the same search grid.`}</p></div><div className="results-actions"><button className="secondary-button" onClick={exportResults} disabled={!ranking.length}><Download size={16} />Export CSV</button><button className="optimize-button secondary-button" onClick={progress ? () => abort.current?.abort() : optimize}><Zap size={16} />{progress ? 'Cancel search' : 'Find best launches'}</button></div></div>
        <div className="section-tabs" role="tablist" aria-label="Comparison method"><button role="tab" aria-selected={tab === 'matched'} className={tab === 'matched' ? 'active' : ''} onClick={() => { setTab('matched'); setComparison(false); setPlaying(false); }}>Matched launch<span>{matched.length}</span></button><button role="tab" aria-selected={tab === 'optimized'} className={tab === 'optimized' ? 'active' : ''} onClick={() => { setTab('optimized'); setComparison(false); setPlaying(false); }}>Best launch search{optimized.length > 0 && <span>{optimized.length}</span>}</button><span className="table-hint">Select a design to replay its flight</span></div>
        {progress && <div className="progress-status" role="status"><Activity size={16} /><span>Testing launches · {progress.done} / {progress.total}</span><progress max={progress.total} value={progress.done} /></div>}
        {ranking.length ? <>
          <div className="leaderboard-wrap"><table className="leaderboard"><thead><tr><th scope="col">RANK</th><th scope="col">AIRFRAME</th><th scope="col">AIRTIME <ChevronDown size={12} /></th><th scope="col">DISTANCE</th><th scope="col">PEAK HEIGHT</th><th scope="col">LAUNCH</th><th scope="col"><span className="sr-only">Replay</span></th></tr></thead><tbody>{ranking.map(row => <tr key={row.design.id} className={row.rank === 1 ? 'row-winner' : ''}><td><span className="rank">{String(row.rank).padStart(2, '0')}</span></td><td><button className="table-design" onClick={() => inspectFlight(row)}><span className="table-plane-icon" style={{ color: row.design.color }}><Send size={19} /></span><span>{row.design.name}<small>{row.design.category}</small></span>{row.rank === 1 && completedWinner && <span className="winner-tag"><Trophy size={11} />LONGEST</span>}</button></td><td><div className="duration-bar"><span className="bar-fill" style={{ width: `${winner ? Math.max(6, row.flight.duration / winner.flight.duration * 100) : 0}%`, background: row.design.color }} /><span className="duration-value">{fmt(row.flight.duration, 2)} s{row.flight.truncated ? ' (cap)' : ''}</span></div></td><td>{fmt(row.flight.distance)}<span className="table-unit"> m</span></td><td>{fmt(row.flight.maxHeight)}<span className="table-unit"> m</span></td><td><span className="launch-cell">{fmt(row.flight.settings.speed)} m/s <span>·</span> {fmt(row.flight.settings.angle, 0)}°{tab === 'optimized' && <small>trim {row.flight.settings.trim > 0 ? '+' : ''}{row.flight.settings.trim}°</small>}</span></td><td><button className="icon-button replay-row" aria-label={`Replay ${row.design.name}`} onClick={() => inspectFlight(row)}><Play size={14} /></button></td></tr>)}</tbody></table></div>
          <div className="comparison-summary"><div className="champion"><Trophy size={19} /><p>{completedWinner ? <><strong>{winner?.design.name}</strong> has the longest predicted airtime in this test.</> : <>The leading flight reached the time cap. Its full airtime is unknown.</>}<span>{fmt(winner?.flight.duration ?? 0, 2)} seconds observed · {fmt(winner?.flight.distance ?? 0)} metres travelled</span></p></div><p className="summary-note">Estimated aerodynamics.<br />Real folds need real flight tests.</p></div>
        </> : <div className="search-empty"><FlaskConical size={30} /><h3>Give every design its best shot.</h3><p>Search 7 launch angles × 5 speeds × 3 trim settings for each airframe. Height, wind and paper stay fixed.</p><button className="secondary-button" disabled={!!progress} onClick={optimize}><Zap size={16} />Find best launches</button></div>}
      </section>
      <footer className="app-footer"><p className="footer-note"><FlaskConical size={15} />A virtual wind tunnel for one sheet of paper.</p><button className="text-button" onClick={() => setModal('model')}>Model & assumptions<CircleHelp size={14} /></button><a className="text-button" href="/reports/benchmark.md" download><Download size={14} />Test report</a><span className="footer-engine">THREE.JS r186 · 120 Hz PHYSICS</span></footer>
    </main>
    <Modal mode={modal} designId={selectedId} onClose={closeModal} />
    <KeyboardLaunch launch={launch} playing={playing} setPlaying={setPlaying} hasLaunched={hasLaunched} modal={modal} />
  </>;
}

function KeyboardLaunch({ launch, playing, setPlaying, hasLaunched, modal }: { launch: () => void; playing: boolean; setPlaying: (value: boolean) => void; hasLaunched: boolean; modal: ModalMode }) {
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || modal || event.repeat) return;
      const target = event.target as HTMLElement;
      if (target.matches('input, select, textarea, button, a') || target.isContentEditable) return;
      event.preventDefault(); if (!hasLaunched) launch(); else setPlaying(!playing);
    };
    window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle);
  }, [launch, playing, setPlaying, hasLaunched, modal]);
  return null;
}
