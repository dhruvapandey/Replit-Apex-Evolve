import { useEffect, useState } from 'react';
import type { EvolutionArchive, EvolutionRunLog } from '../game/evolutionTelemetry';

type Props = {
  archive: EvolutionArchive;
};

const chartPoints = (run: EvolutionRunLog, width: number, height: number) => {
  const values = run.records.map((record) => record.nextAverageStrength);
  if (values.length === 0) return '';
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = Math.max(0.01, maximum - minimum);
  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - minimum) / range) * (height - 18) - 9;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
};

const meanOffspringGene = (run: EvolutionRunLog, gene: keyof EvolutionRunLog['records'][number]['offspring'][number]['genes']) => {
  const latest = run.records.at(-1);
  if (!latest) return 0;
  return latest.offspring.reduce((sum, offspring) => sum + offspring.genes[gene], 0) / latest.offspring.length;
};

export function EvolutionLabPanel({ archive }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState(archive.runs[0]?.id ?? '');
  const newestRunId = archive.runs[0]?.id ?? '';

  useEffect(() => {
    if (newestRunId) setSelectedRunId(newestRunId);
  }, [newestRunId]);

  const selectedRun = archive.runs.find((run) => run.id === selectedRunId) ?? archive.runs[0];
  const latest = selectedRun?.records.at(-1);
  const downloadArchive = () => {
    const blob = new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `apex-evolution-${new Date().toISOString().replaceAll(':', '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className={`evolution-lab ${open ? 'open' : ''}`} data-game-ui>
      <button
        className="evolution-lab-toggle"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? 'CLOSE GA LAB' : 'OPEN GA LAB'}
      </button>
      {open && (
        <div className="evolution-lab-panel">
          <header>
            <div>
              <span>DEVELOPMENT ONLY</span>
              <h2>Evolution black box</h2>
            </div>
            <button onMouseDown={(event) => event.stopPropagation()} onClick={downloadArchive}>EXPORT JSON</button>
          </header>

          <label>
            Recorded run
            <select value={selectedRun?.id ?? ''} onChange={(event) => setSelectedRunId(event.target.value)}>
              {archive.runs.map((run, index) => (
                <option key={run.id} value={run.id}>
                  Run {archive.runs.length - index} · {run.records.length} generations
                </option>
              ))}
            </select>
          </label>

          {!selectedRun || selectedRun.records.length === 0 ? (
            <p className="evolution-empty">Complete Generation 1 to begin recording.</p>
          ) : (
            <>
              <div className="evolution-kpis">
                <div><small>GENERATION</small><strong>{latest?.generation}</strong></div>
                <div><small>GENETIC GAIN</small><strong>{latest?.improvementPercent.toFixed(2)}%</strong></div>
                <div><small>PLATEAU</small><strong className={latest?.plateauDetected ? 'warning' : ''}>{latest?.plateauDetected ? 'DETECTED' : `${latest?.plateauStreak ?? 0} / 3`}</strong></div>
                <div><small>MUTATION</small><strong>{latest?.mutationPercent}%{latest?.adaptiveMutation ? ' BOOST' : ''}</strong></div>
              </div>

              <div className="evolution-chart">
                <span>GENETIC STRENGTH BY GENERATION</span>
                <svg viewBox="0 0 480 130" role="img" aria-label="Genetic strength progression graph">
                  <path d="M0 121 H480" />
                  <polyline points={chartPoints(selectedRun, 480, 130)} />
                </svg>
              </div>

              <div className="evolution-traits">
                <div><small>SPEED</small><b>{meanOffspringGene(selectedRun, 'speed').toFixed(2)}</b></div>
                <div><small>ACCURACY</small><b>{(meanOffspringGene(selectedRun, 'accuracy') * 100).toFixed(0)}%</b></div>
                <div><small>EVASION</small><b>{(meanOffspringGene(selectedRun, 'evasion') * 100).toFixed(0)}%</b></div>
                <div><small>NAVIGATION</small><b>{(meanOffspringGene(selectedRun, 'navigation') * 100).toFixed(0)}%</b></div>
                <div><small>COVER</small><b>{(meanOffspringGene(selectedRun, 'coverDiscipline') * 100).toFixed(0)}%</b></div>
              </div>

              <div className="evolution-table-wrap">
                <table>
                  <thead><tr><th>GEN</th><th>FITNESS</th><th>GAIN</th><th>MUTATION</th><th>TIME</th></tr></thead>
                  <tbody>
                    {selectedRun.records.slice(-10).reverse().map((record) => (
                      <tr key={record.generation} className={record.plateauDetected ? 'plateau-row' : ''}>
                        <td>{record.generation}</td>
                        <td>{record.averageFitness.toFixed(0)}</td>
                        <td>{record.improvementPercent.toFixed(2)}%</td>
                        <td>{record.mutationPercent}%{record.adaptiveMutation ? ' ↑' : ''}</td>
                        <td>{record.durationSeconds.toFixed(0)}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
