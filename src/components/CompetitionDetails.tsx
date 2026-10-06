import type { PlaneDesign } from '../lib/types';

export function CompetitionDetails({ design }: { design: PlaneDesign }) {
  const result = design.achievement;
  if (!result) return null;
  const monthOnly = result.date.length === 7;
  const date = new Date(`${result.date}${monthOnly ? '-01' : ''}T12:00:00Z`).toLocaleDateString('en-GB', { day: monthOnly ? undefined : 'numeric', month: monthOnly ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' });
  return <aside className="competition-details" aria-label={`${design.name} documented achievement`}>
    <p className="competition-label">{result.organization}</p>
    <h3>{result.title}</h3>
    <p><strong>{result.value} {result.unit}</strong> · {date}{result.location && <> · {result.location}</>}</p>
    <p>{result.credit}</p>
    <p className="competition-sources"><a href={result.sourceUrl} target="_blank" rel="noreferrer">Official result</a><span> · </span><a href={result.designSourceUrl} target="_blank" rel="noreferrer">{result.designSourceLabel}</a></p>
    <p className="competition-model-note">{design.modelNotes} The achievement above is a real flight; simulator results use estimated aerodynamics.</p>
  </aside>;
}
