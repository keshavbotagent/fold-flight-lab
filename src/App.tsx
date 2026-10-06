import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, CircleHelp, Crosshair, Download, FlaskConical, Layers3, Map, Orbit, Pause, Play, RotateCcw, Send, SlidersHorizontal, Trophy, Wind, X, Zap } from 'lucide-react';
import { DESIGNS, getDesign } from './lib/designs';
import { DEFAULT_SETTINGS, PHYSICS_VERSION, simulateFlight } from './lib/physics';
import { getAtmosphere } from './lib/atmosphere';
import { NEW_DELHI_ENVIRONMENT, isNewDelhiEnvironment } from './lib/environment';
import { compareDesigns, optimizeDesigns, OPTIMIZATION_RANGES } from './lib/experiments';
import { FlightScene } from './lib/scene';
import { useFlightTools } from './lib/webmcp';
import type { FlightResult, LaunchSettings, RankedFlight } from './lib/types';
import benchmark from './data/tested-results.json';
import { FoldGuide } from './components/FoldGuide';
import { CompetitionDetails } from './components/CompetitionDetails';

type CameraMode = 'orbit' | 'follow' | 'top';
type ModalMode = 'model' | 'folds' | null;
const fmt = (n: number, digits = 1) => Number.isFinite(n) ? n.toFixed(digits) : '—';
const TESTED_OPTIMIZED: RankedFlight[] = benchmark.optimization.ranking.map(row => ({ rank: row.rank, design: getDesign(row.designId), flight: simulateFlight(getDesign(row.designId), row.flight.settings) }));
const FIRST_FLIGHT = TESTED_OPTIMIZED[0].flight;
const SEARCH_TRIALS = DESIGNS.length * OPTIMIZATION_RANGES.angles.length * OPTIMIZATION_RANGES.speeds.length * OPTIMIZATION_RANGES.trims.length;
// Keep the new documented champions visible in the compact airframe picker.
const CATALOGUE = [...DESIGNS.filter(design => design.achievement), ...DESIGNS.filter(design => !design.achievement)];

function RangeControl({ label, value, min, max, step = 1, unit = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (n: number) => void }) {
  const id = label.toLowerCase().replaceAll(' ', '-');
  return <div className="slider-control">
    <div className="slider-label"><label htmlFor={id}>{label}</label><span className="slider-value">{fmt(value, step < 1 ? 1 : 0)}<span>{unit}</span></span></div>
    <input id={id} type="range" min={min} max={max} step={step} value={value} style={{ '--range-progress': `${(value - min) / (max - min) * 100}%` } as React.CSSProperties} onChange={e => onChange(Number(e.target.value))} />
    <div className="slider-limits"><span>{min}{unit}</span><span>{max}{unit}</span></div>
  </div>;
}

