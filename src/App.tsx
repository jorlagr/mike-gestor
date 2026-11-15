import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowDownLeft, ArrowDownUp, ArrowLeft, ArrowUpRight, BarChart3, CalendarDays, Check, ChevronDown, CirclePlus,
  FileSpreadsheet, FileText, LogOut, Pencil, Plus, Search, Trash2, TrendingUp, Wallet, X,
} from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { calculateTotals, filterMovements, sortMovements, type Movement, type MovementType } from './lib/accounting'
import { downloadCsv, downloadXlsx } from './lib/export'
import { isBackendConfigured, supabase } from './lib/supabase'

const COMPANIES = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'Mike Moya', description: 'Eventos y servicios de DJ', initials: 'MM', color: 'violet' },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Largueta', description: 'Gestión empresarial', initials: 'L', color: 'blue' },
] as const
const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
type Company = (typeof COMPANIES)[number]

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(() => new URLSearchParams(window.location.search).get('auth') === 'recovery')
  const [company, setCompany] = useState<Company | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Movement | null>(null)
  const [showCombined, setShowCombined] = useState(false)
  const [combinedRows, setCombinedRows] = useState<{ company: Company; income: number; expense: number; balance: number }[] | null>(null)
  const [combinedLoading, setCombinedLoading] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) setError(sessionError.message)
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session || !company || !supabase) return
    let active = true
    setDataLoading(true)
    setError('')
    supabase.from('movements').select('*').eq('company_id', company.id).order('date', { ascending: false }).order('created_at', { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!active) return
        if (queryError) setError(queryError.message)
        else setMovements((data ?? []) as Movement[])
        setDataLoading(false)
      })
    return () => { active = false }
  }, [session, company])

  const visible = useMemo(() => sortMovements(filterMovements(movements, { search, month, year }), sortDirection), [movements, search, month, year, sortDirection])
  const totals = useMemo(() => calculateTotals(visible), [visible])
  const allTotals = useMemo(() => calculateTotals(movements), [movements])
  const years = useMemo(() => [...new Set(movements.map((item) => item.date.slice(0, 4)))].sort().reverse(), [movements])

  async function toggleCombined() {
    const next = !showCombined
    setShowCombined(next)
    if (!next || combinedRows || !supabase) return
    setCombinedLoading(true)
    setError('')
    const { data, error: queryError } = await supabase.from('movements').select('company_id,type,amount').in('company_id', COMPANIES.map((item) => item.id))
    if (queryError) setError(queryError.message)
    else {
      const rows = data ?? []
      setCombinedRows(COMPANIES.map((item) => {
        const values = rows.filter((row) => row.company_id === item.id)
        return { company: item, ...calculateTotals(values as Pick<Movement, 'type' | 'amount'>[]) }
      }))
    }
    setCombinedLoading(false)
  }

  async function saveMovement(values: { type: MovementType; concept: string; date: string; amount: number }) {
    if (!company || !supabase) return 'No hay una empresa activa o la base de datos no está configurada.'
    setError('')
    const result = editing
      ? await supabase.from('movements').update(values).eq('id', editing.id).eq('company_id', company.id).select().single()
      : await supabase.from('movements').insert({ ...values, company_id: company.id }).select().single()
    if (result.error) {
      setError(result.error.message)
      return result.error.message
    }
    setMovements((current) => sortMovements(editing
      ? current.map((item) => item.id === editing.id ? result.data as Movement : item)
      : [result.data as Movement, ...current]))
    setShowForm(false)
    setEditing(null)
    setCombinedRows(null)
    return null
  }

  async function removeMovement(movement: Movement) {
    if (!supabase || !company || !window.confirm(`¿Eliminar "${movement.concept}"? Esta acción no se puede deshacer.`)) return
    const { data, error: deleteError } = await supabase.from('movements').delete().eq('id', movement.id).eq('company_id', company.id).select('id')
    if (deleteError) setError(deleteError.message)
    else if (!data?.length) setError('No se pudo eliminar el movimiento: no se encontró en esta empresa.')
    else {
      setMovements((current) => current.filter((item) => item.id !== movement.id))
      setCombinedRows(null)
    }
  }

  async function signOut() {
    if (!supabase) return
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) setError(signOutError.message)
    else {
      setCompany(null)
      setMovements([])
      setCombinedRows(null)
    }
  }

  function selectCompany(item: Company) {
    setCompany(item)
    setMovements([])
    setCombinedRows(null)
    setSearch('')
    setMonth('')
    setYear('')
    setSortDirection('desc')
  }
  function backToCompanies() {
    setCompany(null)
    setMovements([])
    setError('')
  }

  if (!isBackendConfigured) return <SetupScreen />
  if (authLoading) return <div className="loading-screen"><span className="spinner" />Cargando...</div>
  if (recoveryMode) return <PasswordRecoveryScreen onComplete={() => {
    setRecoveryMode(false)
    window.history.replaceState({}, document.title, window.location.pathname)
  }} />
  if (!session) return <LoginScreen initialError={error} />

  if (!company) return (
    <div className="app-shell">
      <Header onSignOut={signOut} />
      <main className="home-main">
        <div className="eyebrow">TU ESPACIO DE TRABAJO</div>
        <h1>¿Con qué empresa<br className="mobile-break" /> trabajamos hoy?</h1>
        <p className="intro">Selecciona una empresa para acceder a su contabilidad.</p>
        {error && <ErrorBanner error={error} clear={() => setError('')} />}
        <div className="company-grid">
          {COMPANIES.map((item) => (
            <button className={`company-card ${item.color}`} key={item.id} onClick={() => selectCompany(item)}>
              <span className="company-icon">{item.initials}</span>
              <span className="company-details"><strong>{item.name}</strong><small>{item.description}</small></span>
              <ArrowUpRight size={20} className="company-arrow" />
            </button>
          ))}
        </div>
        <button className={`combined-link ${showCombined ? 'active' : ''}`} onClick={toggleCombined}>
          <BarChart3 size={18} /> {showCombined ? 'Ocultar resumen conjunto' : 'Ver resumen conjunto'} <ChevronDown size={16} />
        </button>
        {showCombined && <CombinedSummary rows={combinedRows} loading={combinedLoading} />}
        <p className="separation-note"><span className="lock-dot" /> Cada empresa tiene su contabilidad independiente y protegida.</p>
      </main>
    </div>
  )

  return (
    <div className="app-shell">
      <Header company={company} onBack={backToCompanies} onSignOut={signOut} />
      <main className="dashboard">
        <div className="dashboard-heading">
          <div>
            <button className="back-link" onClick={backToCompanies}><ArrowLeft size={16} /> Todas las empresas</button>
            <div className="title-line"><h1>{company.name}</h1><span className={`company-pill ${company.color}`}>{company.description}</span></div>
            <p className="subtitle">Tu actividad financiera, clara y al día.</p>
          </div>
          <button className="primary-button add-desktop" onClick={() => { setEditing(null); setShowForm(true) }}><Plus size={18} /> Nuevo movimiento</button>
        </div>

        {error && <ErrorBanner error={error} clear={() => setError('')} />}
        <section className="stats-grid" aria-label="Resumen de la empresa">
          <StatCard title="Ingresos" amount={totals.income} icon={<ArrowDownLeft size={19} />} kind="income" period={Boolean(month || year || search)} />
          <StatCard title="Gastos" amount={totals.expense} icon={<ArrowUpRight size={19} />} kind="expense" period={Boolean(month || year || search)} />
          <StatCard title="Balance" amount={totals.balance} icon={<Wallet size={19} />} kind="balance" period={Boolean(month || year || search)} />
        </section>
        <div className="all-time">Balance histórico sin filtros: <strong>{euro.format(allTotals.balance)}</strong></div>
        <section className="ledger">
          <div className="ledger-top">
            <div><h2>Movimientos</h2><p>{visible.length} {visible.length === 1 ? 'registro' : 'registros'}</p></div>
            <div className="export-actions">
              <button className="secondary-button" disabled={!visible.length} onClick={() => downloadCsv(visible, company.name)}><FileText size={16} /> CSV</button>
              <button className="secondary-button" disabled={!visible.length} onClick={() => downloadXlsx(visible, company.name)}><FileSpreadsheet size={16} /> Excel</button>
            </div>
          </div>
          <div className="filters">
            <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar concepto..." /></label>
            <label className="select-field"><CalendarDays size={16} /><select value={month} onChange={(event) => setMonth(event.target.value)}><option value="">Todos los meses</option>{Array.from({ length: 12 }, (_, i) => <option value={String(i + 1).padStart(2, '0')} key={i}>{new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date(2024, i, 1))}</option>)}</select></label>
            <label className="select-field"><select value={year} onChange={(event) => setYear(event.target.value)}><option value="">Todos los años</option>{years.map((item) => <option key={item}>{item}</option>)}</select></label>
            <button className="sort-button" onClick={() => setSortDirection((current) => current === 'desc' ? 'asc' : 'desc')}><ArrowDownUp size={14} /> {sortDirection === 'desc' ? 'Recientes' : 'Antiguos'}</button>
            {(search || month || year) && <button className="clear-filters" onClick={() => { setSearch(''); setMonth(''); setYear('') }}>Limpiar</button>}
          </div>
          {dataLoading ? <div className="empty-state"><span className="spinner" /> Cargando movimientos...</div> : visible.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">{movements.length ? <Search size={21} /> : <Wallet size={21} />}</span>
              <strong>{movements.length ? 'No hay resultados' : 'Aún no hay movimientos'}</strong>
              <span>{movements.length ? 'Prueba a cambiar los filtros.' : 'Añade tu primer ingreso o gasto para empezar.'}</span>
              {!movements.length && <button className="secondary-button" onClick={() => { setEditing(null); setShowForm(true) }}><CirclePlus size={16} /> Añadir movimiento</button>}
            </div>
          ) : <><div className="movement-list">{visible.map((movement) => <MovementRow key={movement.id} movement={movement} onEdit={() => { setEditing(movement); setShowForm(true) }} onDelete={() => removeMovement(movement)} />)}</div><div className="mobile-total">Total del periodo <strong>{euro.format(totals.balance)}</strong></div></>}
        </section>
      </main>
      <button className="mobile-fab" onClick={() => { setEditing(null); setShowForm(true) }} aria-label="Nuevo movimiento"><Plus size={24} /></button>
      {showForm && <MovementModal movement={editing} onClose={() => { setShowForm(false); setEditing(null) }} onSave={saveMovement} />}
    </div>
  )
}

