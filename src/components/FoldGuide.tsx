import { useId, useState } from 'react';
import type { CSSProperties } from 'react';
import { RotateCcw } from 'lucide-react';
import type { PlaneDesign } from '../lib/types';
import type { FoldFrame } from '../lib/folds/schema';
import { getFoldGuide } from '../lib/folds';

function FoldDiagram({ frame, title, description, color }: {
  frame: FoldFrame; title: string; description: string; color: string;
}) {
  const id = useId().replaceAll(':', '');
  const fills = { paper: '#f4f1e7', underside: '#c2ced9', accent: color };
  return <svg className="fold-diagram" viewBox="0 0 240 240" role="img" aria-labelledby={`${id}-title ${id}-description`}>
    <title id={`${id}-title`}>{title}</title>
    <desc id={`${id}-description`}>{description}</desc>
    <defs>
      <marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="#ff7955" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </marker>
    </defs>
    {frame.shapes.map((shape, index) => <polygon key={`shape-${index}`} points={shape.points} fill={fills[shape.tone ?? 'paper']} className="fold-paper" />)}
    {frame.lines?.map((line, index) => <polyline key={`line-${index}`} points={line.points} className={`fold-line fold-line-${line.kind}`} />)}
    {frame.arrows?.map((arrow, index) => <path key={`arrow-${index}`} d={arrow.path} className={`fold-arrow fold-arrow-${arrow.kind ?? 'fold'}`} markerEnd={`url(#${id}-arrow)`} />)}
    {frame.labels?.map((label, index) => <text key={`label-${index}`} x={label.x} y={label.y} className="fold-diagram-label" textAnchor={label.x < 50 ? 'start' : label.x > 190 ? 'end' : 'middle'}>{label.text}</text>)}
  </svg>;
}

export function FoldGuide({ design }: { design: PlaneDesign }) {
  const guide = getFoldGuide(design.id);
  const [current, setCurrent] = useState(0);
  const step = guide.steps[current];
  const last = current === guide.steps.length - 1;
  const hasMountainFolds = guide.steps.some(item => [item.before, item.after].some(frame => frame.lines?.some(line => line.kind === 'mountain')));
  const hasHiddenEdges = guide.steps.some(item => [item.before, item.after].some(frame => frame.lines?.some(line => line.kind === 'hidden')));
  return <div className="fold-guide" style={{ '--fold-accent': design.color } as CSSProperties}>
    <p className="fold-materials">One A4 sheet <span>·</span> 210 × 297 mm <span>·</span> {guide.orientation === 'portrait' ? 'Portrait' : 'Landscape'} to start</p>
    <div className="fold-legend" aria-label="Folding diagram key">
      <span><svg viewBox="0 0 30 12" aria-hidden="true"><path d="M2 6 H28" className="fold-line fold-line-fold" /></svg>Fold toward you</span>
      {hasMountainFolds && <span><svg viewBox="0 0 30 12" aria-hidden="true"><path d="M2 6 H28" className="fold-line fold-line-mountain" /></svg>Fold away from you</span>}
      <span><svg viewBox="0 0 30 12" aria-hidden="true"><path d="M2 6 H28" className="fold-line fold-line-crease" /></svg>Existing crease</span>
      {hasHiddenEdges && <span><svg viewBox="0 0 30 12" aria-hidden="true"><path d="M2 6 H28" className="fold-line fold-line-hidden" /></svg>Hidden edge</span>}
      <span><svg viewBox="0 0 30 12" aria-hidden="true"><path d="M2 9 Q13 -2 27 6 M21 2 L27 6 L21 10" className="fold-arrow" /></svg>Move this way</span>
    </div>
    <ol className="fold-step-nav" aria-label="Folding steps">
      {guide.steps.map((item, index) => <li key={item.title}><button type="button" aria-label={`Step ${index + 1}: ${item.title}`} aria-current={current === index ? 'step' : undefined} onClick={() => setCurrent(index)} title={item.title}>{String(index + 1).padStart(2, '0')}</button></li>)}
    </ol>
    <section className="fold-current-step" aria-label="Current folding step">
      <div className="fold-step-heading" aria-live="polite" aria-atomic="true">
        <p className="fold-step-count">Step {current + 1} of {guide.steps.length}{last && <span>Ready to fly</span>}</p>
        <h3>{step.title}</h3>
        <p className="fold-instruction">{step.instruction}</p>
      </div>
      <div className="fold-panels">
        <figure className="fold-panel"><figcaption><span>Fold here</span><small>{step.before.view ?? 'top'} view</small></figcaption><FoldDiagram frame={step.before} title={`${design.name}, step ${current + 1}: fold here`} description={step.instruction} color={design.color} /></figure>
        <figure className="fold-panel fold-panel-result"><figcaption><span>After this step</span><small>{step.after.view ?? 'top'} view</small></figcaption><FoldDiagram frame={step.after} title={`${design.name}, step ${current + 1}: after folding`} description={step.detail ?? `Result of ${step.title.toLowerCase()}. ${step.instruction}`} color={design.color} /></figure>
      </div>
      <p className="fold-scale-note">Diagrams are not to scale. Use the written measurements.</p>
      {step.detail && <p className="fold-check">{step.detail}</p>}
    </section>
    <div className="fold-navigation">
      <button className="secondary-button" type="button" onClick={() => setCurrent(value => value - 1)} disabled={current === 0}>Previous step</button>
      {last ? <button className="secondary-button" type="button" onClick={() => setCurrent(0)}><RotateCcw size={16} />Start again</button> : <button className="primary-button fold-next" type="button" onClick={() => setCurrent(value => value + 1)}>Next step</button>}
    </div>
    <details className="fold-overview"><summary>All steps at a glance</summary><ol className="fold-list">
      {guide.steps.map((item, index) => <li key={item.title}><span>{String(index + 1).padStart(2, '0')}</span><div><button className="fold-overview-link" type="button" onClick={() => setCurrent(index)} aria-current={current === index ? 'step' : undefined}>{item.title}</button><p>{item.instruction}</p></div></li>)}
    </ol></details>
    <p className="modal-note"><strong>Before your first throw.</strong> {guide.tip}</p>
  </div>;
}
