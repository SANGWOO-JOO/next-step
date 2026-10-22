export default function FormButtons({ submitLabel, onCancel }: { submitLabel: string; onCancel: () => void }) {
  return (
    <span className="row-actions">
      <button type="submit">{submitLabel}</button>
      <button type="button" className="ghost" onClick={onCancel}>
        취소
      </button>
    </span>
  )
}