function Header({ company, onBack, onSignOut }: { company?: Company; onBack?: () => void; onSignOut: () => void }) {
  return <header className="topbar"><div className="topbar-inner"><button className="brand" onClick={onBack} aria-label="Ir al inicio"><span className="brand-mark"><TrendingUp size={19} /></span><span>balance<span className="brand-period">.</span></span></button>{company && <div className="topbar-company"><span className={`mini-dot ${company.color}`} />{company.name}</div>}<button className="signout-button" onClick={onSignOut}><LogOut size={16} /><span>Cerrar sesión</span></button></div></header>
}

function StatCard({ title, amount, icon, kind, period }: { title: string; amount: number; icon: ReactNode; kind: string; period: boolean }) {
  return <article className={`stat-card ${kind}`}><div className="stat-top"><span>{title}{period && <small className="period-tag">Periodo</small>}</span><span className="stat-icon">{icon}</span></div><strong>{euro.format(amount)}</strong><span className="stat-caption">{period ? 'Según filtros aplicados' : 'Desde el inicio'}</span></article>
}

function MovementRow({ movement, onEdit, onDelete }: { movement: Movement; onEdit: () => void; onDelete: () => void }) {
  const income = movement.type === 'income'
  return <article className="movement-row"><span className={`movement-icon ${income ? 'income' : 'expense'}`}>{income ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</span><div className="movement-copy"><strong>{movement.concept}</strong><span>{movement.date.split('-').reverse().join('/')} <i /> {income ? 'Ingreso' : 'Gasto'}</span></div><strong className={`movement-amount ${income ? 'positive' : 'negative'}`}>{income ? '+' : '−'}{euro.format(Number(movement.amount))}</strong><div className="row-actions"><button onClick={onEdit} aria-label="Editar movimiento"><Pencil size={16} /></button><button onClick={onDelete} aria-label="Eliminar movimiento" className="delete-action"><Trash2 size={16} /></button></div></article>
}

function MovementModal({ movement, onClose, onSave }: { movement: Movement | null; onClose: () => void; onSave: (values: { type: MovementType; concept: string; date: string; amount: number }) => Promise<string | null> }) {
  const [type, setType] = useState<MovementType>(movement?.type ?? 'income')
  const [concept, setConcept] = useState(movement?.concept ?? '')
  const [date, setDate] = useState(movement?.date ?? today())
  const [amount, setAmount] = useState(movement ? String(movement.amount) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsedAmount = Number(amount.replace(',', '.'))
    if (!concept.trim() || !date || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Completa el concepto y una cantidad válida mayor que cero.')
      return
    }
    setSaving(true)
    const saveError = await onSave({ type, concept: concept.trim(), date, amount: Math.round(parsedAmount * 100) / 100 })
    if (saveError) setError(saveError)
    setSaving(false)
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="movement-modal" onSubmit={submit}><div className="modal-heading"><div><span className="eyebrow">{movement ? 'ACTUALIZAR REGISTRO' : 'NUEVO REGISTRO'}</span><h2>{movement ? 'Editar movimiento' : 'Añadir movimiento'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button></div><fieldset className="type-toggle"><legend>Tipo de movimiento</legend><button type="button" className={type === 'income' ? 'selected income' : ''} onClick={() => setType('income')}><ArrowDownLeft size={17} /> Ingreso</button><button type="button" className={type === 'expense' ? 'selected expense' : ''} onClick={() => setType('expense')}><ArrowUpRight size={17} /> Gasto</button></fieldset><label className="form-field">Concepto<input autoFocus maxLength={120} value={concept} onChange={(event) => setConcept(event.target.value)} placeholder="Ej. Evento privado, equipo de sonido..." /></label><div className="form-row"><label className="form-field">Fecha<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label className="form-field">Importe<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" /><span className="currency-suffix">€</span></label></div>{error && <p className="form-error">{error}</p>}<button className="primary-button save-button" disabled={saving}>{saving ? 'Guardando...' : <><Check size={17} /> {movement ? 'Guardar cambios' : 'Guardar movimiento'}</>}</button></form></div>
}

function LoginScreen({ initialError = '' }: { initialError?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'recovery-request'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError)
  const [notice, setNotice] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setLoading(true)
    setError('')
    setNotice('')
    if (mode === 'login') {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
      if (loginError) setError('No se pudo iniciar sesión. Comprueba que usas el correo y la contraseña del usuario de Authentication.')
    } else {
      const redirectUrl = new URL(window.location.href)
      redirectUrl.search = ''
      redirectUrl.hash = ''
      redirectUrl.searchParams.set('auth', 'recovery')
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl.toString() })
      if (recoveryError) setError(`No se pudo solicitar la recuperación. ${recoveryError.message}`)
      else setNotice('Si ese correo está asociado a una cuenta, recibirás un enlace para cambiar la contraseña.')
    }
    setLoading(false)
  }
  return <div className="auth-page"><div className="auth-card"><div className="brand auth-brand"><span className="brand-mark"><TrendingUp size={19} /></span><span>balance<span className="brand-period">.</span></span></div><span className="eyebrow">ACCESO PRIVADO</span><h1>{mode === 'login' ? 'Qué bueno verte.' : 'Recupera tu acceso.'}</h1><p>{mode === 'login' ? 'Inicia sesión para consultar tus empresas.' : 'Te enviaremos un enlace para cambiar tu contraseña.'}</p><form onSubmit={submit}><label className="form-field">Correo electrónico<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@email.com" /></label>{mode === 'login' && <label className="form-field">Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tu contraseña" /></label>}{error && <p className="form-error">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}<button className="primary-button save-button" disabled={loading}>{loading ? 'Procesando...' : mode === 'login' ? 'Iniciar sesión' : 'Enviar enlace'}</button></form>{mode === 'login' ? <button type="button" className="auth-link" onClick={() => { setMode('recovery-request'); setError(''); setNotice('') }}>¿Olvidaste tu contraseña?</button> : <button type="button" className="auth-link" onClick={() => { setMode('login'); setError(''); setNotice('') }}>Volver al inicio de sesión</button>}<div className="auth-foot"><span className="lock-dot" /> Acceso restringido y conexión segura</div></div></div>
}

