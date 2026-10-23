import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  createCategory,
  getCategories,
  reorderCategories,
  updateCategory,
  deleteCategory,
  type Category,
  type CategoryInput,
} from '../api/categories'
import { errorMessage } from '../api/client'
import { availableColors } from '../utils/categoryColors'
import CategoryBadge from '../components/CategoryBadge'
import IconPicker from '../components/IconPicker'

const toInput = (c: Category): CategoryInput => ({
  name: c.name,
  color: c.color,
  targetRatio: c.targetRatio,
  weeklyTargetMinutes: c.weeklyTargetMinutes,
  active: c.active,
  icon: c.icon ?? null,
})

const toNumberOrNull = (value: string) => (value.trim() === '' ? null : Number(value))

export default function SettingsPage() {
  return (
    <section className="settings-page">
      <h1>설정</h1>
      <p className="muted">타이머, 알림, 텔레그램 설정은 1-5단계에서 추가돼요.</p>
      <CategorySettings />
    </section>
  )
}

function CategorySettings() {
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    getCategories(true)
      .then(setCategories)
      .catch((e) => setError(errorMessage(e)))
  }, [])

  useEffect(load, [load])

  const run = async (action: () => Promise<unknown>) => {
    setError(null)
    try {
      await action()
      load()
      return true
    } catch (e) {
      setError(errorMessage(e))
      return false
    }
  }

  const move = (index: number, delta: number) => {
    const ids = categories.map((c) => c.id)
    const target = index + delta
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    run(() => reorderCategories(ids))
  }

  const ratioSum = categories.filter((c) => c.active).reduce((sum, c) => sum + (c.targetRatio ?? 0), 0)

  return (
    <div className="card">
      <h2>분류 관리</h2>
      <p className="muted small">
        활성 분류 목표 비율 합계 <strong className={ratioSum > 100 ? 'status down' : undefined}>{ratioSum}%</strong> (100% 이하).
        분류는 기록이 참조하므로 삭제하지 않고 비활성화해요.
      </p>
      {error && <p className="error">{error}</p>}

      <div className="category-table">
        <div className="category-row header muted small">
          <span>순서</span>
          <span>색</span>
          <span>아이콘</span>
          <span>이름</span>
          <span>목표 비율(%)</span>
          <span>주간 목표(분)</span>
          <span>활성</span>
          <span />
        </div>
        {categories.map((c, i) => (
          <CategoryRow
            key={c.id}
            category={c}
            first={i === 0}
            last={i === categories.length - 1}
            onMove={(delta) => move(i, delta)}
            onSave={(input) => run(() => updateCategory(c.id, input))}
            onDelete={() => confirm(`'${c.name}' 분류를 지울까요?`) && run(() => deleteCategory(c.id))}
          />
        ))}
      </div>

      <NewCategoryForm
        usedColors={categories.map((c) => c.color)}
        onCreate={(input) => run(() => createCategory(input))}
      />
    </div>
  )
}

type RowProps = {
  category: Category
  first: boolean
  last: boolean
  onMove: (delta: number) => void
  onSave: (input: CategoryInput) => Promise<boolean>
  onDelete: () => void
}

function CategoryRow({ category, first, last, onMove, onSave, onDelete }: RowProps) {
  const [draft, setDraft] = useState<CategoryInput>(() => toInput(category))
  const dirty = JSON.stringify(draft) !== JSON.stringify(toInput(category))

  return (
    <div className={category.active ? 'category-row' : 'category-row inactive'}>
      <span className="row-actions">
        <button type="button" className="icon" disabled={first} onClick={() => onMove(-1)} aria-label="위로">
          ↑
        </button>
        <button type="button" className="icon" disabled={last} onClick={() => onMove(1)} aria-label="아래로">
          ↓
        </button>
      </span>
      <input
        type="color"
        value={draft.color}
        onChange={(e) => setDraft({ ...draft, color: e.target.value })}
        aria-label="색"
      />
      <IconPicker value={draft.icon} onChange={(icon) => setDraft({ ...draft, icon })} />
      <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-label="이름" />
      <input
        type="number"
        min={0}
        max={100}
        value={draft.targetRatio ?? ''}
        onChange={(e) => setDraft({ ...draft, targetRatio: toNumberOrNull(e.target.value) })}
        aria-label="목표 비율"
      />
      <input
        type="number"
        min={0}
        step={30}
        value={draft.weeklyTargetMinutes ?? ''}
        onChange={(e) => setDraft({ ...draft, weeklyTargetMinutes: toNumberOrNull(e.target.value) })}
        aria-label="주간 목표 시간(분)"
      />
      <input
        type="checkbox"
        checked={draft.active}
        onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
        aria-label="활성"
      />
      <span className="row-actions">
        <button type="button" disabled={!dirty} onClick={() => onSave(draft)}>
          저장
        </button>
        <button type="button" className="ghost" disabled={!dirty} onClick={() => setDraft(toInput(category))}>
          취소
        </button>
        {category.deletable ? (
          <button type="button" className="ghost danger" onClick={onDelete} title="한 번도 쓰이지 않은 분류라 지울 수 있어요">
            삭제
          </button>
        ) : (
          <span className="muted small" title="쓰인 분류는 지울 수 없어요. 활성 체크를 꺼서 숨겨요">
            사용 중
          </span>
        )}
      </span>
    </div>
  )
}

const EMPTY: CategoryInput = { name: '', color: '#64748b', targetRatio: null, weeklyTargetMinutes: null, active: true, icon: null }

function NewCategoryForm({ usedColors, onCreate }: { usedColors: string[]; onCreate: (input: CategoryInput) => Promise<boolean> }) {
  const [draft, setDraft] = useState<CategoryInput>(EMPTY)
  // 색을 직접 바꾸지 않았으면 안 쓴 색 계열을 기본으로(1-4f ㊷)
  const [colorTouched, setColorTouched] = useState(false)
  const color = colorTouched ? draft.color : availableColors(usedColors)[0]

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (await onCreate({ ...draft, color })) {
      setDraft(EMPTY)
      setColorTouched(false)
    }
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <input
        type="color"
        value={color}
        onChange={(e) => {
          setDraft({ ...draft, color: e.target.value })
          setColorTouched(true)
        }}
        aria-label="새 분류 색"
      />
      <IconPicker value={draft.icon} onChange={(icon) => setDraft({ ...draft, icon })} label="새 분류 아이콘" />
      <input
        placeholder="새 분류 이름"
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        required
      />
      <input
        type="number"
        min={0}
        max={100}
        placeholder="목표 비율(%)"
        value={draft.targetRatio ?? ''}
        onChange={(e) => setDraft({ ...draft, targetRatio: toNumberOrNull(e.target.value) })}
      />
      <button type="submit">추가</button>
      {draft.name && <CategoryBadge name={draft.name} color={draft.color} />}
    </form>
  )
}
