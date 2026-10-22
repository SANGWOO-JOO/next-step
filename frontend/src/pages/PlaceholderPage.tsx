type Props = { title: string; stage: string }

export default function PlaceholderPage({ title, stage }: Props) {
  return (
    <section>
      <h1>{title}</h1>
      <p className="muted">{stage}에서 구현 예정이에요.</p>
    </section>
  )
}