function PasswordRecoveryScreen({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setLoading(true)
    setError('')
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) setError(updateError.message)
    else onComplete()
    setLoading(false)
  }

  return <div className="auth-page"><div className="auth-card"><div className="brand auth-brand"><span className="brand-mark"><TrendingUp size={19} /></span><span>balance<span className="brand-period">.</span></span></div><span className="eyebrow">RECUPERACIÓN DE CUENTA</span><h1>Elige una contraseña nueva.</h1><p>Usa al menos 6 caracteres.</p><form onSubmit={submit}><label className="form-field">Nueva contraseña<input type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="form-field">Repite la contraseña<input type="password" autoComplete="new-password" minLength={6} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button save-button" disabled={loading}>{loading ? 'Guardando...' : 'Guardar contraseña'}</button></form><div className="auth-foot"><span className="lock-dot" /> Enlace de recuperación seguro</div></div></div>
}

function SetupScreen() {
  return <div className="auth-page"><div className="auth-card setup-card"><div className="brand auth-brand"><span className="brand-mark"><TrendingUp size={19} /></span><span>balance<span className="brand-period">.</span></span></div><span className="eyebrow">CONFIGURACIÓN INICIAL</span><h1>Conecta tu base de datos.</h1><p>Faltan las credenciales de Supabase para activar el inicio de sesión y guardar los movimientos en la nube.</p><ol><li>Crea un proyecto gratuito en Supabase.</li><li>Configura sus tablas y políticas con <code>supabase/schema.sql</code>.</li><li>Configura <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> en el entorno de publicación.</li><li>Crea tu usuario privado en Authentication y autorízalo en <code>user_companies</code>.</li></ol><div className="setup-note"><strong>Este proyecto no incluye datos de ejemplo.</strong> Hasta conectar el backend no se habilita el acceso ni se guardan datos en el dispositivo.</div></div></div>
}

function CombinedSummary({ rows, loading }: { rows: { company: Company; income: number; expense: number; balance: number }[] | null; loading: boolean }) {
  if (loading) return <div className="combined-placeholder">Calculando resumen...</div>
  if (!rows) return null
  const combinedBalance = rows.reduce((sum, row) => sum + row.balance, 0)
  return <div className="combined-summary">{rows.map((row) => <div className="combined-company" key={row.company.id}><strong>{row.company.name}</strong><span>Ingresos {euro.format(row.income)} · Gastos {euro.format(row.expense)}</span><b>{euro.format(row.balance)}</b></div>)}<div className="combined-total"><span>Balance conjunto</span><strong>{euro.format(combinedBalance)}</strong></div></div>
}

function ErrorBanner({ error, clear }: { error: string; clear: () => void }) {
  return <div className="error-banner" role="alert">{error}<button onClick={clear} aria-label="Cerrar"><X size={16} /></button></div>
}