function Modal({ mode, designId, settings, onClose }: { mode: ModalMode; designId: string; settings: LaunchSettings; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const design = getDesign(designId);
  const atmosphere = getAtmosphere(settings, settings.height);
  useEffect(() => {
    if (!mode) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), summary, [tabindex="0"]') ?? []).filter(element => element.getClientRects().length > 0 && element.checkVisibility?.() !== false);
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
    <div ref={dialog} className={`modal wide ${mode === 'folds' ? 'fold-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div className="modal-header"><div><p className="eyebrow">{mode === 'model' ? 'BEHIND THE FLIGHT' : 'ONE SHEET. NO CUTS.'}</p><h2 id="dialog-title">{mode === 'model' ? 'Model & assumptions' : `Fold a ${design.name}`}</h2></div><button className="modal-close icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>
      <div className="modal-body">
        {mode === 'folds' ? <FoldGuide key={design.id} design={design} /> : <>
          <p>Flight follows a six-degree-of-freedom (6DoF) rigid-body model with Earth gravity, aerodynamic forces and rotational moments. Airframe coefficients and inertia factors are engineering estimates without experimental calibration.</p>
          <div className="model-grid">
            <div className="model-card"><Wind size={21} /><h3>Earth gravity & atmosphere</h3><p>Altitude above sea level is ground elevation plus the plane’s height above ground. Sea-level pressure and altitude set local pressure. Temperature and humidity determine moist-air density; humid air is less dense at the same temperature and pressure. Gravity decreases with altitude.</p></div>
            <div className="model-card"><Activity size={21} /><h3>Lift, drag & Reynolds number</h3><p>Forces use air-relative speed and angle of attack. Lift includes a stall response; drag includes a Reynolds-dependent profile term and finite-wing induced drag. Wind changes the airspeed used by these forces.</p></div>
            <div className="model-card"><Orbit size={21} /><h3>Six degrees of freedom</h3><p>Position and quaternion attitude evolve through RK4 integration with adaptive substeps. Estimated body inertia, the center of gravity and aerodynamic center determine pitch, roll and yaw moments with rotational damping.</p></div>
            <div className="model-card"><Layers3 size={21} /><h3>The same sheet</h3><p>Every airframe uses one A4 sheet: 4.9896 g at 80 g/m². Paper weight scales mass; each fold changes wing area, span, estimated mass distribution and aerodynamic stability.</p></div>
            <div className="model-card"><FlaskConical size={21} /><h3>A fair comparison</h3><p>Matched launches share speed, angle, height, paper, wind, temperature, field elevation and gust seed. The launch search gives every design the same speed, angle and trim grid while the other conditions stay fixed.</p></div>
            <div className="model-card"><CircleHelp size={21} /><h3>Accuracy needs flight data</h3><p>Paper flexibility, imperfect creases, surface roughness and thermals remain approximations or omitted. Measured geometry, mass distribution and flight or wind-tunnel data are needed to establish accuracy for a real fold.</p></div>
          </div>
          <h3>Selected airframe · {design.name}</h3>
          <CompetitionDetails design={design} />
          <table className="coefficient-table"><tbody>
            <tr><th>Wing area</th><td>{fmt(design.wingArea * 10000, 0)} cm²</td><th>Span</th><td>{fmt(design.span * 100, 1)} cm</td></tr>
            <tr><th>Reference profile drag</th><td>{fmt(design.cd0, 3)}</td><th>Maximum lift coefficient</th><td>{fmt(design.maxCl, 2)}</td></tr>
            <tr><th>Lift slope</th><td>{fmt(design.liftSlope, 2)} / rad</td><th>Neutral trim</th><td>{fmt(design.trimAngle, 1)}°</td></tr>
            {design.dynamics && <>
              <tr><th>Estimated CG</th><td>{fmt(design.dynamics.centerOfGravity * 100, 1)}% chord</td><th>Estimated static margin</th><td>{fmt((design.dynamics.aerodynamicCenter - design.dynamics.centerOfGravity) * 100, 1)}% chord</td></tr>
              <tr><th>Estimated span efficiency</th><td>{fmt(design.dynamics.spanEfficiency, 2)}</td><th>Reference chord</th><td>{fmt(design.wingArea / design.span * 100, 1)} cm</td></tr>
            </>}
          </tbody></table>
          <h3>Air at release · current conditions</h3>
          <table className="coefficient-table"><tbody>
            <tr><th>Air temperature</th><td>{fmt(settings.airTemperature, 0)}°C</td><th>Ground elevation</th><td>{fmt(settings.fieldElevation, 0)} m above sea level</td></tr>
            <tr><th>Relative humidity</th><td>{fmt(settings.relativeHumidity, 0)}%</td><th>Sea-level pressure</th><td>{fmt(settings.seaLevelPressure)} hPa</td></tr>
            <tr><th>Release height</th><td>{fmt(settings.height)} m above ground</td><th>Release altitude</th><td>{fmt(atmosphere.altitudeMSL)} m above sea level</td></tr>
            <tr><th>Local gravity</th><td>{fmt(atmosphere.gravity, 5)} m/s²</td><th>Air density</th><td>{fmt(atmosphere.density, 4)} kg/m³</td></tr>
            <tr><th>Local pressure</th><td>{fmt(atmosphere.pressure / 100)} hPa</td><th>Dynamic viscosity</th><td>{fmt(atmosphere.dynamicViscosity * 1e6, 2)} µPa·s</td></tr>
          </tbody></table>
          <h3>Default environment · New Delhi, India</h3>
          <p>Safdarjung reference: 28.585° N, 77.206° E, 215 m above sea level; India Standard Time (UTC+5:30). The 26°C temperature, 46% humidity and 2 m/s wind are rounded NASA POWER {NEW_DELHI_ENVIRONMENT.climatePeriod} annual means. Sea-level pressure is estimated at 1008.3 hPa. Headwind direction is chosen for the simulation. These are representative defaults, not live weather.</p>
          <p className="environment-sources"><a href={NEW_DELHI_ENVIRONMENT.sources.climate} target="_blank" rel="noreferrer">NASA POWER climatology</a><span> · </span><a href={NEW_DELHI_ENVIRONMENT.sources.elevation} target="_blank" rel="noreferrer">NOAA station elevation</a></p>
          <div className="modal-note">Model {PHYSICS_VERSION}. The default requested physics step is 1/120 s; smaller integration substeps resolve rotational motion. Aircraft are rendered at 3× size for visibility; paths and measurements stay in metres. CG and aerodynamic center use an estimated reference chord (wing area ÷ span). Flights stop at ground contact or the 60-second cap; capped flights cannot win the launch search.</div>
        </>}
      </div>
    </div>
  </div>;
}

export default function App() {
  const [selectedId, setSelectedId] = useState(FIRST_FLIGHT.designId);
  const [settings, setSettings] = useState<LaunchSettings>({ ...DEFAULT_SETTINGS, ...FIRST_FLIGHT.settings });
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
  const testedConditions = winner?.flight.settings;
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
  const localAtmosphere = useMemo(
    () => getAtmosphere(hasLaunched ? flight.settings : settings, hasLaunched ? Math.max(0, liveHeight) : settings.height),
    [settings, flight.settings, hasLaunched, liveHeight],
  );
  const liveDensity = hasLaunched ? activeSample?.density ?? localAtmosphere.density : localAtmosphere.density;

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
    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);
    setFlight(simulateFlight(design, nextSettings));
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
    setProgress({ done: 0, total: SEARCH_TRIALS });
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
    const columns = ['rank', 'design', 'duration_s', 'distance_m', 'max_height_m', 'speed_mps', 'angle_deg', 'trim_deg', 'height_m', 'paper_gsm', 'wind_mps', 'wind_direction_deg', 'turbulence', 'air_temperature_c', 'field_elevation_m', 'relative_humidity_percent', 'sea_level_pressure_hpa', 'release_altitude_msl_m', 'peak_altitude_msl_m', 'mass_g', 'seed', 'simulation_step_s', 'landed', 'time_capped', 'model_version'];
    const csv = [columns.join(','), ...ranking.map(r => [
      r.rank, r.design.name, r.flight.duration, r.flight.distance, r.flight.maxHeight,
      r.flight.settings.speed, r.flight.settings.angle, r.flight.settings.trim, r.flight.settings.height,
      r.flight.settings.paperWeight, r.flight.settings.windSpeed, r.flight.settings.windDirection,
      r.flight.settings.turbulence, r.flight.settings.airTemperature, r.flight.settings.fieldElevation,
      r.flight.settings.relativeHumidity, r.flight.settings.seaLevelPressure,
      r.flight.settings.fieldElevation + r.flight.settings.height,
      r.flight.settings.fieldElevation + r.flight.maxHeight,
      (r.flight.mass ?? r.design.mass * r.flight.settings.paperWeight / 80) * 1000,
      r.flight.settings.seed, r.flight.settings.dt, r.flight.landed, r.flight.truncated,
      r.flight.modelVersion ?? PHYSICS_VERSION,
    ].join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a'); link.href = url; link.download = `fold-flight-${tab}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const environment = settings.windSpeed === 0 && settings.turbulence === 0 ? 'Still air' : `${fmt(settings.windSpeed)} m/s wind`;
  const environmentName = isNewDelhiEnvironment(settings) ? NEW_DELHI_ENVIRONMENT.name : 'Custom environment';
  const status = !hasLaunched ? 'Ready to launch' : time >= playbackDuration ? (flight.truncated ? 'Time limit reached' : 'Flight complete') : playing ? 'In flight' : 'Paused';
  useFlightTools({ selectedId, settings, ranking, comparisonMethod: tab, playing }, compare);

  return <>
    <header className="app-header"><div className="brand"><span className="brand-mark"><Send size={23} strokeWidth={1.6} /></span><div><span className="brand-name">FOLD <span>/</span> FLIGHT</span><span className="brand-sub">PAPER PLANE LAB</span></div></div><div className="header-right"><span className="engine-badge">THREE.JS <b>r186</b></span><button className="header-action" onClick={() => setModal('model')}><CircleHelp size={17} /><span>How it works</span></button></div></header>
    <main className="app-main">
      <div className="intro-row"><div><p className="eyebrow">THE ART OF STAYING AIRBORNE</p><h1 className="page-title">A little paper. A lot of possibility.</h1><p className="page-description">Fold it. Fly it. Find the design that stays up longest.</p></div><div className="environment-summary" aria-label="Environment details"><strong>{environmentName}</strong><small>{isNewDelhiEnvironment(settings) ? 'Representative annual preset' : 'Edited conditions'}</small><p>{fmt(settings.airTemperature, 0)}°C · {fmt(settings.relativeHumidity, 0)}% humidity · {fmt(settings.fieldElevation, 0)} m above sea level</p><span className="condition-pill"><Wind size={16} />{environment}<span>·</span>{fmt(settings.seaLevelPressure)} hPa at sea level</span></div></div>
      <div className="lab-layout">
        <aside className="control-panel" aria-label="Airframe and launch controls">
          <section className="panel-section"><div className="section-heading"><h2>Choose airframe</h2><span>{DESIGNS.length} designs</span></div>
            <div className="design-options" role="group" aria-label="Paper plane designs">{CATALOGUE.map(d => <button key={d.id} className={`design-option ${d.id === selectedId ? 'selected' : ''}`} aria-pressed={d.id === selectedId} onClick={() => selectDesign(d.id)}><Send className="design-icon" size={19} style={{ color: d.color, transform: `rotate(${d.shape === 'wide' || d.shape === 'glider' || d.shape === 'sky-king' ? '-18' : '0'}deg)` }} strokeWidth={1.4} /><span><span className="design-option-name">{d.name}</span><span className="design-option-kind">{d.category}</span></span>{d.achievement && <Trophy className="design-achievement-icon" size={11} aria-hidden="true" />}</button>)}</div>
            <div className="selected-design"><div><span className="selected-plane-name">{design.name}</span><button className="text-button" onClick={() => setModal('folds')}><Layers3 size={14} />Fold guide</button></div><p className="design-description" title={design.description}>{design.description}</p>{design.achievement && <a className="design-record" href={design.achievement.sourceUrl} target="_blank" rel="noreferrer">{design.achievement.value} {design.achievement.unit} · {design.achievement.date.slice(0, 4)} {design.achievement.status === 'former-world-record' ? 'former record' : 'world-final win'}</a>}</div>
          </section>
          <section className="panel-section launch-section"><div className="section-heading"><h2>Set your launch</h2><span>02</span></div>
            <RangeControl label="Launch speed" value={settings.speed} min={2} max={12} step={0.5} unit=" m/s" onChange={value => updateSetting('speed', value)} />
            <RangeControl label="Launch angle" value={settings.angle} min={-10} max={80} unit="°" onChange={value => updateSetting('angle', value)} />
            <RangeControl label="Release height" value={settings.height} min={0.5} max={5} step={0.1} unit=" m" onChange={value => updateSetting('height', value)} />
            <button className="advanced-toggle" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}><SlidersHorizontal size={15} />Paper, wind & altitude{advanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>
            {advanced && <div className="advanced-controls">
              <RangeControl label="Paper weight" value={settings.paperWeight} min={60} max={120} step={5} unit=" g/m²" onChange={value => updateSetting('paperWeight', value)} />
              <RangeControl label="Wind speed" value={settings.windSpeed} min={0} max={6} step={0.5} unit=" m/s" onChange={value => updateSetting('windSpeed', value)} />
              <div className="slider-label"><label htmlFor="wind-direction">Wind direction</label><select id="wind-direction" value={settings.windDirection} onChange={e => updateSetting('windDirection', Number(e.target.value))}><option value={0}>Tailwind</option><option value={180}>Headwind</option><option value={90}>Crosswind</option></select></div>
              <RangeControl label="Gust intensity" value={settings.turbulence} min={0} max={1} step={0.1} onChange={value => updateSetting('turbulence', value)} />
              <RangeControl label="Air temperature" value={settings.airTemperature} min={-10} max={40} unit="°C" onChange={value => updateSetting('airTemperature', value)} />
              <RangeControl label="Relative humidity" value={settings.relativeHumidity} min={0} max={100} unit="%" onChange={value => updateSetting('relativeHumidity', value)} />
              <RangeControl label="Sea-level pressure" value={settings.seaLevelPressure} min={850} max={1100} step={0.1} unit=" hPa" onChange={value => updateSetting('seaLevelPressure', value)} />
              <RangeControl label="Ground elevation" value={settings.fieldElevation} min={-500} max={6000} unit=" m" onChange={value => updateSetting('fieldElevation', value)} />
              <p className="altitude-help">Metres above sea level; negative values are below it. Release height is measured above this ground.</p>
              <RangeControl label="Elevator trim" value={settings.trim} min={-5} max={5} unit="°" onChange={value => updateSetting('trim', value)} />
              <button className="text-button" onClick={() => { setSettings({ ...DEFAULT_SETTINGS }); setFlight(simulateFlight(design, DEFAULT_SETTINGS)); setHasLaunched(false); setPlaying(false); setComparison(false); setTime(0); }}><RotateCcw size={13} />Reset conditions</button>
            </div>}
            <button className="launch-button" onClick={launch}><Send size={18} />Launch plane<span>SPACE</span></button>
            <div className="launch-actions"><button className="secondary-button" onClick={compare} disabled={!!progress}><Layers3 size={16} />Compare all designs</button></div>
          </section>
        </aside>
        <section className="flight-panel" aria-label="3D flight simulator">
          <div className="scene-shell"><div ref={stage} className="scene-host" />
            <div className="scene-topbar"><div className="scene-label"><span className="scene-index">FLIGHT DECK 01</span><span className="live-pill"><span className={playing ? 'status-dot active' : 'status-dot'} />{status}</span></div><div className="scene-tools">{([{ id: 'orbit', label: 'Orbit camera', icon: Orbit }, { id: 'follow', label: 'Follow camera', icon: Crosshair }, { id: 'top', label: 'Top camera', icon: Map }] as const).map(c => <button key={c.id} className={`icon-button ${camera === c.id ? 'active' : ''}`} title={c.label} aria-label={c.label} aria-pressed={camera === c.id} onClick={() => setCamera(c.id)}><c.icon size={18} /></button>)}</div></div>
            {error && <div className="error-state" role="status"><CircleHelp size={24} /><p>{error}</p><button className="text-button" onClick={() => setError('')}>Dismiss</button></div>}
            <div className="scene-bottom-overlay"><div className="scene-caption"><span>{comparison ? `${DESIGNS.length} airframes. One sky.` : design.name}</span><small>{comparison ? `Telemetry follows ${design.name}` : 'Drag to orbit · Scroll to zoom'}</small></div><div className="scene-scale"><span />METRES · Y UP</div></div>
          </div>
          <div className="telemetry-row" aria-live="off">
            <div className="metric"><span className="metric-label">AIRTIME</span><span className="metric-value">{fmt(hasLaunched ? Math.min(time, flight.duration) : 0, 2)}<span className="metric-unit">s</span></span></div>
            <div className="metric"><span className="metric-label">DISTANCE</span><span className="metric-value">{fmt(hasLaunched ? liveDistance : 0)}<span className="metric-unit">m</span></span></div>
            <div className="metric"><span className="metric-label">ABOVE GROUND</span><span className="metric-value">{fmt(hasLaunched ? liveHeight : settings.height)}<span className="metric-unit">m</span></span><span className="metric-altitude" aria-label="Altitude above sea level">{fmt(localAtmosphere.altitudeMSL)} m above sea level</span></div>
            <div className="metric"><span className="metric-label">GROUND SPEED</span><span className="metric-value">{fmt(hasLaunched ? liveSpeed : settings.speed)}<span className="metric-unit">m/s</span></span></div>
          </div>
          <div className="forces-strip" aria-label="Aerodynamic forces and local air conditions" aria-live="off">
            <div className="force-diagnostic" title="Lift at the selected flight time, in millinewtons."><span className="force-label">Lift</span><span className="force-value">{fmt((activeSample?.lift ?? NaN) * 1000)}<span className="force-unit">mN</span></span></div>
            <div className="force-diagnostic" title="Aerodynamic drag at the selected flight time, in millinewtons."><span className="force-label">Drag</span><span className="force-value">{fmt((activeSample?.drag ?? NaN) * 1000)}<span className="force-unit">mN</span></span></div>
            <div className="force-diagnostic" title="Angle between the airframe and its air-relative velocity."><span className="force-label">Angle of attack</span><span className="force-value">{fmt((activeSample?.alpha ?? NaN) * 180 / Math.PI)}<span className="force-unit">°</span></span></div>
            <div className="force-diagnostic" title="Local air density calculated from altitude, pressure, temperature and humidity."><span className="force-label">Air density</span><span className="force-value">{fmt(liveDensity, 3)}<span className="force-unit">kg/m³</span></span></div>
            <div className="force-diagnostic" title="Earth gravity at the plane’s current altitude."><span className="force-label">Gravity</span><span className="force-value">{fmt(localAtmosphere.gravity, 4)}<span className="force-unit">m/s²</span></span></div>
            <div className="force-diagnostic" title={`Air-relative speed used to calculate aerodynamic forces. Reynolds number: ${fmt(activeSample?.reynolds ?? NaN, 0)}.`}><span className="force-label">Airspeed</span><span className="force-value">{fmt(activeSample?.airspeed ?? NaN)}<span className="force-unit">m/s</span></span></div>
            <div className="force-diagnostic" title="Relative humidity used for moist-air density."><span className="force-label">Humidity</span><span className="force-value">{fmt(localAtmosphere.relativeHumidity, 0)}<span className="force-unit">%</span></span></div>
            <div className="force-diagnostic" title="Local pressure at the plane, corrected from the sea-level pressure setting."><span className="force-label">Local pressure</span><span className="force-value">{fmt(localAtmosphere.pressure / 100)}<span className="force-unit">hPa</span></span></div>
          </div>
          <div className="playback-bar"><button className="icon-button" aria-label={playing ? 'Pause flight' : 'Play flight'} onClick={() => { if (!hasLaunched || time >= playbackDuration) replay(); else setPlaying(!playing); }}>{playing ? <Pause size={17} /> : <Play size={17} />}</button><button className="icon-button" aria-label="Replay flight" title="Replay flight" onClick={replay}><RotateCcw size={16} /></button><input aria-label="Flight timeline" type="range" min={0} max={Math.max(playbackDuration, 0.01)} step={0.01} value={Math.min(time, playbackDuration)} disabled={!hasLaunched} onChange={e => { setPlaying(false); setTime(Number(e.target.value)); }} /><span className="time-label">{fmt(time)} / {fmt(playbackDuration)} s</span><select className="speed-select" aria-label="Playback speed" value={playbackRate} onChange={e => setPlaybackRate(Number(e.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></div>
        </section>
      </div>
      <section className="results-panel" aria-label="Design comparison results"><div className="results-header"><div className="results-heading"><p className="eyebrow">LET THE FLIGHTS DECIDE</p><h2>The airtime leaderboard</h2><p className="results-description">{tab === 'matched' ? `Shared release: ${fmt(matched[0].flight.settings.speed)} m/s · ${matched[0].flight.settings.angle}° · ${fmt(matched[0].flight.settings.height)} m high. Ranked by airtime.` : `${trialCount.toLocaleString()} launches. The best completed flight for each design in the same search grid.`}</p>{testedConditions && <p className="tested-conditions"><span>Tested conditions:</span> {fmt(testedConditions.height)} m above ground · {fmt(testedConditions.airTemperature, 0)}°C air · {fmt(testedConditions.relativeHumidity, 0)}% humidity · {fmt(testedConditions.seaLevelPressure)} hPa sea-level pressure · {fmt(testedConditions.fieldElevation, 0)} m ground above sea level · {fmt(testedConditions.windSpeed)} m/s wind · {fmt(testedConditions.paperWeight, 0)} g/m² paper</p>}</div><div className="results-actions"><button className="secondary-button" onClick={exportResults} disabled={!ranking.length}><Download size={16} />Export CSV</button><button className="optimize-button secondary-button" onClick={progress ? () => abort.current?.abort() : optimize}><Zap size={16} />{progress ? 'Cancel search' : 'Find best launches'}</button></div></div>
        <div className="section-tabs" role="tablist" aria-label="Comparison method"><button role="tab" aria-selected={tab === 'matched'} className={tab === 'matched' ? 'active' : ''} onClick={() => { setTab('matched'); setComparison(false); setPlaying(false); }}>Matched launch<span>{matched.length}</span></button><button role="tab" aria-selected={tab === 'optimized'} className={tab === 'optimized' ? 'active' : ''} onClick={() => { setTab('optimized'); setComparison(false); setPlaying(false); }}>Best launch search{optimized.length > 0 && <span>{optimized.length}</span>}</button><span className="table-hint">Select a design to replay its flight</span></div>
        {progress && <div className="progress-status" role="status"><Activity size={16} /><span>Testing launches · {progress.done} / {progress.total}</span><progress max={progress.total} value={progress.done} /></div>}
        {ranking.length ? <>
          <div className="leaderboard-wrap"><table className="leaderboard"><thead><tr><th scope="col">RANK</th><th scope="col">AIRFRAME</th><th scope="col">AIRTIME <ChevronDown size={12} /></th><th scope="col">DISTANCE</th><th scope="col">PEAK HEIGHT</th><th scope="col">LAUNCH</th><th scope="col"><span className="sr-only">Replay</span></th></tr></thead><tbody>{ranking.map(row => <tr key={row.design.id} className={row.rank === 1 ? 'row-winner' : ''}><td><span className="rank">{String(row.rank).padStart(2, '0')}</span></td><td><button className="table-design" onClick={() => inspectFlight(row)}><span className="table-plane-icon" style={{ color: row.design.color }}><Send size={19} /></span><span>{row.design.name}<small>{row.design.category}</small></span>{row.rank === 1 && completedWinner && <span className="winner-tag"><Trophy size={11} />LONGEST</span>}</button></td><td><div className="duration-bar"><span className="bar-fill" style={{ width: `${winner ? Math.max(6, row.flight.duration / winner.flight.duration * 100) : 0}%`, background: row.design.color }} /><span className="duration-value">{fmt(row.flight.duration, 2)} s{row.flight.truncated ? ' (cap)' : ''}</span></div></td><td>{fmt(row.flight.distance)}<span className="table-unit"> m</span></td><td>{fmt(row.flight.maxHeight)}<span className="table-unit"> m</span></td><td><span className="launch-cell">{fmt(row.flight.settings.speed)} m/s <span>·</span> {fmt(row.flight.settings.angle, 0)}°{tab === 'optimized' && <small>trim {row.flight.settings.trim > 0 ? '+' : ''}{row.flight.settings.trim}°</small>}</span></td><td><button className="icon-button replay-row" aria-label={`Replay ${row.design.name}`} onClick={() => inspectFlight(row)}><Play size={14} /></button></td></tr>)}</tbody></table></div>
          <div className="comparison-summary"><div className="champion"><Trophy size={19} /><p>{completedWinner ? <><strong>{winner?.design.name}</strong> has the longest predicted airtime in this test.</> : <>The leading flight reached the time cap. Its full airtime is unknown.</>}<span>{fmt(winner?.flight.duration ?? 0, 2)} seconds observed · {fmt(winner?.flight.distance ?? 0)} metres travelled</span></p></div><p className="summary-note">Estimated aerodynamics.<br />Real folds need real flight tests.</p></div>
        </> : <div className="search-empty"><FlaskConical size={30} /><h3>Give every design its best shot.</h3><p>Search 7 launch angles × 5 speeds × 3 trim settings for each airframe. Height, wind, paper, air temperature and field elevation stay fixed.</p><button className="secondary-button" disabled={!!progress} onClick={optimize}><Zap size={16} />Find best launches</button></div>}
      </section>
      <footer className="app-footer"><p className="footer-note"><FlaskConical size={15} />A virtual wind tunnel for one sheet of paper.</p><button className="text-button" onClick={() => setModal('model')}>Model & assumptions<CircleHelp size={14} /></button><a className="text-button" href="/reports/benchmark.md" download><Download size={14} />Test report</a><span className="footer-engine">THREE.JS r186 · {PHYSICS_VERSION}</span></footer>
    </main>
    <Modal mode={modal} designId={selectedId} settings={settings} onClose={closeModal} />
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
