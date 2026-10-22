import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { getCategories, type Category } from '../api/categories'
import {
  createChecklistItem,
  deleteChecklistItem,
  getChecklistItems,
  toChecklistInput,
  updateChecklistItem,
  type ChecklistItem,
} from '../api/checklist'
import { errorMessage } from '../api/client'
import type { CategoryRef } from '../api/goals'
import CategoryBadge from '../components/CategoryBadge'
import FormButtons from '../components/FormButtons'

type Run = (action: () => Promise<unknown>) => Promise<boolean>

/** 분류별 할 일 목록. 활성 분류는 항목이 없어도 보여주고, 비활성 분류는 항목이 있을 때만 보여준다. */
export default function ChecklistPage() {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    Promise.all([getChecklistItems(), getCategories()])
      .then(([i, c]) => {
        setItems(i)
        setCategories(c)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [])

  useEffect(load, [load])

  const run: Run = async (action) => {
    setError(null)
    try {
      await action()
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    } finally {
      load()
    }
  }

  const groups: CategoryRef[] = [
    ...categories,
    ...items.map((i) => i.category).filter((c, idx, all) => !c.active && all.findIndex((x) => x.id === c.id) === idx),
  ]
  const done = items.filter((i) => i.done).length

  return (
    <section>
      <h1>체크리스트</h1>
      <p className="muted">
        분류별로 준비할 것을 적어 두고 하나씩 지워요. {items.length > 0 && `전체 ${done}/${items.length} 완료`}
      </p>
      {error && (
        <p className="error-banner" role="alert">
          {error}
          <button className="icon" onClick={() => setError(null)} aria-label="닫기">
            ×
          </button>
        </p>
      )}
      <div className="checklist-grid">
        {groups.map((c) => (
          <ChecklistGroup key={c.id} category={c} items={items.filter((i) => i.category.id === c.id)} run={run} />
        ))}
      </div>
    </section>
  )
}

function ChecklistGroup({ category, items, run }: { category: CategoryRef; items: ChecklistItem[]; run: Run }) {
  const [content, setContent] = useState('')

  const add = (e: FormEvent) => {
    e.preventDefault()
    run(() => createChecklistItem({ categoryId: category.id, content, done: false })).then((ok) => ok && setContent(''))
  }

  return (
    <div className="card checklist-group">
      <div className="daily-panel-head">
        <CategoryBadge name={category.name} color={category.color} inactive={!category.active} />
        <span className="muted small">
          {items.filter((i) => i.done).length}/{items.length}
        </span>
      </div>
      <ul className="plan-list">
        {items.map((i) => (
          <ChecklistRow key={i.id} item={i} run={run} />
        ))}
      </ul>
      {category.active && (
        <form className="inline-form" onSubmit={add}>
          <input
            className="grow"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="+ 항목 추가"
            maxLength={500}
            required
          />
          <button type="submit">추가</button>
        </form>
      )}
    </div>
  )
}

function ChecklistRow({ item, run }: { item: ChecklistItem; run: Run }) {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(item.content)

  const save = (e: FormEvent) => {
    e.preventDefault()
    run(() => updateChecklistItem(item.id, { ...toChecklistInput(item), content })).then((ok) => ok && setEditing(false))
  }

  if (editing) {
    return (
      <li>
        <form className="inline-form plan-form" onSubmit={save}>
          <input className="grow" value={content} onChange={(e) => setContent(e.target.value)} required maxLength={500} />
          <FormButtons submitLabel="저장" onCancel={() => setEditing(false)} />
        </form>
      </li>
    )
  }

  return (
    <li className="plan-item">
      <input
        type="checkbox"
        checked={item.done}
        onChange={() => run(() => updateChecklistItem(item.id, { ...toChecklistInput(item), done: !item.done }))}
        aria-label="완료"
      />
      <span className={item.done ? 'plan-content done' : 'plan-content'}>{item.content}</span>
      <span className="row-actions daily-actions">
        <button className="ghost" onClick={() => setEditing(true)}>
          수정
        </button>
        <button
          className="danger"
          onClick={() => confirm(`'${item.content}' 항목을 삭제할까요?`) && run(() => deleteChecklistItem(item.id))}
        >
          삭제
        </button>
      </span>
    </li>
  )
}
