import { useEffect, useMemo, useRef, useState } from 'react'
import './StudentGrouping.css'

type Gender = 'male' | 'female'
type Student = { number: number; gender: Gender }
type Group = Student[]
type Settings = {
  className: string; classSize: number; maleStart: number; maleEnd: number
  femaleStart: number; femaleEnd: number; absent: number[]
  sizeMode: 'groups' | 'members'; value: number; method: 'balanced' | 'random'
}
type SavedState = { settings: Settings; groups: Group[]; generatedAt: string }

const STORAGE_KEY = 'shuxin-student-grouping-v1'
const defaults: Settings = { className: '701', classSize: 30, maleStart: 1, maleEnd: 16, femaleStart: 17, femaleEnd: 30, absent: [], sizeMode: 'groups', value: 7, method: 'balanced' }
const numerals = ['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十']
const shuffle = <T,>(items: T[]) => {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]] }
  return result
}
const label = (number: number) => `${String(number).padStart(2, '0')}號`
const groupLabel = (index: number) => `第${numerals[index] ?? index + 1}組`

export function validateGrouping(groups: Group[], students: Student[]) {
  const expected = new Set(students.map((student) => student.number))
  const actual = groups.flat().map((student) => student.number)
  if (actual.length !== students.length) return '分組總人數與有效學生人數不符。'
  if (new Set(actual).size !== actual.length) return '分組結果出現重複座號。'
  if (actual.some((number) => !expected.has(number)) || [...expected].some((number) => !actual.includes(number))) return '分組結果有遺漏或無效座號。'
  return ''
}

function buildGroups(students: Student[], count: number, method: Settings['method']): Group[] {
  const groups: Group[] = Array.from({ length: count }, () => [])
  if (method === 'random') shuffle(students).forEach((student, index) => groups[index % count].push(student))
  else {
    const genders = [shuffle(students.filter((student) => student.gender === 'male')), shuffle(students.filter((student) => student.gender === 'female'))]
    genders.forEach((list) => list.forEach((student) => {
      const smallest = Math.min(...groups.map((group) => group.length))
      const candidates = groups.map((group, index) => ({ group, index })).filter(({ group }) => group.length === smallest)
      const target = candidates.sort((a, b) => a.group.filter((item) => item.gender === student.gender).length - b.group.filter((item) => item.gender === student.gender).length)[0]
      groups[target.index].push(student)
    }))
  }
  return groups.map((group) => group.sort((a, b) => a.number - b.number))
}

