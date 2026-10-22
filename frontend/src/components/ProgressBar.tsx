import type { Progress } from '../api/goals'

export default function ProgressBar({ progress }: { progress: Progress }) {
  return (
    <span className="progress" title={`${progress.achieved}/${progress.total} 달성`}>
      <span className="progress-track">
        <span className="progress-fill" style={{ width: `${progress.percent}%` }} />
      </span>
      <span className="progress-text">
        {progress.percent}% ({progress.achieved}/{progress.total})
      </span>
    </span>
  )
}