export function StudentGrouping({ onBack }: { onBack?: () => void }) {
  const restored = useRef<SavedState | null>(null)
  if (!restored.current) { try { restored.current = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { restored.current = null } }
  const [settings, setSettings] = useState<Settings>(() => ({ ...defaults, ...restored.current?.settings }))
  const [groups, setGroups] = useState<Group[]>(() => restored.current?.groups ?? [])
  const [generatedAt, setGeneratedAt] = useState(() => restored.current?.generatedAt ?? '')
  const [screen, setScreen] = useState<'settings' | 'results'>(() => restored.current?.groups?.length ? 'results' : 'settings')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const [presentation, setPresentation] = useState(false)

  const students = useMemo(() => Array.from({ length: settings.classSize }, (_, index) => index + 1).filter((number) => !settings.absent.includes(number)).map((number) => ({ number, gender: number >= settings.maleStart && number <= settings.maleEnd ? 'male' as const : 'female' as const })), [settings])
  const maleCount = students.filter((student) => student.gender === 'male').length
  const femaleCount = students.length - maleCount
  const groupCount = settings.sizeMode === 'groups' ? settings.value : Math.ceil(students.length / settings.value)
  const estimate = students.length && groupCount > 0 ? `將分成 ${groupCount} 組，每組約 ${Math.ceil(students.length / groupCount)} 人${students.length % groupCount ? `，部分組別 ${Math.floor(students.length / groupCount)} 人` : ''}。` : ''

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, groups, generatedAt })) }, [settings, groups, generatedAt])
  useEffect(() => {
    const exit = () => { if (!document.fullscreenElement) setPresentation(false) }
    document.addEventListener('fullscreenchange', exit); return () => document.removeEventListener('fullscreenchange', exit)
  }, [])

  const updateNumber = (key: keyof Settings, value: number) => setSettings((current) => ({ ...current, [key]: Number.isFinite(value) ? value : 0 }))
  const configurationError = () => {
    if (!settings.className.trim()) return '請輸入班級名稱。'
    if (settings.classSize < 1 || settings.classSize > 200) return '班級人數須介於 1 至 200 人。'
    if ([settings.maleStart, settings.maleEnd, settings.femaleStart, settings.femaleEnd].some((value) => value < 1 || value > settings.classSize)) return '男女生座號範圍必須在班級人數內。'
    if (settings.maleStart > settings.maleEnd || settings.femaleStart > settings.femaleEnd) return '座號範圍的起始號不可大於結束號。'
    const maleRange = new Set(Array.from({ length: settings.maleEnd - settings.maleStart + 1 }, (_, i) => settings.maleStart + i))
    const femaleRange = new Set(Array.from({ length: settings.femaleEnd - settings.femaleStart + 1 }, (_, i) => settings.femaleStart + i))
    if ([...maleRange].some((number) => femaleRange.has(number))) return '男生與女生座號範圍不可重疊。'
    if (Array.from({ length: settings.classSize }, (_, i) => i + 1).some((number) => !maleRange.has(number) && !femaleRange.has(number))) return '每個座號都必須包含在男生或女生範圍內。'
    if (students.length === 0) return '目前沒有可參與分組的學生。'
    if (settings.value < 1) return settings.sizeMode === 'groups' ? '組數至少為 1 組。' : '每組人數至少為 1 人。'
    if (settings.value > students.length) return settings.sizeMode === 'groups' ? '組數不可超過實際參與人數。' : '每組人數不可超過實際參與人數。'
    return ''
  }
  const generate = () => {
    const invalid = configurationError(); if (invalid) { setError(invalid); return }
    setError(''); setWorking(true)
    window.setTimeout(() => {
      let next: Group[] = []; let issue = ''
      for (let attempt = 0; attempt < 5; attempt++) { next = buildGroups(students, groupCount, settings.method); issue = validateGrouping(next, students); if (!issue) break }
      if (issue) setError(`無法產生正確分組：${issue}`)
      else { setGroups(next); setGeneratedAt(new Date().toISOString()); setScreen('results') }
      setWorking(false)
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 30 : 1100)
  }
  const toggleAbsent = (number: number) => setSettings((current) => ({ ...current, absent: current.absent.includes(number) ? current.absent.filter((item) => item !== number) : [...current.absent, number] }))
  const enterPresentation = async () => { setPresentation(true); try { await document.documentElement.requestFullscreen?.() } catch { /* browser can still use overlay mode */ } }
  const exitPresentation = async () => { setPresentation(false); if (document.fullscreenElement) await document.exitFullscreen?.() }

  const download = async () => {
    if (!groups.length) return
    await document.fonts?.ready
    const width = 1920, columns = groups.length <= 4 ? 2 : groups.length <= 8 ? 4 : 5
    const rows = Math.ceil(groups.length / columns), header = 220, gap = 26, side = 90
    const cardWidth = (width - side * 2 - gap * (columns - 1)) / columns
    const cardHeight = Math.max(250, 130 + Math.ceil(Math.max(...groups.map((group) => group.length)) / 4) * 74)
    const height = Math.max(1080, header + rows * cardHeight + (rows - 1) * gap + 90)
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d')!; const grad = ctx.createLinearGradient(0, 0, width, height); grad.addColorStop(0, '#102f3b'); grad.addColorStop(1, '#061822'); ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = '#9b7441'; ctx.lineWidth = 3; ctx.strokeRect(28, 28, width - 56, height - 56)
    ctx.textAlign = 'center'; ctx.fillStyle = '#e6c27c'; ctx.font = '64px "Noto Serif TC", "Microsoft JhengHei", serif'; ctx.fillText(`${settings.className}｜學生分組`, width / 2, 98)
    ctx.fillStyle = '#b9a88a'; ctx.font = '28px "Noto Serif TC", "Microsoft JhengHei", serif'; ctx.fillText(`${settings.method === 'balanced' ? '男女平均分組' : '完全隨機分組'}　｜　${students.length} 人　｜　${new Date(generatedAt).toLocaleDateString('zh-TW')}`, width / 2, 155)
    groups.forEach((group, index) => {
      const row = Math.floor(index / columns), col = index % columns, x = side + col * (cardWidth + gap), y = header + row * (cardHeight + gap)
      ctx.fillStyle = '#e7d1a3'; ctx.strokeStyle = '#a67b42'; ctx.lineWidth = 3; ctx.fillRect(x, y, cardWidth, cardHeight); ctx.strokeRect(x, y, cardWidth, cardHeight)
      ctx.fillStyle = '#4d351f'; ctx.font = 'bold 34px "Noto Serif TC", "Microsoft JhengHei", serif'; ctx.fillText(`${groupLabel(index)}　${group.length}人`, x + cardWidth / 2, y + 56)
      group.forEach((student, studentIndex) => { const cx = x + 58 + (studentIndex % 4) * ((cardWidth - 116) / 3), cy = y + 122 + Math.floor(studentIndex / 4) * 72; ctx.fillStyle = student.gender === 'male' ? '#315766' : '#7a554c'; ctx.beginPath(); ctx.arc(cx - 24, cy - 9, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#302419'; ctx.font = 'bold 31px "Noto Serif TC", "Microsoft JhengHei", serif'; ctx.fillText(label(student.number), cx + 24, cy) })
    })
    canvas.toBlob((blob) => { if (!blob) return; const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${settings.className.trim()}_學生分組_${new Date().toISOString().slice(0, 10)}.png`; link.click(); window.setTimeout(() => URL.revokeObjectURL(link.href), 1000) }, 'image/png')
  }

  const result = <section className="group-results-sheet" aria-label="分組結果">
    <header><span>SHUXIN CLASSROOM</span><h1>{settings.className}｜學生分組</h1><p>{settings.method === 'balanced' ? '男女平均分組' : '完全隨機分組'}　｜　實際參與 {students.length} 人　｜　{generatedAt ? new Date(generatedAt).toLocaleDateString('zh-TW') : ''}</p></header>
    <div className="group-card-grid">{groups.map((group, index) => <article className="group-card" key={index}><h2>{groupLabel(index)}<small>{group.length}人</small></h2><div>{group.map((student) => <span className={student.gender} key={student.number}><i />{label(student.number)}</span>)}</div></article>)}</div>
  </section>

  if (presentation) return <main className={`group-presentation groups-${groups.length}`}><div className="presentation-controls"><button onClick={exitPresentation}>退出大圖</button><button onClick={download}>下載圖檔</button></div>{result}</main>
  return <main className="grouping-page">
    <div className="grouping-frame" aria-hidden="true" />
    <header className={`grouping-header${onBack ? '' : ' standalone'}`}>{onBack ? <button className="grouping-back" onClick={onBack}>返回首頁</button> : <span aria-hidden="true" />}<div><span>SHUXIN CLASSROOM TOOL</span><h1>探索者編隊簿</h1><p>翻開名冊，為今日的探索編排同行小隊。</p></div><b>TEAM FORMATION</b></header>
    {screen === 'settings' ? <div className="grouping-layout">
      <section className="parchment-panel"><h2>一、班級與學生</h2><div className="field-grid"><label>班級名稱<input value={settings.className} onChange={(e) => setSettings({ ...settings, className: e.target.value })} /></label><label>班級人數<input type="number" min="1" max="200" value={settings.classSize} onChange={(e) => updateNumber('classSize', +e.target.value)} /></label><label>男生座號範圍<span><input type="number" value={settings.maleStart} onChange={(e) => updateNumber('maleStart', +e.target.value)} />至<input type="number" value={settings.maleEnd} onChange={(e) => updateNumber('maleEnd', +e.target.value)} /></span></label><label>女生座號範圍<span><input type="number" value={settings.femaleStart} onChange={(e) => updateNumber('femaleStart', +e.target.value)} />至<input type="number" value={settings.femaleEnd} onChange={(e) => updateNumber('femaleEnd', +e.target.value)} /></span></label></div>
        <div className="student-summary">目前參與分組：{students.length}人｜男生{maleCount}人｜女生{femaleCount}人</div>
        <div className="student-roster">{Array.from({ length: Math.max(0, settings.classSize) }, (_, i) => i + 1).map((number) => { const absent = settings.absent.includes(number), female = number >= settings.femaleStart && number <= settings.femaleEnd; return <button key={number} aria-pressed={absent} className={`${female ? 'female' : 'male'}${absent ? ' absent' : ''}`} onClick={() => toggleAbsent(number)}><i />{label(number)}<small>{absent ? '空號' : '在班'}</small></button> })}</div>
        <div className="minor-actions"><button onClick={() => setSettings({ ...settings, absent: [] })}>全部恢復</button><button onClick={() => setSettings({ ...settings, absent: [] })}>清除空號設定</button></div>
      </section>
      <section className="parchment-panel grouping-options"><h2>二、分組設定</h2><div className="segmented"><button className={settings.sizeMode === 'groups' ? 'active' : ''} onClick={() => setSettings({ ...settings, sizeMode: 'groups' })}>指定組數</button><button className={settings.sizeMode === 'members' ? 'active' : ''} onClick={() => setSettings({ ...settings, sizeMode: 'members' })}>指定每組人數</button></div><label className="large-input">{settings.sizeMode === 'groups' ? '希望分成幾組' : '每組預計幾人'}<input type="number" min="1" max={students.length || 1} value={settings.value} onChange={(e) => updateNumber('value', +e.target.value)} /></label><p className="estimate">{estimate}</p><h2>三、分組方式</h2><div className="method-cards"><button className={settings.method === 'balanced' ? 'active' : ''} onClick={() => setSettings({ ...settings, method: 'balanced' })}><strong>男女平均分組</strong><small>兼顧性別比例與各組總人數</small></button><button className={settings.method === 'random' ? 'active' : ''} onClick={() => setSettings({ ...settings, method: 'random' })}><strong>完全隨機分組</strong><small>充分打亂並平均分配所有學生</small></button></div>{error && <p className="group-error" role="alert">{error}</p>}<button className={`group-start${working ? ' working' : ''}`} disabled={working} onClick={generate}>{working ? '書頁正在展開…' : '開始分組'}</button><button className="clear-data" onClick={() => { if (window.confirm('確定要清除所有班級設定與分組結果嗎？此操作無法復原。')) { localStorage.removeItem(STORAGE_KEY); setSettings(defaults); setGroups([]); setGeneratedAt(''); setError('') } }}>清除全部資料</button></section>
    </div> : <div className="grouping-results-wrap">{result}<nav className="result-actions"><button onClick={() => setScreen('settings')}>返回修改</button><button onClick={generate}>重新分組</button><button onClick={enterPresentation}>大圖檢視</button><button className="primary" onClick={download}>下載分組圖檔</button></nav>{error && <p className="group-error">{error}</p>}</div>}
  </main>
}
