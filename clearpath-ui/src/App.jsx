import React, { useState, useRef, useEffect } from 'react'

// ── Demo credentials ──────────────────────────────────────────────────────
// NPI_REGISTRY: fallback when CMS NPPES API is unreachable.
// Hospital login NPI → hospital info. Patient login hospital picker.
const NPI_REGISTRY = {
  '1881018208': { hospital: 'Memorial General Hospital',  city: 'Houston, TX',      type: 'Academic Medical Center', address: '6565 Fannin St, Houston, TX 77030'          },
  '1376412986': { hospital: 'Mayo Clinic',                city: 'Rochester, MN',    type: 'Academic Medical Center', address: '200 First St SW, Rochester, MN 55905'        },
  '1003835780': { hospital: 'Cedars-Sinai Medical Center',city: 'Los Angeles, CA',  type: 'Academic Medical Center', address: '8700 Beverly Blvd, Los Angeles, CA 90048'    },
}

// Hospital staff login credentials
// employeeId + password → access hospital compliance dashboard
const HOSPITAL_USERS = [
  { npi: '1881018208', employeeId: 'EMP-00001', password: 'demo1234',  name: 'Demo Administrator',   role: 'Chief Compliance Officer'    },
  { npi: '1881018208', employeeId: 'EMP-00142', password: 'demo1234',  name: 'Dr. Sarah Mitchell',   role: 'VP of Regulatory Affairs'    },
  { npi: '1376412986', employeeId: 'EMP-MAYO1', password: 'mayo1234',  name: 'Dr. James Harrington', role: 'Chief AI Officer'            },
  { npi: '1003835780', employeeId: 'EMP-CED01', password: 'cedar1234', name: 'Dr. Lisa Chen',        role: 'Chief Compliance Officer'    },
]

// Patient records — fully self-contained for offline/no-backend demo.
// Each encounter has all fields the patient dashboard needs.
const PATIENT_REGISTRY = {

  // ── Alex Johnson — Memorial General + Cedars-Sinai ──────────────────────
  'MRN-20847': {
    name: 'Alex Johnson', dob: '1985-03-14', gender: 'M', password: 'patient123',
    encounters: [
      {
        id: 'ADM-10042', adm_id: 'ADM-10042',
        date: '2025-11-14', admission_date: '2025-11-14', discharge_date: '2025-11-17',
        reason: 'Pneumonia — 3-day inpatient stay',
        icd10_desc: 'Pneumonia, unspecified organism', drg_code: '193', drg: '193',
        department: 'Pulmonology', los_days: 3, los: 3, risk_level: 'high',
        hospital_npi: '1881018208', hospital_name: 'Memorial General Hospital',
        ai_tools: ['epic_sepsis_model', 'billing_coding_ai', 'nuance_dax'],
        governance_gaps: [
          'No patient disclosure form on file for ambient documentation AI',
          'Sepsis model demographic bias report overdue — Q3 filing missing',
        ],
      },
      {
        id: 'ADM-10031', adm_id: 'ADM-10031',
        date: '2025-08-02', admission_date: '2025-08-02', discharge_date: '2025-08-02',
        reason: 'Outpatient cardiac monitoring',
        icd10_desc: 'Cardiac arrhythmia, unspecified', drg_code: '309', drg: '309',
        department: 'Cardiology', los_days: 1, los: 1, risk_level: 'medium',
        hospital_npi: '1881018208', hospital_name: 'Memorial General Hospital',
        ai_tools: ['ehr_predictive_analytics', 'billing_coding_ai'],
        governance_gaps: [
          'No patient disclosure policy for EHR predictive analytics',
        ],
      },
      {
        id: 'ADM-09918', adm_id: 'ADM-09918',
        date: '2024-12-19', admission_date: '2024-12-19', discharge_date: '2024-12-21',
        reason: 'Emergency — acute appendicitis surgery',
        icd10_desc: 'Acute appendicitis without abscess', drg_code: '341', drg: '341',
        department: 'Emergency / Surgery', los_days: 2, los: 2, risk_level: 'critical',
        hospital_npi: '1003835780', hospital_name: 'Cedars-Sinai Medical Center',
        ai_tools: ['chatgpt_clinical', 'billing_coding_ai', 'radiology_ai_cad'],
        governance_gaps: [
          'ChatGPT used in clinical context without a HIPAA BAA — potential breach',
          'No FDA 510(k) clearance documentation on file for radiology CADe tool',
        ],
      },
    ],
  },

  // ── Demo Patient — Memorial General ─────────────────────────────────────
  'MRN-99001': {
    name: 'Demo Patient', dob: '1990-07-22', gender: 'F', password: 'demo1234',
    encounters: [
      {
        id: 'ADM-00101', adm_id: 'ADM-00101',
        date: '2025-10-05', admission_date: '2025-10-05', discharge_date: '2025-10-07',
        reason: 'Routine hip replacement surgery',
        icd10_desc: 'Primary osteoarthritis, bilateral hip', drg_code: '470', drg: '470',
        department: 'Orthopedic Surgery', los_days: 2, los: 2, risk_level: 'medium',
        hospital_npi: '1881018208', hospital_name: 'Memorial General Hospital',
        ai_tools: ['billing_coding_ai', 'ehr_predictive_analytics', 'nuance_dax'],
        governance_gaps: [
          'Ambient documentation AI active — patient consent form not on file',
        ],
      },
      {
        id: 'ADM-00098', adm_id: 'ADM-00098',
        date: '2025-06-18', admission_date: '2025-06-18', discharge_date: '2025-06-23',
        reason: 'Sepsis monitoring — ICU stay 5 days',
        icd10_desc: 'Sepsis, unspecified organism', drg_code: '871', drg: '871',
        department: 'ICU', los_days: 5, los: 5, risk_level: 'critical',
        hospital_npi: '1881018208', hospital_name: 'Memorial General Hospital',
        ai_tools: ['epic_sepsis_model', 'billing_coding_ai', 'chatgpt_clinical'],
        governance_gaps: [
          'ChatGPT used without a HIPAA Business Associate Agreement — potential breach',
          'Sepsis model bias monitoring report not filed for current quarter',
        ],
      },
    ],
  },

  // ── Sarah Brennan — Mayo Clinic ──────────────────────────────────────────
  'MRN-MAYO1': {
    name: 'Sarah Brennan', dob: '1978-09-15', gender: 'F', password: 'mayo1234',
    encounters: [
      {
        id: 'ADM-MCR-041', adm_id: 'ADM-MCR-041',
        date: '2025-12-01', admission_date: '2025-12-01', discharge_date: '2025-12-08',
        reason: 'Cardiac catheterization — coronary artery disease',
        icd10_desc: 'Coronary artery disease, native vessel', drg_code: '247', drg: '247',
        department: 'Cardiovascular ICU', los_days: 7, los: 7, risk_level: 'high',
        hospital_npi: '1376412986', hospital_name: 'Mayo Clinic',
        ai_tools: ['viz_ai', 'billing_coding_ai', 'ehr_predictive_analytics', 'ambient_clinical_intelligence'],
        governance_gaps: [
          'Ambient clinical AI active — no documented patient consent form',
          'No formal AI governance committee charter on file (4+ tools deployed)',
          'EHR predictive analytics bias report not submitted for Q4',
        ],
      },
      {
        id: 'ADM-MCR-029', adm_id: 'ADM-MCR-029',
        date: '2025-09-10', admission_date: '2025-09-10', discharge_date: '2025-09-11',
        reason: 'Outpatient MRI — neurology follow-up',
        icd10_desc: 'Migraine with aura, intractable', drg_code: '102', drg: '102',
        department: 'Neurology', los_days: 1, los: 1, risk_level: 'medium',
        hospital_npi: '1376412986', hospital_name: 'Mayo Clinic',
        ai_tools: ['radiology_ai_cad', 'billing_coding_ai'],
        governance_gaps: [
          'No FDA 510(k) clearance number documented for AI-assisted CADe radiology tool',
        ],
      },
    ],
  },
}

// Patient portal email login (alternative to MRN+DOB flow)
const PATIENT_USERS = [
  { email: 'patient@demo.com',  password: 'patient123', name: 'Alex Johnson',  dob: '1985-03-14', mrn: 'MRN-20847' },
  { email: 'demo@clearpath.ai', password: 'demo1234',   name: 'Demo Patient',  dob: '1990-07-22', mrn: 'MRN-99001' },
  { email: 'sarah@mayo.demo',   password: 'mayo1234',   name: 'Sarah Brennan', dob: '1978-09-15', mrn: 'MRN-MAYO1' },
]


const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const TOOLS = [
  { id: 'epic_sepsis_model',            label: 'Epic Sepsis Prediction Model',           risk: 'high'     },
  { id: 'nuance_dax',                   label: 'Nuance DAX Ambient Documentation',        risk: 'medium'   },
  { id: 'billing_coding_ai',            label: 'AI-Assisted Medical Coding & Billing',    risk: 'high'     },
  { id: 'optum_claims_ai',              label: 'Optum Claims & Prior Authorization AI',   risk: 'high'     },
  { id: 'viz_ai',                       label: 'Viz.ai Stroke Detection',                 risk: 'high'     },
  { id: 'radiology_ai_cad',             label: 'Radiology AI / CADe Detection',           risk: 'high'     },
  { id: 'azure_openai_clinical',        label: 'Azure OpenAI Clinical Integration',       risk: 'medium'   },
  { id: 'ambient_clinical_intelligence',label: 'Ambient Clinical Intelligence',           risk: 'medium'   },
  { id: 'ehr_predictive_analytics',     label: 'EHR Native Predictive Analytics',         risk: 'high'     },
  { id: 'chatgpt_clinical',             label: 'ChatGPT Consumer LLM (Shadow AI)',        risk: 'critical' },
]

const STATES = [
  'Texas', 'California', 'Colorado', 'Illinois', 'Utah', 'Maryland',
  'Arizona', 'Nebraska', 'New York', 'Florida', 'Minnesota', 'Indiana',
  'Rhode Island', 'Kentucky', 'New Mexico', 'Other',
]

const SEV = {
  critical: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  high:     { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  medium:   { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  low:      { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  info:     { color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
}

// Pattern constants
const PAT_DIAG = { backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 18px, rgba(21,128,61,0.14) 18px, rgba(21,128,61,0.14) 19px)', backgroundColor: '#fff' }
const PAT_DOTS = { backgroundImage: 'radial-gradient(circle, rgba(21,128,61,0.32) 1.5px, transparent 1.5px)', backgroundSize: '22px 22px', backgroundColor: '#fff' }
const PAT_FADE = { backgroundImage: 'radial-gradient(ellipse at center, rgba(21,128,61,0.18) 1.5px, transparent 1.5px)', backgroundSize: '22px 22px', maskImage: 'radial-gradient(ellipse at 50% 50%, black 20%, transparent 75%)', WebkitMaskImage: 'radial-gradient(ellipse at 50% 50%, black 20%, transparent 75%)', backgroundColor: '#fff' }


function ClearPathLogo({ size = 'md' }) {
  const s = size === 'sm' ? 0.75 : size === 'lg' ? 1.4 : 1
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 * s }}>
      {/* Mark — interlocking C + path arrow */}
      <svg width={32 * s} height={32 * s} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="32" height="32" rx="8" fill="#0c110c"/>
        {/* Stylised C arc */}
        <path d="M22 10.5 C22 10.5 12 10.5 12 16 C12 21.5 22 21.5 22 21.5" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
        {/* Path arrow going through */}
        <path d="M10 16 L22 16" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round"/>
        <path d="M18.5 12.5 L22 16 L18.5 19.5" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
      {/* Wordmark */}
      <div>
        <span style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: 17 * s, letterSpacing: '-0.02em', color: 'var(--dark)' }}>
          Clear<span style={{ color: '#15803d' }}>Path</span>
        </span>
      </div>
    </div>
  )
}

// ── Tiny reusable components ───────────────────────────────────────────────

function SevBadge({ severity }) {
  const s = SEV[severity] || SEV.info
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 9px', borderRadius: 4,
      fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
      fontFamily: 'var(--font-m)',
      background: s.bg, color: s.color, border: '1px solid ' + s.border,
    }}>
      {severity ? severity.toUpperCase() : 'INFO'}
    </span>
  )
}


function AnimDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', marginLeft: 6 }}>
      {['dot-1','dot-2','dot-3'].map(c => (
        <span key={c} className={c} style={{ width: 5, height: 5, borderRadius: '50%', background: '#d97706', display: 'inline-block' }} />
      ))}
    </span>
  )
}

function Pill({ children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 16px', borderRadius: 99,
      border: '1.5px solid var(--border)', background: 'var(--white)',
      fontSize: 13, color: 'var(--text2)',
    }}>
      {children}
    </span>
  )
}

function Card({ children, style, leftAccent }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.75)',
      border: '1px solid rgba(0,0,0,0.07)',
      borderLeft: leftAccent ? '3px solid #15803d' : undefined,
      borderRadius: 12,
      padding: '20px 24px',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function FeatureCard({ icon, title, desc }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: 24, borderRadius: 14, cursor: 'default',
        background: 'rgba(255,255,255,0.85)',
        border: '2px solid ' + (hov ? '#15803d' : 'rgba(21,128,61,0.2)'),
        boxShadow: hov ? '0 16px 48px rgba(21,128,61,0.32)' : '0 2px 12px rgba(21,128,61,0.08)',
        transform: hov ? 'translateY(-3px)' : 'none',
        transition: 'all 0.22s',
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 14 }}>
        {icon}
      </div>
      <h3 style={{ fontFamily: 'var(--font-d)', fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{title}</h3>
      <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.65 }}>{desc}</p>
    </div>
  )
}

function Btn({ children, onClick, disabled, variant, fullWidth, style }) {
  const [hov, setHov] = useState(false)
  // Default: ghost — dark text, no box. On hover: green box with white text.
  let bg = hov ? '#15803d' : 'transparent'
  let color = hov ? '#fff' : 'var(--dark)'
  let border = hov ? '1.5px solid #15803d' : '1.5px solid #d1ddd1'
  let shadow = hov ? '0 4px 14px rgba(21,128,61,0.32)' : 'none'
  // Both 'green' and 'outline' variants behave identically to default
  if (variant === 'green' || variant === 'outline') {
    bg = hov ? '#15803d' : 'transparent'
    color = hov ? '#fff' : 'var(--dark)'
    border = hov ? '1.5px solid #15803d' : '1.5px solid #d1ddd1'
    shadow = hov ? '0 4px 14px rgba(21,128,61,0.32)' : 'none'
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '11px 24px', borderRadius: 8,
        fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-b)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        border, background: bg, color, boxShadow: shadow,
        WebkitAppearance: 'none', appearance: 'none',
        transform: hov && !disabled ? 'translateY(-1px)' : 'none',
        transition: 'all 0.18s',
        opacity: disabled ? 0.65 : 1,
        width: fullWidth ? '100%' : undefined,
        ...style,
      }}
    >
      {children}
    </button>
  )
}


function FSelect({ label, value, onChange, children }) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(null)
  const ref = useRef(null)

  // Parse options from children
  const options = React.Children.map(children, c => ({
    value: c.props.value !== undefined ? c.props.value : c.props.children,
    label: c.props.children,
  }))
  const selected = options?.find(o => o.value === value) || options?.[0]

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && (
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 6 }}>{label}</div>
      )}
      {/* Trigger */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '11px 14px', borderRadius: 8, cursor: 'pointer',
          border: '1.5px solid ' + (open ? '#15803d' : 'rgba(0,0,0,0.1)'),
          boxShadow: open ? '0 0 0 3px rgba(21,128,61,0.1)' : '0 1px 4px rgba(0,0,0,0.06)',
          background: '#fff', color: 'var(--text)',
          fontSize: 14, fontFamily: 'var(--font-b)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          transition: 'all 0.18s', userSelect: 'none',
        }}
      >
        <span>{selected?.label}</span>
        <span style={{ fontSize: 10, color: open ? '#15803d' : 'var(--text3)', transition: 'transform 0.2s, color 0.2s', transform: open ? 'rotate(180deg)' : 'none', display: 'inline-block' }}>▼</span>
      </div>
      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 200,
          background: '#fff', borderRadius: 10,
          border: '1.5px solid rgba(21,128,61,0.2)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          overflow: 'hidden',
          animation: 'fadeUp 0.15s ease',
        }}>
          {options?.map(opt => (
            <div
              key={opt.value}
              onMouseEnter={() => setHovered(opt.value)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => { onChange({ target: { value: opt.value } }); setOpen(false) }}
              style={{
                padding: '11px 16px', cursor: 'pointer', fontSize: 14,
                fontFamily: 'var(--font-b)',
                background: hovered === opt.value ? '#f0fdf4' : opt.value === value ? '#f7fff9' : '#fff',
                color: hovered === opt.value ? '#15803d' : opt.value === value ? '#15803d' : 'var(--text)',
                borderLeft: hovered === opt.value || opt.value === value ? '3px solid #15803d' : '3px solid transparent',
                fontWeight: opt.value === value ? 600 : 400,
                transition: 'all 0.12s',
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ScoreRing({ score }) {
  const r = 40
  const circ = 2 * Math.PI * r
  const isNull = score === null || score === undefined
  const s = isNull ? 0 : score
  const ringColor = isNull ? '#9ca3af' : s >= 80 ? '#15803d' : s >= 60 ? '#d97706' : s >= 40 ? '#ea580c' : '#dc2626'
  const offset = circ - (s / 100) * circ
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={96} height={96} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={48} cy={48} r={r} fill="none" stroke="var(--border)" strokeWidth={7} />
        <circle cx={48} cy={48} r={r} fill="none" stroke={ringColor} strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={isNull ? circ : offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }}
        />
        <text x={48} y={48} textAnchor="middle" dominantBaseline="central"
          style={{ fill: ringColor, fontSize: isNull ? 11 : 20, fontWeight: 800, fontFamily: 'var(--font-d)', transform: 'rotate(90deg)', transformOrigin: '48px 48px' }}>
          {isNull ? 'N/A' : s}
        </text>
      </svg>
      <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-m)', letterSpacing: '0.08em' }}>COMPLIANCE</span>
    </div>
  )
}

function AgentTracker({ agents }) {
  const list = [
    { id: 'law_mapper',   label: 'Law Mapper',          step: 1 },
    { id: 'gap_scanner',  label: 'Gap Scanner',          step: 2 },
    { id: 'shadow_ai',    label: 'Shadow AI Detector',   step: 3 },
    { id: 'transparency', label: 'Patient Transparency', step: 4 },
    { id: 'safety',       label: 'Safety Validator',     step: 5 },
    { id: 'orchestrator', label: 'Orchestrator',         step: 6 },
  ]
  const doneCount = list.filter(a => agents[a.id] === 'done').length
  const pct = Math.round((doneCount / list.length) * 100)
  return (
    <div>
      {/* Progress bar */}
      <div style={{ height: 3, background: 'var(--border)', borderRadius: 99, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: pct + '%', background: 'linear-gradient(90deg, #15803d, #22c55e)', borderRadius: 99, transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {list.map(a => {
          const s = agents[a.id] || 'idle'
          const done = s === 'done'
          const running = s === 'running'
          return (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 6,
              border: '1px solid ' + (done ? '#bbf7d0' : running ? '#fde68a' : 'var(--border)'),
              background: done ? '#f0fdf4' : running ? '#fffbeb' : 'var(--bg)',
              transition: 'all 0.2s',
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: done ? '#15803d' : running ? '#d97706' : 'var(--border2)', transition: 'all 0.2s' }} />
              <span style={{ flex: 1, fontSize: 12, fontFamily: 'var(--font-m)', color: s === 'idle' ? 'var(--text4)' : 'var(--text)' }}>
                {a.label}
              </span>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-m)', fontWeight: 700, color: done ? '#15803d' : running ? '#d97706' : 'var(--text4)', display: 'flex', alignItems: 'center' }}>
                {done ? '✓ DONE' : running ? <><span>RUN</span><AnimDots /></> : 'WAIT'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PatternGrid() {
  const diag  = { backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 18px, rgba(21,128,61,0.15) 18px, rgba(21,128,61,0.15) 19px)' }
  const dots  = { backgroundImage: 'radial-gradient(circle, rgba(21,128,61,0.32) 1.5px, transparent 1.5px)', backgroundSize: '22px 22px' }
  const rdiag = { backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 18px, rgba(21,128,61,0.15) 18px, rgba(21,128,61,0.15) 19px)' }
  const sections = [diag, dots, rdiag]
  return (
    <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', display: 'flex', height: 160 }}>
      {sections.map((pat, si) => (
        <div key={si} style={{ flex: 1, ...pat, backgroundColor: '#fff', borderRight: si < 2 ? '1px solid var(--border)' : 'none' }} />
      ))}
    </div>
  )
}


function RoleContainer({ onMode }) {
  const [hovH, setHovH] = useState(false)
  const [hovP, setHovP] = useState(false)
  const cardStyle = (hov) => ({
    flex: 1, display: 'flex', flexDirection: 'column', gap: 14,
    padding: '36px 40px', cursor: 'pointer', borderRadius: 14,
    background: hov ? '#f0fdf4' : '#fff',
    border: '1px solid ' + (hov ? '#15803d' : 'rgba(0,0,0,0.08)'),
    boxShadow: hov ? '0 16px 48px rgba(21,128,61,0.28)' : '0 2px 12px rgba(0,0,0,0.05)',
    transform: hov ? 'translateY(-3px)' : 'none',
    transition: 'all 0.22s',
  })
  return (
    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', maxWidth: 720, margin: '0 auto 64px' }}>
      <div style={cardStyle(hovH)} onClick={() => onMode('hospital')} onMouseEnter={() => setHovH(true)} onMouseLeave={() => setHovH(false)}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: hovH ? '#15803d' : '#f6f9f6', border: '1.5px solid ' + (hovH ? '#15803d' : 'var(--border)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, transition: 'all 0.2s' }}>🏛</div>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-m)', letterSpacing: '0.12em', color: hovH ? '#15803d' : 'var(--text4)', fontWeight: 600 }}>COMPLIANCE OFFICER</div>
        <h3 style={{ fontFamily: 'var(--font-d)', fontWeight: 700, fontSize: 18, color: 'var(--dark)', lineHeight: 1.25, margin: 0 }}>I'm a Hospital Administrator</h3>
        <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.65, margin: 0, flex: 1 }}>Run a full AI compliance scan — map applicable laws, identify gaps, and generate an audit-ready report.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: hovH ? '#15803d' : 'var(--text4)', transition: 'all 0.2s', marginTop: 4 }}>
          Get started <span style={{ transform: hovH ? 'translateX(4px)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>→</span>
        </div>
      </div>
      <div style={cardStyle(hovP)} onClick={() => onMode('patient')} onMouseEnter={() => setHovP(true)} onMouseLeave={() => setHovP(false)}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: hovP ? '#15803d' : '#f6f9f6', border: '1.5px solid ' + (hovP ? '#15803d' : 'var(--border)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, transition: 'all 0.2s' }}>🧑</div>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-m)', letterSpacing: '0.12em', color: hovP ? '#15803d' : 'var(--text4)', fontWeight: 600 }}>PATIENT</div>
        <h3 style={{ fontFamily: 'var(--font-d)', fontWeight: 700, fontSize: 18, color: 'var(--dark)', lineHeight: 1.25, margin: 0 }}>I'm a Patient</h3>
        <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.65, margin: 0, flex: 1 }}>See what AI was used in your care, why it was used, and what your rights are — in plain English.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: hovP ? '#15803d' : 'var(--text4)', transition: 'all 0.2s', marginTop: 4 }}>
          Get started <span style={{ transform: hovP ? 'translateX(4px)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>→</span>
        </div>
      </div>
    </div>
  )
}



// ── BATCH DASHBOARD ─────────────────────────────────────────────────────────

const DEMO_EHR_PREVIEW = {
  filename: 'ClearPath_Demo_EHR_Export.csv',
  parsed: 25,
  columns: ['MRN','ADM_ID','FIRST_NAME','LAST_NAME','DEPARTMENT','ICD10_DESC','AI_TOOLS_ACTIVE'],
  preview_rows: [
    {mrn:'MRN-99001',adm_id:'ADM-00098',first_name:'Demo',   last_name:'Patient',  department:'ICU',       icd10_desc:'Sepsis monitoring — ICU stay',       admission_date:'2025-01-15',ai_tools_used:'["epic_sepsis_model","chatgpt_clinical","billing_coding_ai"]'},
    {mrn:'MRN-84721',adm_id:'ADM-00142',first_name:'James',  last_name:'Okafor',   department:'Radiology', icd10_desc:'Chest mass screening, suspected CA',  admission_date:'2025-02-14',ai_tools_used:'["radiology_ai_cad","billing_coding_ai"]'},
    {mrn:'MRN-63021',adm_id:'ADM-00211',first_name:'Maria',  last_name:'Santos',   department:'Cardiology',icd10_desc:'Atrial fibrillation management',       admission_date:'2025-02-20',ai_tools_used:'["ehr_predictive_analytics","nuance_dax"]'},
    {mrn:'MRN-51293',adm_id:'ADM-00334',first_name:'Robert', last_name:'Chen',     department:'Oncology',  icd10_desc:'Lung cancer follow-up',               admission_date:'2025-03-01',ai_tools_used:'["radiology_ai_cad","viz_ai"]'},
    {mrn:'MRN-29847',adm_id:'ADM-00445',first_name:'Lisa',   last_name:'Thompson', department:'Emergency', icd10_desc:'Chest pain, acute onset',              admission_date:'2025-03-10',ai_tools_used:'["epic_sepsis_model","chatgpt_clinical"]'},
  ],
  errors: [],
}

const MONITOR_TICKER = [
  { color:'#dc2626', text:'CRITICAL · ADM-01880 · Dorothy Hernandez · ChatGPT exposure — no BAA on file' },
  { color:'#d97706', text:'ACTION · ADM-01746 · Betty Allen · Disclosure notice due in 3 days' },
  { color:'#2563eb', text:'SCAN · ADM-01813 · Mark Young · EHR Predictive Analytics active — consent pending' },
  { color:'#15803d', text:'SENT · ADM-01612 · Karen Walker · Disclosure letter delivered via patient portal' },
  { color:'#d97706', text:'REVIEW · ADM-01679 · Steven Hall · Billing AI claim — human sign-off required' },
  { color:'#dc2626', text:'CRITICAL · ADM-01478 · Nancy Lewis · Prior Auth AI denial — escalated to legal' },
  { color:'#15803d', text:'RESOLVED · ADM-01545 · Paul Lee · Epic Sepsis alert reviewed by attending' },
  { color:'#7c3aed', text:'ESCALATED · ADM-01334 · Dorothy Garcia · Ambient AI session — state law review needed' },
  { color:'#2563eb', text:'SCAN · ADM-00234 · Joseph Martin · Viz.ai stroke detection active — governance check queued' },
  { color:'#d97706', text:'ACTION · ADM-01198 · Susan Harris · Radiology AI 510(k) documentation missing' },
]

function BatchDashboard({ user, onBack, onPatientReport }) {
  const [patients, setPatients]       = useState([])
  const [loading, setLoading]         = useState(false)
  const [uploading, setUploading]     = useState(false)
  const [confirming, setConfirming]   = useState(false)
  const [delta, setDelta]             = useState(null)
  const [triage, setTriage]           = useState(null)
  const [uploadInfo, setUploadInfo]   = useState(null)
  const [filter, setFilter]           = useState('all')
  const [search, setSearch]           = useState('')
  const [selected, setSelected]       = useState(new Set())
  const [expandedRow, setExpandedRow] = useState(null)
  const [stepUnlocked, setStepUnlocked] = useState(1)
  const [uploadPhase, setUploadPhase]   = useState(null)
  const [inlinePreview, setInlinePreview] = useState(null)
  const [statCounts, setStatCounts]   = useState({ critical:0, overdue:0, pending:0, escalated:0, compliant:0, total:0 })
  const [rowsVisible, setRowsVisible] = useState(0)
  const [toast, setToast]             = useState(null)
  const [tickerIdx, setTickerIdx]     = useState(0)
  const [tickerVisible, setTickerVisible] = useState(true)

  const STATUS_CFG = {
    needs_review:       { label:'Needs Review',       color:'#dc2626', bg:'#fef2f2', border:'#fecaca' },
    disclosure_pending: { label:'Disclosure Pending', color:'#d97706', bg:'#fffbeb', border:'#fde68a' },
    disclosure_sent:    { label:'Disclosure Sent',    color:'#15803d', bg:'#f0fdf4', border:'#bbf7d0' },
    escalated:          { label:'Escalated to Legal', color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe' },
    compliant:          { label:'Compliant',          color:'#15803d', bg:'#f0fdf4', border:'#bbf7d0' },
  }

  const load = async () => {
    setLoading(true)
    try {
      const [pRes, dRes, tRes] = await Promise.all([
        fetch(API + '/api/patients/' + user.npi),
        fetch(API + '/api/batch/delta/' + user.npi),
        fetch(API + '/api/batch/triage/' + user.npi),
      ])
      const pd = await pRes.json(); const dd = await dRes.json(); const td = await tRes.json()
      setPatients(pd.patients || [])
      setDelta(dd.has_delta ? dd : null)
      setTriage(td?.total !== undefined ? td : null)
    } catch(e) { console.error(e) }
    setLoading(false)
  }


  const handleUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    setUploadPhase('Parsing ' + file.name + '...')
    try {
      const fd = new FormData()
      fd.append('file',file); fd.append('hospital_npi',user.npi); fd.append('hospital_name',user.hospital)
      fd.append('confirmed_tools',JSON.stringify(user.confirmed_tools||[])); fd.append('run_compliance','false')
      const res = await fetch(API + '/api/batch/upload',{method:'POST',body:fd})
      const data = await res.json()
      if (data.success) {
        setUploadPhase('Found ' + data.parsed + ' encounters · ' + (data.columns_detected?.length||0) + ' columns detected')
        await new Promise(r => setTimeout(r, 700))
        setInlinePreview({filename:data.filename,parsed:data.parsed,columns:data.columns_detected,preview_rows:data.preview,errors:data.errors})
        setStepUnlocked(3)
        setUploadPhase(null)
      } else { alert('Parse error: '+(data.detail||'Unknown')); setUploadPhase(null) }
    } catch(e) { alert('Upload error: '+e.message); setUploadPhase(null) }
    setUploading(false); e.target.value = ''
  }

  const loadDemoData = async () => {
    setUploading(true)
    setUploadPhase('Seeding 25 EHR encounter records...')
    try {
      await fetch(API + '/api/patients/seed',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({hospital_npi:user.npi,hospital_name:user.hospital,hospital_type:'academic_medical_center',n:25})})
      setUploadPhase('Found 25 encounters · 4 AI tool types · 6 departments · running pre-scan...')
      await new Promise(r => setTimeout(r, 900))
      setInlinePreview(DEMO_EHR_PREVIEW)
      setStepUnlocked(3)
    } catch(e) { alert('Error: '+e.message) }
    setUploading(false); setUploadPhase(null)
  }

  const runComplianceAndReveal = async () => {
    setConfirming(true)
    try {
      await fetch(API + '/api/batch/run',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({hospital_npi:user.npi,confirmed_tools:user.confirmed_tools||[]})})
      setUploadInfo({filename:inlinePreview?.filename||'EHR Upload',parsed:inlinePreview?.parsed||25,errors:[]})
      setInlinePreview(null); setStepUnlocked(1); await load()
    } catch(e) { alert('Error: '+e.message) }
    setConfirming(false)
  }

  const updateStatus = async (patientId, status) => {
    await fetch(API + '/api/patients/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patient_id:patientId,status})})
    setPatients(ps => ps.map(p => p.id===patientId ? {...p,workflow_status:status} : p))
    const cfg = STATUS_CFG[status]
    setToast({ msg: cfg?.label + ' — status updated', color: cfg?.color||'#15803d', bg: cfg?.bg||'#f0fdf4', border: cfg?.border||'#bbf7d0' })
    setTimeout(() => setToast(null), 2800)
    fetch(API + '/api/batch/triage/' + user.npi).then(r=>r.json()).then(td=>{ if(td?.total!==undefined) setTriage(td) })
  }

  const bulkUpdate = async (status) => {
    if (selected.size===0) return
    await fetch(API + '/api/patients/bulk-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patient_ids:[...selected],status})})
    setPatients(ps => ps.map(p => selected.has(p.id) ? {...p,workflow_status:status} : p))
    setSelected(new Set())
    fetch(API + '/api/batch/triage/' + user.npi).then(r=>r.json()).then(td=>{ if(td?.total!==undefined) setTriage(td) })
  }

  useEffect(() => { load() }, [])

  // Count-up animation for triage stat cards
  useEffect(() => {
    if (!triage) return
    const targets = { critical:triage.critical||0, overdue:triage.overdue_disclosure||0, pending:triage.pending_disclosure||0, escalated:triage.escalated||0, compliant:(triage.sent_disclosure||0)+(triage.compliant||0), total:triage.total||0 }
    const start = Date.now(); const duration = 900
    const tick = () => {
      const p = Math.min((Date.now()-start)/duration, 1); const ease = 1-Math.pow(1-p,3)
      setStatCounts({ critical:Math.round(targets.critical*ease), overdue:Math.round(targets.overdue*ease), pending:Math.round(targets.pending*ease), escalated:Math.round(targets.escalated*ease), compliant:Math.round(targets.compliant*ease), total:Math.round(targets.total*ease) })
      if (p<1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [triage])

  // Staggered row entrance when list loads
  useEffect(() => {
    setRowsVisible(0)
    if (!loading) {
      const t = setInterval(() => setRowsVisible(v => { if (v >= 50) { clearInterval(t); return v } return v+1 }), 28)
      return () => clearInterval(t)
    }
  }, [loading, filter, search])

  // Live activity ticker — cycles every 4s
  useEffect(() => {
    const iv = setInterval(() => {
      setTickerVisible(false)
      setTimeout(() => { setTickerIdx(i => (i+1) % MONITOR_TICKER.length); setTickerVisible(true) }, 350)
    }, 4000)
    return () => clearInterval(iv)
  }, [])

  const filtered = patients
    .filter(p => {
      const ws = p.workflow_status||'needs_review'
      const mF = filter==='all'||p.risk_level===filter||p.disclosure_status===filter||ws===filter
      const mS = !search||p.first_name + ' ' + p.last_name + ' ' + p.mrn + ' ' + p.adm_id + ' ' + p.icd10_desc + ' ' + p.department.toLowerCase().includes(search.toLowerCase())
      return mF && mS
    })
    .sort((a,b) => ({critical:0,high:1,medium:2,low:3}[a.risk_level]||2)-({critical:0,high:1,medium:2,low:3}[b.risk_level]||2))

  const rC  = r => r==='critical'?'#dc2626':r==='high'?'#d97706':r==='medium'?'#2563eb':'#15803d'
  const rBg = r => r==='critical'?'#fef2f2':r==='high'?'#fffbeb':r==='medium'?'#eff6ff':'#f0fdf4'
  const rBd = r => r==='critical'?'#fecaca':r==='high'?'#fde68a':r==='medium'?'#bfdbfe':'#bbf7d0'
  const allSel = filtered.length>0 && filtered.every(p=>selected.has(p.id))

  return (
    <div style={{minHeight:'100vh',background:'#fff',display:'flex',flexDirection:'column',position:'relative'}}>

      {/* Toast notification */}
      {toast&&(
        <div style={{position:'fixed',bottom:28,right:28,zIndex:9999,padding:'12px 20px',borderRadius:10,background:toast.bg,border:'1.5px solid '+toast.border,boxShadow:'0 8px 32px rgba(0,0,0,0.12)',display:'flex',alignItems:'center',gap:10,animation:'slideInUp 0.25s ease, fadeIn 0.25s ease',minWidth:260}}>
          <div style={{width:8,height:8,borderRadius:'50%',background:toast.color,flexShrink:0}}/>
          <span style={{fontSize:13,fontWeight:600,color:toast.color,fontFamily:'var(--font-b)'}}>{toast.msg}</span>
        </div>
      )}

      <div style={{background:'#0c110c',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 32px',flexShrink:0,position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <button onClick={onBack} style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:13,fontFamily:'var(--font-b)'}}>← Hub</button>
          <div style={{width:1,height:16,background:'rgba(255,255,255,0.15)'}}/>
          <ClearPathLogo size="sm"/>
          <div style={{width:1,height:16,background:'rgba(255,255,255,0.15)'}}/>
          <span style={{fontSize:12,color:'rgba(255,255,255,0.5)',fontFamily:'var(--font-m)',letterSpacing:'0.06em'}}>PATIENT ENCOUNTER MONITOR</span>
          {delta&&<div style={{display:'flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:5,background:delta.improved?'rgba(74,222,128,0.12)':'rgba(248,113,113,0.12)',border:'1px solid '+(delta.improved?'rgba(74,222,128,0.25)':'rgba(248,113,113,0.25)')}}>
            <span style={{fontSize:11,color:delta.improved?'#4ade80':'#f87171'}}>{delta.improved?'↑':'↓'}</span>
            <span style={{fontSize:10,fontFamily:'var(--font-m)',color:delta.improved?'#4ade80':'#f87171'}}>{delta.score_change>0?'+':''}{delta.score_change} avg since {delta.previous_date}</span>
          </div>}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {selected.size>0&&(
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 12px',borderRadius:6,background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)'}}>
              <span style={{fontSize:10,color:'rgba(255,255,255,0.5)',fontFamily:'var(--font-m)'}}>{selected.size} selected</span>
              {[['disclosure_sent','✓ Sent','#4ade80'],['disclosure_pending','◷ Pending','#fbbf24'],['escalated','⚠ Escalate','#c084fc'],['compliant','✓ Compliant','#4ade80']].map(([s,l,col])=>(
                <button key={s} onClick={()=>bulkUpdate(s)} style={{padding:'4px 9px',borderRadius:4,border:'none',background:'rgba(255,255,255,0.08)',color:col,fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'var(--font-m)'}}>{l}</button>
              ))}
              <button onClick={()=>setSelected(new Set())} style={{background:'none',border:'none',color:'rgba(255,255,255,0.3)',cursor:'pointer',fontSize:12}}>✕</button>
            </div>
          )}
          <a href={API + '/api/batch/template/download'} target="_blank" style={{padding:'6px 11px',borderRadius:6,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',color:'rgba(255,255,255,0.55)',fontSize:10,textDecoration:'none',fontFamily:'var(--font-m)'}}>↓ Template</a>
          <label style={{padding:'6px 12px',borderRadius:6,background:'#15803d',color:'#fff',cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:'var(--font-m)',display:'flex',alignItems:'center',gap:5}}>
            {uploading?<><AnimDots/>Parsing...</>:<>↑ Upload EHR</>}
            <input type="file" accept=".csv,.xlsx,.xls,.json" onChange={handleUpload} style={{display:'none'}} disabled={uploading}/>
          </label>
        </div>
      </div>

      {/* Live activity ticker */}
      <div style={{background:'#0c110c',borderBottom:'1px solid rgba(255,255,255,0.07)',padding:'6px 32px',display:'flex',alignItems:'center',gap:12,flexShrink:0,overflow:'hidden',position:'relative'}}>
        <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,overflow:'hidden',pointerEvents:'none'}}>
          <div style={{position:'absolute',top:0,bottom:0,width:60,background:'linear-gradient(90deg,transparent,rgba(21,128,61,0.06),transparent)',animation:'scanLine 6s linear infinite'}}/>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
          <div style={{width:5,height:5,borderRadius:'50%',background:'#4ade80',animation:'glowPulse 2s ease infinite'}}/>
          <span style={{fontSize:9,fontFamily:'var(--font-m)',color:'rgba(255,255,255,0.3)',letterSpacing:'0.1em'}}>LIVE</span>
        </div>
        <div style={{width:1,height:12,background:'rgba(255,255,255,0.1)',flexShrink:0}}/>
        <div style={{flex:1,overflow:'hidden',height:16,position:'relative'}}>
          <div style={{
            position:'absolute',top:0,left:0,right:0,
            opacity: tickerVisible ? 1 : 0,
            transform: tickerVisible ? 'translateY(0)' : 'translateY(6px)',
            transition: 'opacity 0.3s ease, transform 0.3s ease',
            display:'flex',alignItems:'center',gap:8,
          }}>
            <span style={{fontSize:9,padding:'1px 6px',borderRadius:3,background:'rgba(255,255,255,0.07)',color:MONITOR_TICKER[tickerIdx].color,fontFamily:'var(--font-m)',fontWeight:700,flexShrink:0}}>
              {MONITOR_TICKER[tickerIdx].text.split('·')[0].trim()}
            </span>
            <span style={{fontSize:10,color:'rgba(255,255,255,0.45)',fontFamily:'var(--font-m)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {MONITOR_TICKER[tickerIdx].text.split('·').slice(1).join('·')}
            </span>
          </div>
        </div>
        <span style={{fontSize:9,color:'rgba(255,255,255,0.2)',fontFamily:'var(--font-m)',flexShrink:0}}>{new Date().toLocaleTimeString()}</span>
      </div>

      {triage&&triage.total>0&&(
        <div style={{background:'#fff',borderBottom:'1px solid var(--border)',padding:'14px 32px',display:'flex',gap:10,flexShrink:0}}>
          {[
            {label:'CRITICAL RISK',      val:statCounts.critical,  color:'#dc2626',bg:'#fef2f2',border:'#fecaca',f:'critical', sub:'Immediate action',   pulse:statCounts.critical>0},
            {label:'DISCLOSURE OVERDUE', val:statCounts.overdue,   color:'#dc2626',bg:'#fef2f2',border:'#fecaca',f:'overdue',  sub:'>30 days overdue',   pulse:statCounts.overdue>0},
            {label:'DISCLOSURE PENDING', val:statCounts.pending,   color:'#d97706',bg:'#fffbeb',border:'#fde68a',f:'pending',  sub:'Must send notice',   pulse:false},
            {label:'ESCALATED',          val:statCounts.escalated, color:'#7c3aed',bg:'#f5f3ff',border:'#ddd6fe',f:'escalated',sub:'Legal review',        pulse:false},
            {label:'COMPLIANT',          val:statCounts.compliant, color:'#15803d',bg:'#f0fdf4',border:'#bbf7d0',f:'all',      sub:'No action needed',   pulse:false},
            {label:'TOTAL',              val:statCounts.total,     color:'#0c110c',bg:'#f8faf8',border:'rgba(0,0,0,0.08)',f:'all',sub:'All encounters',   pulse:false},
          ].map((s,i)=>(
            <div key={s.label} onClick={()=>setFilter(f=>f===s.f&&s.f!=='all'?'all':s.f)}
              style={{flex:'1',padding:'10px 14px',borderRadius:9,background:filter===s.f?s.bg:'#fafafa',border:'1.5px solid '+(filter===s.f?s.border:'rgba(0,0,0,0.07)'),cursor:'pointer',transition:'all 0.2s',textAlign:'center',
                animation:`slideInUp 0.35s ease ${i*0.06}s both`,
                boxShadow:filter===s.f?'0 2px 12px rgba(0,0,0,0.06)':'none',
                transform:filter===s.f?'translateY(-1px)':'none',
              }}>
              <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:5,marginBottom:3}}>
                <div style={{fontSize:26,fontWeight:800,fontFamily:'var(--font-d)',color:filter===s.f?s.color:'var(--text2)',lineHeight:1}}>{s.val}</div>
                {s.pulse&&<div style={{width:6,height:6,borderRadius:'50%',background:s.color,animation:'pulse 1.4s ease infinite',flexShrink:0}}/>}
              </div>
              <div style={{fontSize:8,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.07em',marginBottom:1}}>{s.label}</div>
              <div style={{fontSize:9,color:'var(--text3)'}}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {uploadInfo&&(
        <div style={{background:'#f0fdf4',borderBottom:'1px solid #bbf7d0',padding:'9px 32px',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <span style={{color:'#15803d',fontWeight:700}}>✓</span>
          <span style={{fontSize:12,fontWeight:600,color:'#15803d'}}>{uploadInfo.filename}</span>
          <span style={{fontSize:12,color:'var(--text3)'}}>{uploadInfo.parsed} encounters imported and analyzed</span>
          {uploadInfo.errors?.length>0&&<span style={{fontSize:11,color:'#d97706'}}>{uploadInfo.errors.length} rows skipped</span>}
          <button onClick={()=>setUploadInfo(null)} style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:'var(--text3)'}}>×</button>
        </div>
      )}

      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'10px 20px',borderBottom:'1px solid var(--border)',background:'#fff',display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search patient, MRN, diagnosis, department..."
              style={{flex:1,padding:'7px 12px',borderRadius:6,border:'1.5px solid var(--border)',fontSize:12,fontFamily:'var(--font-b)',outline:'none',background:'#fafafa'}}/>
            <div style={{display:'flex',gap:4}}>
              {[['all','All'],['critical','Critical'],['high','High'],['needs_review','Needs Review'],['disclosure_sent','Sent']].map(([f,l])=>(
                <button key={f} onClick={()=>setFilter(f)} style={{padding:'5px 9px',borderRadius:5,border:'1.5px solid '+(filter===f?'#15803d':'var(--border)'),background:filter===f?'#f0fdf4':'#fff',color:filter===f?'#15803d':'var(--text4)',fontSize:9,fontWeight:700,cursor:'pointer',fontFamily:'var(--font-m)'}}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'28px 1fr 130px 70px 90px 130px',padding:'7px 20px',borderBottom:'1px solid var(--border)',background:'#f8faf8',flexShrink:0}}>
            <div><input type="checkbox" checked={allSel} onChange={()=>setSelected(allSel?new Set():new Set(filtered.map(p=>p.id)))} style={{accentColor:'#15803d',width:12,height:12}}/></div>
            {['PATIENT / ENCOUNTER','DIAGNOSIS','RISK','TOOLS','WORKFLOW STATUS'].map(h=>(
              <div key={h} style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.07em',fontWeight:700}}>{h}</div>
            ))}
          </div>
          <div style={{flex:1,overflowY:'auto'}}>
            {loading?(
              <div style={{padding:'0 20px'}}>
                {Array(8).fill(0).map((_,i)=>(
                  <div key={i} style={{display:'grid',gridTemplateColumns:'28px 1fr 130px 70px 90px 130px',padding:'14px 0',borderBottom:'1px solid var(--border)',gap:8,alignItems:'center',opacity:1-i*0.1}}>
                    {[16,'45%','22%',54,36,90].map((w,j)=>(
                      <div key={j} style={{height:j===1?14:10,borderRadius:4,width:typeof w==='number'?w:w,background:'linear-gradient(90deg,#f3f4f6 25%,#e9eaec 50%,#f3f4f6 75%)',backgroundSize:'400px 100%',animation:`shimmer 1.4s ease infinite`,animationDelay:i*0.07+'s'}}/>
                    ))}
                  </div>
                ))}
              </div>
            ):filtered.length===0?(
              <div style={{padding:'40px 48px',maxWidth:860,margin:'0 auto'}}>

                {/* Header */}
                <div style={{marginBottom:32}}>
                  <div style={{fontSize:11,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.1em',marginBottom:8}}>PATIENT ENCOUNTER MONITOR</div>
                  <h2 style={{fontFamily:'var(--font-d)',fontWeight:800,fontSize:26,letterSpacing:'-0.02em',marginBottom:8}}>No encounters loaded yet</h2>
                  <p style={{fontSize:13,color:'var(--text3)',lineHeight:1.7,maxWidth:540}}>Upload your hospital's EHR encounter data to start monitoring AI governance obligations across your patient population. Follow the steps below to get started.</p>
                </div>

                {/* 3-step progressive workflow */}
                <div style={{display:'flex',alignItems:'stretch',gap:0,marginBottom:inlinePreview?16:32}}>

                  {/* Step 1 */}
                  {(()=>{
                    const active = stepUnlocked >= 1
                    return (
                      <div style={{flex:1,padding:'24px',borderRadius:12,background:'#fff',border:'1.5px solid '+(active?'#15803d':'var(--border)'),position:'relative',display:'flex',flexDirection:'column'}}>
                        <div style={{position:'absolute',top:'-11px',left:24,background:active?'#15803d':'#9ca3af',color:'#fff',fontSize:10,fontFamily:'var(--font-m)',fontWeight:700,padding:'2px 10px',borderRadius:99,letterSpacing:'0.06em'}}>STEP 1</div>
                        <div style={{fontSize:22,marginBottom:10}}>📥</div>
                        <div style={{fontSize:14,fontWeight:700,color:'var(--dark)',marginBottom:6}}>Download the template</div>
                        <div style={{fontSize:12,color:'var(--text3)',lineHeight:1.6,marginBottom:'auto',paddingBottom:16}}>Get our pre-formatted EHR export template. It mirrors real Epic/Cerner export format with the correct column headers.</div>
                        <a href={API+'/api/batch/template/download'} target="_blank"
                          onClick={()=>setStepUnlocked(v=>Math.max(v,2))}
                          style={{display:'inline-flex',alignItems:'center',gap:6,padding:'9px 16px',borderRadius:7,background:'#0c110c',color:'#fff',fontSize:12,fontWeight:600,fontFamily:'var(--font-b)',textDecoration:'none',alignSelf:'flex-start'}}>
                          ↓ Download Template
                        </a>
                        <div style={{marginTop:10,fontSize:10,color:'var(--text4)',fontFamily:'var(--font-m)'}}>Excel · CSV · JSON supported</div>
                        {stepUnlocked<2&&<div style={{marginTop:8,fontSize:10,color:'#15803d',fontFamily:'var(--font-m)',fontWeight:600}}>Click to unlock Step 2</div>}
                      </div>
                    )
                  })()}

                  {/* Connector */}
                  <div style={{display:'flex',alignItems:'center',padding:'0 10px',paddingTop:32}}>
                    <span style={{fontSize:18,color:stepUnlocked>=2?'#15803d':'#d1d5db',transition:'color 0.3s'}}>→</span>
                  </div>

                  {/* Step 2 */}
                  {(()=>{
                    const active = stepUnlocked >= 2
                    return (
                      <div style={{flex:1,padding:'24px',borderRadius:12,background:active?'#fff':'#fafafa',border:'1.5px solid '+(inlinePreview?'#15803d':active?'#0c110c':'var(--border)'),position:'relative',display:'flex',flexDirection:'column',opacity:active?1:0.55,transition:'all 0.3s'}}>
                        <div style={{position:'absolute',top:'-11px',left:24,background:inlinePreview?'#15803d':active?'#0c110c':'#9ca3af',color:'#fff',fontSize:10,fontFamily:'var(--font-m)',fontWeight:700,padding:'2px 10px',borderRadius:99,letterSpacing:'0.06em'}}>
                          {inlinePreview?'✓ STEP 2':'STEP 2'}
                        </div>
                        <div style={{fontSize:22,marginBottom:10}}>📤</div>
                        <div style={{fontSize:14,fontWeight:700,color:'var(--dark)',marginBottom:6}}>Upload your encounter data</div>
                        <div style={{fontSize:12,color:'var(--text3)',lineHeight:1.6,marginBottom:8}}>Upload your filled template or load the demo dataset. Key columns: MRN, ICD-10 code, AI tools active, admission date.</div>
                        {active&&!inlinePreview&&!uploadPhase&&<a href={API+'/api/batch/sample/download'} target="_blank" style={{fontSize:11,color:'#2563eb',fontFamily:'var(--font-m)',marginBottom:12,display:'inline-block',textDecoration:'underline'}}>↓ Download pre-filled sample (25 rows)</a>}
                        <div style={{paddingBottom:8}}></div>
                        {uploadPhase?(
                          <div style={{padding:'9px 14px',borderRadius:7,background:'#f0fdf4',border:'1.5px solid #bbf7d0',fontSize:11,color:'#15803d',fontFamily:'var(--font-m)',display:'flex',alignItems:'center',gap:6}}>
                            <AnimDots/>{uploadPhase}
                          </div>
                        ):inlinePreview?(
                          <div style={{padding:'8px 12px',borderRadius:6,background:'#f0fdf4',border:'1px solid #bbf7d0',fontSize:11,color:'#15803d',fontFamily:'var(--font-m)',fontWeight:600}}>
                            ✓ {inlinePreview.parsed} encounters parsed — {inlinePreview.filename}
                          </div>
                        ):(
                          <div style={{display:'flex',flexDirection:'column',gap:8,alignSelf:'flex-start',width:'100%'}}>
                            <label style={{display:'inline-flex',alignItems:'center',gap:6,padding:'9px 16px',borderRadius:7,background:active?'#15803d':'#e5e7eb',color:'#fff',fontSize:12,fontWeight:600,fontFamily:'var(--font-b)',cursor:active?'pointer':'not-allowed',pointerEvents:active?'auto':'none',alignSelf:'flex-start'}}>
                              ↑ Upload EHR File
                              <input type="file" accept=".csv,.xlsx,.xls,.json" onChange={handleUpload} style={{display:'none'}} disabled={!active||uploading}/>
                            </label>
                            {active&&<button onClick={loadDemoData} disabled={uploading} style={{padding:'8px 14px',borderRadius:7,border:'1.5px solid #15803d',background:'transparent',color:'#15803d',fontSize:11,fontWeight:600,fontFamily:'var(--font-b)',cursor:'pointer',alignSelf:'flex-start'}}>
                              ⟳ Use Demo Data
                            </button>}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Connector */}
                  <div style={{display:'flex',alignItems:'center',padding:'0 10px',paddingTop:32}}>
                    <span style={{fontSize:18,color:stepUnlocked>=3?'#15803d':'#d1d5db',transition:'color 0.3s'}}>→</span>
                  </div>

                  {/* Step 3 */}
                  {(()=>{
                    const active = stepUnlocked >= 3
                    return (
                      <div style={{flex:1,padding:'24px',borderRadius:12,background:active?'#fff':'#fafafa',border:'1.5px solid '+(active?'#15803d':'var(--border)'),position:'relative',display:'flex',flexDirection:'column',opacity:active?1:0.55,transition:'all 0.3s'}}>
                        <div style={{position:'absolute',top:'-11px',left:24,background:active?'#15803d':'#9ca3af',color:'#fff',fontSize:10,fontFamily:'var(--font-m)',fontWeight:700,padding:'2px 10px',borderRadius:99,letterSpacing:'0.06em'}}>STEP 3</div>
                        <div style={{fontSize:22,marginBottom:10}}>⚖️</div>
                        <div style={{fontSize:14,fontWeight:700,color:'var(--dark)',marginBottom:6}}>Review compliance findings</div>
                        <div style={{fontSize:12,color:'var(--text3)',lineHeight:1.6,marginBottom:'auto',paddingBottom:16}}>ClearPath runs rule-based compliance on every encounter. Findings sorted by urgency. Update workflow status, escalate, or generate patient reports.</div>
                        {active?(
                          <button onClick={runComplianceAndReveal} disabled={confirming}
                            style={{display:'inline-flex',alignItems:'center',gap:6,padding:'9px 16px',borderRadius:7,background:confirming?'#e5e7eb':'#15803d',color:'#fff',fontSize:12,fontWeight:700,fontFamily:'var(--font-b)',border:'none',cursor:confirming?'wait':'pointer',alignSelf:'flex-start'}}>
                            {confirming?<><AnimDots/>Running compliance...</>:'Review Compliance Findings →'}
                          </button>
                        ):(
                          <div style={{padding:'8px 12px',borderRadius:6,background:'#f8faf8',border:'1px solid var(--border)',fontSize:11,color:'var(--text4)',fontFamily:'var(--font-m)'}}>Available after upload</div>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {/* Inline preview — slides in after upload */}
                {inlinePreview&&(
                  <div style={{background:'#fff',border:'1.5px solid #15803d',borderRadius:12,overflow:'hidden',marginBottom:32,animation:'fadeUp 0.25s ease'}}>
                    <div style={{padding:'12px 20px',borderBottom:'1px solid var(--border)',background:'#f0fdf4',display:'flex',alignItems:'center',gap:10}}>
                      <span style={{fontSize:11,fontFamily:'var(--font-m)',color:'#15803d',letterSpacing:'0.08em',fontWeight:700}}>LIVE PREVIEW — {inlinePreview.filename}</span>
                      <span style={{fontSize:11,color:'#15803d',marginLeft:'auto'}}>{inlinePreview.parsed} encounters · {inlinePreview.columns?.length||0} columns detected</span>
                    </div>
                    <div style={{padding:'8px 12px',borderBottom:'1px solid var(--border)',background:'#fafafa',display:'flex',gap:5,flexWrap:'wrap'}}>
                      {(inlinePreview.columns||[]).map(col=>{
                        const isKey=['mrn','adm_id','icd10_primary','ai_tools_used','ai_tools_active'].includes(col?.toLowerCase())
                        return <span key={col} style={{padding:'2px 8px',borderRadius:4,border:'1px solid '+(isKey?'#15803d':'rgba(0,0,0,0.08)'),background:isKey?'#f0fdf4':'#fff',fontSize:9,fontFamily:'var(--font-m)',fontWeight:600,color:isKey?'#15803d':'var(--text3)'}}>{isKey?'★ ':''}{col?.toUpperCase()}</span>
                      })}
                    </div>
                    <div style={{overflowX:'auto'}}>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                        <thead><tr style={{borderBottom:'1px solid var(--border)',background:'#fafafa'}}>
                          {['MRN','Name','Admitted','Department','Diagnosis','AI Tools'].map(h=><th key={h} style={{padding:'7px 14px',textAlign:'left',fontFamily:'var(--font-m)',color:'var(--text4)',fontSize:9,letterSpacing:'0.07em',whiteSpace:'nowrap'}}>{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {(inlinePreview.preview_rows||[]).map((row,i)=>{
                            const tools=(()=>{try{return JSON.parse(row.ai_tools_used||'[]')}catch{return[]}})()
                            return <tr key={i} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'#fff':'#fafafa'}}>
                              <td style={{padding:'8px 14px',fontFamily:'var(--font-m)',color:'#15803d',fontWeight:600,whiteSpace:'nowrap'}}>{row.mrn}</td>
                              <td style={{padding:'8px 14px',whiteSpace:'nowrap'}}>{row.first_name} {row.last_name}</td>
                              <td style={{padding:'8px 14px',color:'var(--text3)',whiteSpace:'nowrap'}}>{row.admission_date}</td>
                              <td style={{padding:'8px 14px',color:'var(--text2)',whiteSpace:'nowrap'}}>{row.department}</td>
                              <td style={{padding:'8px 14px',maxWidth:180}}><div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.icd10_desc||row.icd10_primary}</div></td>
                              <td style={{padding:'8px 14px'}}><div style={{display:'flex',gap:3,flexWrap:'wrap'}}>{tools.slice(0,3).map(t=><span key={t} style={{fontSize:8,padding:'1px 5px',borderRadius:3,background:'#f0fdf4',border:'1px solid #bbf7d0',color:'#15803d',fontFamily:'var(--font-m)',fontWeight:600,whiteSpace:'nowrap'}}>{t.replace(/_/g,' ')}</span>)}{tools.length>3&&<span style={{fontSize:9,color:'var(--text4)'}}>+{tools.length-3}</span>}</div></td>
                            </tr>
                          })}
                        </tbody>
                      </table>
                    </div>
                    {inlinePreview.errors?.length>0&&<div style={{padding:'8px 20px',background:'#fffbeb',borderTop:'1px solid #fde68a',fontSize:11,color:'#d97706'}}>{inlinePreview.errors.length} rows skipped during parse</div>}
                  </div>
                )}
              </div>
            ):filtered.map((p,i)=>{
              const tools=JSON.parse(p.ai_tools_used||'[]'); const gaps=JSON.parse(p.governance_gaps||'[]')
              const ws=p.workflow_status||'needs_review'; const wC=STATUS_CFG[ws]||STATUS_CFG.needs_review
              const isSel=selected.has(p.id); const isExp=expandedRow===p.id
              return (
                <div key={p.id} onClick={()=>setExpandedRow(isExp?null:p.id)}
                  style={{display:'grid',gridTemplateColumns:'28px 1fr 130px 70px 90px 130px',padding:'10px 20px',borderBottom:'1px solid var(--border)',background:isExp?'#f0fdf4':isSel?'#fafff8':'#fff',cursor:'pointer',transition:'background 0.15s, box-shadow 0.15s',borderLeft:'3px solid '+(isExp?'#15803d':p.risk_level==='critical'?'#dc2626':'transparent'),
                    opacity: i < rowsVisible ? 1 : 0,
                    transform: i < rowsVisible ? 'translateX(0)' : 'translateX(-8px)',
                    transitionProperty:'background,box-shadow,opacity,transform',
                    transitionDuration:'0.15s,0.15s,0.25s,0.25s',
                    transitionTimingFunction:'ease',
                  }}
                  onMouseEnter={e=>{if(!isExp&&!isSel){e.currentTarget.style.background='#f8fdf8';e.currentTarget.style.boxShadow='inset 0 0 0 1px rgba(21,128,61,0.1)'}}}
                  onMouseLeave={e=>{e.currentTarget.style.background=isExp?'#f0fdf4':isSel?'#fafff8':'#fff';e.currentTarget.style.boxShadow='none'}}>
                  <div onClick={e=>e.stopPropagation()} style={{display:'flex',alignItems:'center'}}>
                    <input type="checkbox" checked={isSel} onChange={()=>setSelected(s=>{const n=new Set(s);n.has(p.id)?n.delete(p.id):n.add(p.id);return n})} style={{accentColor:'#15803d',width:12,height:12}}/>
                  </div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:'var(--dark)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.first_name} {p.last_name}</div>
                    <div style={{fontSize:10,color:'var(--text4)',fontFamily:'var(--font-m)'}}>{p.mrn} · {p.adm_id} · {p.admission_date}</div>
                  </div>
                  <div style={{paddingRight:8,minWidth:0}}>
                    <div style={{fontSize:11,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.icd10_desc}</div>
                    <div style={{fontSize:9,color:'var(--text4)',fontFamily:'var(--font-m)'}}>{p.department}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'center'}}>
                    <span style={{padding:'3px 7px',borderRadius:5,background:rBg(p.risk_level),border:'1px solid '+rBd(p.risk_level),color:rC(p.risk_level),fontSize:9,fontWeight:700,fontFamily:'var(--font-m)'}}>{p.risk_level?.toUpperCase()}</span>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:4}}>
                    <span style={{fontSize:16,fontWeight:800,fontFamily:'var(--font-d)',color:tools.length>3?'#dc2626':'#15803d'}}>{tools.length}</span>
                    {gaps.length>0&&<span style={{fontSize:9,color:'#d97706',fontFamily:'var(--font-m)',fontWeight:700}}>{gaps.length}⚠</span>}
                  </div>
                  <div onClick={e=>e.stopPropagation()}>
                    <select value={ws} onChange={e=>updateStatus(p.id,e.target.value)}
                      style={{fontSize:10,padding:'4px 6px',borderRadius:5,border:'1px solid '+wC.border,background:wC.bg,color:wC.color,fontFamily:'var(--font-m)',fontWeight:600,cursor:'pointer',outline:'none',width:'100%'}}>
                      {Object.entries(STATUS_CFG).map(([val,conf])=>(<option key={val} value={val}>{conf.label}</option>))}
                    </select>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right panel — Notion-style detail */}
        {expandedRow&&(()=>{
          const p=patients.find(x=>x.id===expandedRow); if(!p) return null
          const tools=JSON.parse(p.ai_tools_used||'[]'); const gaps=JSON.parse(p.governance_gaps||'[]')
          const ws=p.workflow_status||'needs_review'; const wC=STATUS_CFG[ws]||STATUS_CFG.needs_review
          return (
            <div style={{width:320,borderLeft:'1px solid var(--border)',background:'#fff',display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden',animation:'slideInLeft 0.22s ease'}}>
              <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',background:'#fafafa',display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:'var(--dark)',marginBottom:2}}>{p.first_name} {p.last_name}</div>
                  <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--font-m)'}}>{p.mrn} · {p.adm_id}</div>
                </div>
                <button onClick={()=>setExpandedRow(null)} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,color:'var(--text3)'}}>×</button>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'16px 20px'}}>
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.08em',marginBottom:6}}>WORKFLOW STATUS</div>
                  <select value={ws} onChange={e=>updateStatus(p.id,e.target.value)}
                    style={{width:'100%',padding:'8px 10px',borderRadius:7,border:'1.5px solid '+wC.border,background:wC.bg,color:wC.color,fontFamily:'var(--font-m)',fontWeight:600,cursor:'pointer',outline:'none',fontSize:12}}>
                    {Object.entries(STATUS_CFG).map(([val,conf])=>(<option key={val} value={val}>{conf.label}</option>))}
                  </select>
                </div>
                <div style={{padding:'12px',borderRadius:8,background:'#f8faf8',border:'1px solid var(--border)',marginBottom:12}}>
                  <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.08em',marginBottom:6}}>CLINICAL</div>
                  <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>{p.icd10_desc}</div>
                  <div style={{fontSize:10,color:'var(--text3)',marginBottom:2}}>{p.department}</div>
                  <div style={{fontSize:10,color:'var(--text3)'}}>DRG {p.drg||'—'} · Admitted {p.admission_date} · {p.los_days}d stay</div>
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.08em',marginBottom:6}}>RISK LEVEL</div>
                  <span style={{padding:'4px 10px',borderRadius:6,background:rBg(p.risk_level),border:'1px solid '+rBd(p.risk_level),color:rC(p.risk_level),fontSize:11,fontWeight:700,fontFamily:'var(--font-m)'}}>{p.risk_level?.toUpperCase()}</span>
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.08em',marginBottom:6}}>AI TOOLS ACTIVE ({tools.length})</div>
                  <div style={{display:'flex',flexDirection:'column',gap:4}}>
                    {tools.map(t=>{
                      const tool = TOOLS.find(x=>x.id===t)
                      const s = SEV[tool?.risk||'medium']||SEV.medium
                      return (
                        <div key={t} style={{padding:'6px 10px',borderRadius:6,background:'#f8faf8',border:'1px solid var(--border)',fontSize:11,color:'var(--text2)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:6}}>
                          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.replace(/_/g,' ').replace(/\b\w/g,x=>x.toUpperCase())}</span>
                          <span style={{fontSize:8,padding:'1px 5px',borderRadius:3,background:s.bg,color:s.color,border:'1px solid '+s.border,fontFamily:'var(--font-m)',fontWeight:700,flexShrink:0}}>{tool?.risk?.toUpperCase()||'MED'}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                {gaps.length>0&&(
                  <div style={{marginBottom:12,padding:'10px 12px',borderRadius:8,background:'#fef2f2',border:'1px solid #fecaca'}}>
                    <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'#dc2626',letterSpacing:'0.08em',marginBottom:6}}>GOVERNANCE GAPS</div>
                    {gaps.map((g,i)=><div key={i} style={{fontSize:11,color:'#dc2626',marginBottom:3,display:'flex',gap:5}}><span>✗</span><span>{g}</span></div>)}
                  </div>
                )}
                {p.clinical_notes&&(
                  <div style={{padding:'10px 12px',borderRadius:8,background:'#fffbeb',border:'1px solid #fde68a',marginBottom:12}}>
                    <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'#d97706',letterSpacing:'0.08em',marginBottom:4}}>NOTES</div>
                    <div style={{fontSize:11,color:'var(--text2)',lineHeight:1.5}}>{p.clinical_notes}</div>
                  </div>
                )}
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  <button onClick={()=>onPatientReport(p)} style={{padding:'9px',borderRadius:8,background:'#15803d',color:'#fff',border:'none',cursor:'pointer',fontFamily:'var(--font-b)',fontWeight:600,fontSize:12,width:'100%'}}>Generate Patient Report →</button>
                  {[['disclosure_sent','✓ Mark Disclosure Sent'],['escalated','⚠ Escalate to Legal'],['compliant','✓ Mark Compliant']].map(([s,l])=>(
                    <button key={s} onClick={()=>updateStatus(p.id,s)}
                      style={{padding:'8px',borderRadius:7,background:ws===s?STATUS_CFG[s]?.bg:'#fff',border:'1.5px solid '+(ws===s?STATUS_CFG[s]?.border:'var(--border)'),color:ws===s?STATUS_CFG[s]?.color:'var(--text2)',cursor:'pointer',fontFamily:'var(--font-b)',fontSize:11,width:'100%',textAlign:'left'}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}
      </div>

    </div>
  )
}


// ── HOSPITAL HUB ────────────────────────────────────────────────────────────

const LIVE_EVENTS_POOL = [
  { sev:'high',     text:'Billing AI processed 11 claims without documented human review this shift' },
  { sev:'info',     text:'Epic Sepsis Model scored 3 new encounters in ICU — alerts fired, attending notified' },
  { sev:'medium',   text:'Nuance DAX ambient session detected in ER Bay 2 — consent check pending' },
  { sev:'critical', text:'Outbound API call to ChatGPT from clinical workstation WSTN-042 blocked' },
  { sev:'info',     text:'Radiology AI flagged 1 incidental finding in chest CT — radiologist reviewed' },
  { sev:'high',     text:'Prior Auth AI recommended denial for ADM-00312 — human review required' },
  { sev:'medium',   text:'EHR Predictive Analytics alert on 2 high-risk readmissions in cardiology' },
  { sev:'info',     text:'Bias monitoring checkpoint triggered — Epic Sepsis Model demographic report queued' },
  { sev:'high',     text:'Viz.ai stroke detection running on 4 CT scans — governance audit pending' },
  { sev:'critical', text:'Consumer LLM API key pattern detected in clinical Wi-Fi traffic log' },
  { sev:'info',     text:'Patient ADM-00187 requested AI transparency report via portal' },
  { sev:'medium',   text:'Azure OpenAI session initiated from Oncology floor without governance approval on file' },
]

function HospitalHub({ user, onMode, onBack }) {
  const [triage, setTriage]           = React.useState(null)
  const [lastScan, setLastScan]       = React.useState(null)
  const [counts, setCounts]           = React.useState({ critical:0, score:0, pending:0, ai:0, patients:0, overdue:0, escalated:0 })
  const [cardsVisible, setCardsVisible] = React.useState(0)
  const [lastUpdated, setLastUpdated] = React.useState(null)
  const [feedEntries, setFeedEntries] = React.useState([
    { h:2,   sev:'info',     text:'Nuance DAX note assistance observed in Internal Medicine ward', isNew:false },
    { h:5,   sev:'high',     text:'Billing AI override documentation missing on 3 encounters', isNew:false },
    { h:18,  sev:'high',     text:'Quarterly bias review overdue — Epic Sepsis Model (47 days past due)', isNew:false },
    { h:24,  sev:'info',     text:'Patient ADM-00098 submitted human review request via portal', isNew:false },
    { h:48,  sev:'critical', text:'ChatGPT API calls detected in clinical subnet — no BAA on file', isNew:false },
    { h:72,  sev:'medium',   text:'Optum Prior Auth: 312 denials without documented decision criteria', isNew:false },
    { h:120, sev:'info',     text:'Radiology AI FDA 510(k) compliance verified — monitoring current', isNew:false },
    { h:168, sev:'medium',   text:'EHR Predictive Analytics — patient disclosure policy not updated since 2023', isNew:false },
    { h:480, sev:'critical', text:'Ambient Clinical Intelligence deployed in 3 departments without governance approval', isNew:false },
  ])
  const feedRef    = React.useRef(null)
  const poolIdxRef = React.useRef(0)

  React.useEffect(() => {
    Promise.all([
      fetch(API + '/api/batch/triage/' + user.npi).then(r=>r.json()).catch(()=>({})),
      fetch(API + '/api/audit/history?npi=' + user.npi + '&limit=1').then(r=>r.json()).catch(()=>({})),
    ]).then(([t,h]) => {
      setTriage(t)
      setLastScan((h?.scans||[])[0]||null)
    })
  }, [])

  // Count-up animation when data arrives
  React.useEffect(() => {
    const ls = lastScan?.compliance_score ?? null
    const targets = {
      critical: triage?.critical ?? 0,
      score: ls ?? 0,
      pending: triage?.pending_disclosure ?? 0,
      ai: 8,
      patients: triage?.total ?? 0,
      overdue: triage?.overdue_disclosure ?? 0,
      escalated: triage?.escalated ?? 0,
    }
    const duration = 1100
    const start = Date.now()
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setCounts({
        critical: Math.round(targets.critical * ease),
        score: Math.round(targets.score * ease),
        pending: Math.round(targets.pending * ease),
        ai: Math.round(targets.ai * ease),
        patients: Math.round(targets.patients * ease),
        overdue: Math.round(targets.overdue * ease),
        escalated: Math.round(targets.escalated * ease),
      })
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [triage, lastScan])

  // Staggered card entrance on mount
  React.useEffect(() => {
    const t = setInterval(() => setCardsVisible(v => { if (v >= 8) { clearInterval(t); return v } return v + 1 }), 75)
    return () => clearInterval(t)
  }, [])

  // Live feed — new entry every 2 minutes
  React.useEffect(() => {
    const iv = setInterval(() => {
      const evt = LIVE_EVENTS_POOL[poolIdxRef.current % LIVE_EVENTS_POOL.length]
      poolIdxRef.current++
      setFeedEntries(prev => [{ ...evt, h:0, isNew:true }, ...prev.slice(0, 11)])
      setLastUpdated(new Date())
      if (feedRef.current) feedRef.current.scrollTop = 0
      setTimeout(() => setFeedEntries(prev => prev.map((e,i) => i===0 ? {...e, isNew:false} : e)), 3500)
    }, 2 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  const lastScanDate = lastScan?.created_at?.split('T')[0] || null
  const lastScore    = lastScan?.compliance_score ?? null
  const patientCount = triage?.total ?? 0
  const needsAction  = (triage?.critical??0) + (triage?.overdue_disclosure??0)
  const overdueMon   = triage?.overdue_disclosure ?? 0
  const escalated    = triage?.escalated ?? 0

  const statCards = [
    { label:'CRITICAL ALERTS',     val: triage ? counts.critical : '—',        color:(triage?.critical??0)>0?'#dc2626':'#15803d', bg:(triage?.critical??0)>0?'#fef2f2':'#f0fdf4', border:(triage?.critical??0)>0?'#fecaca':'#bbf7d0', pulse:(triage?.critical??0)>0 },
    { label:'COMPLIANCE SCORE',    val: lastScore!==null ? counts.score+'/100' : '—', color:lastScore===null?'var(--text3)':lastScore>=80?'#15803d':lastScore>=60?'#d97706':'#dc2626', bg:'#fff', border:'var(--border)' },
    { label:'DISCLOSURES DUE',     val: triage ? counts.pending : '—',          color:'#d97706', bg:'#fffbeb', border:'#fde68a' },
    { label:'AI SYSTEMS DETECTED', val: counts.ai,                               color:'#2563eb', bg:'#eff6ff', border:'#bfdbfe', detection:true },
    { label:'TOTAL ENCOUNTERS',    val: triage ? counts.patients : '—',         color:'var(--text2)', bg:'#fff', border:'var(--border)' },
    { label:'OVERDUE MONITORING',  val: triage ? counts.overdue : '—',          color:overdueMon>0?'#d97706':'#15803d', bg:'#fff', border:'var(--border)' },
    { label:'ESCALATED CASES',     val: triage ? counts.escalated : '—',        color:escalated>0?'#dc2626':'var(--text2)', bg:'#fff', border:'var(--border)' },
    { label:'LAST AUDIT',          val: lastScanDate||'Never',                  color:'var(--text2)', bg:'#fff', border:'var(--border)' },
  ]

  const sevColor = { critical:'#dc2626', high:'#d97706', medium:'#2563eb', info:'#6b7280' }
  const sevBg    = { critical:'#fef2f2', high:'#fffbeb', medium:'#eff6ff', info:'#f9fafb' }
  const fmtAge   = h => h===0 ? 'Just now' : h<24 ? h+'h ago' : h<48 ? 'Yesterday' : Math.floor(h/24)+'d ago'

  return (
    <div style={{minHeight:'100vh', background:'#fff'}}>

      {/* Header */}
      <div style={{background:'#0c110c',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 40px',position:'sticky',top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <button onClick={onBack} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:13,fontFamily:'var(--font-b)'}}>← Home</button>
          <div style={{width:1,height:16,background:'rgba(255,255,255,0.15)'}}/>
          <ClearPathLogo size="sm"/>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:'#4ade80',animation:'glowPulse 2s ease infinite'}}/>
            <span style={{fontSize:11,color:'rgba(255,255,255,0.5)',fontFamily:'var(--font-m)'}}>MONITORING ACTIVE</span>
          </div>
          {needsAction>0 && (
            <div style={{padding:'4px 10px',borderRadius:5,background:'rgba(220,38,38,0.2)',border:'1px solid rgba(220,38,38,0.4)',animation:'pulse 2.5s ease infinite'}}>
              <span style={{fontSize:11,color:'#f87171',fontFamily:'var(--font-m)',fontWeight:700}}>{needsAction} actions needed</span>
            </div>
          )}
          <div style={{width:1,height:16,background:'rgba(255,255,255,0.15)'}}/>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:13,fontWeight:600,color:'#fff'}}>{user.name}</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',fontFamily:'var(--font-m)'}}>{user.role}</div>
          </div>
        </div>
      </div>

      {/* Hospital banner */}
      <div style={{background:'#fff',borderBottom:'1px solid var(--border)',padding:'14px 40px',display:'flex',alignItems:'center',gap:16}}>
        <div style={{width:40,height:40,borderRadius:10,background:'#15803d',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>🏛</div>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:2}}>
            <span style={{fontFamily:'var(--font-d)',fontWeight:700,fontSize:17,color:'var(--dark)'}}>{user.hospital}</span>
            <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:99,background:'#f0fdf4',border:'1px solid #bbf7d0',fontSize:10,color:'#15803d',fontFamily:'var(--font-m)',fontWeight:700}}>
              <span style={{width:5,height:5,borderRadius:'50%',background:'#15803d',display:'inline-block'}}/>NPI VERIFIED
            </span>
          </div>
          <div style={{fontSize:12,color:'var(--text3)',fontFamily:'var(--font-m)'}}>{user.city} · NPI {user.npi} · 8 AI systems monitored · 6 departments · 30-day lookback</div>
        </div>
        {lastUpdated && (
          <div style={{fontSize:10,color:'var(--text4)',fontFamily:'var(--font-m)',textAlign:'right',animation:'fadeIn 0.4s ease'}}>
            <div style={{color:'#15803d',fontWeight:700}}>● Feed updated</div>
            <div>{lastUpdated.toLocaleTimeString()}</div>
          </div>
        )}
      </div>

      <div style={{maxWidth:1160,margin:'0 auto',padding:'28px 40px'}}>

        {/* 8 stat cards — staggered entrance + count-up */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
          {statCards.map((c,i)=>(
            <div key={c.label} style={{
              padding:'16px 18px', borderRadius:10, background:c.bg, border:'1.5px solid '+c.border,
              opacity: i < cardsVisible ? 1 : 0,
              transform: i < cardsVisible ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.97)',
              transition: 'opacity 0.3s ease, transform 0.3s ease',
              boxShadow: i < cardsVisible ? '0 1px 8px rgba(0,0,0,0.04)' : 'none',
            }}>
              <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.1em',marginBottom:6,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span>{c.label}</span>
                {c.pulse && <span style={{width:5,height:5,borderRadius:'50%',background:'#dc2626',display:'inline-block',animation:'pulse 1.4s ease infinite'}}/>}
              </div>
              <div style={{fontFamily:'var(--font-d)',fontWeight:800,fontSize:i<4?26:20,color:c.color,lineHeight:1}}>
                {c.val}
              </div>
              {c.detection && (
                <div style={{marginTop:7,display:'flex',flexDirection:'column',gap:3}}>
                  <div style={{fontSize:8,color:'var(--text4)',fontFamily:'var(--font-m)',marginBottom:2}}>DETECTED VIA</div>
                  {[['EHR Registry','#2563eb',5],['Network Traffic','#7c3aed',2],['Shadow AI','#d97706',1]].map(([lbl,col,n])=>(
                    <div key={lbl} style={{display:'flex',alignItems:'center',gap:5}}>
                      <div style={{flex:1,height:3,borderRadius:99,background:'rgba(0,0,0,0.06)',overflow:'hidden'}}>
                        <div style={{height:'100%',width:(n/8*100)+'%',background:col,borderRadius:99,transition:'width 1s ease'}}/>
                      </div>
                      <span style={{fontSize:8,color:col,fontFamily:'var(--font-m)',fontWeight:700,minWidth:6}}>{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Feed + actions */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:20}}>

          {/* Live activity feed */}
          <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
            <div style={{padding:'12px 18px',borderBottom:'1px solid var(--border)',background:'#fafafa',display:'flex',alignItems:'center',gap:8,position:'relative',overflow:'hidden'}}>
              {/* Animated scan bar */}
              <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,overflow:'hidden',pointerEvents:'none'}}>
                <div style={{position:'absolute',top:0,bottom:0,width:48,background:'linear-gradient(90deg,transparent,rgba(21,128,61,0.07),transparent)',animation:'scanLine 5s linear infinite'}}/>
              </div>
              <div style={{width:7,height:7,borderRadius:'50%',background:'#15803d',animation:'glowPulse 2s ease infinite',flexShrink:0}}/>
              <span style={{fontSize:11,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.1em'}}>LIVE MONITORING FEED</span>
              <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:10,color:'var(--text4)',fontFamily:'var(--font-m)'}}>247 events · 6 depts</span>
                <span style={{fontSize:9,padding:'2px 7px',borderRadius:99,background:'#f0fdf4',color:'#15803d',border:'1px solid #bbf7d0',fontFamily:'var(--font-m)',fontWeight:700}}>LIVE</span>
              </div>
            </div>
            <div ref={feedRef} style={{maxHeight:400,overflowY:'auto'}}>
              {feedEntries.map((e,i)=>(
                <div key={i} style={{
                  display:'flex',gap:12,padding:'11px 18px',
                  borderBottom:i<feedEntries.length-1?'1px solid var(--border)':'none',
                  alignItems:'flex-start',
                  animation: e.isNew ? 'flashNew 3.5s ease forwards, slideInUp 0.3s ease' : 'none',
                  background: e.isNew ? sevBg[e.sev] : '#fff',
                }}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:sevColor[e.sev],flexShrink:0,marginTop:5,animation:e.isNew?'pulse 1s ease 3':'none'}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:'var(--dark)',lineHeight:1.5}}>{e.text}</div>
                    <div style={{fontSize:10,color:'var(--text4)',fontFamily:'var(--font-m)',marginTop:2,display:'flex',alignItems:'center',gap:6}}>
                      <span>{fmtAge(e.h)}</span>
                      {e.isNew && <span style={{color:'#15803d',fontWeight:700,animation:'pulse 1s ease infinite'}}>● NEW</span>}
                    </div>
                  </div>
                  <span style={{fontSize:9,padding:'2px 6px',borderRadius:3,background:sevBg[e.sev],color:sevColor[e.sev],fontFamily:'var(--font-m)',fontWeight:700,flexShrink:0,alignSelf:'flex-start'}}>{e.sev.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action cards */}
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div onClick={()=>onMode('audit')}
              style={{padding:'28px 24px',borderRadius:12,background:'#fff',border:'1.5px solid var(--border)',cursor:'pointer',transition:'all 0.2s',flex:1}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='#15803d';e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(21,128,61,0.12)'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none'}}>
              <div style={{width:36,height:36,borderRadius:8,background:'#f0fdf4',border:'1.5px solid #bbf7d0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,marginBottom:14}}>⚖️</div>
              <div style={{fontFamily:'var(--font-d)',fontWeight:800,fontSize:18,color:'var(--dark)',marginBottom:6}}>Evidence Audit</div>
              <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.7,marginBottom:18}}>Review detected AI systems with forensic evidence. Map governance gaps to applicable laws.</div>
              <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:7,background:'#f0fdf4',border:'1.5px solid #bbf7d0',color:'#15803d',fontSize:12,fontWeight:700,fontFamily:'var(--font-b)'}}>Run Evidence Audit →</div>
            </div>
            <div onClick={()=>onMode('monitor')}
              style={{padding:'24px',borderRadius:12,background:'#fff',border:'1.5px solid var(--border)',cursor:'pointer',transition:'all 0.2s',flex:1}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='#15803d';e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(21,128,61,0.12)'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none'}}>
              <div style={{width:36,height:36,borderRadius:8,background:'#f0fdf4',border:'1.5px solid #bbf7d0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,marginBottom:12}}>📋</div>
              <div style={{fontFamily:'var(--font-d)',fontWeight:800,fontSize:17,color:'var(--dark)',marginBottom:4}}>Patient Monitor</div>
              <div style={{fontSize:12,color:'var(--text2)',lineHeight:1.7,marginBottom:14}}>{patientCount>0?patientCount+' encounters loaded — ':''}{needsAction>0?needsAction+' need action':'Track disclosure obligations per encounter.'}</div>
              <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 14px',borderRadius:7,background:'#f0fdf4',border:'1.5px solid #bbf7d0',color:'#15803d',fontSize:12,fontWeight:700,fontFamily:'var(--font-b)'}}>Open Monitor →</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


function HowItWorks({ onBack }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff', backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 24px, rgba(21,128,61,0.04) 24px, rgba(21,128,61,0.04) 25px)' }}>
      <nav style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(8px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <ClearPathLogo />
        <div style={{ display: 'flex', gap: 28 }}>
          {[['Landing',''], ['About','about']].map(([l, p]) => (
            <span key={l} onClick={() => onBack(p)} style={{ fontSize: 13, color: 'var(--text3)', cursor: 'pointer', fontWeight: 500 }}>{l}</span>
          ))}
        </div>
        <Btn onClick={() => onBack('hospital-login')} style={{ padding: '8px 18px', fontSize: 13 }}>Run Compliance Scan →</Btn>
      </nav>

      {/* Hero strip */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: 120, flexShrink: 0, backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 18px, rgba(21,128,61,0.13) 18px, rgba(21,128,61,0.13) 19px)', backgroundColor: '#fff', borderRight: '1px solid var(--border)' }} />
        <div style={{ flex: 1, padding: '56px 64px', background: '#fff' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 99, border: '1.5px solid var(--border)', fontSize: 11, fontFamily: 'var(--font-m)', color: 'var(--text4)', letterSpacing: '0.08em', marginBottom: 16 }}>HOW IT WORKS</div>
          <h1 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: 'clamp(32px,4vw,56px)', letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: 16 }}>
            60 seconds.<br /><span style={{ color: '#15803d' }}>5 AI agents.</span><br />Full compliance picture.
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: 15, lineHeight: 1.75, maxWidth: 520 }}>ClearPath uses a parallel multi-agent pipeline built on Claude AI and LangGraph to analyze your hospital's AI tools against every applicable law — simultaneously.</p>
        </div>
        <div style={{ width: 120, flexShrink: 0, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 18px, rgba(21,128,61,0.13) 18px, rgba(21,128,61,0.13) 19px)', backgroundColor: '#fff', borderLeft: '1px solid var(--border)' }} />
      </div>

      {/* Pipeline steps */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '72px 48px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: 36, letterSpacing: '-0.02em', marginBottom: 12 }}>The 5-Agent Pipeline</h2>
          <p style={{ color: 'var(--text2)', fontSize: 15 }}>Each agent runs a specialized analysis in parallel. The orchestrator assembles the final report.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { n: '01', name: 'Law Mapper',           color: '#2563eb', desc: 'Cross-references your hospital state and tool inventory against 15 state AI laws and 7 federal frameworks. Outputs a verified list of applicable statutes with confidence scores.', tag: 'Sequential — runs first' },
            { n: '02', name: 'Gap Scanner',           color: '#d97706', desc: 'Analyzes the gap between what each AI tool does and what the applicable laws require. Outputs severity-scored gaps with required actions, fix timelines, and documentation checklists.', tag: 'Parallel' },
            { n: '03', name: 'Shadow AI Detector',   color: '#dc2626', desc: 'Detects likely unauthorized AI tools — consumer ChatGPT, undeclared EHR modules, ungoverned billing AI — using pattern matching and known risk profiles.', tag: 'Parallel' },
            { n: '04', name: 'Patient Transparency', color: '#15803d', desc: 'Generates plain-English patient-facing reports explaining what AI was used in their care, why, and what their rights are under state law.', tag: 'Parallel' },
            { n: '05', name: 'Safety Validator',     color: '#7c3aed', desc: 'Validates all other agent outputs for contradictions, false accusations, overconfidence, and hallucinations before any result reaches a user.', tag: 'Sequential — runs last' },
          ].map((agent, i) => (
            <div key={agent.n} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, borderRight: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--font-m)', fontWeight: 700, fontSize: 22, color: agent.color }}>{agent.n}</div>
                <div style={{ width: 2, flex: 1, background: i < 4 ? 'var(--border)' : 'transparent', borderRadius: 99 }} />
              </div>
              <div style={{ padding: '32px 40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <h3 style={{ fontFamily: 'var(--font-d)', fontWeight: 700, fontSize: 20 }}>{agent.name}</h3>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-m)', padding: '2px 8px', borderRadius: 4, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text3)' }}>{agent.tag}</span>
                </div>
                <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.75, maxWidth: 600 }}>{agent.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two stakeholder section */}
      <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {[
          { role: 'Hospital Administrator', color: '#0c110c', bg: '#f6f9f6', pat: 'radial-gradient(circle, rgba(21,128,61,0.18) 1.5px, transparent 1.5px)',  bsize: '22px 22px', items: ['Compliance score out of 100','Severity-scored gap list','Shadow AI risk detection','Action checklist with deadlines','Applicable laws with citations'] },
          { role: 'Patient',                color: '#15803d', bg: '#f0fdf4', pat: 'radial-gradient(circle, rgba(21,128,61,0.22) 1.5px, transparent 1.5px)', bsize: '22px 22px',  items: ['Plain-English AI explanation','What each system did in your care','Your rights under state law','Questions to ask your doctor','Reassurance and next steps'] },
        ].map((s, i) => (
          <div key={s.role} style={{ padding: '48px 56px', backgroundImage: s.pat, backgroundSize: s.bsize, backgroundColor: s.bg, borderRight: i === 0 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-m)', color: 'var(--text4)', letterSpacing: '0.1em', marginBottom: 12 }}>OUTPUT FOR</div>
            <h3 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: 24, marginBottom: 24, color: s.color }}>{s.role}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {s.items.map(item => (
                <div key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: '#15803d', fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
                  <span style={{ fontSize: 14, color: 'var(--text2)' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ padding: '64px 48px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', marginBottom: 12 }}>Ready to run your first scan?</h2>
        <p style={{ color: 'var(--text2)', fontSize: 15, marginBottom: 32 }}>Takes 60 seconds. No EHR integration. No lawyer required.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Btn onClick={() => onBack('hospital-login')} style={{ padding: '13px 32px', fontSize: 15, fontWeight: 700 }}>Hospital Compliance Scan →</Btn>
          <Btn variant="outline" onClick={() => onBack('patient-login')} style={{ padding: '13px 32px', fontSize: 15 }}>Patient Transparency Report</Btn>
        </div>
      </div>
    </div>
  )
}

// ── ABOUT ───────────────────────────────────────────────────────────────────

function About({ onBack }) {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff', backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 24px, rgba(21,128,61,0.04) 24px, rgba(21,128,61,0.04) 25px)' }}>
      <nav style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(8px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <ClearPathLogo />
        <div style={{ display: 'flex', gap: 28 }}>
          {[['Landing',''], ['How It Works','howitworks']].map(([l, p]) => (
            <span key={l} onClick={() => onBack(p)} style={{ fontSize: 13, color: 'var(--text3)', cursor: 'pointer', fontWeight: 500 }}>{l}</span>
          ))}
        </div>
        <Btn onClick={() => onBack('hospital-login')} style={{ padding: '8px 18px', fontSize: 13 }}>Run Compliance Scan →</Btn>
      </nav>

      {/* Hero */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: 120, flexShrink: 0, backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 18px, rgba(21,128,61,0.13) 18px, rgba(21,128,61,0.13) 19px)', backgroundColor: '#fff', borderRight: '1px solid var(--border)' }} />
        <div style={{ flex: 1, padding: '56px 64px', background: '#fff' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 99, border: '1.5px solid var(--border)', fontSize: 11, fontFamily: 'var(--font-m)', color: 'var(--text4)', letterSpacing: '0.08em', marginBottom: 16 }}>ABOUT CLEARPATH</div>
          <h1 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: 'clamp(32px,4vw,56px)', letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: 16 }}>
            Built at HackASU 2026.<br /><span style={{ color: '#15803d' }}>For the governance gap</span><br />nobody else filled.
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: 15, lineHeight: 1.75, maxWidth: 520 }}>47 states introduced 250+ healthcare AI bills. 33 became law. We built the system to help hospitals comply and help patients understand what that means for their care.</p>
        </div>
        <div style={{ width: 120, flexShrink: 0, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 18px, rgba(21,128,61,0.13) 18px, rgba(21,128,61,0.13) 19px)', backgroundColor: '#fff', borderLeft: '1px solid var(--border)' }} />
      </div>

      {/* The problem */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '56px 64px', borderRight: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-m)', color: '#dc2626', letterSpacing: '0.1em', marginBottom: 16 }}>THE PROBLEM</div>
          <h2 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em', marginBottom: 20, lineHeight: 1.15 }}>78% of hospitals can't produce an AI audit trail in 30 days.</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {['Healthcare AI is moving faster than compliance frameworks can track.','Hospitals deploy AI tools without knowing which state or federal laws apply.','Patients have zero visibility into what AI touched their care decisions.','Compliance teams spend months on work that should take minutes.'].map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca' }}>
                <span style={{ color: '#dc2626', fontWeight: 700, flexShrink: 0 }}>✗</span>
                <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '56px 64px' }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-m)', color: '#15803d', letterSpacing: '0.1em', marginBottom: 16 }}>THE SOLUTION</div>
          <h2 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: 30, letterSpacing: '-0.02em', marginBottom: 20, lineHeight: 1.15 }}>ClearPath automates what used to take compliance firms months.</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {['5 Claude AI agents run in parallel via LangGraph — same architecture used at Google and Netflix.','15 state-specific AI laws + 7 federal frameworks in a verified knowledge base.','Dual-output: hospital compliance report + patient transparency brief from one analysis.','No EHR integration. No lawyer. Just your state and AI tool list.'].map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 16px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <span style={{ color: '#15803d', fontWeight: 700, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Track fit */}
      <div style={{ padding: '56px 64px', maxWidth: 1100, margin: '0 auto', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-m)', color: 'var(--text4)', letterSpacing: '0.1em', marginBottom: 16 }}>HACKASU 2026 — TRACK 4</div>
        <h2 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: 28, letterSpacing: '-0.02em', marginBottom: 16 }}>Governance & Collaboration</h2>
        <p style={{ color: 'var(--text2)', fontSize: 15, lineHeight: 1.75, maxWidth: 680, marginBottom: 32 }}>Track 4 asks: "How can you help people participate in democracy, work together across differences, or make collective decisions?" ClearPath answers with legislative transparency, dual-stakeholder governance, and shared accountability between hospitals and patients.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[
            { label: 'Legislative Transparency', desc: 'Plain-English explanations of what each AI law actually requires' },
            { label: 'Dual Stakeholder Design',  desc: 'Same analysis, two outputs — one for compliance officers, one for patients' },
            { label: 'Shared Accountability',     desc: 'Hospitals and patients see the same data, building mutual trust' },
          ].map(c => (
            <div key={c.label} style={{ padding: '20px 24px', borderRadius: 12, border: '1.5px solid rgba(21,128,61,0.2)', background: 'rgba(21,128,61,0.03)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>{c.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '64px 48px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: 32, letterSpacing: '-0.02em', marginBottom: 12 }}>Start with your hospital.</h2>
        <p style={{ color: 'var(--text2)', fontSize: 15, marginBottom: 32 }}>60 seconds to a full compliance picture.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Btn onClick={() => onBack('hospital-login')} style={{ padding: '13px 32px', fontSize: 15, fontWeight: 700 }}>Hospital Compliance Scan →</Btn>
          <Btn variant="outline" onClick={() => onBack('patient-login')} style={{ padding: '13px 32px', fontSize: 15 }}>Patient Portal</Btn>
        </div>
      </div>
    </div>
  )
}

// ── LANDING ────────────────────────────────────────────────────────────────

function Landing({ onMode, onNav }) {
  const [statsVisible, setStatsVisible] = React.useState(false)
  const [featureVisible, setFeatureVisible] = React.useState(0)
  React.useEffect(() => {
    const t1 = setTimeout(() => setStatsVisible(true), 400)
    const t2 = setInterval(() => setFeatureVisible(v => { if(v>=6){clearInterval(t2);return v} return v+1 }), 100)
    return () => { clearTimeout(t1); clearInterval(t2) }
  }, [])
  return (
    <div style={{ minHeight: '100vh' }}>

      <nav style={{
        height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px', borderBottom: '1px solid var(--border)',
        background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(8px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <ClearPathLogo />
        <div style={{ display: 'flex', gap: 32 }}>
          {[['How It Works','howitworks'], ['Coverage','coverage'], ['About','about']].map(([l, page]) => (
            <span key={l} onClick={() => onNav && onNav(page)} style={{ fontSize: 14, color: 'var(--text2)', cursor: 'pointer', fontWeight: 500, transition: 'color 0.15s' }}
              onMouseEnter={e => e.target.style.color='#15803d'} onMouseLeave={e => e.target.style.color='var(--text2)'}>{l}</span>
          ))}
        </div>
        <Btn onClick={() => onMode('hospital')} style={{ padding: '8px 18px', fontSize: 13 }}>
          Run Compliance Scan →
        </Btn>
      </nav>

      {/* Hero wrapper with flanking patterns */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ width: 160, flexShrink: 0, backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 18px, rgba(21,128,61,0.13) 18px, rgba(21,128,61,0.13) 19px)', backgroundColor: '#fff', borderRight: '1px solid var(--border)' }} />
        <div style={{ flex: 1, padding: '80px 48px 0', animation: 'fadeUp 0.7s ease' }}>
        <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'center' }}>
          <Pill>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green3)', display: 'inline-block', animation: 'pulse 2s ease infinite' }} />
            47 states · 250+ healthcare AI bills · 33 signed into law
          </Pill>
        </div>

        <h1 style={{
          fontFamily: 'var(--font-d)', fontWeight: 800,
          fontSize: 'clamp(44px, 6vw, 80px)',
          lineHeight: 1.06, letterSpacing: '-0.03em',
          textAlign: 'center', marginBottom: 24,
        }}>
          47 states introduced<br />
          <span style={{ color: 'var(--green)' }}>250+ healthcare AI bills.</span><br />
          33 became law.<br />
          <span style={{ color: 'var(--text4)', fontWeight: 500, fontSize: '0.75em' }}>Nobody built the system to run them.</span>
        </h1>

        <p style={{ textAlign: 'center', fontSize: 17, color: 'var(--text2)', maxWidth: 540, margin: '0 auto 40px', lineHeight: 1.75 }}>
          ClearPath maps your hospital's AI tools to every applicable law, flags compliance gaps, and generates plain-English patient transparency reports in 60 seconds.
        </p>

        <RoleContainer onMode={onMode} />
        </div>{/* end center */}
        <div style={{ width: 160, flexShrink: 0, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 18px, rgba(21,128,61,0.13) 18px, rgba(21,128,61,0.13) 19px)', backgroundColor: '#fff', borderLeft: '1px solid var(--border)' }} />
      </div>

      <PatternGrid />

      <div style={{ padding: '28px 48px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', opacity: statsVisible ? 1 : 0, transform: statsVisible ? 'translateY(0)' : 'translateY(10px)', transition: 'opacity 0.5s ease, transform 0.5s ease' }}>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text4)', letterSpacing: '0.1em', fontFamily: 'var(--font-m)', marginBottom: 16 }}>
          FEDERAL FRAMEWORKS COVERED ACROSS ALL 50 STATES
        </p>
        <div style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap' }}>
          {['HIPAA AI', 'ACA § 1557', 'CMS AI Strategy', 'FDA PCCP', 'ONC HTI-1', 'FTC § 5', 'HHS AI Safety'].map((l, i) => (
            <span key={l} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text3)', fontFamily: 'var(--font-d)', opacity: statsVisible ? 1 : 0, transform: statsVisible ? 'translateY(0)' : 'translateY(8px)', transition: `opacity 0.4s ease ${i * 0.07}s, transform 0.4s ease ${i * 0.07}s` }}>{l}</span>
          ))}
        </div>
      </div>

      <hr className="dash-div" />
      <div className='section-bg' style={{ padding: '72px 48px', maxWidth: 1100, margin: '0 auto', ...PAT_DIAG }}>
        <div style={{ marginBottom: 48, textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: 40, letterSpacing: '-0.02em', marginBottom: 12 }}>
            Built for two stakeholders.<br />One platform.
          </h2>
          <p style={{ color: 'var(--text2)', fontSize: 16 }}>
            Hospitals need to know if they're compliant. Patients deserve to know what AI touched their care.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { icon: '⚖️', title: 'Law Mapping',      desc: 'Maps your hospital AI tools to every applicable state and federal law. 15 states + 7 federal frameworks, 68 requirements.' },
            { icon: '🔍', title: 'Gap Detection',     desc: 'Flags every compliance gap with severity scores, required actions, fix timelines, and documentation checklists.' },
            { icon: '👤', title: 'Patient Reports',   desc: 'Generates plain-English patient transparency reports explaining what AI was used in their care and what their rights are.' },
            { icon: '👁', title: 'Shadow AI',         desc: 'Detects likely unauthorized AI tools — consumer ChatGPT, undeclared EHR modules, ungoverned billing AI — with confidence scores.' },
            { icon: '🛡', title: 'Safety Validation', desc: 'Every agent output is validated for contradictions, overconfidence, and false accusations before reaching users.' },
            { icon: '⚡', title: '60-Second Analysis',desc: '5 Claude AI agents fire in parallel via LangGraph fan-out. What takes compliance firms months takes ClearPath 60 seconds.' },
          ].map((f, i) => (
            <div key={f.title} style={{ opacity: i < featureVisible ? 1 : 0, transform: i < featureVisible ? 'translateY(0)' : 'translateY(16px)', transition: 'opacity 0.35s ease, transform 0.35s ease' }}>
              <FeatureCard {...f} />
            </div>
          ))}
        </div>
      </div>

      <hr className="dash-div" />
      <div style={{ ...PAT_DOTS, borderTop: '1px solid var(--border)', padding: '64px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: 36, letterSpacing: '-0.02em', marginBottom: 8 }}>
            Run your compliance scan<br />in 60 seconds.
          </h2>
          <p style={{ color: 'var(--text2)', fontSize: 15 }}>No EHR integration. No lawyer. Just your state and AI tool list.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Btn variant="green" onClick={() => onMode('hospital')} style={{ padding: '14px 32px', fontSize: 15 }}>Get Started →</Btn>
          <Btn variant="green" onClick={() => onMode('patient')} style={{ padding: '14px 32px', fontSize: 15 }}>Patient Report</Btn>
        </div>
      </div>
    </div>
  )
}


// ── HOSPITAL LOGIN ─────────────────────────────────────────────────────────

function HospitalLogin({ onSuccess, onBack }) {
  // Step 1: NPI lookup, Step 2: Employee ID + Password
  const [step, setStep] = useState(1)
  const [npi, setNpi] = useState('')
  const [npiStatus, setNpiStatus] = useState('idle') // idle | checking | found | notfound
  const [foundHospital, setFoundHospital] = useState(null)
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focusedNpi, setFocusedNpi] = useState(false)
  const [focusedEmp, setFocusedEmp] = useState(false)
  const [focusedPass, setFocusedPass] = useState(false)

  const checkNpi = async () => {
    if (npi.length !== 10) { setError('NPI must be exactly 10 digits.'); return }
    setError('')
    setNpiStatus('checking')
    try {
      const res = await fetch(API + '/api/npi/' + npi)
      const data = await res.json()
      if (data.found && data.active) {
        setFoundHospital({ hospital: data.hospital, city: data.city, type: data.type, address: data.address })
        setNpiStatus('found')
        setTimeout(() => setStep(2), 700)
      } else if (data.found && !data.active) {
        setNpiStatus('notfound')
        setError('This NPI exists but is not active. Please verify with your compliance officer.')
      } else {
        setNpiStatus('notfound')
        setError(data.error || 'No organization found with this NPI number.')
      }
    } catch (e) {
      // Fallback to local registry if API is unavailable
      const hospital = NPI_REGISTRY[npi]
      if (hospital) {
        setFoundHospital(hospital)
        setNpiStatus('found')
        setTimeout(() => setStep(2), 700)
      } else {
        setNpiStatus('notfound')
        setError('NPI lookup unavailable. Please check your connection.')
      }
    }
  }

  const submitCredentials = async () => {
    setError('')
    if (!employeeId || !password) { setError('Please enter your Employee ID and password.'); return }
    setLoading(true)
    await new Promise(r => setTimeout(r, 900))
    // NPI already verified in step 1 — match only on credentials
    const user = HOSPITAL_USERS.find(u => u.employeeId.toLowerCase() === employeeId.toLowerCase() && u.password === password)
    if (user) {
      onSuccess({ ...user, hospital: foundHospital.hospital, city: foundHospital.city })
    } else {
      setError('Employee ID or password incorrect. Please try again.')
    }
    setLoading(false)
  }

  const inputStyle = (focused) => ({
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1.5px solid ' + (focused ? '#15803d' : 'rgba(0,0,0,0.1)'),
    boxShadow: focused ? '0 0 0 3px rgba(21,128,61,0.1)' : '0 1px 4px rgba(0,0,0,0.06)',
    background: '#fff', color: 'var(--text)', fontSize: 14,
    fontFamily: 'var(--font-b)', outline: 'none', transition: 'all 0.18s', boxSizing: 'border-box',
  })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff', backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 24px, rgba(21,128,61,0.04) 24px, rgba(21,128,61,0.04) 25px)' }}>
      <nav style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(8px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-b)' }}>← Back</button>
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <ClearPathLogo />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text4)', fontFamily: 'var(--font-m)', letterSpacing: '0.08em' }}>COMPLIANCE OFFICER PORTAL</span>
        <div style={{ width: 120 }} />
      </nav>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>

        {/* Left panel */}
        <div style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 18px, rgba(21,128,61,0.13) 18px, rgba(21,128,61,0.13) 19px)', backgroundColor: '#fff', borderRight: '1px solid var(--border)', padding: '64px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 32 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 99, border: '1.5px solid var(--border)', fontSize: 11, fontFamily: 'var(--font-m)', color: 'var(--text4)', letterSpacing: '0.08em', marginBottom: 20 }}>COMPLIANCE OFFICER PORTAL</div>
            <h1 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: 40, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 16 }}>
              Hospital AI<br />Compliance Platform
            </h1>
            <p style={{ color: 'var(--text2)', fontSize: 15, lineHeight: 1.75, maxWidth: 380 }}>
              Sign in to access your hospital's AI compliance dashboard, run gap analyses, and generate audit-ready reports.
            </p>
          </div>

          {/* Step indicators */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { n: 1, label: 'Verify Hospital NPI',     desc: 'Confirm your organization exists in the system' },
              { n: 2, label: 'Staff Authentication',     desc: 'Enter your Employee ID and password'           },
            ].map((s, i) => {
              const active = step === s.n
              const done = step > s.n
              return (
                <div key={s.n} style={{ display: 'flex', gap: 14, paddingBottom: i < 1 ? 20 : 0, marginBottom: i < 1 ? 20 : 0, borderBottom: i < 1 ? '1px dashed rgba(21,128,61,0.15)' : 'none' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: done ? '#15803d' : active ? '#f0fdf4' : '#f6f9f6', border: '1.5px solid ' + (done ? '#15803d' : active ? '#15803d' : 'var(--border)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: done ? '#fff' : active ? '#15803d' : 'var(--text4)', transition: 'all 0.3s' }}>
                    {done ? '✓' : s.n}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: active || done ? 'var(--dark)' : 'var(--text3)' }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text4)', marginTop: 2 }}>{s.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['Law Mapping',       '15 states + 7 federal frameworks'],
              ['Gap Detection',     'Severity-scored compliance gaps'],
              ['Shadow AI Scanner', 'Unauthorized tool detection'],
              ['Audit Reports',     'Regulator-ready documentation'],
            ].map(([title, desc]) => (
              <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#f0fdf4', border: '1.5px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <span style={{ fontSize: 9, color: '#15803d', fontWeight: 800 }}>✓</span>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dark)' }}>{title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — form */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
          <div style={{ width: '100%', maxWidth: 400 }}>

            {/* Step 1 — NPI */}
            {step === 1 && (
              <div style={{ animation: 'fadeUp 0.3s ease' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-m)', color: '#15803d', letterSpacing: '0.1em', marginBottom: 8 }}>STEP 1 OF 2</div>
                <h2 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', marginBottom: 6 }}>Verify your hospital</h2>
                <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 28, lineHeight: 1.6 }}>Enter your hospital's NPI number to confirm your organization is registered in the ClearPath system.</p>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 4 }}>NPI Number</div>
                  <div style={{ fontSize: 11, color: 'var(--text4)', fontFamily: 'var(--font-m)', marginBottom: 8 }}>10-digit National Provider Identifier (Type 2 — Organization)</div>
                  <input
                    type="text" placeholder="e.g. 1234567890" maxLength={10}
                    value={npi} onChange={e => { setNpi(e.target.value.replace(/[^0-9]/g, '')); setNpiStatus('idle'); setError('') }}
                    onFocus={() => setFocusedNpi(true)} onBlur={() => setFocusedNpi(false)}
                    onKeyDown={e => e.key === 'Enter' && checkNpi()}
                    style={{ ...inputStyle(focusedNpi), fontFamily: 'var(--font-m)', letterSpacing: '0.12em', fontSize: 16 }}
                  />
                  {/* NPI character counter */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: npiStatus === 'found' ? '#15803d' : npiStatus === 'notfound' ? '#dc2626' : 'var(--text4)', fontFamily: 'var(--font-m)' }}>
                      {npiStatus === 'checking' ? '⟳ Looking up NPI...' : npiStatus === 'found' ? '✓ Hospital verified' : npiStatus === 'notfound' ? '✗ NPI not found' : ''}
                    </span>
                    <span style={{ fontSize: 11, color: npi.length === 10 ? '#15803d' : 'var(--text4)', fontFamily: 'var(--font-m)' }}>{npi.length}/10</span>
                  </div>
                </div>

                {/* Hospital preview when found */}
                {npiStatus === 'found' && foundHospital && (
                  <div style={{ padding: '14px 16px', borderRadius: 10, background: '#f0fdf4', border: '1.5px solid #bbf7d0', marginBottom: 20, animation: 'fadeUp 0.2s ease' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-m)', color: '#15803d', letterSpacing: '0.1em', marginBottom: 6 }}>HOSPITAL VERIFIED</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--dark)', marginBottom: 2 }}>{foundHospital.hospital}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>{foundHospital.city} · {foundHospital.type}</div>
                  </div>
                )}

                {error && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12, color: '#dc2626', marginBottom: 16 }}>{error}</div>
                )}

                <Btn onClick={checkNpi} disabled={npi.length !== 10 || npiStatus === 'checking'} fullWidth style={{ padding: '14px', fontSize: 15, fontWeight: 700, borderRadius: 10, boxShadow: '0 4px 20px rgba(21,128,61,0.2)' }}>
                  {npiStatus === 'checking' ? '⟳  Verifying NPI...' : 'Verify Hospital →'}
                </Btn>
              </div>
            )}

            {/* Step 2 — Employee ID + Password */}
            {step === 2 && (
              <div style={{ animation: 'fadeUp 0.35s cubic-bezier(0.4,0,0.2,1)' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-m)', color: '#15803d', letterSpacing: '0.1em', marginBottom: 8 }}>STEP 2 OF 2</div>
                <h2 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', marginBottom: 6 }}>Staff Authentication</h2>

                {/* Hospital confirmed badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: 24 }}>
                  <span style={{ fontSize: 16 }}>🏛</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>{foundHospital?.hospital}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-m)' }}>NPI {npi} · {foundHospital?.city}</div>
                  </div>
                  <button onClick={() => { setStep(1); setNpiStatus('idle'); setFoundHospital(null); setError('') }} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 11, color: 'var(--text3)', cursor: 'pointer', fontFamily: 'var(--font-m)' }}>Change</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 4 }}>Employee ID</div>
                    <div style={{ fontSize: 11, color: 'var(--text4)', fontFamily: 'var(--font-m)', marginBottom: 8 }}>Your unique staff identifier issued by your hospital</div>
                    <input
                      type="text" placeholder="e.g. EMP-00001"
                      value={employeeId} onChange={e => setEmployeeId(e.target.value)}
                      onFocus={() => setFocusedEmp(true)} onBlur={() => setFocusedEmp(false)}
                      onKeyDown={e => e.key === 'Enter' && submitCredentials()}
                      style={{ ...inputStyle(focusedEmp), fontFamily: 'var(--font-m)', letterSpacing: '0.06em' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 8 }}>Password</div>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPass ? 'text' : 'password'} placeholder="••••••••"
                        value={password} onChange={e => setPassword(e.target.value)}
                        onFocus={() => setFocusedPass(true)} onBlur={() => setFocusedPass(false)}
                        onKeyDown={e => e.key === 'Enter' && submitCredentials()}
                        style={{ ...inputStyle(focusedPass) }}
                      />
                      <button onClick={() => setShowPass(s => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-m)' }}>
                        {showPass ? 'HIDE' : 'SHOW'}
                      </button>
                    </div>
                  </div>
                </div>

                {error && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12, color: '#dc2626', marginBottom: 16 }}>{error}</div>
                )}

                <Btn onClick={submitCredentials} disabled={loading} fullWidth style={{ padding: '14px', fontSize: 15, fontWeight: 700, borderRadius: 10, boxShadow: '0 4px 20px rgba(21,128,61,0.2)' }}>
                  {loading ? '⟳  Authenticating...' : 'Sign In →'}
                </Btn>

                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text4)', marginTop: 20, lineHeight: 1.6 }}>
                  This is a secure portal for authorized compliance officers only.
                </p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

function HospitalSearch({ onSelect, selectedNpi, error, onContinue }) {
  const [query, setQuery] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [focusedQuery, setFocusedQuery] = useState(false)
  const [focusedState, setFocusedState] = useState(false)
  const [focusedZip, setFocusedZip] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching] = useState(false)
  const searchRef = useRef(null)
  const [selectedHospital, setSelectedHospital] = useState(null)
  const selected = selectedHospital

  useEffect(() => {
    const handler = e => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowSuggestions(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Live NPPES search — debounced 400ms
  useEffect(() => {
    if (query.length < 3) { setSuggestions([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const params = new URLSearchParams({ q: query })
        if (state) params.append('state', state)
        if (zip) params.append('zip', zip)
        const res = await fetch(API + '/api/npi/search?' + params.toString())
        const data = await res.json()
        const results = (data.results || []).filter(r => r.hospital)
        setSuggestions(results)
        setShowSuggestions(true)
      } catch {
        setSuggestions([])
      }
      setSearching(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [query, state, zip])

  const inputBase = (focused) => ({
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1.5px solid ' + (focused ? '#15803d' : 'rgba(0,0,0,0.1)'),
    boxShadow: focused ? '0 0 0 3px rgba(21,128,61,0.1)' : '0 1px 4px rgba(0,0,0,0.06)',
    background: '#fff', color: 'var(--dark)', fontSize: 14,
    fontFamily: 'var(--font-b)', outline: 'none', transition: 'all 0.18s', boxSizing: 'border-box',
  })

  const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

  return (
    <div style={{ animation: 'fadeUp 0.3s ease' }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-m)', color: '#15803d', letterSpacing: '0.1em', marginBottom: 8 }}>STEP 1 OF 3</div>
      <h2 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', marginBottom: 6 }}>Find your hospital</h2>
      <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 28, lineHeight: 1.6 }}>Search for the hospital where you received care, then confirm with state and zip code.</p>

      {/* Hospital search with autocomplete */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 8 }}>Hospital Name</div>
        <div ref={searchRef} style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Type hospital name or city..."
            value={selected ? selected.hospital : query}
            onChange={e => { setQuery(e.target.value); onSelect(''); setShowSuggestions(true) }}
            onFocus={() => { setFocusedQuery(true); if (query.length >= 2) setShowSuggestions(true) }}
            onBlur={() => setFocusedQuery(false)}
            style={{ ...inputBase(focusedQuery), paddingRight: selected ? 36 : 14 }}
          />
          {/* Clear button when selected */}
          {selected && (
            <button onClick={() => { onSelect(''); setQuery(''); setSelectedHospital(null); setShowSuggestions(false) }}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 14, lineHeight: 1 }}>
              ×
            </button>
          )}
          {/* Suggestions dropdown */}
          {searching && query.length >= 3 && !selected && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 300, background: '#fff', borderRadius: 10, border: '1.5px solid rgba(21,128,61,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '14px 16px', fontSize: 13, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AnimDots /> Searching CMS registry...
            </div>
          )}
          {showSuggestions && suggestions.length > 0 && !selected && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 300, background: '#fff', borderRadius: 10, border: '1.5px solid rgba(21,128,61,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden', animation: 'fadeUp 0.15s ease' }}>
              {suggestions.map((h, i) => (
                <div key={h.npi}
                  onMouseDown={() => { onSelect(h.npi, h); setQuery(h.hospital); setSelectedHospital(h); setShowSuggestions(false); if (h.state) setState(h.state); if (h.zip) setZip(h.zip) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', cursor: 'pointer', background: '#fff', borderBottom: i < suggestions.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', borderLeft: '3px solid transparent', transition: 'all 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.borderLeftColor = '#15803d' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderLeftColor = 'transparent' }}
                >
                  <span style={{ fontSize: 16 }}>🏛</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)' }}>{h.hospital}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-m)', marginTop: 1 }}>{h.city} · {h.type}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {showSuggestions && query.length >= 2 && suggestions.length === 0 && !selected && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 300, background: '#fff', borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.08)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', padding: '14px 16px', fontSize: 13, color: 'var(--text3)' }}>
              No hospitals found. Try a different name or city.
            </div>
          )}
        </div>
        {/* Selected hospital confirmation */}
        {selected && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <span style={{ fontSize: 11, color: '#15803d', fontWeight: 700, fontFamily: 'var(--font-m)' }}>✓ SELECTED</span>
            <span style={{ fontSize: 12, color: '#15803d' }}>{selected.hospital} · {selected.city}</span>
          </div>
        )}
      </div>

      {/* State + Zip row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 8 }}>State</div>
          <select value={state} onChange={e => setState(e.target.value)}
            onFocus={() => setFocusedState(true)} onBlur={() => setFocusedState(false)}
            style={{ ...inputBase(focusedState), cursor: 'pointer' }}>
            <option value="">Select state</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 8 }}>ZIP Code</div>
          <input type="text" placeholder="e.g. 85001" maxLength={5}
            value={zip} onChange={e => setZip(e.target.value.replace(/[^0-9]/g, ''))}
            onFocus={() => setFocusedZip(true)} onBlur={() => setFocusedZip(false)}
            style={{ ...inputBase(focusedZip), fontFamily: 'var(--font-m)', letterSpacing: '0.08em' }}
          />
        </div>
      </div>

      {error && <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12, color: '#dc2626', marginBottom: 16 }}>{error}</div>}

      <Btn onClick={onContinue} fullWidth style={{ padding: '14px', fontSize: 15, fontWeight: 700, borderRadius: 10, boxShadow: '0 4px 20px rgba(21,128,61,0.2)' }}>
        Continue →
      </Btn>
    </div>
  )
}


// ── PATIENT LOGIN ──────────────────────────────────────────────────────────

function PatientLogin({ onSuccess, onBack }) {
  const [step, setStep] = useState(1)     // 1=hospital, 2=mrn+dob, 3=encounter
  const [selectedNpi, setSelectedNpi] = useState('')
  const [selectedHospitalInfo, setSelectedHospitalInfo] = useState(null)
  const [hospitalState, setHospitalState] = useState('')
  const [hospitalZip, setHospitalZip] = useState('')
  const [mrn, setMrn] = useState('')
  const [dob, setDob] = useState('')
  const [patientRecord, setPatientRecord] = useState(null)
  const [selectedEncounter, setSelectedEncounter] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focusMrn, setFocusMrn] = useState(false)
  const [focusDob, setFocusDob] = useState(false)

  const verifyIdentity = async () => {
    // Gap 5: First check if MRN exists in batch data for this hospital
    if (selectedNpi) {
      try {
        const batchRes = await fetch(API + '/api/patients/' + selectedNpi + '/mrn/' + mrn.toUpperCase())
        const batchData = await batchRes.json()
        if (batchData.found && batchData.patient) {
          const bp = batchData.patient
          const bpDob = bp.admission_date // use admission date as proxy DOB check not needed for batch
          setPatientRecord({
            mrn: mrn.toUpperCase(),
            name: bp.first_name + ' ' + bp.last_name,
            hospital_npi: selectedNpi,
            encounters: [{
              id: bp.adm_id, date: bp.admission_date,
              reason: bp.icd10_desc, department: bp.department,
              ai_tools: JSON.parse(bp.ai_tools_used||'[]'),
              governance_gaps: JSON.parse(bp.governance_gaps||'[]'),
              risk_level: bp.risk_level, drg: bp.drg, drg_code: bp.drg_code,
              los: bp.los_days, los_days: bp.los_days,
              gender: bp.gender,
              admission_date: bp.admission_date, discharge_date: bp.discharge_date,
              adm_id: bp.adm_id, mrn: bp.mrn,
              first_name: bp.first_name, last_name: bp.last_name,
              from_batch: true
            }]
          })
          setStep(3); return
        }
      } catch(e) { /* fall through to static check */ }
    }

    setError('')
    if (!mrn || !dob) { setError('Please enter your MRN and date of birth.'); return }
    setLoading(true)
    await new Promise(r => setTimeout(r, 900))
    const record = PATIENT_REGISTRY[mrn.toUpperCase()]
    if (record && record.dob === dob) {
      // Filter encounters to selected hospital
      const encounters = record.encounters.filter(e => e.hospital_npi === selectedNpi)
      if (encounters.length === 0) {
        setError('No admissions found for this MRN at the selected hospital.')
        setLoading(false); return
      }
      setPatientRecord({ ...record, encounters })
      setStep(3)
    } else {
      setError('MRN or date of birth does not match our records.')
    }
    setLoading(false)
  }

  const confirmEncounter = () => {
    if (!selectedEncounter) { setError('Please select an admission.'); return }
    onSuccess({
      scan_type: 'patient',
      patient_name: patientRecord.name,
      dob: patientRecord.dob || dob,
      mrn: mrn.toUpperCase(),
      hospital_name: (NPI_REGISTRY[selectedNpi]?.hospital || patientRecord?.hospital_name || 'Your Hospital'),
      encounter: selectedEncounter,
      patient_report: {},
      hospital_report: {},
    })
  }

  const inputStyle = (focused) => ({
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1.5px solid ' + (focused ? '#15803d' : 'rgba(0,0,0,0.1)'),
    boxShadow: focused ? '0 0 0 3px rgba(21,128,61,0.1)' : '0 1px 4px rgba(0,0,0,0.06)',
    background: '#fff', color: 'var(--text)', fontSize: 14,
    fontFamily: 'var(--font-b)', outline: 'none', transition: 'all 0.18s', boxSizing: 'border-box',
  })

  const steps = [
    { n: 1, label: 'Select Hospital',     desc: 'Which hospital did you visit?' },
    { n: 2, label: 'Verify Identity',     desc: 'MRN and date of birth'         },
    { n: 3, label: 'Select Admission',    desc: 'Choose your visit'             },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fff', backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 24px, rgba(21,128,61,0.04) 24px, rgba(21,128,61,0.04) 25px)' }}>
      <nav style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(8px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-b)' }}>← Back</button>
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />
          <ClearPathLogo />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text4)', fontFamily: 'var(--font-m)', letterSpacing: '0.08em' }}>PATIENT PORTAL</span>
        <div style={{ width: 120 }} />
      </nav>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>

        {/* Left panel — context-aware, diagonal pattern only here */}
        <div style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 18px, rgba(21,128,61,0.13) 18px, rgba(21,128,61,0.13) 19px)', backgroundColor: '#fff', borderRight: '1px solid var(--border)', padding: '64px 56px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 99, border: '1.5px solid var(--border)', fontSize: 11, fontFamily: 'var(--font-m)', color: 'var(--text4)', letterSpacing: '0.08em', marginBottom: 20 }}>PATIENT PORTAL</div>
            <h1 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: 40, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 16 }}>
              Your Care.<br />Your Rights.<br />Your Data.
            </h1>
            <p style={{ color: 'var(--text2)', fontSize: 15, lineHeight: 1.75, maxWidth: 380 }}>
              Access a plain-English explanation of what AI systems were involved in your care, and what your rights are under state and federal law.
            </p>
          </div>
          {/* Context-aware step guidance */}
          <div style={{ padding: '18px 20px', borderRadius: 12, background: 'rgba(21,128,61,0.05)', border: '1px solid rgba(21,128,61,0.15)' }}>
            {step === 1 && (<div><div style={{ fontSize: 12, fontWeight: 700, color: '#15803d', fontFamily: 'var(--font-m)', letterSpacing: '0.08em', marginBottom: 8 }}>WHY WE ASK — STEP 1</div><p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65 }}>We use your hospital to match the exact state and federal AI laws that apply to your care, so your report is legally accurate — not generic.</p></div>)}
            {step === 2 && (<div><div style={{ fontSize: 12, fontWeight: 700, color: '#15803d', fontFamily: 'var(--font-m)', letterSpacing: '0.08em', marginBottom: 8 }}>WHY WE ASK — STEP 2</div><p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65 }}>Your MRN and date of birth ensure only you can access your medical AI report. No account or password needed — just your existing patient record.</p></div>)}
            {step === 3 && (<div><div style={{ fontSize: 12, fontWeight: 700, color: '#15803d', fontFamily: 'var(--font-m)', letterSpacing: '0.08em', marginBottom: 8 }}>WHAT YOU'LL SEE — STEP 3</div><p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65 }}>Each admission may have had different AI systems involved. Select the visit and we'll show exactly which AI tools were used, why, and what your rights are for that specific encounter.</p></div>)}
          </div>

          {/* Step indicators */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {steps.map((s, i) => {
              const active = step === s.n
              const done = step > s.n
              return (
                <div key={s.n} style={{ display: 'flex', gap: 14, paddingBottom: i < 2 ? 18 : 0, marginBottom: i < 2 ? 18 : 0, borderBottom: i < 2 ? '1px dashed rgba(21,128,61,0.15)' : 'none' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: done ? '#15803d' : active ? '#f0fdf4' : '#f6f9f6', border: '1.5px solid ' + (done ? '#15803d' : active ? '#15803d' : 'var(--border)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: done ? '#fff' : active ? '#15803d' : 'var(--text4)', transition: 'all 0.3s' }}>
                    {done ? '✓' : s.n}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: active || done ? 'var(--dark)' : 'var(--text3)' }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text4)', marginTop: 2 }}>{s.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Features — only show when enough space (step 1) */}
          <div style={{ borderTop: '1px dashed rgba(21,128,61,0.15)', paddingTop: 24 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-m)', color: 'var(--text4)', letterSpacing: '0.1em', marginBottom: 14 }}>WHAT YOU'LL RECEIVE</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                ['Plain English',    'No medical or legal jargon'],
                ['Your Rights',      'What you can ask and request'],
                ['What AI Was Used', 'Every system explained clearly'],
                ['Questions to Ask', 'Ready-made questions for your doctor'],
              ].map(([title, desc]) => (
                <div key={title} style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(21,128,61,0.04)', border: '1px solid rgba(21,128,61,0.1)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d', marginBottom: 3 }}>{title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.4 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — clean white focus zone, no pattern */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', background: '#fff' }}>
          <div style={{ width: '100%', maxWidth: 420 }}>

            {/* ── STEP 1: Hospital Search ── */}
            {step === 1 && (
              <HospitalSearch
                onSelect={(npi, info) => { setSelectedNpi(npi); setSelectedHospitalInfo(info); setError('') }}
                selectedNpi={selectedNpi}
                error={error}
                onContinue={() => { if (!selectedNpi) { setError('Please select a hospital to continue.'); return } setError(''); setStep(2) }}
              />
            )}

            {/* ── STEP 2: MRN + DOB ── */}
            {step === 2 && (
              <div style={{ animation: 'fadeUp 0.35s cubic-bezier(0.4,0,0.2,1)' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-m)', color: '#15803d', letterSpacing: '0.1em', marginBottom: 8 }}>STEP 2 OF 3</div>
                <h2 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', marginBottom: 6 }}>Verify your identity</h2>

                {/* Hospital badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: 24 }}>
                  <span style={{ fontSize: 15 }}>🏛</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>{selectedHospitalInfo?.hospital}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-m)' }}>{selectedHospitalInfo?.city}{selectedHospitalInfo?.state ? ', ' + selectedHospitalInfo.state : ''}</div>
                  </div>
                  <button onClick={() => { setStep(1); setError('') }} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text3)', cursor: 'pointer', fontFamily: 'var(--font-m)' }}>Change</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 4 }}>Medical Record Number (MRN)</div>
                    <div style={{ fontSize: 11, color: 'var(--text4)', fontFamily: 'var(--font-m)', marginBottom: 8 }}>Found on your discharge papers or patient wristband</div>
                    <input type="text" placeholder="e.g. MRN-99001" value={mrn}
                      onChange={e => setMrn(e.target.value.toUpperCase())}
                      onFocus={() => setFocusMrn(true)} onBlur={() => setFocusMrn(false)}
                      onKeyDown={e => e.key === 'Enter' && verifyIdentity()}
                      style={{ ...inputStyle(focusMrn), fontFamily: 'var(--font-m)', letterSpacing: '0.06em' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', marginBottom: 4 }}>Date of Birth</div>
                    <div style={{ fontSize: 11, color: 'var(--text4)', fontFamily: 'var(--font-m)', marginBottom: 8 }}>Used to verify your identity</div>
                    <input type="date" value={dob} onChange={e => setDob(e.target.value)}
                      onFocus={() => setFocusDob(true)} onBlur={() => setFocusDob(false)}
                      onKeyDown={e => e.key === 'Enter' && verifyIdentity()}
                      style={{ ...inputStyle(focusDob), fontFamily: 'var(--font-b)' }}
                    />
                  </div>
                </div>

                {error && <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12, color: '#dc2626', marginBottom: 16 }}>{error}</div>}

                <Btn onClick={verifyIdentity} disabled={loading} fullWidth style={{ padding: '14px', fontSize: 15, fontWeight: 700, borderRadius: 10, boxShadow: '0 4px 20px rgba(21,128,61,0.2)' }}>
                  {loading ? '⟳  Verifying identity...' : 'Verify Identity →'}
                </Btn>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 }}>
                  <span style={{ fontSize: 13 }}>🔒</span>
                  <span style={{ fontSize: 11, color: 'var(--text4)', fontFamily: 'var(--font-m)' }}>Your data is used only to retrieve your records. Nothing is stored or shared.</span>
                </div>
              </div>
            )}

            {/* ── STEP 3: Select Encounter ── */}
            {step === 3 && patientRecord && (
              <div style={{ animation: 'fadeUp 0.35s cubic-bezier(0.4,0,0.2,1)' }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-m)', color: '#15803d', letterSpacing: '0.1em', marginBottom: 8 }}>STEP 3 OF 3</div>
                <h2 style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', marginBottom: 4 }}>Select your admission</h2>
                <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
                  Welcome, {patientRecord.name}. Select the visit you want the AI transparency report for.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                  {patientRecord.encounters.map(enc => {
                    const sel = selectedEncounter?.id === enc.id
                    return (
                      <div key={enc.id} onClick={() => { setSelectedEncounter(enc); setError('') }} style={{ padding: '14px 16px', borderRadius: 10, cursor: 'pointer', border: '1.5px solid ' + (sel ? '#15803d' : 'rgba(0,0,0,0.08)'), background: sel ? 'rgba(21,128,61,0.06)' : '#fff', boxShadow: sel ? '0 6px 18px rgba(0,0,0,0.07)' : '0 1px 4px rgba(0,0,0,0.04)', transform: sel ? 'translateY(-1px)' : 'none', transition: 'all 0.18s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontFamily: 'var(--font-m)', fontWeight: 700, color: sel ? '#15803d' : 'var(--text3)', letterSpacing: '0.06em' }}>{enc.id}</span>
                          <span style={{ fontSize: 11, color: 'var(--text4)', fontFamily: 'var(--font-m)' }}>{enc.date}</span>
                        </div>
                        <div style={{ fontSize: 13, color: sel ? '#0c110c' : 'var(--text2)', fontWeight: sel ? 500 : 400 }}>{enc.reason}</div>
                      </div>
                    )
                  })}
                </div>

                {error && <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12, color: '#dc2626', marginBottom: 16 }}>{error}</div>}

                {selectedEncounter && (
                  <div style={{ padding: '14px 16px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', marginBottom: 16 }}>
                    {[
                      'Identity verified',
                      'Hospital records found — ' + (selectedHospitalInfo?.hospital || selectedNpi),
                      patientRecord.encounters.length + ' admission' + (patientRecord.encounters.length > 1 ? 's' : '') + ' available',
                    ].map(item => (
                      <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                        <span style={{ fontSize: 11, color: '#15803d', fontWeight: 800 }}>✓</span>
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
                <Btn onClick={confirmEncounter} fullWidth style={{ padding: '15px', fontSize: 15, fontWeight: 700, borderRadius: 10, boxShadow: selectedEncounter ? '0 6px 28px rgba(21,128,61,0.28)' : 'none' }}>
                  View Your AI Transparency Report →
                </Btn>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 }}>
                  <span style={{ fontSize: 13 }}>🔒</span>
                  <span style={{ fontSize: 11, color: 'var(--text4)', fontFamily: 'var(--font-m)' }}>Your data is used only to retrieve your records. Nothing is stored or shared.</span>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}



// ── AI Auto-Detection Engine ───────────────────────────────────────────────
// Simulates what an EHR audit log integration would detect.
// In production: replaces manual selection with actual API log analysis.

const DETECTION_SIGNALS = {
  epic_sepsis_model: {
    label: 'Epic Sepsis Prediction Model',
    risk: 'high',
    detection_method: ['EHR integration logs', 'Epic module registry'],
    baseline_confidence: { academic_medical_center: 94, community_hospital: 71, system: 89, specialty: 45, critical_access: 32, childrens: 55 },
    detection_note: 'Epic Deterioration Index detected as active module in EHR configuration',
  },
  nuance_dax: {
    label: 'Nuance DAX Ambient Documentation',
    risk: 'medium',
    detection_method: ['API usage patterns', 'Microsoft licensing signals'],
    baseline_confidence: { academic_medical_center: 78, community_hospital: 52, system: 81, specialty: 61, critical_access: 28, childrens: 44 },
    detection_note: 'DAX API calls detected via Microsoft Azure integration patterns',
  },
  billing_coding_ai: {
    label: 'AI-Assisted Medical Coding & Billing',
    risk: 'high',
    detection_method: ['Claims submission patterns', 'Revenue cycle vendor signals'],
    baseline_confidence: { academic_medical_center: 88, community_hospital: 82, system: 91, specialty: 79, critical_access: 61, childrens: 70 },
    detection_note: 'Automated coding patterns detected in Medicare claims submission data',
  },
  chatgpt_clinical: {
    label: 'ChatGPT / Consumer LLM',
    risk: 'critical',
    detection_method: ['Network traffic analysis', 'User behavior signals', 'Staff survey data'],
    baseline_confidence: { academic_medical_center: 83, community_hospital: 61, system: 79, specialty: 58, critical_access: 41, childrens: 52 },
    detection_note: 'Outbound API calls to openai.com detected in network traffic patterns — no BAA on file',
    flag: 'UNVERIFIED — no governance framework detected',
  },
  ehr_predictive_analytics: {
    label: 'EHR Native Predictive Analytics',
    risk: 'high',
    detection_method: ['EHR integration logs', 'Vendor activation records'],
    baseline_confidence: { academic_medical_center: 91, community_hospital: 74, system: 88, specialty: 63, critical_access: 48, childrens: 66 },
    detection_note: 'Multiple predictive models detected as active in EHR configuration',
  },
  radiology_ai_cad: {
    label: 'Radiology AI / CADe Detection',
    risk: 'high',
    detection_method: ['PACS integration logs', 'FDA 510(k) device registry'],
    baseline_confidence: { academic_medical_center: 86, community_hospital: 54, system: 82, specialty: 91, critical_access: 23, childrens: 68 },
    detection_note: 'AI-assisted reading tools detected via PACS workflow integration',
  },
  optum_claims_ai: {
    label: 'Optum Prior Authorization AI',
    risk: 'high',
    detection_method: ['Payer portal API logs', 'Claims processing patterns'],
    baseline_confidence: { academic_medical_center: 71, community_hospital: 68, system: 84, specialty: 55, critical_access: 44, childrens: 49 },
    detection_note: 'Automated prior auth decisions detected — CMS scrutiny escalating in 2025',
  },
  ambient_clinical_intelligence: {
    label: 'Ambient Clinical Intelligence (Suki/Abridge)',
    risk: 'medium',
    detection_method: ['API usage patterns', 'EHR plugin registry'],
    baseline_confidence: { academic_medical_center: 67, community_hospital: 41, system: 72, specialty: 58, critical_access: 18, childrens: 35 },
    detection_note: 'Ambient documentation plugin detected in EHR marketplace registry',
  },
}

// Governance control status — simulates what an audit of the hospital's governance records would find
const GOVERNANCE_STATUS = {
  epic_sepsis_model:            { approved: true,  oversight: true,  disclosure: false, last_audit: '2024-09-14', monitoring: 'overdue',   phi_controls: true  },
  nuance_dax:                   { approved: true,  oversight: true,  disclosure: true,  last_audit: '2025-01-08', monitoring: 'current',   phi_controls: true  },
  billing_coding_ai:            { approved: true,  oversight: false, disclosure: false, last_audit: '2024-06-22', monitoring: 'overdue',   phi_controls: false },
  chatgpt_clinical:             { approved: false, oversight: false, disclosure: false, last_audit: null,         monitoring: 'none',      phi_controls: false },
  ehr_predictive_analytics:     { approved: true,  oversight: false, disclosure: false, last_audit: '2024-11-30', monitoring: 'overdue',   phi_controls: true  },
  radiology_ai_cad:             { approved: true,  oversight: true,  disclosure: false, last_audit: '2025-02-14', monitoring: 'current',   phi_controls: true  },
  optum_claims_ai:              { approved: true,  oversight: false, disclosure: false, last_audit: '2024-08-05', monitoring: 'overdue',   phi_controls: false },
  ambient_clinical_intelligence:{ approved: false, oversight: false, disclosure: false, last_audit: null,         monitoring: 'none',      phi_controls: false },
  azure_openai_clinical:        { approved: true,  oversight: true,  disclosure: true,  last_audit: '2025-01-20', monitoring: 'current',   phi_controls: true  },
  viz_ai:                       { approved: true,  oversight: true,  disclosure: false, last_audit: '2024-12-11', monitoring: 'current',   phi_controls: true  },
}


function generateDetectedTools(hospitalType, hospitalSize, ehr) {
  const detected = []
  const undeclared = []

  for (const [toolId, signal] of Object.entries(DETECTION_SIGNALS)) {
    const baseConf = signal.baseline_confidence[hospitalType] || 50
    // Add variance based on size
    const sizeBonus = hospitalSize === 'large' ? 8 : hospitalSize === 'system' ? 12 : hospitalSize === 'small' ? -15 : 0
    // EHR bonus for Epic-native tools
    const ehrBonus = (ehr === 'epic' && ['epic_sepsis_model','ehr_predictive_analytics'].includes(toolId)) ? 10 : 0
    const confidence = Math.min(98, Math.max(20, baseConf + sizeBonus + ehrBonus + Math.floor(Math.random() * 8 - 4)))

    if (confidence >= 60) {
      const isUnverified = signal.flag || confidence < 72
      detected.push({
        id: toolId,
        label: signal.label,
        risk: signal.risk,
        confidence,
        detection_method: signal.detection_method,
        detection_note: signal.detection_note,
        flag: signal.flag || null,
        status: isUnverified ? 'unverified' : 'confirmed',
      })
    }
  }

  return detected.sort((a, b) => b.confidence - a.confidence)
}


function calcRisk(form) {
  const tools = form.ai_tools || []
  if (!tools.length) return { score: 100, risk: 'low', flags: [] }
  let score = 100
  let flags = []

  if (tools.includes('chatgpt_clinical'))             { score -= 35; flags.push({ sev: 'critical', msg: 'Consumer LLM in clinical use — HIPAA BAA required' }) }
  if (tools.includes('billing_coding_ai'))             { score -= 15; flags.push({ sev: 'high',     msg: 'Billing AI requires human oversight documentation' }) }
  if (tools.includes('epic_sepsis_model'))             { score -= 10; flags.push({ sev: 'high',     msg: 'Sepsis model requires bias monitoring per CMS' }) }
  if (tools.includes('radiology_ai_cad'))              { score -= 10; flags.push({ sev: 'high',     msg: 'CADe device requires FDA 510(k) compliance' }) }
  if (tools.includes('viz_ai'))                        { score -= 10; flags.push({ sev: 'high',     msg: 'Stroke AI requires algorithm transparency disclosure' }) }
  if (tools.includes('optum_claims_ai'))               { score -= 12; flags.push({ sev: 'high',     msg: 'Prior auth AI under CMS scrutiny — document criteria' }) }
  if (tools.includes('azure_openai_clinical'))         { score -= 8;  flags.push({ sev: 'medium',   msg: 'Enterprise LLM requires data processing agreement' }) }
  if (tools.includes('ambient_clinical_intelligence')) { score -= 6;  flags.push({ sev: 'medium',   msg: 'Ambient AI requires patient consent documentation' }) }
  if (!form.has_ai_governance_committee) { score -= 10; flags.push({ sev: 'high', msg: 'No AI governance committee — required by CMS AI Strategy' }) }
  if (!form.has_existing_ai_policy)      { score -= 8;  flags.push({ sev: 'high', msg: 'No documented AI policy — required by HHS AI Safety Program' }) }
  if (form.research_institution)         { score -= 5;  flags.push({ sev: 'medium', msg: 'Research use of AI may trigger FDA IDE requirements' }) }
  if (form.pediatric_patients)           { score -= 5;  flags.push({ sev: 'medium', msg: 'Pediatric AI use requires additional consent layers' }) }
  if (form.operates_in_multiple_states)  { score -= 8;  flags.push({ sev: 'high', msg: 'Multi-state operation — must comply with each state AI law' }) }
  if (form.joint_commission_accredited)   score += 5
  if (form.has_ai_governance_committee)   score += 5
  if (form.has_existing_ai_policy)        score += 5
  const clamped = Math.max(0, Math.min(100, score))
  const risk = clamped >= 80 ? 'low' : clamped >= 60 ? 'medium' : clamped >= 35 ? 'high' : 'critical'
  return { score: clamped, risk, flags }
}

function predictedLaws(form) {
  const laws = []
  const tools = form.ai_tools || []
  const state = form.state || ''
  if (form.accepts_medicare_medicaid) {
    laws.push({ id: 'HIPAA_AI', name: 'HIPAA with AI Addendum', jurisdiction: 'Federal', confidence: 98 })
    laws.push({ id: 'CMS_AI_STRATEGY', name: 'CMS AI Strategy Requirements', jurisdiction: 'Federal', confidence: 95 })
  }
  if (tools.includes('chatgpt_clinical') || tools.includes('azure_openai_clinical'))
    laws.push({ id: 'FTC_AI_HEALTH', name: 'FTC Section 5 — AI Health Claims', jurisdiction: 'Federal', confidence: 87 })
  if (tools.includes('billing_coding_ai') || tools.includes('optum_claims_ai'))
    laws.push({ id: 'ACA_1557', name: 'ACA Section 1557 — Non-Discrimination', jurisdiction: 'Federal', confidence: 90 })
  if (tools.includes('epic_sepsis_model') || tools.includes('radiology_ai_cad') || tools.includes('viz_ai'))
    laws.push({ id: 'FDA_AI_DEVICE', name: 'FDA AI/ML Medical Device Guidance', jurisdiction: 'Federal', confidence: 92 })
  if (state === 'Texas' && tools.length > 0)
    laws.push({ id: 'TRAIGA', name: 'Texas Responsible AI Governance Act', jurisdiction: 'State', confidence: 96 })
  if (state === 'California')
    laws.push({ id: 'CA_AB_2013', name: 'California AB 2013 — AI Training Data', jurisdiction: 'State', confidence: 88 })
  if (state === 'Colorado')
    laws.push({ id: 'CO_SB_205', name: 'Colorado AI Act (SB 24-205)', jurisdiction: 'State', confidence: 93 })
  if (state === 'Illinois')
    laws.push({ id: 'IL_AI_ACT', name: 'Illinois Artificial Intelligence Act', jurisdiction: 'State', confidence: 89 })
  if (state === 'Minnesota')
    laws.push({ id: 'MN_PRIVACY', name: 'Minnesota Consumer Data Privacy Act', jurisdiction: 'State', confidence: 85 })
  if (form.joint_commission_accredited)
    laws.push({ id: 'TJC_AI', name: 'Joint Commission AI Standards (2025)', jurisdiction: 'Accreditation', confidence: 88 })
  return laws
}

// ── HOSPITAL FORM ──────────────────────────────────────────────────────────

function BatchPatientReport({ patient, user, onBack }) {
  const tools = JSON.parse(patient.ai_tools_used || '[]')
  const gaps  = JSON.parse(patient.governance_gaps || '[]')

  const TOOL_NAMES = {
    epic_sepsis_model:'Epic Sepsis Prediction Model', billing_coding_ai:'AI-Assisted Medical Coding',
    radiology_ai_cad:'Radiology AI / CADe Detection', viz_ai:'Viz.ai Stroke Detection',
    nuance_dax:'Nuance DAX Documentation', chatgpt_clinical:'Consumer AI (ChatGPT)',
    ehr_predictive_analytics:'EHR Predictive Analytics', optum_claims_ai:'Prior Authorization AI',
    ambient_clinical_intelligence:'Ambient Clinical Intelligence', azure_openai_clinical:'Azure OpenAI Clinical',
  }
  const TOOL_DESCS = {
    epic_sepsis_model:'Continuously monitored your vital signs and lab values to predict sepsis risk. Supported your care team with early-warning alerts — likely helped catch problems faster.',
    billing_coding_ai:'Translated clinical notes to insurance billing codes. A human coder reviewed all codes before final submission to your insurer.',
    radiology_ai_cad:'Analyzed your imaging studies to assist radiologists in spotting findings. The final interpretation was always made by a licensed radiologist.',
    viz_ai:'Analyzed brain imaging to detect signs of stroke or hemorrhage in real time. All clinical decisions were made by physicians.',
    chatgpt_clinical:'A consumer AI chatbot was used by a care team member. This tool has no formal hospital approval and no data protection agreement covering your health information.',
    ehr_predictive_analytics:'Your electronic health record used predictive models to flag potential clinical risks. These models influence which alerts your care team sees.',
    optum_claims_ai:'An AI system evaluated your prior authorization requests and insurance coverage. Its recommendations may have affected which treatments were approved.',
    nuance_dax:'An ambient AI system listened during clinical encounters to automatically generate documentation notes for your care team.',
    ambient_clinical_intelligence:'An AI recording tool transcribed clinical encounters. Patient consent documentation is required but may not have been collected.',
    azure_openai_clinical:'An enterprise AI integration assisted clinicians with documentation and clinical decision support throughout your stay.',
  }
  const TOOL_FRAMING = {
    epic_sepsis_model:             { label:'This protected you',   color:'#15803d', bg:'#f0fdf4', dot:'#22c55e' },
    billing_coding_ai:             { label:'This was routine',     color:'#d97706', bg:'#fffbeb', dot:'#f59e0b' },
    radiology_ai_cad:              { label:'This protected you',   color:'#15803d', bg:'#f0fdf4', dot:'#22c55e' },
    viz_ai:                        { label:'This protected you',   color:'#15803d', bg:'#f0fdf4', dot:'#22c55e' },
    chatgpt_clinical:              { label:'This is a concern',    color:'#dc2626', bg:'#fef2f2', dot:'#ef4444' },
    ehr_predictive_analytics:      { label:'This was routine',     color:'#d97706', bg:'#fffbeb', dot:'#f59e0b' },
    optum_claims_ai:               { label:'This was routine',     color:'#d97706', bg:'#fffbeb', dot:'#f59e0b' },
    nuance_dax:                    { label:'This was routine',     color:'#d97706', bg:'#fffbeb', dot:'#f59e0b' },
    ambient_clinical_intelligence: { label:'This is a concern',    color:'#dc2626', bg:'#fef2f2', dot:'#ef4444' },
    azure_openai_clinical:         { label:'This was routine',     color:'#d97706', bg:'#fffbeb', dot:'#f59e0b' },
  }

  // Derived risk values
  const riskWeights = { chatgpt_clinical:42, ambient_clinical_intelligence:32, optum_claims_ai:20, ehr_predictive_analytics:18, billing_coding_ai:15, nuance_dax:10, azure_openai_clinical:8 }
  const riskTarget  = Math.min(tools.reduce((s,t) => s + (riskWeights[t]||0), 0), 100)
  const criticalCount = tools.filter(t => ['chatgpt_clinical','ambient_clinical_intelligence'].includes(t)).length
  const watchCount    = tools.filter(t => ['optum_claims_ai','ehr_predictive_analytics','billing_coding_ai','nuance_dax'].includes(t)).length
  const hasChatGPT    = tools.includes('chatgpt_clinical')
  const hasSepsis     = tools.includes('epic_sepsis_model')
  const hasBilling    = tools.includes('billing_coding_ai')
  const complianceScore = patient.compliance_score || 74
  // Stable synthetic event count — seeded from patient id to avoid re-render churn
  const clinicalEventCount = 120 + ((patient.id||'').split('').reduce((s,c)=>s+c.charCodeAt(0),0) % 180)

  // ── State ─────────────────────────────────────────────────────────────────
  const [scanning, setScanning]           = React.useState(true)
  const [scanPhase, setScanPhase]         = React.useState(0)
  const [scanPct, setScanPct]             = React.useState(0)
  const [mounted, setMounted]             = React.useState(false)
  const [toolsVisible, setToolsVisible]   = React.useState(0)
  const [sectionsVisible, setSectionsVisible] = React.useState(0)
  const [riskScore, setRiskScore]         = React.useState(0)
  const [rightsVisible, setRightsVisible] = React.useState(0)
  const [submitting, setSubmitting]       = React.useState({})
  const [submitted, setSubmitted]         = React.useState({})
  const [ticketNums, setTicketNums]       = React.useState({})
  const [showEscalation, setShowEscalation] = React.useState(false)
  const [pdfGenerating, setPdfGenerating] = React.useState(false)
  const [pdfPhase, setPdfPhase]           = React.useState(0)
  const [pdfPct, setPdfPct]               = React.useState(0)

  const SCAN_PHASES = [
    `Retrieving your encounter data from ${patient.department || 'ICU'}...`,
    `Analyzing ${tools.length} AI system${tools.length !== 1 ? 's' : ''} active during your stay...`,
    'Generating your personal compliance report...',
  ]
  const PDF_PHASES = ['Compiling visit data...','Adding AI disclosures...','Generating rights section...','Finalizing document...']

  // Scanning sequence
  React.useEffect(() => {
    let pct = 0
    const pctI = setInterval(() => { pct += 2; setScanPct(Math.min(pct, 100)) }, 50)
    const t1 = setTimeout(() => setScanPhase(1), 900)
    const t2 = setTimeout(() => setScanPhase(2), 1800)
    const t3 = setTimeout(() => { clearInterval(pctI); setScanPct(100); setScanning(false); setTimeout(() => setMounted(true), 80) }, 2700)
    return () => { clearInterval(pctI); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  // Post-scan entrance animations
  React.useEffect(() => {
    if (!mounted) return
    let i = 0; const ti = setInterval(() => { i++; setToolsVisible(i); if (i >= tools.length) clearInterval(ti) }, 150)
    let s = 0; const si = setInterval(() => { s++; setSectionsVisible(s); if (s >= 9) clearInterval(si) }, 220)
    let r = 0; const ri = setInterval(() => { r++; setRightsVisible(r); if (r >= 3) clearInterval(ri) }, 200)
    const start = performance.now()
    const animRisk = (now) => {
      const p = Math.min((now - start) / 1500, 1)
      setRiskScore(Math.round(riskTarget * (1 - Math.pow(1 - p, 3))))
      if (p < 1) requestAnimationFrame(animRisk)
    }
    requestAnimationFrame(animRisk)
    return () => { clearInterval(ti); clearInterval(si); clearInterval(ri) }
  }, [mounted])

  const handleRequest = (type) => {
    if (submitted[type] || submitting[type]) return
    setSubmitting(s => ({...s, [type]: true}))
    setTimeout(() => {
      const num = 40000 + Math.floor(Math.random() * 9999)
      setSubmitting(s => ({...s, [type]: false}))
      setSubmitted(s => ({...s, [type]: { ticket: num, time: new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) }}))
      let n = 0
      const ci = setInterval(() => { n += Math.ceil(num/20); setTicketNums(p=>({...p,[type]:Math.min(n,num)})); if (n>=num) clearInterval(ci) }, 30)
    }, 1300)
  }

  const handlePdf = () => {
    if (pdfGenerating) return
    setPdfGenerating(true); setPdfPhase(0); setPdfPct(0)
    let ph = 0; const pi = setInterval(() => { ph++; setPdfPhase(ph); if (ph >= PDF_PHASES.length) clearInterval(pi) }, 700)
    let pc = 0; const ci = setInterval(() => { pc += 3; setPdfPct(Math.min(pc,100)); if (pc>=100) { clearInterval(ci); setTimeout(()=>setPdfGenerating(false),300) } }, 90)
  }

  // Synthetic stay timeline
  const los = Math.min(patient.los_days || 3, 6)
  const admDate = new Date(patient.admission_date || '2025-01-15')
  const timelineDays = Array.from({length: los}, (_,i) => {
    const d = new Date(admDate); d.setDate(d.getDate() + i)
    const label = d.toLocaleDateString('en-US',{month:'short',day:'numeric'})
    const events = []
    if (i === 0) {
      events.push({text:`Admitted to ${patient.department||'ICU'}`,type:'neutral'})
      if (hasSepsis) events.push({text:'Sepsis monitoring AI activated — tracking vitals every 15 min',type:'protect'})
    }
    if (i === 1 && hasSepsis) events.push({text:'AI flagged elevated risk at 3:14am — attending notified, care adjusted',type:'protect'})
    if (i === 1 && hasChatGPT) events.push({text:'Consumer AI accessed by staff — not covered by data protection agreement',type:'concern'})
    if (i === 2 && hasBilling) events.push({text:'AI Billing began generating insurance codes from clinical notes',type:'neutral'})
    if (i === 2 && hasSepsis) events.push({text:'Sepsis model: 4 readings scored — all within safe range',type:'protect'})
    if (i === 3 && hasSepsis) events.push({text:'Sepsis risk score trending down — care team briefed on model output',type:'protect'})
    if (i === los-1) events.push({text:'Discharge processed — billing codes submitted for human review',type:'neutral'})
    if (events.length === 0) events.push({text:`Day ${i+1} — Routine monitoring, no AI alerts fired`,type:'neutral'})
    return {day:i+1, label, events}
  })

  const riskColor = riskScore > 65 ? '#dc2626' : riskScore > 35 ? '#d97706' : '#15803d'

  // ── Scanning overlay ───────────────────────────────────────────────────────
  if (scanning) return (
    <div style={{minHeight:'100vh',background:'#0c110c',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20}}>
      <div style={{fontSize:10,fontFamily:'var(--font-m)',color:'rgba(34,197,94,0.6)',letterSpacing:'0.2em'}}>CLEARPATH PATIENT PORTAL</div>
      <div style={{fontSize:18,fontWeight:700,color:'#fff',fontFamily:'var(--font-d)',textAlign:'center',maxWidth:360}}>{SCAN_PHASES[scanPhase]}</div>
      <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',fontFamily:'var(--font-m)'}}>Based on {patient.los_days||3} days of clinical data</div>
      <div style={{width:320,height:2,background:'rgba(255,255,255,0.08)',borderRadius:1,overflow:'hidden',marginTop:8}}>
        <div style={{height:'100%',width:scanPct+'%',background:'linear-gradient(90deg,#15803d,#22c55e)',transition:'width 0.1s linear'}} />
      </div>
      <div style={{fontSize:10,fontFamily:'var(--font-m)',color:'rgba(255,255,255,0.25)'}}>{scanPct}%</div>
      <div style={{position:'relative',width:320,height:1,background:'rgba(255,255,255,0.04)',overflow:'hidden'}}>
        <div style={{position:'absolute',top:0,left:0,height:'100%',width:60,background:'linear-gradient(90deg,transparent,rgba(34,197,94,0.5),transparent)',animation:'scanLine 1.5s linear infinite'}} />
      </div>
    </div>
  )

  // ── Main report ────────────────────────────────────────────────────────────
  return (
    <div style={{minHeight:'100vh',background:'#f9fafb',opacity:mounted?1:0,transition:'opacity 0.5s ease'}}>
      <nav style={{height:60,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 48px',borderBottom:'1px solid var(--border)',background:'rgba(255,255,255,0.97)',position:'sticky',top:0,zIndex:100,backdropFilter:'blur(8px)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button onClick={onBack} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:13,fontFamily:'var(--font-b)'}}>← Back</button>
          <div style={{width:1,height:16,background:'var(--border)'}} />
          <ClearPathLogo />
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{fontSize:10,color:'var(--text4)',fontFamily:'var(--font-m)'}}>Analysis confidence:</span>
          <span style={{fontSize:10,color:'#15803d',fontFamily:'var(--font-m)',fontWeight:700}}>92%</span>
          <span style={{fontSize:10,color:'var(--text4)',fontFamily:'var(--font-m)',marginLeft:4}}>· Based on system logs &amp; policy records</span>
        </div>
      </nav>

      <div style={{maxWidth:900,margin:'0 auto',padding:'36px 48px'}}>

        {/* ── Hero panel ── */}
        <div style={{background:'#0c110c',borderRadius:16,padding:'28px 32px',marginBottom:28,animation:'slideInLeft 0.4s ease',overflow:'hidden',position:'relative'}}>
          <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:'linear-gradient(90deg,#15803d,#22c55e,transparent)',opacity:0.8}} />
          <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'rgba(34,197,94,0.65)',letterSpacing:'0.18em',marginBottom:10}}>VERIFIED ENCOUNTER — PATIENT TRANSPARENCY REPORT</div>
          <div style={{display:'flex',gap:28,alignItems:'flex-start',flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:260}}>
              <h1 style={{fontFamily:'var(--font-d)',fontWeight:800,fontSize:24,color:'#fff',letterSpacing:'-0.02em',marginBottom:6,lineHeight:1.2}}>AI Used During Your Care</h1>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',marginBottom:16,lineHeight:1.65}}>Here is exactly what happened during your {patient.los_days||3}-day stay — every AI system, what it did, and what your rights are.</div>
              <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
                {[{label:'ADMISSION ID',val:patient.adm_id},{label:'DATE',val:patient.admission_date},{label:'UNIT',val:patient.department||'ICU'},{label:'STAY',val:`${patient.los_days||3} days`}].map((item,i) => (
                  <div key={item.label} style={{animation:`countIn 0.3s ease ${i*0.1+0.2}s both`}}>
                    <div style={{fontSize:8,color:'rgba(255,255,255,0.3)',fontFamily:'var(--font-m)',letterSpacing:'0.1em'}}>{item.label}</div>
                    <div style={{fontSize:12,color:'rgba(255,255,255,0.8)',fontFamily:'var(--font-m)',fontWeight:600,marginTop:2}}>{item.val}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{borderLeft:'1px solid rgba(255,255,255,0.07)',paddingLeft:24,minWidth:190}}>
              <div style={{fontSize:8,color:'rgba(255,255,255,0.3)',fontFamily:'var(--font-m)',letterSpacing:'0.12em',marginBottom:10}}>AI SYSTEMS DETECTED</div>
              {tools.map((t,i) => {
                const f = TOOL_FRAMING[t] || {dot:'#9ca3af'}
                const isCrit = t === 'chatgpt_clinical'
                return (
                  <div key={t} style={{display:'flex',alignItems:'center',gap:8,marginBottom:7,animation:`countIn 0.3s ease ${i*0.12+0.3}s both`}}>
                    <div style={{width:6,height:6,borderRadius:'50%',background:f.dot,flexShrink:0,animation:isCrit?'glowPulse 2s ease infinite':'none'}} />
                    <span style={{fontSize:11,color:'rgba(255,255,255,0.7)',flex:1}}>{TOOL_NAMES[t]||t.replace(/_/g,' ')}</span>
                    {isCrit && <span style={{fontSize:8,padding:'1px 5px',borderRadius:3,background:'rgba(220,38,38,0.2)',color:'#f87171',border:'1px solid rgba(220,38,38,0.3)',fontFamily:'var(--font-m)',fontWeight:700,animation:'pulse 1.5s ease 3'}}>CRITICAL</span>}
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{marginTop:16,paddingTop:12,borderTop:'1px solid rgba(255,255,255,0.06)',fontSize:9,color:'rgba(255,255,255,0.28)',fontFamily:'var(--font-m)',display:'flex',gap:14,flexWrap:'wrap'}}>
            <span>Based on {clinicalEventCount} clinical events during your stay</span>
            <span>·</span>
            <span>Analyzed from {patient.department||'ICU'} monitoring systems and hospital logs</span>
          </div>
        </div>

        {/* ── Personal risk meter ── */}
        {sectionsVisible >= 1 && (
          <div style={{marginBottom:22,animation:'fadeUp 0.4s ease both'}}>
            <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:14,padding:'22px 28px',display:'flex',gap:24,alignItems:'center',flexWrap:'wrap'}}>
              <div style={{position:'relative',width:96,height:54,flexShrink:0}}>
                <svg width="96" height="54" viewBox="0 0 96 54">
                  <path d="M 8 50 A 40 40 0 0 1 88 50" stroke="#f3f4f6" strokeWidth="7" fill="none" strokeLinecap="round"/>
                  <path d="M 8 50 A 40 40 0 0 1 88 50" stroke={riskColor} strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray={`${(riskScore/100)*125.7} 125.7`} style={{transition:'all 0.05s linear'}}/>
                </svg>
                <div style={{position:'absolute',bottom:2,left:0,right:0,textAlign:'center',fontSize:20,fontWeight:800,fontFamily:'var(--font-d)',color:riskColor,lineHeight:1}}>{riskScore}</div>
              </div>
              <div style={{flex:1,minWidth:200}}>
                <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.12em',marginBottom:4}}>YOUR PERSONAL RISK ASSESSMENT</div>
                <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>
                  {criticalCount > 0 ? `We found ${criticalCount} serious issue${criticalCount>1?'s':''} and ${watchCount} thing${watchCount!==1?'s':''} to watch.` : watchCount > 0 ? `We found ${watchCount} items to keep an eye on.` : 'Your AI care record looks clean.'}
                </div>
                <div style={{fontSize:11,color:'var(--text2)',lineHeight:1.55}}>
                  {criticalCount > 0 ? 'Your data may have been exposed to an unauthorized AI system. Review the concerns below and consider taking action.' : 'The AI systems used during your care followed standard hospital governance protocols.'}
                </div>
              </div>
              <div style={{borderLeft:'1px solid var(--border)',paddingLeft:20,minWidth:170,flexShrink:0}}>
                <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.08em',marginBottom:5}}>COMPARISON</div>
                <div style={{fontSize:11,color:'var(--text2)',lineHeight:1.65}}>
                  Average ICU stay uses <strong>2.4</strong> AI tools.<br/>
                  Your stay used <strong style={{color:tools.length > 2.4 ? '#d97706' : '#15803d'}}>{tools.length}</strong>
                  {criticalCount > 0 ? `, including ${criticalCount} with a governance issue.` : '.'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Stay timeline ── */}
        {sectionsVisible >= 2 && (
          <div style={{marginBottom:22,animation:'fadeUp 0.4s ease both'}}>
            <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.12em',marginBottom:10}}>YOUR STAY TIMELINE</div>
            <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:14,padding:'20px 24px',overflowX:'auto'}}>
              <div style={{display:'flex',minWidth:Math.max(timelineDays.length*120, 400),position:'relative'}}>
                {timelineDays.map((day,i) => (
                  <div key={i} style={{flex:1,position:'relative',animation:`countIn 0.35s ease ${i*0.12}s both`}}>
                    {i < timelineDays.length-1 && <div style={{position:'absolute',top:9,left:'50%',right:'-50%',height:2,background:'var(--border)',zIndex:0}} />}
                    <div style={{position:'relative',zIndex:1,display:'flex',flexDirection:'column',alignItems:'center'}}>
                      <div style={{width:20,height:20,borderRadius:'50%',background:'#fff',border:'2px solid #d1d5db',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:7,flexShrink:0}}>
                        <div style={{width:6,height:6,borderRadius:'50%',background:'#15803d'}} />
                      </div>
                      <div style={{fontSize:8,fontFamily:'var(--font-m)',color:'var(--text4)',marginBottom:5,textAlign:'center'}}>Day {day.day}<br/>{day.label}</div>
                      <div style={{display:'flex',flexDirection:'column',gap:3,alignItems:'center',maxWidth:115,width:'100%'}}>
                        {day.events.map((ev,j) => (
                          <div key={j} style={{fontSize:8,color:ev.type==='concern'?'#dc2626':ev.type==='protect'?'#15803d':'var(--text3)',textAlign:'center',lineHeight:1.45,padding:'3px 5px',borderRadius:4,background:ev.type==='concern'?'#fef2f2':ev.type==='protect'?'#f0fdf4':'#f9fafb',animation:`countIn 0.3s ease ${i*0.12+j*0.1+0.15}s both`}}>
                            {ev.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Tool cards — cascade in ── */}
        {sectionsVisible >= 3 && (
          <div style={{marginBottom:22,animation:'fadeUp 0.4s ease both'}}>
            <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.12em',marginBottom:10}}>AI SYSTEMS ACTIVE DURING YOUR VISIT</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {tools.map((t,i) => {
                const f = TOOL_FRAMING[t] || {label:'This was routine',color:'#d97706',bg:'#fffbeb',dot:'#f59e0b'}
                const isCrit = t==='chatgpt_clinical' || t==='ambient_clinical_intelligence'
                const vis = toolsVisible > i
                return (
                  <div key={t} style={{opacity:vis?1:0,transform:vis?'translateX(0)':'translateX(-18px)',transition:`all 0.3s ease ${i*0.15}s`,padding:'18px 20px',borderRadius:12,background:'#fff',border:isCrit?'1.5px solid #fecaca':'1px solid var(--border)',cursor:'default'}}
                    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow=`0 8px 24px ${f.dot}33`}}
                    onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,flexWrap:'wrap'}}>
                      <span style={{fontSize:13,fontWeight:700,flex:1}}>{TOOL_NAMES[t]||t.replace(/_/g,' ')}</span>
                      <span style={{fontSize:10,padding:'3px 11px',borderRadius:20,background:f.bg,color:f.color,fontWeight:600,border:`1px solid ${f.dot}55`,flexShrink:0,display:'flex',alignItems:'center',gap:5}}>
                        <span style={{width:6,height:6,borderRadius:'50%',background:f.dot,display:'inline-block'}} />{f.label}
                      </span>
                      {isCrit && <span style={{fontSize:8,padding:'2px 6px',borderRadius:3,background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',fontFamily:'var(--font-m)',fontWeight:700}}>CONCERN</span>}
                    </div>
                    <p style={{fontSize:11,color:'var(--text2)',lineHeight:1.65,margin:0}}>{TOOL_DESCS[t]||'AI system was active during your care.'}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Hospital trust score ── */}
        {sectionsVisible >= 4 && (
          <div style={{marginBottom:22,animation:'fadeUp 0.4s ease both'}}>
            <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:14,padding:'18px 24px',display:'flex',alignItems:'center',gap:18,flexWrap:'wrap'}}>
              <div style={{width:52,height:52,borderRadius:12,background:complianceScore>=80?'#f0fdf4':complianceScore>=60?'#fffbeb':'#fef2f2',border:`2px solid ${complianceScore>=80?'#bbf7d0':complianceScore>=60?'#fde68a':'#fecaca'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span style={{fontSize:15,fontWeight:800,fontFamily:'var(--font-d)',color:complianceScore>=80?'#15803d':complianceScore>=60?'#d97706':'#dc2626'}}>{complianceScore}</span>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.1em',marginBottom:3}}>YOUR HOSPITAL'S AI SAFETY RATING</div>
                <div style={{fontSize:14,fontWeight:700,marginBottom:2}}>{complianceScore>=80?'Good Standing':complianceScore>=60?'Moderate Risk':'High Risk'} — {complianceScore}/100</div>
                <div style={{fontSize:11,color:'var(--text3)'}}>Compared to similar hospitals: {complianceScore>=80?'Above average':complianceScore>=65?'Slightly below average':'Below average'}</div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontSize:9,color:'var(--text4)',fontFamily:'var(--font-m)',marginBottom:3}}>VERIFIED BY</div>
                <div style={{fontSize:12,color:'var(--text)',fontWeight:600}}>ClearPath AI</div>
                <div style={{fontSize:9,color:'var(--text4)',fontFamily:'var(--font-m)',marginTop:1}}>{gaps.length} governance checks run</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Legal rights — flip in ── */}
        {sectionsVisible >= 5 && (
          <div style={{marginBottom:22,animation:'fadeUp 0.4s ease both'}}>
            <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.12em',marginBottom:10}}>YOUR LEGAL RIGHTS</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[
                {title:'Request Human Review',desc:'You can request that a licensed human clinician review any AI-assisted decision that affected your care under HIPAA and HHS AI Safety guidelines.',color:'#2563eb',bg:'#eff6ff',border:'#bfdbfe',type:'review',urgent:false},
                {title:'Request AI Explanation',desc:'Under applicable state law, you have the right to a plain-language explanation of how AI influenced your diagnosis or treatment plan.',color:'#15803d',bg:'#f0fdf4',border:'#bbf7d0',type:'explain',urgent:false},
                ...(hasChatGPT?[{title:'File a Complaint — HIPAA Data Breach',desc:'ChatGPT was used without a Business Associate Agreement. Your health data may have left the hospital without legal protection. File a complaint with HHS Office for Civil Rights.',color:'#dc2626',bg:'#fef2f2',border:'#fecaca',type:'complaint',urgent:true}]:[]),
              ].map((r,i) => (
                <div key={r.type} style={{opacity:rightsVisible>i?1:0,transform:rightsVisible>i?'translateX(0)':'translateX(-24px)',transition:`all 0.35s ease ${i*0.2}s`,padding:'16px 18px',borderRadius:12,background:r.bg,border:`1.5px solid ${r.border}`}}>
                  <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                    <div style={{width:26,height:26,borderRadius:8,background:'rgba(255,255,255,0.65)',border:`1.5px solid ${r.border}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>
                      <span style={{color:r.color,fontWeight:700,fontSize:12}}>✓</span>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:700,color:r.color,marginBottom:3}}>{r.title}</div>
                      <div style={{fontSize:11,color:'var(--text2)',lineHeight:1.6}}>{r.desc}</div>
                    </div>
                    {r.urgent && <span style={{fontSize:8,padding:'2px 6px',borderRadius:4,background:'rgba(220,38,38,0.1)',color:'#dc2626',border:'1px solid #fecaca',fontFamily:'var(--font-m)',fontWeight:700,flexShrink:0}}>URGENT</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Action buttons ── */}
        {sectionsVisible >= 6 && (
          <div style={{marginBottom:22,animation:'fadeUp 0.4s ease both'}}>
            <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.12em',marginBottom:12}}>TAKE ACTION</div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              {[{type:'review',label:'Request Human Review',color:'#2563eb',bg:'#eff6ff'},{type:'explain',label:'Request AI Explanation',color:'#15803d',bg:'#f0fdf4'}].map(btn => (
                <button key={btn.type} onClick={()=>handleRequest(btn.type)} disabled={!!submitted[btn.type]}
                  style={{padding:'10px 18px',borderRadius:10,background:submitted[btn.type]?btn.bg:'#fff',border:`1.5px solid ${submitted[btn.type]?btn.color+'44':'var(--border)'}`,color:submitted[btn.type]?btn.color:'var(--text)',fontSize:12,fontWeight:600,cursor:submitted[btn.type]?'default':'pointer',fontFamily:'var(--font-b)',display:'flex',alignItems:'center',gap:8,transition:'all 0.2s',transform:submitting[btn.type]?'scale(0.97)':'scale(1)'}}>
                  {submitting[btn.type] ? <><span style={{width:10,height:10,border:`2px solid ${btn.color}`,borderTopColor:'transparent',borderRadius:'50%',display:'inline-block',animation:'spin 0.8s linear infinite'}} /><span>Submitting...</span></> :
                   submitted[btn.type] ? <><span>✓</span><span>Submitted — REQ-{ticketNums[btn.type]||submitted[btn.type].ticket}</span></> :
                   <span>{btn.label}</span>}
                </button>
              ))}
              <button onClick={handlePdf} style={{padding:'10px 18px',borderRadius:10,background:'#fff',border:'1.5px solid var(--border)',color:'var(--text)',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'var(--font-b)',display:'flex',alignItems:'center',gap:8,transition:'all 0.2s'}}
                onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'} onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                <span>⬇</span> Download Rights Card
              </button>
            </div>

            {/* Case status — appears after submission */}
            {(submitted.review || submitted.explain) && (
              <div style={{marginTop:16,padding:'18px 20px',borderRadius:12,background:'#f0fdf4',border:'1.5px solid #bbf7d0',animation:'slideInUp 0.3s ease'}}>
                <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'#15803d',letterSpacing:'0.12em',marginBottom:10}}>YOUR REQUESTS</div>
                {Object.entries(submitted).map(([type,info]) => (
                  <div key={type} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:'1px solid rgba(21,128,61,0.1)'}}>
                    <div style={{width:7,height:7,borderRadius:'50%',background:'#22c55e',animation:'glowPulse 2s ease infinite'}} />
                    <span style={{fontSize:12,fontWeight:600,flex:1}}>{type==='review'?'Human Review Request':'AI Explanation Request'} — <span style={{color:'#15803d'}}>In Progress</span></span>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:10,fontFamily:'var(--font-m)',color:'var(--text3)'}}>REQ-{ticketNums[type]||info.ticket}</div>
                      <div style={{fontSize:9,color:'var(--text4)',fontFamily:'var(--font-m)'}}>Submitted {info.time}</div>
                    </div>
                  </div>
                ))}
                <div style={{marginTop:12,padding:'10px 14px',borderRadius:8,background:'rgba(21,128,61,0.07)',border:'1px solid rgba(21,128,61,0.12)',marginBottom:12}}>
                  <div style={{fontSize:11,color:'#15803d',fontWeight:600,marginBottom:2}}>Your request triggered a compliance review.</div>
                  <div style={{fontSize:10,color:'var(--text2)'}}>The AI systems identified during your stay are now under investigation by the hospital compliance office.</div>
                </div>
                <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.08em',marginBottom:8}}>WHAT HAPPENS NEXT</div>
                {[
                  {step:'Request received',done:true,desc:'Logged in the hospital compliance system'},
                  {step:'Hospital reviews within 72 hours',done:false,desc:'Compliance officer assigned to your case'},
                  {step:'You will be contacted',done:false,desc:'Via the email on file within the response window'},
                  {step:'If no response, escalate',done:false,desc:'Use the escalation path below'},
                ].map((s,i) => (
                  <div key={i} style={{display:'flex',gap:10,marginBottom:7,animation:`countIn 0.3s ease ${i*0.1}s both`}}>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                      <div style={{width:15,height:15,borderRadius:'50%',background:s.done?'#15803d':'#e5e7eb',border:`2px solid ${s.done?'#15803d':'#d1d5db'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        {s.done && <span style={{fontSize:7,color:'#fff',fontWeight:700}}>✓</span>}
                      </div>
                      {i<3 && <div style={{width:1,height:14,background:'#e5e7eb',marginTop:2}} />}
                    </div>
                    <div style={{paddingTop:1}}>
                      <div style={{fontSize:11,fontWeight:600,color:s.done?'#15803d':'var(--text)'}}>{s.step}</div>
                      <div style={{fontSize:10,color:'var(--text3)'}}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Escalation path ── */}
        {sectionsVisible >= 7 && (
          <div style={{marginBottom:22,animation:'fadeUp 0.4s ease both'}}>
            <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden'}}>
              <button onClick={()=>setShowEscalation(e=>!e)} style={{width:'100%',padding:'13px 20px',background:'none',border:'none',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',fontFamily:'var(--font-b)'}}>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <span style={{fontSize:11,fontWeight:600}}>If no response within 72 hours...</span>
                  <span style={{fontSize:9,padding:'2px 8px',borderRadius:4,background:'#fffbeb',color:'#d97706',border:'1px solid #fde68a',fontFamily:'var(--font-m)',fontWeight:700}}>ESCALATION PATH</span>
                </div>
                <span style={{fontSize:10,color:'var(--text4)',transition:'transform 0.2s',transform:showEscalation?'rotate(180deg)':'rotate(0deg)'}}>▼</span>
              </button>
              {showEscalation && (
                <div style={{padding:'0 20px 16px',borderTop:'1px solid var(--border)',animation:'slideInUp 0.2s ease'}}>
                  {[
                    {icon:'🏥',label:'Escalate to Hospital Compliance Officer',desc:'Contact the hospital compliance office directly and reference your case ID.',action:'Get Contact Info'},
                    {icon:'🏛',label:'File with State Health Authority',desc:'Submit a formal complaint to your state health department AI oversight office.',action:'File Complaint'},
                    {icon:'📄',label:'Download Report for Legal Review',desc:'Download your full AI governance report as a PDF for use in any legal proceeding.',action:'Download PDF'},
                  ].map((item,i) => (
                    <div key={i} style={{display:'flex',gap:12,padding:'12px 0',borderBottom:i<2?'1px solid var(--border)':'none',alignItems:'center'}}>
                      <span style={{fontSize:18,flexShrink:0}}>{item.icon}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>→ {item.label}</div>
                        <div style={{fontSize:10,color:'var(--text3)'}}>{item.desc}</div>
                      </div>
                      <button style={{fontSize:11,padding:'5px 12px',borderRadius:6,background:'#f9fafb',border:'1px solid var(--border)',color:'var(--text)',cursor:'pointer',fontFamily:'var(--font-b)',flexShrink:0,fontWeight:600}}>{item.action}</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Patient history ── */}
        {sectionsVisible >= 8 && (
          <div style={{marginBottom:22,animation:'fadeUp 0.4s ease both'}}>
            <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.12em',marginBottom:10}}>YOUR AI CARE HISTORY</div>
            <div style={{display:'flex',gap:10}}>
              {[{date:'Jan 2025',type:'ICU Stay',tools:tools.length,current:true},{date:'Nov 2024',type:'Emergency Visit',tools:1,current:false}].map((enc,i) => (
                <div key={i} style={{flex:1,padding:'14px 18px',borderRadius:12,background:enc.current?'#f0fdf4':'#fff',border:`1.5px solid ${enc.current?'#bbf7d0':'var(--border)'}`,position:'relative'}}>
                  {enc.current && <div style={{position:'absolute',top:10,right:12,fontSize:8,padding:'1px 6px',borderRadius:3,background:'#15803d',color:'#fff',fontFamily:'var(--font-m)',fontWeight:700}}>CURRENT</div>}
                  <div style={{fontSize:10,fontFamily:'var(--font-m)',color:'var(--text4)',marginBottom:4}}>{enc.date}</div>
                  <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>{enc.type}</div>
                  <div style={{fontSize:11,color:'var(--text3)'}}>{enc.tools} AI system{enc.tools!==1?'s':''} used</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        {sectionsVisible >= 9 && (
          <div style={{fontSize:10,color:'var(--text4)',lineHeight:1.7,borderTop:'1px solid var(--border)',paddingTop:16,animation:'fadeUp 0.4s ease both'}}>
            Generated by ClearPath AI Governance Platform. Confidence: 92% — based on system logs, policy records, and usage patterns. For informational purposes only. Does not constitute medical or legal advice.
          </div>
        )}
      </div>

      {/* PDF generating overlay */}
      {pdfGenerating && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,animation:'fadeIn 0.2s ease'}}>
          <div style={{background:'#fff',borderRadius:16,padding:'32px 40px',width:360,textAlign:'center',animation:'scaleIn 0.2s ease'}}>
            <div style={{fontSize:16,fontWeight:700,fontFamily:'var(--font-d)',marginBottom:6}}>Preparing your report...</div>
            <div style={{fontSize:12,color:'var(--text3)',marginBottom:20,minHeight:18}}>{PDF_PHASES[Math.min(pdfPhase, PDF_PHASES.length-1)]}</div>
            <div style={{height:4,background:'#f3f4f6',borderRadius:2,overflow:'hidden',marginBottom:8}}>
              <div style={{height:'100%',width:pdfPct+'%',background:'linear-gradient(90deg,#15803d,#22c55e)',borderRadius:2,transition:'width 0.1s linear'}} />
            </div>
            <div style={{fontSize:10,color:'var(--text4)',fontFamily:'var(--font-m)'}}>{pdfPct}%</div>
          </div>
        </div>
      )}
    </div>
  )
}

const REASONING_CHAIN = {
  chatgpt_clinical:             ['Consumer LLM (ChatGPT) API calls observed in clinical network traffic','HIPAA Privacy Rule §164.502 requires BAA for all PHI-handling vendors','No BAA found in vendor governance registry for OpenAI','Critical violation flagged — patient data exposure risk','Remediation required within 72 hours'],
  billing_coding_ai:            ['Automated coding patterns detected in Medicare claims submissions','CMS Claims Processing Manual §4.2 mandates documented human review before submission','No human override workflow documented in audit records','High violation flagged — Medicare fraud exposure','Remediation required within 30 days'],
  epic_sepsis_model:            ['Epic Deterioration Index active in EHR module configuration','CMS AI Strategy requires quarterly demographic bias monitoring for clinical AI','No bias monitoring report on file for current quarter','High violation flagged — algorithmic bias exposure','Remediation required within 90 days'],
  radiology_ai_cad:             ['AI-assisted reading tools detected in PACS workflow integration','FDA 21 CFR Part 892 requires 510(k) clearance for CADe/CADx devices','510(k) clearance documentation not found in governance records','High violation flagged — FDA compliance gap','Remediation required within 30 days'],
  optum_claims_ai:              ['Automated prior authorization decisions detected in payer portal logs','CMS-0057-F requires explainable and auditable AI prior auth decisions','No documented decision criteria found for AI-recommended denials','High violation flagged — CMS 2026 enforcement exposure','Remediation required within 60 days'],
  nuance_dax:                   ['DAX API calls detected via Microsoft Azure integration patterns','State wiretapping laws + HIPAA require explicit patient consent before recording','Patient consent documentation process required prior to activation','Medium finding — consent workflow required','Remediation required within 45 days'],
  ambient_clinical_intelligence:['Ambient documentation plugin detected in EHR marketplace registry','State wiretapping laws + HIPAA require explicit patient consent','Deployed without governance approval in 3 departments','Medium violation flagged — unauthorized deployment','Remediation required within 45 days'],
  ehr_predictive_analytics:     ['Multiple predictive models active in EHR configuration','HHS AI Safety Program (2025) requires patient disclosure when AI influences clinical decisions','No patient disclosure policy found in governance records','High violation flagged — patient transparency gap','Remediation required within 45 days'],
  viz_ai:                       ['Stroke detection AI API calls observed in radiology workflow','AHA/FDA guidance requires algorithm transparency for stroke CADt tools','Patient disclosure not documented for AI-assisted stroke reads','High finding — transparency gap','Remediation required within 30 days'],
  azure_openai_clinical:        ['Azure OpenAI API calls detected in clinical application telemetry','Enterprise LLM deployment requires data processing agreement and PHI logging controls','DPA verification not confirmed in vendor governance registry','Medium finding — documentation gap','Remediation required within 60 days'],
}

function getSourceLabel(methods) {
  const m = (methods?.[0] || '').toLowerCase()
  if (m.includes('ehr') || m.includes('epic') || m.includes('pacs') || m.includes('vendor activation')) return 'EHR telemetry'
  if (m.includes('network') || m.includes('api') || m.includes('microsoft') || m.includes('user behavior') || m.includes('azure')) return 'Network traffic'
  if (m.includes('claims') || m.includes('payer') || m.includes('revenue')) return 'Workflow logs'
  return 'Registry entry'
}

function HospitalForm({ onResult, onBack, user }) {
  const inferredState = user?.city?.split(', ')?.[1] || 'TX'
  const stateMap = { 'MN':'Minnesota','TX':'Texas','CA':'California','IL':'Illinois','MD':'Maryland','AZ':'Arizona','CO':'Colorado','NE':'Nebraska','NY':'New York','FL':'Florida','NC':'North Carolina','OH':'Ohio','PA':'Pennsylvania','MA':'Massachusetts','WA':'Washington','GA':'Georgia','OR':'Oregon' }
  const fullState = stateMap[inferredState] || 'Minnesota'

  const [form, setForm] = useState({ state: fullState, hospital_name: user?.hospital||'', hospital_type:'academic_medical_center', hospital_size:'large', ai_tools:[], accepts_medicare_medicaid:true, has_ai_governance_committee:false, has_existing_ai_policy:false, ehr_vendor:'epic', research_institution:false, pediatric_patients:false, telehealth_services:false, operates_in_multiple_states:false })
  const [loading, setLoading]         = useState(false)
  const [agents, setAgents]           = useState({})
  const [phase, setPhase]             = useState('')
  const [drawer, setDrawer]           = useState(null)
  const [disputedTools, setDisputedTools] = useState([])
  const [showConfig, setShowConfig]   = useState(false)
  const [rowsVisible, setRowsVisible] = useState(0)
  const [mounted, setMounted]         = useState(false)

  React.useEffect(() => {
    setMounted(true)
    const t = setInterval(() => setRowsVisible(v => { if (v >= 12) { clearInterval(t); return v } return v+1 }), 60)
    return () => clearInterval(t)
  }, [])

  const detectedTools = React.useMemo(() => generateDetectedTools(form.hospital_type, form.hospital_size, form.ehr_vendor), [form.hospital_type, form.hospital_size, form.ehr_vendor])

  // Auto-include all detected tools — system already observed them
  React.useEffect(() => {
    setForm(f => ({ ...f, ai_tools: detectedTools.map(t => t.id) }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle  = id => setForm(f => ({ ...f, ai_tools: f.ai_tools.includes(id) ? f.ai_tools.filter(x=>x!==id) : [...f.ai_tools, id] }))
  const dispute = id => { setDisputedTools(d => d.includes(id)?d:[...d,id]); setForm(f => ({...f, ai_tools: f.ai_tools.filter(x=>x!==id)})) }
  const restore = id => { setForm(f => ({ ...f, ai_tools: f.ai_tools.includes(id) ? f.ai_tools : [...f.ai_tools, id] })); setDisputedTools(d => d.filter(x=>x!==id)) }

  const liveRisk = calcRisk(form)
  const liveLaws = predictedLaws(form)
  const liveRiskColor = liveRisk.risk==='critical'?'#dc2626':liveRisk.risk==='high'?'#d97706':liveRisk.risk==='medium'?'#2563eb':'#15803d'
  const doneCount = Object.values(agents).filter(v=>v==='done').length
  const pct = Math.round((doneCount/6)*100)

  const simulate = async () => {
    const steps=[['law_mapper','Law Mapper',300],['gap_scanner','Gap Scanner',1400],['shadow_ai','Shadow AI',1400],['transparency','Patient Transparency',1400],['safety','Safety Validator',3500],['orchestrator','Orchestrator',5500]]
    for(const[key,,delay] of steps){ await new Promise(r=>setTimeout(r,delay)); setAgents(p=>({...p,[key]:'running'})); await new Promise(r=>setTimeout(r,700)); setAgents(p=>({...p,[key]:'done'})) }
  }

  const submit = async () => {
    if(!form.ai_tools.length){ alert('At least one AI system must remain active to generate governance findings'); return }
    setLoading(true); setAgents({})
    simulate()
    try {
      const payload = { ...form, state: form.state.toLowerCase().replace(/ /g,'_'), additional_context: JSON.stringify({ governance_committee: form.has_ai_governance_committee, ai_policy: form.has_existing_ai_policy, ehr: form.ehr_vendor }) }
      const res = await fetch(API + '/api/analyze/hospital',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) })
      const data = await res.json()
      setAgents({law_mapper:'done',gap_scanner:'done',shadow_ai:'done',transparency:'done',safety:'done',orchestrator:'done'})
      setTimeout(()=>onResult({...data, confirmed_tools: form.ai_tools, hospital_npi: user?.npi, scan_type: 'hospital'}),500)
    } catch(e){ alert('API error: '+e.message) }
    finally{ setLoading(false) }
  }

  const agentList=[
    {id:'law_mapper',label:'Law Mapper',desc:'Maps laws to state + tools'},
    {id:'gap_scanner',label:'Gap Scanner',desc:'Finds compliance gaps'},
    {id:'shadow_ai',label:'Shadow AI',desc:'Detects unauthorized tools'},
    {id:'transparency',label:'Patient Transparency',desc:'Generates patient report'},
    {id:'safety',label:'Safety Validator',desc:'Validates all outputs'},
    {id:'orchestrator',label:'Orchestrator',desc:'Assembles final reports'},
  ]

  const govStatus = GOVERNANCE_STATUS

  return (
    <div style={{minHeight:'100vh',background:'#fff',fontFamily:'var(--font-b)'}}>

      {/* Sticky command bar */}
      <div style={{position:'sticky',top:0,zIndex:200,background:'#0c110c',color:'#fff',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 32px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <button onClick={()=>onBack()} style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:13,fontFamily:'var(--font-b)'}}>←</button>
          <div style={{width:1,height:16,background:'rgba(255,255,255,0.15)'}} />
          <ClearPathLogo size="sm" />
          <div style={{width:1,height:16,background:'rgba(255,255,255,0.15)'}} />
          <span style={{fontSize:13,color:'rgba(255,255,255,0.7)',fontFamily:'var(--font-m)'}}>AI GOVERNANCE AUDIT</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:20}}>
          {/* Live score in command bar */}
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontFamily:'var(--font-m)'}}>POSTURE</span>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <div style={{width:80,height:4,background:'rgba(255,255,255,0.15)',borderRadius:99,overflow:'hidden'}}>
                <div style={{height:'100%',width:liveRisk.score+'%',background:liveRiskColor,borderRadius:99,transition:'width 0.4s ease'}} />
              </div>
              <span style={{fontSize:14,fontWeight:700,color:liveRiskColor,fontFamily:'var(--font-d)'}}>{liveRisk.score}</span>
            </div>
            <span style={{padding:'3px 8px',borderRadius:4,background:'rgba(255,255,255,0.1)',fontSize:10,fontWeight:700,color:liveRiskColor,fontFamily:'var(--font-m)'}}>{liveRisk.risk.toUpperCase()}</span>
          </div>
          <div style={{width:1,height:16,background:'rgba(255,255,255,0.15)'}} />
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            {[{label:'LAWS',val:liveLaws.length,color:'#60a5fa'},{label:'FLAGS',val:liveRisk.flags.length,color:'#fbbf24'},{label:'TOOLS',val:form.ai_tools.length,color:'#4ade80'}].map(s=>(
              <div key={s.label} style={{display:'flex',alignItems:'center',gap:4}}>
                <span style={{fontSize:16,fontWeight:800,fontFamily:'var(--font-d)',color:s.color}}>{s.val}</span>
                <span style={{fontSize:9,color:'rgba(255,255,255,0.4)',fontFamily:'var(--font-m)'}}>{s.label}</span>
              </div>
            ))}
          </div>
          <div style={{width:1,height:16,background:'rgba(255,255,255,0.15)'}} />
          {user && <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',fontFamily:'var(--font-m)',textAlign:'right'}}>
            <div>{user.name}</div><div style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>{user.hospital?.split(' ').slice(0,3).join(' ')}</div>
          </div>}
        </div>
      </div>

      <div style={{
        display:'grid', gridTemplateColumns:'1fr 300px', maxWidth:1400, margin:'0 auto', padding:'24px 32px', gap:20, alignItems:'start',
        opacity: mounted?1:0, transform: mounted?'translateY(0)':'translateY(16px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}>

        {/* LEFT — Main content */}
        <div>

          {/* Audit scope — animated pill strip */}
          <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:16,flexWrap:'wrap'}}>
            {[
              {label:'8 AI Systems',   color:'#2563eb', bg:'#eff6ff', border:'#bfdbfe'},
              {label:'6 Departments',  color:'#15803d', bg:'#f0fdf4', border:'#bbf7d0'},
              {label:'247 Events',     color:'#d97706', bg:'#fffbeb', border:'#fde68a'},
              {label:'30-day lookback',color:'var(--text3)', bg:'#f8faf8', border:'var(--border)'},
              {label:'4 Gov. Domains', color:'var(--text3)', bg:'#f8faf8', border:'var(--border)'},
            ].map(({label,color,bg,border},i)=>(
              <span key={label} style={{
                padding:'4px 12px', borderRadius:99, background:bg, border:'1px solid '+border,
                fontSize:11, color, fontFamily:'var(--font-m)', fontWeight:600,
                opacity: mounted?1:0, transform: mounted?'translateY(0)':'translateY(6px)',
                transition: `opacity 0.35s ease ${i*0.07}s, transform 0.35s ease ${i*0.07}s`,
              }}>{label}</span>
            ))}
            <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:'#15803d',animation:'glowPulse 2s ease infinite'}}/>
              <span style={{fontSize:10,color:'var(--text4)',fontFamily:'var(--font-m)'}}>LIVE SCAN</span>
            </div>
          </div>

          {/* AI Systems inventory */}
          <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:16,overflow:'hidden',marginBottom:16,boxShadow:'0 1px 12px rgba(0,0,0,0.04)'}}>
            {/* Header */}
            <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#fafafa',position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,overflow:'hidden',pointerEvents:'none'}}>
                <div style={{position:'absolute',top:0,bottom:0,width:56,background:'linear-gradient(90deg,transparent,rgba(21,128,61,0.05),transparent)',animation:'scanLine 5s linear infinite'}}/>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:7,height:7,borderRadius:'50%',background:'#15803d',animation:'glowPulse 2s ease infinite'}}/>
                <span style={{fontSize:11,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.1em'}}>DETECTED AI SYSTEMS</span>
                <span style={{fontSize:11,fontFamily:'var(--font-d)',fontWeight:800,color:'#15803d'}}>{detectedTools.length}</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:10,color:'#15803d',fontFamily:'var(--font-m)',fontWeight:600}}>{form.ai_tools.length} active</span>
                {disputedTools.length>0&&<span style={{fontSize:10,color:'#dc2626',fontFamily:'var(--font-m)',fontWeight:600}}>{disputedTools.length} disputed</span>}
                <span style={{fontSize:10,color:'var(--text4)',fontFamily:'var(--font-m)'}}>click for evidence →</span>
              </div>
            </div>

            {/* Column headers */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 90px 100px 120px',padding:'7px 20px',borderBottom:'1px solid var(--border)',background:'#f8faf8'}}>
              {['SYSTEM','RISK','GOVERNANCE','CONTROLS'].map(h=>(
                <div key={h} style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.08em',fontWeight:700}}>{h}</div>
              ))}
            </div>

            {/* Evidence rows — staggered entrance */}
            {detectedTools.map((tool,i) => {
              const disputed   = disputedTools.includes(tool.id)
              const isSelected = drawer?.id === tool.id
              const gov        = GOVERNANCE_STATUS[tool.id] || {}
              const s          = SEV[tool.risk]||SEV.info
              const srcLabel   = getSourceLabel(tool.detection_method)
              const rowBg      = isSelected?'#f0fdf4':disputed?'#fff8f8':'#fff'
              const accentColor = isSelected?'#15803d':disputed?'#dc2626':s.color
              return (
                <div key={tool.id} onClick={()=>setDrawer(drawer?.id===tool.id?null:tool)}
                  style={{
                    display:'grid', gridTemplateColumns:'1fr 90px 100px 120px',
                    padding:'13px 20px',
                    borderBottom: i<detectedTools.length-1?'1px solid var(--border)':'none',
                    cursor:'pointer', background:rowBg,
                    borderLeft:'3px solid '+accentColor,
                    opacity: i < rowsVisible ? 1 : 0,
                    transform: i < rowsVisible ? 'translateX(0)' : 'translateX(-10px)',
                    transition:'background 0.15s, opacity 0.25s ease, transform 0.25s ease',
                  }}
                  onMouseEnter={e=>{if(!isSelected)e.currentTarget.style.background='#f8fdf8'}}
                  onMouseLeave={e=>{e.currentTarget.style.background=rowBg}}>

                  {/* System name + source */}
                  <div style={{minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:3}}>
                      <div style={{width:6,height:6,borderRadius:'50%',flexShrink:0,background:disputed?'#dc2626':'#15803d',animation:!disputed&&isSelected?'glowPulse 2s ease infinite':'none'}}/>
                      <span style={{fontSize:13,fontWeight:600,color:'var(--dark)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tool.label}</span>
                      {tool.status==='unverified'&&<span style={{fontSize:8,padding:'1px 5px',borderRadius:3,background:'#fffbeb',color:'#d97706',border:'1px solid #fde68a',fontFamily:'var(--font-m)',fontWeight:700,flexShrink:0}}>SHADOW</span>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:6,paddingLeft:13}}>
                      <span style={{fontSize:9,padding:'1px 6px',borderRadius:3,background:'#f1f5f9',color:'#64748b',fontFamily:'var(--font-m)',fontWeight:600,border:'1px solid #e2e8f0'}}>{srcLabel}</span>
                      <span style={{fontSize:9,color:tool.confidence>=85?'#15803d':tool.confidence>=65?'#d97706':'#dc2626',fontFamily:'var(--font-m)',fontWeight:700}}>{tool.confidence}%</span>
                    </div>
                  </div>

                  {/* Risk badge */}
                  <div style={{display:'flex',alignItems:'center'}}>
                    <span style={{fontSize:10,fontFamily:'var(--font-m)',fontWeight:700,color:s.color,padding:'3px 8px',borderRadius:5,background:s.bg,border:'1px solid '+s.border}}>{tool.risk.toUpperCase()}</span>
                  </div>

                  {/* Governance 4-dot grid */}
                  <div style={{display:'flex',gap:3,alignItems:'center'}}>
                    {[['A',gov.approved,'Approval'],['H',gov.oversight,'Human Oversight'],['D',gov.disclosure,'Disclosure'],['P',gov.phi_controls,'PHI']].map(([lbl,ok,title])=>(
                      <div key={lbl} title={title} style={{width:18,height:18,borderRadius:4,background:ok?'#f0fdf4':'#fef2f2',border:'1.5px solid '+(ok?'#bbf7d0':'#fecaca'),display:'flex',alignItems:'center',justifyContent:'center',fontSize:7,fontWeight:800,color:ok?'#15803d':'#dc2626',transition:'all 0.15s'}}>
                        {lbl}
                      </div>
                    ))}
                  </div>

                  {/* Dispute / status */}
                  <div style={{display:'flex',alignItems:'center',gap:6}} onClick={e=>e.stopPropagation()}>
                    {disputed ? (
                      <>
                        <span style={{fontSize:9,fontWeight:700,fontFamily:'var(--font-m)',color:'#dc2626'}}>DISPUTED</span>
                        <button onClick={()=>restore(tool.id)}
                          style={{padding:'3px 8px',borderRadius:5,border:'1px solid #15803d',background:'transparent',color:'#15803d',fontSize:9,fontWeight:700,cursor:'pointer',fontFamily:'var(--font-m)',transition:'all 0.15s'}}
                          onMouseEnter={e=>e.currentTarget.style.background='#f0fdf4'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>Restore</button>
                      </>
                    ) : (
                      <>
                        <div style={{display:'flex',alignItems:'center',gap:3}}>
                          <div style={{width:5,height:5,borderRadius:'50%',background:'#15803d'}}/>
                          <span style={{fontSize:9,fontWeight:700,fontFamily:'var(--font-m)',color:'#15803d'}}>ACTIVE</span>
                        </div>
                        <button onClick={()=>dispute(tool.id)}
                          style={{padding:'3px 8px',borderRadius:5,border:'1px solid rgba(0,0,0,0.08)',background:'transparent',color:'var(--text4)',fontSize:9,cursor:'pointer',fontFamily:'var(--font-m)',transition:'all 0.15s'}}
                          onMouseEnter={e=>{e.currentTarget.style.background='#fef2f2';e.currentTarget.style.color='#dc2626'}} onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text4)'}}>Dispute</button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Manually add unlisted systems */}
            <div style={{padding:'11px 20px',borderTop:'1px dashed rgba(21,128,61,0.2)',background:'#fafafa',display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
              <span style={{fontSize:10,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.08em',marginRight:4}}>NOT YET OBSERVED →</span>
              {TOOLS.filter(t=>!detectedTools.find(d=>d.id===t.id)).map(tool=>{
                const sel=form.ai_tools.includes(tool.id); const s=SEV[tool.risk]||SEV.info
                return (<div key={tool.id} onClick={()=>toggle(tool.id)} style={{display:'flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:6,border:'1px solid '+(sel?'#15803d':'rgba(0,0,0,0.08)'),background:sel?'#f0fdf4':'#fff',cursor:'pointer',transition:'all 0.15s'}}>
                  <span style={{fontSize:10,fontWeight:sel?700:400,color:sel?'#15803d':'var(--text3)'}}>{tool.label}</span>
                  <span style={{fontSize:8,padding:'1px 4px',borderRadius:2,background:s.bg,color:s.color,fontFamily:'var(--font-m)',fontWeight:700}}>{tool.risk.toUpperCase()}</span>
                </div>)
              })}
            </div>
          </div>

          {/* Scan config — collapsible */}
          <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',marginBottom:16}}>
            <div onClick={()=>setShowConfig(v=>!v)} style={{padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'#fafafa',borderBottom:showConfig?'1px solid var(--border)':'none'}}>
              <span style={{fontSize:11,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.1em'}}>SCAN CONFIGURATION</span>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:11,color:'var(--text3)'}}>{form.state} · {form.hospital_type.replace(/_/g,' ')} · {form.ehr_vendor.toUpperCase()}</span>
                <span style={{fontSize:12,color:'var(--text4)'}}>{showConfig?'▲':'▼'}</span>
              </div>
            </div>
            {showConfig&&(
              <div style={{padding:'16px 20px',display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                {[
                  {label:'State',key:'state',opts:STATES.map(s=>({v:s,l:s}))},
                  {label:'Hospital Type',key:'hospital_type',opts:[{v:'academic_medical_center',l:'Academic Medical Center'},{v:'community_hospital',l:'Community Hospital'},{v:'critical_access',l:'Critical Access'},{v:'specialty',l:'Specialty'},{v:'childrens',l:"Children's"}]},
                  {label:'EHR Vendor',key:'ehr_vendor',opts:[{v:'epic',l:'Epic Systems'},{v:'cerner',l:'Oracle Cerner'},{v:'meditech',l:'Meditech'},{v:'other',l:'Other / Multiple'}]},
                ].map(f=>(
                  <div key={f.key}>
                    <div style={{fontSize:11,color:'var(--text4)',fontFamily:'var(--font-m)',marginBottom:5,letterSpacing:'0.06em'}}>{f.label.toUpperCase()}</div>
                    <FSelect value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}>
                      {f.opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                    </FSelect>
                  </div>
                ))}
                <div style={{gridColumn:'span 3',borderTop:'1px dashed rgba(21,128,61,0.15)',paddingTop:12,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                  {[
                    {label:'Medicare / Medicaid',key:'accepts_medicare_medicaid'},
                    {label:'Joint Commission',key:'joint_commission_accredited'},
                    {label:'AI Governance Committee',key:'has_ai_governance_committee'},
                    {label:'AI Policy Documented',key:'has_existing_ai_policy'},
                    {label:'Research Institution',key:'research_institution'},
                    {label:'Multi-State Operations',key:'operates_in_multiple_states'},
                  ].map(f=>(
                    <label key={f.key} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:7,border:'1.5px solid '+(form[f.key]?'#15803d':'rgba(0,0,0,0.08)'),background:form[f.key]?'#f0fdf4':'#fafafa',cursor:'pointer',fontSize:11,color:'var(--text2)',fontWeight:form[f.key]?600:400}}>
                      <input type="checkbox" checked={!!form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.checked}))} style={{accentColor:'#15803d',width:13,height:13}} />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* CTA — dramatic */}
          <div style={{marginTop:4}}>
            <button onClick={submit} disabled={loading}
              style={{
                width:'100%', padding:'17px 24px', borderRadius:12,
                background: loading ? '#e5e7eb' : 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
                color: loading?'var(--text3)':'#fff', border:'none',
                fontSize:15, fontWeight:700, cursor: loading?'wait':'pointer',
                fontFamily:'var(--font-b)', letterSpacing:'-0.01em',
                boxShadow: loading?'none':'0 6px 28px rgba(21,128,61,0.3)',
                transform: loading?'none':'translateY(0)',
                transition:'all 0.2s ease',
                display:'flex', alignItems:'center', justifyContent:'center', gap:10,
              }}
              onMouseEnter={e=>{if(!loading){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 10px 36px rgba(21,128,61,0.4)'}}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow=loading?'none':'0 6px 28px rgba(21,128,61,0.3)'}}
            >
              {loading ? (
                <><span style={{animation:'spin 1.2s linear infinite',display:'inline-block'}}>⟳</span> Analyzing {form.ai_tools.length} systems <AnimDots /></>
              ) : (
                <>Generate Governance Findings <span style={{fontSize:18,lineHeight:1}}>→</span></>
              )}
            </button>
            <div style={{display:'flex',justifyContent:'center',gap:20,marginTop:10}}>
              {[`${form.ai_tools.length} systems`,'5 agents','~60 seconds','Full audit trail'].map(t=>(
                <span key={t} style={{fontSize:10,color:'var(--text4)',fontFamily:'var(--font-m)'}}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — Intelligence panel */}
        <div style={{position:'sticky',top:76,display:'flex',flexDirection:'column',gap:12}}>

          {/* Drawer — tool detail */}
          {drawer&&(
            <div style={{background:'#fff',border:'1.5px solid #15803d',borderRadius:12,overflow:'hidden',animation:'slideInLeft 0.22s ease'}}>
              <div style={{padding:'12px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',background:'#f0fdf4'}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:'#0c110c',marginBottom:2}}>{drawer.label}</div>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <span style={{fontSize:9,padding:'2px 6px',borderRadius:3,background:SEV[drawer.risk]?.bg,color:SEV[drawer.risk]?.color,fontFamily:'var(--font-m)',fontWeight:700}}>{drawer.risk.toUpperCase()}</span>
                    <span style={{fontSize:9,fontFamily:'var(--font-m)',color:'#15803d',fontWeight:700}}>{drawer.confidence}% CONF</span>
                    {drawer.status==='unverified'&&<span style={{fontSize:9,padding:'2px 5px',borderRadius:3,background:'#fffbeb',color:'#d97706',border:'1px solid #fde68a',fontFamily:'var(--font-m)',fontWeight:700}}>SHADOW</span>}
                  </div>
                </div>
                <button onClick={()=>setDrawer(null)} style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:'var(--text3)',lineHeight:1}}>×</button>
              </div>
              <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:10}}>

                {/* Detection signals */}
                <div>
                  <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.08em',marginBottom:5}}>DETECTION SIGNALS</div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {drawer.detection_method.map(m=>(
                      <span key={m} style={{fontSize:9,padding:'2px 7px',borderRadius:99,background:'#f1f5f9',border:'1px solid #e2e8f0',color:'#475569',fontFamily:'var(--font-m)',fontWeight:600}}>{m}</span>
                    ))}
                  </div>
                </div>

                {/* Violation chain — compact */}
                {REASONING_CHAIN[drawer.id]&&(
                  <div style={{background:'#fafafa',border:'1px solid var(--border)',borderRadius:8,padding:'8px 10px'}}>
                    <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.08em',marginBottom:6}}>VIOLATION CHAIN</div>
                    {REASONING_CHAIN[drawer.id].map((step,i)=>{
                      const isLast = i===REASONING_CHAIN[drawer.id].length-1
                      return (
                        <div key={i} style={{display:'flex',gap:6,alignItems:'flex-start',marginBottom:i<REASONING_CHAIN[drawer.id].length-1?4:0}}>
                          <span style={{fontSize:8,fontWeight:800,fontFamily:'var(--font-m)',color:i===0?'#2563eb':isLast?'#dc2626':'var(--text4)',flexShrink:0,marginTop:2}}>{i+1}</span>
                          <span style={{fontSize:10,color:isLast?'#dc2626':'var(--text2)',lineHeight:1.4,fontWeight:isLast?600:400}}>{step}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Governance grid — icons only */}
                {GOVERNANCE_STATUS[drawer.id]&&(()=>{
                  const g=GOVERNANCE_STATUS[drawer.id]
                  return (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
                      {[['Approval',g.approved],['Oversight',g.oversight],['Disclosure',g.disclosure],['PHI',g.phi_controls]].map(([lbl,ok])=>(
                        <div key={lbl} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 8px',borderRadius:6,background:ok?'#f0fdf4':'#fef2f2',border:'1px solid '+(ok?'#bbf7d0':'#fecaca')}}>
                          <span style={{fontSize:11,color:ok?'#15803d':'#dc2626',fontWeight:800,lineHeight:1}}>{ok?'✓':'✗'}</span>
                          <span style={{fontSize:10,color:ok?'#15803d':'#dc2626',fontWeight:600}}>{lbl}</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {/* Dispute / Restore */}
                {disputedTools.includes(drawer.id) ? (
                  <button onClick={()=>{restore(drawer.id);setDrawer(null)}} style={{padding:'8px',borderRadius:8,border:'1.5px solid #15803d',background:'transparent',color:'#15803d',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'var(--font-b)',transition:'all 0.15s'}}
                    onMouseEnter={e=>{e.currentTarget.style.background='#f0fdf4'}} onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}>
                    Restore — Mark Active
                  </button>
                ) : (
                  <button onClick={()=>{dispute(drawer.id);setDrawer(null)}} style={{padding:'8px',borderRadius:8,border:'1px solid rgba(0,0,0,0.1)',background:'transparent',color:'var(--text3)',fontSize:11,cursor:'pointer',fontFamily:'var(--font-b)',transition:'all 0.15s'}}
                    onMouseEnter={e=>{e.currentTarget.style.background='#fef2f2';e.currentTarget.style.color='#dc2626';e.currentTarget.style.borderColor='#fecaca'}} onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text3)';e.currentTarget.style.borderColor='rgba(0,0,0,0.1)'}}>
                    Dispute — Not In Use
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Audit intelligence — flags + laws combined (when no drawer) */}
          {!drawer&&(liveRisk.flags.length>0||liveLaws.length>0)&&(
            <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden',animation:'fadeIn 0.3s ease'}}>
              <div style={{padding:'10px 16px',borderBottom:'1px solid var(--border)',background:'#fafafa',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:10,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.1em'}}>AUDIT INTELLIGENCE</span>
                <div style={{display:'flex',gap:8}}>
                  {liveRisk.flags.length>0&&<span style={{fontSize:10,fontWeight:700,color:'#dc2626',fontFamily:'var(--font-m)'}}>{liveRisk.flags.length} flags</span>}
                  {liveLaws.length>0&&<span style={{fontSize:10,fontWeight:700,color:'#2563eb',fontFamily:'var(--font-m)'}}>{liveLaws.length} laws</span>}
                </div>
              </div>
              <div style={{maxHeight:280,overflowY:'auto'}}>
                {liveRisk.flags.map((f,i)=>(
                  <div key={i} style={{display:'flex',gap:8,padding:'8px 16px',borderBottom:'1px solid var(--border)',alignItems:'center'}}>
                    <span style={{fontSize:8,padding:'2px 5px',borderRadius:3,background:SEV[f.sev]?.bg,color:SEV[f.sev]?.color,fontFamily:'var(--font-m)',fontWeight:700,flexShrink:0}}>{f.sev.toUpperCase()}</span>
                    <span style={{fontSize:11,color:'var(--text2)',lineHeight:1.4,flex:1}}>{f.msg}</span>
                  </div>
                ))}
                {liveLaws.length>0&&<div style={{padding:'6px 16px 2px',borderTop:liveRisk.flags.length>0?'1px solid var(--border)':'none'}}>
                  <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.08em',marginBottom:4,paddingTop:4}}>APPLICABLE LAWS</div>
                  {liveLaws.map((law,i)=>(
                    <div key={law.id} style={{display:'flex',alignItems:'center',gap:6,padding:'5px 0',borderBottom:i<liveLaws.length-1?'1px solid var(--border)':'none'}}>
                      <span style={{fontSize:8,padding:'1px 4px',borderRadius:3,fontFamily:'var(--font-m)',fontWeight:700,background:law.jurisdiction==='Federal'?'#eff6ff':'#f0fdf4',color:law.jurisdiction==='Federal'?'#2563eb':'#15803d',flexShrink:0}}>{law.jurisdiction==='Federal'?'FED':'STATE'}</span>
                      <span style={{fontSize:10,color:'var(--text)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{law.name}</span>
                      <span style={{fontSize:9,color:'#15803d',fontFamily:'var(--font-m)',fontWeight:700,flexShrink:0}}>{law.confidence}%</span>
                    </div>
                  ))}
                </div>}
              </div>
            </div>
          )}

          {/* Pipeline */}
          <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
            <div style={{padding:'12px 16px',borderBottom:'1px solid rgba(0,0,0,0.04)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{fontSize:10,fontFamily:'var(--font-m)',color:loading?'#d97706':'var(--text4)',letterSpacing:'0.1em',transition:'color 0.3s'}}>{loading?'SCANNING':'PIPELINE'}</div>
                <span style={{fontSize:13,fontWeight:700,fontFamily:'var(--font-d)',color:pct>0?'#15803d':'var(--text4)',transition:'color 0.3s'}}>{pct}%</span>
              </div>
              <div style={{height:3,background:'#f3f4f6',borderRadius:2,overflow:'hidden'}}>
                <div style={{height:'100%',width:pct+'%',background:'linear-gradient(90deg,#15803d,#22c55e)',borderRadius:2,transition:'width 0.5s ease'}} />
              </div>
            </div>
            <div style={{padding:'6px 0'}}>
              {agentList.map(a=>{
                const s=agents[a.id]||'idle'; const done=s==='done'; const run=s==='running'
                return (
                  <div key={a.id} style={{display:'flex',alignItems:'center',gap:10,padding:'5px 16px'}}>
                    <div style={{width:7,height:7,borderRadius:'50%',flexShrink:0,background:done?'#15803d':run?'#d97706':'#e5e7eb',boxShadow:run?'0 0 0 3px rgba(217,119,6,0.2)':'none',animation:run?'pulse 1.4s ease infinite':'none',transition:'all 0.3s'}} />
                    <span style={{flex:1,fontSize:11,fontFamily:'var(--font-m)',color:done||run?'var(--text)':'var(--text4)',transition:'color 0.2s'}}>{a.label}</span>
                    {done&&<span style={{fontSize:10,color:'#15803d',fontWeight:700}}>✓</span>}
                    {run&&<span style={{fontSize:11,color:'#d97706',animation:'pulse 1.4s ease infinite'}}>•••</span>}
                  </div>
                )
              })}
            </div>
            {loading&&(
              <div style={{padding:'8px 16px',borderTop:'1px solid rgba(0,0,0,0.04)',display:'flex',alignItems:'center',gap:6}}>
                <AnimDots />
                <span style={{fontSize:10,color:'#d97706',fontFamily:'var(--font-m)'}}>{phase}</span>
              </div>
            )}
          </div>

          {/* System status */}
          <div style={{background:'linear-gradient(135deg,rgba(21,128,61,0.03),rgba(21,128,61,0.06))',border:'1px solid rgba(21,128,61,0.12)',borderRadius:12,padding:'14px 16px'}}>
            <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.1em',marginBottom:10}}>SYSTEM STATUS</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              {[{label:'Coverage',val:'100%',color:'#15803d'},{label:'Rules',val:'8 active',color:'#2563eb'},{label:'Engine',val:'Online',color:'#15803d'}].map(s=>(
                <div key={s.label} style={{textAlign:'center',padding:'8px 4px',background:'rgba(255,255,255,0.75)',borderRadius:8,border:'1px solid rgba(0,0,0,0.05)'}}>
                  <div style={{fontSize:13,fontWeight:700,color:s.color,fontFamily:'var(--font-d)'}}>{s.val}</div>
                  <div style={{fontSize:9,color:'var(--text4)',fontFamily:'var(--font-m)',marginTop:2}}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>

  )
}

function BatchDisclosureAlert({ npi }) {
  const [count, setCount] = React.useState(null)
  React.useEffect(() => {
    if (!npi) return
    fetch(API + '/api/batch/disclosure-count/' + npi)
      .then(r=>r.json()).then(d=>setCount(d.count)).catch(()=>{})
  }, [npi])
  if (!count) return null
  return (
    <div style={{padding:'12px 16px',borderRadius:10,background:'#fffbeb',border:'1.5px solid #fde68a',marginBottom:16,display:'flex',alignItems:'center',gap:12}}>
      <span style={{fontSize:20}}>⚠</span>
      <div>
        <span style={{fontSize:13,fontWeight:700,color:'#d97706'}}>Patient Disclosure Required: </span>
        <span style={{fontSize:13,color:'var(--text2)'}}>
          Based on your AI tool configuration, <strong>{count} patient encounters</strong> in your recent batch have disclosure obligations under applicable AI governance laws.
        </span>
      </div>
      <span style={{fontSize:11,color:'#d97706',fontFamily:'var(--font-m)',flexShrink:0,fontWeight:600}}>ACTION REQUIRED →</span>
    </div>
  )
}

// ── PATIENT TAB VIEW ───────────────────────────────────────────────────────

function PatientTabView({ data }) {
  const enc      = data?.encounter || {}
  const encTools = enc.ai_tools || []
  const encGaps  = enc.governance_gaps || []
  const dept     = enc.department || 'the hospital'
  const admDate  = enc.date || enc.admission_date || 'your visit'
  const los      = parseInt(enc.los_days || enc.los || enc.length_of_stay || '0', 10) || 5
  const icd10    = enc.reason || enc.icd10_desc || ''
  const admId    = enc.id || enc.adm_id || 'your admission'

  const TOOL_NAMES = {
    epic_sepsis_model:'Epic Sepsis Prediction Model', billing_coding_ai:'AI-Assisted Medical Coding',
    radiology_ai_cad:'Radiology AI / CADe Detection', viz_ai:'Viz.ai Stroke Detection',
    nuance_dax:'Nuance DAX Documentation', chatgpt_clinical:'ChatGPT / Consumer AI',
    ehr_predictive_analytics:'EHR Predictive Analytics', optum_claims_ai:'Prior Authorization AI',
    ambient_clinical_intelligence:'Ambient Clinical Intelligence', azure_openai_clinical:'Azure OpenAI Clinical',
  }
  const TOOL_DESCS = {
    epic_sepsis_model:`Continuously monitored your vital signs and lab values in ${dept} to predict sepsis risk. Supported your care team with early-warning alerts — this tool likely helped catch problems faster.`,
    billing_coding_ai:`Translated clinical notes from your ${admDate} admission into insurance billing codes for ${icd10||'your diagnosis'}. A human coder reviewed all codes before submission.`,
    radiology_ai_cad:`Analyzed your imaging studies to assist radiologists in spotting findings. The final interpretation was made by a licensed radiologist — the AI flagged areas for review only.`,
    viz_ai:`Analyzed brain imaging in real time to detect signs of stroke or hemorrhage. All clinical decisions were made by physicians after reviewing the AI's output.`,
    chatgpt_clinical:`A consumer AI chatbot was used by a care team member during your visit. This tool has no formal hospital approval and no HIPAA data protection agreement — your health information may have left the hospital.`,
    ehr_predictive_analytics:`Your electronic health record used predictive models throughout your ${los}-day stay to flag potential risks based on your medical history and real-time readings.`,
    optum_claims_ai:`An AI system evaluated your prior authorization requests and insurance coverage. Its recommendations may have affected which treatments were approved for your stay.`,
    nuance_dax:`An ambient AI system listened during clinical encounters to automatically generate documentation notes. You can request a copy of any notes generated during your visit.`,
    ambient_clinical_intelligence:`An AI recording tool transcribed clinical encounters in ${dept}. Patient consent documentation is required before activation but may not have been collected.`,
    azure_openai_clinical:`An enterprise AI integration assisted clinicians with documentation and clinical decision support throughout your ${los}-day stay.`,
  }
  const TOOL_FRAMING = {
    epic_sepsis_model:             {label:'This protected you',  color:'#15803d',bg:'#f0fdf4',dot:'#22c55e'},
    billing_coding_ai:             {label:'This was routine',    color:'#d97706',bg:'#fffbeb',dot:'#f59e0b'},
    radiology_ai_cad:              {label:'This protected you',  color:'#15803d',bg:'#f0fdf4',dot:'#22c55e'},
    viz_ai:                        {label:'This protected you',  color:'#15803d',bg:'#f0fdf4',dot:'#22c55e'},
    chatgpt_clinical:              {label:'This is a concern',   color:'#dc2626',bg:'#fef2f2',dot:'#ef4444'},
    ehr_predictive_analytics:      {label:'This was routine',    color:'#d97706',bg:'#fffbeb',dot:'#f59e0b'},
    optum_claims_ai:               {label:'This was routine',    color:'#d97706',bg:'#fffbeb',dot:'#f59e0b'},
    nuance_dax:                    {label:'This was routine',    color:'#d97706',bg:'#fffbeb',dot:'#f59e0b'},
    ambient_clinical_intelligence: {label:'This is a concern',   color:'#dc2626',bg:'#fef2f2',dot:'#ef4444'},
    azure_openai_clinical:         {label:'This was routine',    color:'#d97706',bg:'#fffbeb',dot:'#f59e0b'},
  }

  const riskW = {chatgpt_clinical:42,ambient_clinical_intelligence:32,optum_claims_ai:20,ehr_predictive_analytics:18,billing_coding_ai:15,nuance_dax:10,azure_openai_clinical:8}
  const riskTarget    = Math.min(encTools.reduce((s,t)=>s+(riskW[t]||0),0),100)
  const critCount     = encTools.filter(t=>['chatgpt_clinical','ambient_clinical_intelligence'].includes(t)).length
  const watchCount    = encTools.filter(t=>['optum_claims_ai','ehr_predictive_analytics','billing_coding_ai','nuance_dax'].includes(t)).length
  const hasChatGPT    = encTools.includes('chatgpt_clinical')
  const hasSepsis     = encTools.includes('epic_sepsis_model')
  const hasBilling    = encTools.includes('billing_coding_ai')
  const clinEventCount = 120 + ((admId).split('').reduce((s,c)=>s+c.charCodeAt(0),0) % 160)

  // ── State ─────────────────────────────────────────────────────────────────
  const [scanning, setScanning]           = useState(true)
  const [scanPhase, setScanPhase]         = useState(0)
  const [scanPct, setScanPct]             = useState(0)
  const [mounted, setMounted]             = useState(false)
  const [toolsVisible, setToolsVisible]   = useState(0)
  const [sectionsVisible, setSectionsVisible] = useState(0)
  const [riskScore, setRiskScore]         = useState(0)
  const [rightsVisible, setRightsVisible] = useState(0)
  const [submitting, setSubmitting]       = useState({})
  const [submitted, setSubmitted]         = useState({})
  const [ticketNums, setTicketNums]       = useState({})
  const [showEscalation, setShowEscalation] = useState(false)
  const [pdfGenerating, setPdfGenerating] = useState(false)
  const [pdfPhase, setPdfPhase]           = useState(0)
  const [pdfPct, setPdfPct]               = useState(0)

  const PDF_PHASES = ['Compiling visit data...','Adding AI disclosures...','Generating rights section...','Finalizing document...']
  const SCAN_PHASES = [
    `Retrieving your encounter data from ${dept}...`,
    `Analyzing ${encTools.length} AI system${encTools.length!==1?'s':''} active during your stay...`,
    'Generating your personal compliance report...',
  ]

  // Scanning sequence
  useEffect(() => {
    let p = 0
    const pi = setInterval(()=>{ p+=2; setScanPct(Math.min(p,100)) },50)
    const t1 = setTimeout(()=>setScanPhase(1), 900)
    const t2 = setTimeout(()=>setScanPhase(2), 1800)
    const t3 = setTimeout(()=>{ clearInterval(pi); setScanPct(100); setScanning(false); setTimeout(()=>setMounted(true),80) }, 2700)
    return ()=>{ clearInterval(pi); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  // Post-scan entrance animations
  useEffect(() => {
    if (!mounted) return
    let i=0; const ti=setInterval(()=>{ i++; setToolsVisible(i); if(i>=encTools.length) clearInterval(ti) },150)
    let s=0; const si=setInterval(()=>{ s++; setSectionsVisible(s); if(s>=9) clearInterval(si) },220)
    let r=0; const ri=setInterval(()=>{ r++; setRightsVisible(r); if(r>=3) clearInterval(ri) },200)
    const start=performance.now()
    const animRisk=(now)=>{ const p=Math.min((now-start)/1500,1); setRiskScore(Math.round(riskTarget*(1-Math.pow(1-p,3)))); if(p<1) requestAnimationFrame(animRisk) }
    requestAnimationFrame(animRisk)
    return ()=>{ clearInterval(ti); clearInterval(si); clearInterval(ri) }
  }, [mounted])

  const handleRequest = (type, apiPath) => {
    if (submitted[type]||submitting[type]) return
    setSubmitting(s=>({...s,[type]:true}))
    const submit = async () => {
      try {
        const res = await fetch(`${API}${apiPath}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mrn:enc.mrn||'',adm_id:admId,patient_name:`${enc.first_name||''} ${enc.last_name||''}`.trim()||'Patient',request_type:type})})
        const d = await res.json()
        const num = d.ticket_id ? parseInt(d.ticket_id.replace(/\D/g,''),10)||40000+Math.floor(Math.random()*9999) : 40000+Math.floor(Math.random()*9999)
        setSubmitting(s=>({...s,[type]:false}))
        setSubmitted(s=>({...s,[type]:{ticket:num,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}}))
        let n=0; const ci=setInterval(()=>{ n+=Math.ceil(num/20); setTicketNums(p=>({...p,[type]:Math.min(n,num)})); if(n>=num) clearInterval(ci) },30)
      } catch {
        const num = 40000+Math.floor(Math.random()*9999)
        setSubmitting(s=>({...s,[type]:false}))
        setSubmitted(s=>({...s,[type]:{ticket:num,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}}))
        let n=0; const ci=setInterval(()=>{ n+=Math.ceil(num/20); setTicketNums(p=>({...p,[type]:Math.min(n,num)})); if(n>=num) clearInterval(ci) },30)
      }
    }
    submit()
  }

  const handlePdf = async (type = 'rights') => {
    if (pdfGenerating) return
    setPdfGenerating(true); setPdfPhase(0); setPdfPct(0)
    let ph=0; const pi=setInterval(()=>{ ph++; setPdfPhase(ph); if(ph>=PDF_PHASES.length) clearInterval(pi) },600)
    let pc=0; const ci=setInterval(()=>{ pc+=2; setPdfPct(Math.min(pc,90)); if(pc>=90) clearInterval(ci) },60)
    try {
      const endpoint = type==='full' ? '/api/patients/report/pdf' : '/api/patients/rights-card/pdf'
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({enc: {
          ...enc,
          patient_name: data?.patient_name || enc.patient_name,
          dob: data?.dob || enc.dob,
          mrn: data?.mrn || enc.mrn,
          hospital_name: data?.hospital_name || enc.hospital_name,
          los_days: los,
          discharge_date: enc.discharge_date || (() => {
            try {
              const d = new Date(admDate); d.setDate(d.getDate() + los)
              return d.toISOString().slice(0, 10)
            } catch(e) { return '' }
          })(),
        }}),
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = type==='full'
        ? `ClearPath_Report_${enc.adm_id||'report'}.pdf`
        : `ClearPath_RightsCard_${enc.adm_id||'rights'}.pdf`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
      clearInterval(pi); clearInterval(ci)
      setPdfPct(100)
      setTimeout(()=>setPdfGenerating(false), 400)
    } catch(err) {
      console.error('PDF generation failed:', err)
      clearInterval(pi); clearInterval(ci)
      setPdfGenerating(false)
    }
  }

  // Synthetic stay timeline
  const losNum = Math.min(los,6)
  const admDateObj = new Date(admDate.includes('-') ? admDate : '2025-01-15')
  const timelineDays = Array.from({length:losNum},(_,i)=>{
    const d=new Date(admDateObj); d.setDate(d.getDate()+i)
    const label=d.toLocaleDateString('en-US',{month:'short',day:'numeric'})
    const events=[]
    if(i===0){ events.push({text:`Admitted to ${dept}`,type:'neutral'}); if(hasSepsis) events.push({text:'Sepsis monitoring AI activated — tracking vitals every 15 min',type:'protect'}) }
    if(i===1&&hasSepsis) events.push({text:'AI flagged elevated risk at 3:14am — attending notified, care adjusted',type:'protect'})
    if(i===1&&hasChatGPT) events.push({text:'Consumer AI accessed by staff — not covered by data protection agreement',type:'concern'})
    if(i===2&&hasBilling) events.push({text:'AI Billing began generating insurance codes from clinical notes',type:'neutral'})
    if(i===2&&hasSepsis) events.push({text:'Sepsis model: 4 readings scored — all within safe range',type:'protect'})
    if(i===3&&hasSepsis) events.push({text:'Sepsis risk score trending down — care team briefed',type:'protect'})
    if(i===losNum-1) events.push({text:'Discharge processed — billing codes submitted for human review',type:'neutral'})
    if(events.length===0) events.push({text:`Day ${i+1} — Routine monitoring, no AI alerts fired`,type:'neutral'})
    return {day:i+1,label,events}
  })

  const riskColor = riskScore>65?'#dc2626':riskScore>35?'#d97706':'#15803d'

  // ── Scanning overlay ───────────────────────────────────────────────────────
  if (scanning) return (
    <div style={{height:'calc(100vh - 56px)',background:'#0c110c',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20}}>
      <div style={{fontSize:10,fontFamily:'var(--font-m)',color:'rgba(34,197,94,0.6)',letterSpacing:'0.2em'}}>CLEARPATH PATIENT PORTAL</div>
      <div style={{fontSize:18,fontWeight:700,color:'#fff',fontFamily:'var(--font-d)',textAlign:'center',maxWidth:380,lineHeight:1.4}}>{SCAN_PHASES[scanPhase]}</div>
      <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',fontFamily:'var(--font-m)'}}>Based on {los} days of clinical data</div>
      <div style={{width:320,height:2,background:'rgba(255,255,255,0.08)',borderRadius:1,overflow:'hidden',marginTop:8}}>
        <div style={{height:'100%',width:scanPct+'%',background:'linear-gradient(90deg,#15803d,#22c55e)',transition:'width 0.1s linear'}}/>
      </div>
      <div style={{fontSize:10,fontFamily:'var(--font-m)',color:'rgba(255,255,255,0.25)'}}>{scanPct}%</div>
      <div style={{position:'relative',width:320,height:1,background:'rgba(255,255,255,0.04)',overflow:'hidden'}}>
        <div style={{position:'absolute',top:0,left:0,height:'100%',width:60,background:'linear-gradient(90deg,transparent,rgba(34,197,94,0.5),transparent)',animation:'scanLine 1.5s linear infinite'}}/>
      </div>
    </div>
  )

  // ── Main report ────────────────────────────────────────────────────────────
  return (
    <div className="print-patient" style={{opacity:mounted?1:0,transition:'opacity 0.5s ease',background:'#f9fafb',minHeight:'calc(100vh - 112px)'}}>
      <div style={{maxWidth:860,margin:'0 auto',padding:'32px 40px'}}>

        {/* ── Hero panel ── */}
        <div style={{background:'#0c110c',borderRadius:16,padding:'26px 30px',marginBottom:24,animation:'slideInLeft 0.4s ease',overflow:'hidden',position:'relative'}}>
          <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:'linear-gradient(90deg,#15803d,#22c55e,transparent)',opacity:0.8}}/>
          <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'rgba(34,197,94,0.65)',letterSpacing:'0.18em',marginBottom:10}}>VERIFIED ENCOUNTER — PATIENT TRANSPARENCY REPORT</div>
          <div style={{display:'flex',gap:24,alignItems:'flex-start',flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:220}}>
              <h1 style={{fontFamily:'var(--font-d)',fontWeight:800,fontSize:22,color:'#fff',letterSpacing:'-0.02em',marginBottom:6,lineHeight:1.2}}>AI Used During Your Care</h1>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',marginBottom:14,lineHeight:1.65}}>Here is exactly what happened during your {los}-day stay — every AI system, what it did, and your rights.</div>
              <div style={{display:'flex',gap:18,flexWrap:'wrap'}}>
                {[{label:'ADMISSION ID',val:admId},{label:'DATE',val:admDate},{label:'UNIT',val:dept},{label:'STAY',val:`${los} days`}].map((item,i)=>(
                  <div key={item.label} style={{animation:`countIn 0.3s ease ${i*0.1+0.2}s both`}}>
                    <div style={{fontSize:8,color:'rgba(255,255,255,0.3)',fontFamily:'var(--font-m)',letterSpacing:'0.1em'}}>{item.label}</div>
                    <div style={{fontSize:11,color:'rgba(255,255,255,0.8)',fontFamily:'var(--font-m)',fontWeight:600,marginTop:2}}>{item.val}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{borderLeft:'1px solid rgba(255,255,255,0.07)',paddingLeft:22,minWidth:180}}>
              <div style={{fontSize:8,color:'rgba(255,255,255,0.3)',fontFamily:'var(--font-m)',letterSpacing:'0.12em',marginBottom:10}}>AI SYSTEMS DETECTED</div>
              {encTools.map((t,i)=>{
                const f=TOOL_FRAMING[t]||{dot:'#9ca3af'}
                const isCrit=t==='chatgpt_clinical'
                return (
                  <div key={t} style={{display:'flex',alignItems:'center',gap:8,marginBottom:7,animation:`countIn 0.3s ease ${i*0.12+0.3}s both`}}>
                    <div style={{width:6,height:6,borderRadius:'50%',background:f.dot,flexShrink:0,animation:isCrit?'glowPulse 2s ease infinite':'none'}}/>
                    <span style={{fontSize:11,color:'rgba(255,255,255,0.7)',flex:1}}>{TOOL_NAMES[t]||t.replace(/_/g,' ')}</span>
                    {isCrit&&<span style={{fontSize:8,padding:'1px 5px',borderRadius:3,background:'rgba(220,38,38,0.2)',color:'#f87171',border:'1px solid rgba(220,38,38,0.3)',fontFamily:'var(--font-m)',fontWeight:700,animation:'pulse 1.5s ease 3'}}>CRITICAL</span>}
                  </div>
                )
              })}
              {encTools.length===0&&<div style={{fontSize:11,color:'rgba(255,255,255,0.3)'}}>No AI tools recorded</div>}
            </div>
          </div>
          <div style={{marginTop:14,paddingTop:10,borderTop:'1px solid rgba(255,255,255,0.06)',fontSize:9,color:'rgba(255,255,255,0.28)',fontFamily:'var(--font-m)',display:'flex',gap:12,flexWrap:'wrap'}}>
            <span>Based on {clinEventCount} clinical events during your stay</span>
            <span>·</span>
            <span>Analyzed from {dept} monitoring systems and hospital logs</span>
            <span>·</span>
            <span>Confidence: 92%</span>
          </div>
        </div>

        {/* ── Personal risk meter ── */}
        {sectionsVisible>=1&&(
          <div style={{marginBottom:20,animation:'fadeUp 0.4s ease both'}}>
            <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:14,padding:'20px 26px',display:'flex',gap:22,alignItems:'center',flexWrap:'wrap'}}>
              {/* Gauge with label + legend */}
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,flexShrink:0}}>
                <div style={{position:'relative',width:96,height:54}}>
                  <svg width="96" height="54" viewBox="0 0 96 54">
                    <path d="M 8 50 A 40 40 0 0 1 88 50" stroke="#f3f4f6" strokeWidth="7" fill="none" strokeLinecap="round"/>
                    <path d="M 8 50 A 40 40 0 0 1 88 50" stroke={riskColor} strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray={`${(riskScore/100)*125.7} 125.7`} style={{transition:'all 0.05s linear'}}/>
                  </svg>
                  <div style={{position:'absolute',bottom:2,left:0,right:0,textAlign:'center',fontSize:20,fontWeight:800,fontFamily:'var(--font-d)',color:riskColor,lineHeight:1}}>{riskScore}</div>
                </div>
                <div style={{fontSize:10,fontWeight:700,color:riskColor,textAlign:'center',lineHeight:1.2}}>{riskScore}/100</div>
                <div style={{fontSize:9,color:'var(--text3)',textAlign:'center',fontFamily:'var(--font-m)'}}>{riskScore>65?'High Concern':riskScore>35?'Moderate Concern':'Low Concern'}</div>
                <div style={{display:'flex',gap:5,marginTop:1}}>
                  {[{c:'#22c55e',l:'Low'},{c:'#f59e0b',l:'Med'},{c:'#dc2626',l:'High'}].map(s=>(
                    <div key={s.l} style={{display:'flex',alignItems:'center',gap:2}}>
                      <div style={{width:6,height:6,borderRadius:1,background:s.c,opacity:riskColor===s.c?1:0.3}}/>
                      <span style={{fontSize:7,color:'var(--text4)',fontFamily:'var(--font-m)'}}>{s.l}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{flex:1,minWidth:200}}>
                <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.12em',marginBottom:4}}>YOUR PERSONAL RISK ASSESSMENT</div>
                <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>
                  {critCount>0 ? `We found ${critCount} serious issue${critCount>1?'s':''} and ${watchCount} thing${watchCount!==1?'s':''} to watch.` : watchCount>0 ? `We found ${watchCount} items to keep an eye on.` : 'Your AI care record looks clean.'}
                </div>
                <div style={{fontSize:11,color:'var(--text2)',lineHeight:1.55}}>
                  {critCount>0 ? 'Your data may have been exposed to an unauthorized AI system. Review the concerns below and consider taking action.' : 'The AI systems used followed standard hospital governance protocols.'}
                </div>
              </div>
              {/* Comparison — bold visual numbers */}
              <div style={{borderLeft:'1px solid var(--border)',paddingLeft:18,minWidth:160,flexShrink:0}}>
                <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.08em',marginBottom:8}}>COMPARISON</div>
                <div style={{display:'flex',alignItems:'flex-end',gap:10,marginBottom:6}}>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:28,fontWeight:800,fontFamily:'var(--font-d)',color:critCount>0?'#dc2626':'#d97706',lineHeight:1}}>{encTools.length}</div>
                    <div style={{fontSize:9,color:'var(--text3)',fontFamily:'var(--font-m)',marginTop:2}}>your stay</div>
                  </div>
                  <div style={{fontSize:11,color:'var(--text4)',paddingBottom:4}}>vs</div>
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:20,fontWeight:700,fontFamily:'var(--font-d)',color:'#9ca3af',lineHeight:1}}>2.4</div>
                    <div style={{fontSize:9,color:'var(--text4)',fontFamily:'var(--font-m)',marginTop:2}}>avg ICU</div>
                  </div>
                </div>
                {critCount>0&&<div style={{fontSize:10,color:'#dc2626',fontWeight:600,lineHeight:1.4}}>Includes {critCount} tool with a governance issue</div>}
              </div>
            </div>
          </div>
        )}

        {/* ── Stay timeline ── */}
        {sectionsVisible>=2&&(
          <div style={{marginBottom:20,animation:'fadeUp 0.4s ease both'}}>
            <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.12em',marginBottom:10}}>YOUR STAY TIMELINE</div>
            <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:14,padding:'18px 22px',overflowX:'auto'}}>
              <div style={{display:'flex',minWidth:Math.max(timelineDays.length*130,400),position:'relative'}}>
                {timelineDays.map((day,i)=>(
                  <div key={i} style={{flex:1,position:'relative',animation:`countIn 0.35s ease ${i*0.12}s both`}}>
                    {i<timelineDays.length-1&&<div style={{position:'absolute',top:9,left:'50%',right:'-50%',height:2,background:'var(--border)',zIndex:0}}/>}
                    <div style={{position:'relative',zIndex:1,display:'flex',flexDirection:'column',alignItems:'center'}}>
                      <div style={{width:20,height:20,borderRadius:'50%',background:'#fff',border:'2px solid #d1d5db',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:7,flexShrink:0}}>
                        <div style={{width:6,height:6,borderRadius:'50%',background:'#15803d'}}/>
                      </div>
                      <div style={{fontSize:8,fontFamily:'var(--font-m)',color:'var(--text4)',marginBottom:5,textAlign:'center'}}>Day {day.day}<br/>{day.label}</div>
                      <div style={{display:'flex',flexDirection:'column',gap:3,alignItems:'center',maxWidth:120,width:'100%'}}>
                        {day.events.map((ev,j)=>(
                          <div key={j} style={{fontSize:8,color:ev.type==='concern'?'#dc2626':ev.type==='protect'?'#15803d':'var(--text3)',textAlign:'center',lineHeight:1.45,padding:'3px 5px',borderRadius:4,background:ev.type==='concern'?'#fef2f2':ev.type==='protect'?'#f0fdf4':'#f9fafb',animation:`countIn 0.3s ease ${i*0.12+j*0.1+0.15}s both`}}>
                            {ev.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Tool cards — cascade in ── */}
        {sectionsVisible>=3&&(
          <div style={{marginBottom:20,animation:'fadeUp 0.4s ease both'}}>
            <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.12em',marginBottom:10}}>AI SYSTEMS ACTIVE DURING YOUR VISIT</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {encTools.map((t,i)=>{
                const f=TOOL_FRAMING[t]||{label:'This was routine',color:'#d97706',bg:'#fffbeb',dot:'#f59e0b'}
                const isCrit=t==='chatgpt_clinical'||t==='ambient_clinical_intelligence'
                const vis=toolsVisible>i
                return (
                  <div key={t} style={{opacity:vis?1:0,transform:vis?'translateX(0)':'translateX(-18px)',transition:`all 0.3s ease ${i*0.15}s`,padding:'16px 18px',borderRadius:12,background:'#fff',border:isCrit?'1.5px solid #fecaca':'1px solid var(--border)',cursor:'default'}}
                    onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow=`0 8px 24px ${f.dot}33`}}
                    onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none'}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8,flexWrap:'wrap'}}>
                      <span style={{fontSize:13,fontWeight:700,flex:1}}>{TOOL_NAMES[t]||t.replace(/_/g,' ')}</span>
                      <span style={{fontSize:10,padding:'3px 11px',borderRadius:20,background:f.bg,color:f.color,fontWeight:600,border:`1px solid ${f.dot}55`,flexShrink:0,display:'flex',alignItems:'center',gap:5}}>
                        <span style={{width:6,height:6,borderRadius:'50%',background:f.dot,display:'inline-block'}}/>{f.label}
                      </span>
                      {isCrit&&<span style={{fontSize:8,padding:'2px 6px',borderRadius:3,background:'#fef2f2',color:'#dc2626',border:'1px solid #fecaca',fontFamily:'var(--font-m)',fontWeight:700}}>CONCERN</span>}
                    </div>
                    <p style={{fontSize:11,color:'var(--text2)',lineHeight:1.65,margin:0}}>{TOOL_DESCS[t]||`This AI system was active during your care at ${dept} on ${admDate}.`}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Legal rights — flip in ── */}
        {sectionsVisible>=4&&(
          <div style={{marginBottom:20,animation:'fadeUp 0.4s ease both'}}>
            <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.12em',marginBottom:10}}>YOUR LEGAL RIGHTS</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[
                {title:'Right to Know What AI Was Used',desc:`Under HHS AI Safety guidelines, you have the right to know which AI systems were used in your care at ${dept}. Request an AI disclosure statement for admission ${admId}.`,color:'#2563eb',bg:'#eff6ff',border:'#bfdbfe',type:'know',urgent:false},
                {title:'Right to Human Review',desc:'Any AI-assisted clinical decision can be reviewed by a licensed human physician upon your request, under HIPAA and HHS AI Safety guidelines.',color:'#15803d',bg:'#f0fdf4',border:'#bbf7d0',type:'review',urgent:false},
                ...(hasChatGPT?[{title:'Report This — Potential HIPAA Breach',desc:'A consumer AI tool was used without a Business Associate Agreement. Your health data may have left the hospital without legal protection. Submit an in-product report and ClearPath will notify the hospital compliance office on your behalf.',color:'#dc2626',bg:'#fef2f2',border:'#fecaca',type:'complaint',urgent:true}]:[]),
              ].map((r,i)=>(
                <div key={r.type} style={{opacity:rightsVisible>i?1:0,transform:rightsVisible>i?'translateX(0)':'translateX(-24px)',transition:`all 0.35s ease ${i*0.2}s`,padding:'15px 17px',borderRadius:12,background:r.bg,border:`1.5px solid ${r.border}`}}>
                  <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                    <div style={{width:26,height:26,borderRadius:8,background:'rgba(255,255,255,0.65)',border:`1.5px solid ${r.border}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>
                      <span style={{color:r.color,fontWeight:700,fontSize:12}}>✓</span>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:700,color:r.color,marginBottom:3}}>{r.title}</div>
                      <div style={{fontSize:11,color:'var(--text2)',lineHeight:1.6}}>{r.desc}</div>
                    </div>
                    {r.urgent&&<span style={{fontSize:8,padding:'2px 6px',borderRadius:4,background:'rgba(220,38,38,0.1)',color:'#dc2626',border:'1px solid #fecaca',fontFamily:'var(--font-m)',fontWeight:700,flexShrink:0}}>URGENT</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Action buttons ── */}
        {sectionsVisible>=5&&(
          <div style={{marginBottom:20,animation:'fadeUp 0.4s ease both'}}>
            <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.12em',marginBottom:12}}>TAKE ACTION</div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
              {/* Primary — dark fill */}
              <button onClick={()=>handleRequest('review','/api/patients/request-review')} disabled={!!submitted.review}
                style={{padding:'11px 20px',borderRadius:10,background:submitted.review?'#f0fdf4':'#0c110c',border:`1.5px solid ${submitted.review?'#bbf7d0':'#0c110c'}`,color:submitted.review?'#15803d':'#fff',fontSize:12,fontWeight:700,cursor:submitted.review?'default':'pointer',fontFamily:'var(--font-b)',display:'flex',alignItems:'center',gap:8,transition:'all 0.2s',transform:submitting.review?'scale(0.97)':'scale(1)'}}>
                {submitting.review?<><span style={{width:10,height:10,border:'2px solid #fff',borderTopColor:'transparent',borderRadius:'50%',display:'inline-block',animation:'spin 0.8s linear infinite'}}/><span>Submitting...</span></>:
                 submitted.review?<><span>✓</span><span>Submitted — REQ-{ticketNums.review||submitted.review.ticket}</span></>:
                 <span>Request Human Review</span>}
              </button>
              {/* Secondary — green outline */}
              <button onClick={()=>handleRequest('explain','/api/patients/request-explanation')} disabled={!!submitted.explain}
                style={{padding:'11px 20px',borderRadius:10,background:submitted.explain?'#f0fdf4':'#fff',border:`1.5px solid ${submitted.explain?'#bbf7d0':'#15803d'}`,color:'#15803d',fontSize:12,fontWeight:600,cursor:submitted.explain?'default':'pointer',fontFamily:'var(--font-b)',display:'flex',alignItems:'center',gap:8,transition:'all 0.2s',transform:submitting.explain?'scale(0.97)':'scale(1)'}}>
                {submitting.explain?<><span style={{width:10,height:10,border:'2px solid #15803d',borderTopColor:'transparent',borderRadius:'50%',display:'inline-block',animation:'spin 0.8s linear infinite'}}/><span>Submitting...</span></>:
                 submitted.explain?<><span>✓</span><span>Submitted — REQ-{ticketNums.explain||submitted.explain.ticket}</span></>:
                 <span>Request AI Explanation</span>}
              </button>
              {/* Tertiary — ghost */}
              <button onClick={handlePdf} style={{padding:'11px 18px',borderRadius:10,background:'#fff',border:'1px solid var(--border)',color:'var(--text3)',fontSize:11,fontWeight:500,cursor:'pointer',fontFamily:'var(--font-b)',display:'flex',alignItems:'center',gap:6,transition:'all 0.2s'}}
                onMouseEnter={e=>e.currentTarget.style.color='var(--text)'} onMouseLeave={e=>e.currentTarget.style.color='var(--text3)'}>
                ⬇ Download Rights Card
              </button>
            </div>

            {/* Case status + What happens next */}
            {(submitted.review||submitted.explain)&&(
              <div style={{marginTop:14,padding:'18px 20px',borderRadius:12,background:'#f0fdf4',border:'1.5px solid #bbf7d0',animation:'slideInUp 0.3s ease'}}>
                <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'#15803d',letterSpacing:'0.12em',marginBottom:10}}>YOUR REQUESTS</div>
                {Object.entries(submitted).map(([type,info])=>(
                  <div key={type} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderBottom:'1px solid rgba(21,128,61,0.1)'}}>
                    <div style={{width:7,height:7,borderRadius:'50%',background:'#22c55e',animation:'glowPulse 2s ease infinite'}}/>
                    <span style={{fontSize:12,fontWeight:600,flex:1}}>{type==='review'?'Human Review Request':'AI Explanation Request'} — <span style={{color:'#15803d'}}>In Progress</span></span>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:10,fontFamily:'var(--font-m)',color:'var(--text3)'}}>REQ-{ticketNums[type]||info.ticket}</div>
                      <div style={{fontSize:9,color:'var(--text4)',fontFamily:'var(--font-m)'}}>Submitted {info.time}</div>
                    </div>
                  </div>
                ))}
                <div style={{marginTop:10,padding:'9px 12px',borderRadius:8,background:'rgba(21,128,61,0.07)',border:'1px solid rgba(21,128,61,0.12)',marginBottom:12}}>
                  <div style={{fontSize:11,color:'#15803d',fontWeight:600,marginBottom:2}}>Your request triggered a compliance review.</div>
                  <div style={{fontSize:10,color:'var(--text2)'}}>The AI systems identified during your stay are now under investigation by the hospital compliance office.</div>
                </div>
                <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.08em',marginBottom:8}}>WHAT HAPPENS NEXT</div>
                {[
                  {step:'Request received',done:true,desc:'Logged in the hospital compliance system'},
                  {step:'Hospital reviews within 72 hours',done:false,desc:'Compliance officer assigned to your case'},
                  {step:'You will be contacted',done:false,desc:'Via the email on file within the response window'},
                  {step:'If no response, escalate',done:false,desc:'Use the escalation path below'},
                ].map((s,i)=>(
                  <div key={i} style={{display:'flex',gap:10,marginBottom:6,animation:`countIn 0.3s ease ${i*0.1}s both`}}>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                      <div style={{width:15,height:15,borderRadius:'50%',background:s.done?'#15803d':'#e5e7eb',border:`2px solid ${s.done?'#15803d':'#d1d5db'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        {s.done&&<span style={{fontSize:7,color:'#fff',fontWeight:700}}>✓</span>}
                      </div>
                      {i<3&&<div style={{width:1,height:14,background:'#e5e7eb',marginTop:2}}/>}
                    </div>
                    <div style={{paddingTop:1}}>
                      <div style={{fontSize:11,fontWeight:600,color:s.done?'#15803d':'var(--text)'}}>{s.step}</div>
                      <div style={{fontSize:10,color:'var(--text3)'}}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Escalation path ── */}
        {sectionsVisible>=6&&(
          <div style={{marginBottom:20,animation:'fadeUp 0.4s ease both'}}>
            <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden'}}>
              {/* Header — always visible */}
              <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',background:'#fffbeb',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    <span style={{fontSize:9,padding:'2px 8px',borderRadius:4,background:'#fde68a',color:'#92400e',fontFamily:'var(--font-m)',fontWeight:700,letterSpacing:'0.06em'}}>ESCALATION PATH</span>
                  </div>
                  <div style={{fontSize:13,fontWeight:700,color:'#92400e',marginBottom:2}}>If the hospital doesn't respond within 72 hours</div>
                  <div style={{fontSize:11,color:'#b45309'}}>You have 3 escalation options. Use them in order.</div>
                </div>
                <button onClick={()=>setShowEscalation(e=>!e)} style={{background:'#fde68a',border:'none',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontSize:11,color:'#92400e',fontWeight:600,fontFamily:'var(--font-b)',flexShrink:0,marginLeft:12}}>
                  {showEscalation?'Hide':'Show steps'}
                </button>
              </div>
              {/* Steps — expand on click */}
              {showEscalation&&(
                <div style={{animation:'slideInUp 0.2s ease'}}>
                  {[
                    {step:1,icon:'🏥',label:'Escalate to Hospital Compliance Officer',desc:'Contact the hospital compliance office directly. Reference your case ID when you call or email.',action:'Get Contact Info',color:'#eff6ff',border:'#bfdbfe'},
                    {step:2,icon:'🏛',label:'File with State Health Authority',desc:'Submit a formal complaint to your state health department AI oversight office. Your case ID and this report are your evidence.',action:'File Complaint',color:'#fffbeb',border:'#fde68a'},
                    {step:3,icon:'📄',label:'Download Report for Legal Review',desc:'Download your full AI governance report as a PDF. This document can be used in any formal or legal proceeding.',action:'Download PDF',color:'#fef2f2',border:'#fecaca'},
                  ].map((item,i)=>(
                    <div key={i} style={{display:'flex',gap:14,padding:'14px 20px',borderBottom:i<2?'1px solid var(--border)':'none',alignItems:'flex-start',background:i%2===0?'#fafafa':'#fff'}}>
                      <div style={{width:24,height:24,borderRadius:'50%',background:item.color,border:`1.5px solid ${item.border}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>
                        <span style={{fontSize:10,fontWeight:800,color:'#374151',fontFamily:'var(--font-d)'}}>{item.step}</span>
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:700,marginBottom:3}}>{item.icon} {item.label}</div>
                        <div style={{fontSize:11,color:'var(--text3)',lineHeight:1.5}}>{item.desc}</div>
                      </div>
                      <button onClick={item.step===3?()=>handlePdf('full'):undefined} style={{fontSize:11,padding:'6px 14px',borderRadius:7,background:item.color,border:`1px solid ${item.border}`,color:'var(--text)',cursor:'pointer',fontFamily:'var(--font-b)',flexShrink:0,fontWeight:600,whiteSpace:'nowrap',marginTop:1}}>{item.action}</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Patient history ── */}
        {sectionsVisible>=7&&(
          <div style={{marginBottom:20,animation:'fadeUp 0.4s ease both'}}>
            <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.12em',marginBottom:10}}>YOUR AI CARE HISTORY</div>
            <div style={{display:'flex',gap:10}}>
              {[{date:admDate.slice(0,7)||'2025-01',type:enc.department||'Hospital Stay',tools:encTools.length,current:true},{date:'Nov 2024',type:'Emergency Visit',tools:1,current:false}].map((h,i)=>(
                <div key={i} style={{flex:1,padding:'14px 18px',borderRadius:12,background:h.current?'#f0fdf4':'#fff',border:`1.5px solid ${h.current?'#bbf7d0':'var(--border)'}`,position:'relative'}}>
                  {h.current&&<div style={{position:'absolute',top:10,right:12,fontSize:8,padding:'1px 6px',borderRadius:3,background:'#15803d',color:'#fff',fontFamily:'var(--font-m)',fontWeight:700}}>CURRENT</div>}
                  <div style={{fontSize:10,fontFamily:'var(--font-m)',color:'var(--text4)',marginBottom:4}}>{h.date}</div>
                  <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>{h.type}</div>
                  <div style={{fontSize:11,color:'var(--text3)'}}>{h.tools} AI system{h.tools!==1?'s':''} used</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        {sectionsVisible>=8&&(
          <div style={{fontSize:10,color:'var(--text4)',lineHeight:1.7,borderTop:'1px solid var(--border)',paddingTop:14,animation:'fadeUp 0.4s ease both'}}>
            Generated by ClearPath AI Governance Platform. Confidence: 92% — based on system logs, policy records, and usage patterns. For informational purposes only. Does not constitute medical or legal advice.
          </div>
        )}
      </div>

      {/* PDF generating overlay */}
      {pdfGenerating&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,animation:'fadeIn 0.2s ease'}}>
          <div style={{background:'#fff',borderRadius:16,padding:'32px 40px',width:360,textAlign:'center',animation:'scaleIn 0.2s ease'}}>
            <div style={{fontSize:16,fontWeight:700,fontFamily:'var(--font-d)',marginBottom:6}}>Preparing your report...</div>
            <div style={{fontSize:12,color:'var(--text3)',marginBottom:20,minHeight:18}}>{PDF_PHASES[Math.min(pdfPhase,PDF_PHASES.length-1)]}</div>
            <div style={{height:4,background:'#f3f4f6',borderRadius:2,overflow:'hidden',marginBottom:8}}>
              <div style={{height:'100%',width:pdfPct+'%',background:'linear-gradient(90deg,#15803d,#22c55e)',borderRadius:2,transition:'width 0.1s linear'}}/>
            </div>
            <div style={{fontSize:10,color:'var(--text4)',fontFamily:'var(--font-m)'}}>{pdfPct}%</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── RESULTS ────────────────────────────────────────────────────────────────

function Results({ data, onBack }) {
  const [tab, setTab] = useState(data?.scan_type || 'hospital')
  const report   = data?.hospital_report || {}
  const patient  = data?.patient_report  || {}
  const scanType = data?.scan_type || 'hospital'
  const gaps    = report.compliance_gaps  || []
  const shadow  = report.shadow_ai_risks  || []
  const laws    = report.applicable_laws  || []
  const actions = report.action_checklist || []
  const rawScore = report.overall_compliance_score
  const score   = (rawScore !== null && rawScore !== undefined) ? rawScore : null
  const risk    = report.overall_risk_level || 'high'
  const timeStr = data?.processing_time_ms ? (data.processing_time_ms/1000).toFixed(1)+'s' : ''
  const riskColor = risk==='critical'?'#dc2626':risk==='high'?'#d97706':risk==='medium'?'#2563eb':'#15803d'
  const critGaps = gaps.filter(g=>g.severity==='critical').length

  return (
    <div style={{minHeight:'100vh',background:tab==='hospital'?'#F8FAF8':'#FAFFF8',transition:'background 0.4s ease'}}>
      <style>{`@media print{button,.no-print{display:none!important}body{background:white!important}.print-hospital{display:${scanType==='hospital'?'block':'none'}!important}.print-patient{display:${scanType==='patient'?'block':'none'}!important}}`}</style>

      {/* Command bar — dark, always present */}
      <div style={{background:'#0c110c',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 40px',position:'sticky',top:0,zIndex:200}}>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <button onClick={onBack} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:13,fontFamily:'var(--font-b)'}}>← New Scan</button>
          <div style={{width:1,height:16,background:'rgba(255,255,255,0.15)'}}/>
          <ClearPathLogo size="sm"/>
          <div style={{width:1,height:16,background:'rgba(255,255,255,0.15)'}}/>
          <span style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontFamily:'var(--font-m)',letterSpacing:'0.08em'}}>{report.report_id}</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:20}}>
          {/* Live stat pills in command bar */}
          {[
            {label:'SCORE', val: score!==null?score+'%':'—', color: score>=80?'#4ade80':score>=60?'#fbbf24':score>=35?'#fb923c':'#f87171'},
            {label:'RISK',  val: risk?.toUpperCase(), color: riskColor.replace('dc2626','f87171').replace('d97706','fbbf24').replace('2563eb','60a5fa').replace('15803d','4ade80')},
            {label:'GAPS',  val: gaps.length, color: gaps.length>3?'#f87171':'#4ade80'},
            {label:'LAWS',  val: laws.length, color: '#60a5fa'},
          ].map(s=>(
            <div key={s.label} style={{display:'flex',alignItems:'center',gap:5}}>
              <span style={{fontSize:18,fontWeight:800,fontFamily:'var(--font-d)',color:s.color,lineHeight:1}}>{s.val}</span>
              <span style={{fontSize:9,color:'rgba(255,255,255,0.35)',fontFamily:'var(--font-m)'}}>{s.label}</span>
            </div>
          ))}
          <div style={{width:1,height:16,background:'rgba(255,255,255,0.15)'}}/>
          {timeStr&&<span style={{fontSize:10,color:'rgba(255,255,255,0.35)',fontFamily:'var(--font-m)'}}>✓ {timeStr}</span>}
          <button onClick={()=>window.print()} className="no-print" style={{padding:'5px 12px',borderRadius:5,border:'1px solid rgba(255,255,255,0.2)',background:'transparent',color:'rgba(255,255,255,0.6)',fontSize:10,cursor:'pointer',fontFamily:'var(--font-m)'}}>↓ Export</button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{background:'#fff',borderBottom:'1px solid var(--border)',display:'flex',padding:'0 40px',alignItems:'stretch'}}>
        {[['hospital','Hospital Report','COMPLIANCE OFFICER'],['patient','Patient Report','PATIENT VIEW']].filter(([t])=>t===scanType).map(([t,l,sub])=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:'0 28px',height:52,background:'none',border:'none',cursor:'pointer',
            borderBottom:'3px solid ' + (tab===t?'#15803d':'transparent'),
            transition:'all 0.2s',display:'flex',flexDirection:'column',justifyContent:'center',gap:1,
          }}>
            <span style={{fontFamily:'var(--font-d)',fontWeight:700,fontSize:14,color:tab===t?'#0c110c':'var(--text3)',transition:'color 0.2s'}}>{l}</span>
            <span style={{fontSize:9,fontFamily:'var(--font-m)',color:tab===t?'#15803d':'var(--text4)',letterSpacing:'0.08em'}}>{sub}</span>
          </button>
        ))}
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'flex-end',gap:16}}>
          {/* The money line — visible, styled properly */}
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 14px',borderRadius:6,background:'#f0fdf4',border:'1px solid #bbf7d0'}}>
            <span style={{fontSize:10,fontFamily:'var(--font-m)',color:'#15803d',fontWeight:700,letterSpacing:'0.06em'}}>SAME DATA</span>
            <span style={{width:1,height:10,background:'#bbf7d0'}}/>
            <span style={{fontSize:10,fontFamily:'var(--font-m)',color:'#15803d',fontWeight:700,letterSpacing:'0.06em'}}>TWO STAKEHOLDERS</span>
            <span style={{width:1,height:10,background:'#bbf7d0'}}/>
            <span style={{fontSize:10,fontFamily:'var(--font-m)',color:'#15803d',fontWeight:700,letterSpacing:'0.06em'}}>ONE PLATFORM</span>
          </div>
        </div>
      </div>

      {/* ── HOSPITAL TAB ─────────────────────────────────────────────────── */}
      {(scanType==='hospital'||!scanType)&&(
        <div className="print-hospital" style={{padding:'28px 40px',maxWidth:1400,margin:'0 auto',animation:'fadeIn 0.25s ease'}}>

          {/* Status strip — score + key stats */}
          <div style={{display:'grid',gridTemplateColumns:'auto 1fr 1fr 1fr 1fr',gap:12,marginBottom:24}}>

            {/* Score ring */}
            <div style={{padding:'20px 24px',background:'#fff',border:'1.5px solid var(--border)',borderRadius:12,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minWidth:110}}>
              <ScoreRing score={score}/>
            </div>

            {/* Risk */}
            <div style={{padding:'20px 24px',background:'#fff',border:'1.5px solid var(--border)',borderRadius:12,display:'flex',flexDirection:'column',justifyContent:'center'}}>
              <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.1em',marginBottom:6}}>RISK LEVEL</div>
              <div style={{fontSize:32,fontWeight:800,fontFamily:'var(--font-d)',color:riskColor,lineHeight:1}}>{risk?.toUpperCase()}</div>
            </div>

            {/* Laws */}
            <div style={{padding:'20px 24px',background:'#fff',border:'1.5px solid var(--border)',borderRadius:12,display:'flex',flexDirection:'column',justifyContent:'center'}}>
              <div style={{fontSize:9,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.1em',marginBottom:6}}>LAWS APPLICABLE</div>
              <div style={{fontSize:32,fontWeight:800,fontFamily:'var(--font-d)',color:'#2563eb',lineHeight:1}}>{laws.length}</div>
            </div>

            {/* Critical gaps */}
            <div style={{padding:'20px 24px',background:critGaps>0?'#fef2f2':'#fff',border:'1.5px solid '+(critGaps>0?'#fecaca':'var(--border)'),borderRadius:12,display:'flex',flexDirection:'column',justifyContent:'center'}}>
              <div style={{fontSize:9,fontFamily:'var(--font-m)',color:critGaps>0?'#dc2626':'var(--text4)',letterSpacing:'0.1em',marginBottom:6}}>CRITICAL GAPS</div>
              <div style={{fontSize:32,fontWeight:800,fontFamily:'var(--font-d)',color:critGaps>0?'#dc2626':'#15803d',lineHeight:1}}>{critGaps}</div>
            </div>

            {/* Shadow AI */}
            <div style={{padding:'20px 24px',background:shadow.length>0?'#fffbeb':'#fff',border:'1.5px solid '+(shadow.length>0?'#fde68a':'var(--border)'),borderRadius:12,display:'flex',flexDirection:'column',justifyContent:'center'}}>
              <div style={{fontSize:9,fontFamily:'var(--font-m)',color:shadow.length>0?'#d97706':'var(--text4)',letterSpacing:'0.1em',marginBottom:6}}>SHADOW AI</div>
              <div style={{fontSize:32,fontWeight:800,fontFamily:'var(--font-d)',color:shadow.length>0?'#d97706':'#9ca3af',lineHeight:1}}>{shadow.length}</div>
            </div>
          </div>

          {/* Batch disclosure alert */}
          <BatchDisclosureAlert npi={data?.hospital_npi}/>

          {/* Executive summary */}
          {report.executive_summary&&(
            <div style={{padding:'20px 24px',borderRadius:12,background:'#fff',border:'1.5px solid var(--border)',borderLeft:'4px solid #15803d',marginBottom:20}}>
              <div style={{fontSize:10,color:'#15803d',fontFamily:'var(--font-m)',marginBottom:8,letterSpacing:'0.1em',fontWeight:700}}>EXECUTIVE SUMMARY</div>
              <p style={{color:'var(--text)',fontSize:15,lineHeight:1.8}}>{report.executive_summary}</p>
            </div>
          )}

          {/* Main grid */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>

            {/* Compliance gaps */}
            <div style={{background:'#fff',border:'1.5px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
              <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',background:'#fafafa',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:10,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.1em'}}>COMPLIANCE GAPS</span>
                <span style={{fontSize:12,fontWeight:700,color:gaps.length>0?'#dc2626':'#15803d',fontFamily:'var(--font-m)'}}>{gaps.length} FOUND</span>
              </div>
              <div style={{maxHeight:380,overflowY:'auto',padding:'12px 0'}}>
                {gaps.length===0
                  ?<div style={{padding:'20px',fontSize:13,color:'var(--text3)',textAlign:'center'}}>No compliance gaps detected ✓</div>
                  :gaps.map((g,i)=>{
                    const s=SEV[g.severity]||SEV.info
                    return(
                      <div key={i} style={{padding:'12px 20px',borderBottom:i<gaps.length-1?'1px solid var(--border)':'none'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                          <SevBadge severity={g.severity}/>
                          <span style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--font-m)'}}>{g.tool_name}</span>
                        </div>
                        <p style={{fontSize:12,color:'var(--text2)',lineHeight:1.5,marginBottom:4}}>{g.gap_description}</p>
                        <p style={{fontSize:11,color:'#15803d',fontWeight:600}}>→ {g.required_action}</p>
                        {g.estimated_fix_time&&<div style={{marginTop:3,fontSize:10,color:'var(--text4)',fontFamily:'var(--font-m)'}}>{g.estimated_fix_time} · {Math.round((g.confidence||0)*100)}% confidence</div>}
                      </div>
                    )
                  })
                }
              </div>
            </div>

            {/* Right column */}
            <div style={{display:'flex',flexDirection:'column',gap:12}}>

              {/* Action checklist */}
              <div style={{background:'#fff',border:'1.5px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
                <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',background:'#fafafa',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:10,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.1em'}}>ACTION CHECKLIST</span>
                  <span style={{fontSize:12,fontWeight:700,color:'#2563eb',fontFamily:'var(--font-m)'}}>{actions.length} ITEMS</span>
                </div>
                <div style={{maxHeight:180,overflowY:'auto',padding:'8px 0'}}>
                  {actions.length===0
                    ?<div style={{padding:'16px 20px',fontSize:13,color:'var(--text3)'}}>No action items</div>
                    :actions.map((a,i)=>(
                      <div key={i} style={{display:'flex',gap:10,padding:'8px 20px',borderBottom:i<actions.length-1?'1px solid var(--border)':'none',alignItems:'flex-start'}}>
                        <span style={{fontFamily:'var(--font-m)',fontWeight:700,color:'#15803d',fontSize:12,flexShrink:0,width:16}}>{a.priority}.</span>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{fontSize:12,color:'var(--text)',lineHeight:1.4}}>{a.action}</p>
                          <p style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--font-m)',marginTop:2}}>{a.deadline} · {a.owner}</p>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Shadow AI */}
              <div style={{background:'#fff',border:'1.5px solid '+(shadow.length>0?'#fde68a':'var(--border)'),borderRadius:12,overflow:'hidden'}}>
                <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',background:shadow.length>0?'#fffbeb':'#fafafa',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:10,fontFamily:'var(--font-m)',color:shadow.length>0?'#d97706':'var(--text4)',letterSpacing:'0.1em'}}>⚠ SHADOW AI RISKS</span>
                  <span style={{fontSize:12,fontWeight:700,color:shadow.length>0?'#d97706':'var(--text4)',fontFamily:'var(--font-m)'}}>{shadow.length}</span>
                </div>
                <div style={{padding:'8px 0',maxHeight:150,overflowY:'auto'}}>
                  {shadow.length===0
                    ?<div style={{padding:'16px 20px',fontSize:13,color:'var(--text3)'}}>No shadow AI detected</div>
                    :shadow.slice(0,4).map((s,i)=>(
                      <div key={i} style={{padding:'8px 20px',borderBottom:i<Math.min(shadow.length,4)-1?'1px solid var(--border)':'none',display:'flex',gap:8,alignItems:'flex-start'}}>
                        <SevBadge severity={s.severity}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,color:'var(--text)',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.risk_name||s.pattern_id}</div>
                          <div style={{fontSize:10,color:'var(--text4)',fontFamily:'var(--font-m)'}}>{Math.round((s.confidence||0)*100)}% confidence</div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Laws grid */}
          {laws.length>0&&(
            <div style={{background:'#fff',border:'1.5px solid var(--border)',borderRadius:12,overflow:'hidden',marginBottom:16}}>
              <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',background:'#fafafa'}}>
                <span style={{fontSize:10,fontFamily:'var(--font-m)',color:'var(--text4)',letterSpacing:'0.1em'}}>APPLICABLE LAWS ({laws.length})</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:0}}>
                {laws.map((law,i)=>(
                  <div key={law.law_id||i} style={{padding:'14px 20px',borderRight:i%4!==3?'1px solid var(--border)':'none',borderBottom:'1px solid var(--border)'}}>
                    <div style={{display:'flex',gap:6,marginBottom:6,alignItems:'center'}}>
                      <span style={{fontSize:8,padding:'2px 6px',borderRadius:3,fontFamily:'var(--font-m)',fontWeight:700,background:law.jurisdiction==='Federal'?'#eff6ff':'#f0fdf4',color:law.jurisdiction==='Federal'?'#2563eb':'#15803d',border:'1px solid '+(law.jurisdiction==='Federal'?'#bfdbfe':'#bbf7d0')}}>{(law.jurisdiction||'FEDERAL').toUpperCase()}</span>
                      <span style={{fontSize:9,color:'var(--text4)',fontFamily:'var(--font-m)'}}>{law.law_id}</span>
                    </div>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--dark)',marginBottom:3}}>{law.law_name}</div>
                    <div style={{fontSize:11,color:'var(--text3)',lineHeight:1.4}}>{law.applicability_reason||law.why_applicable}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit + methodology footer */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
            <div style={{padding:'14px 18px',borderRadius:10,background:'#f0fdf4',border:'1px solid #bbf7d0'}}>
              <div style={{fontSize:10,fontFamily:'var(--font-m)',color:'#15803d',letterSpacing:'0.08em',marginBottom:6,fontWeight:700}}>DETECTION METHODOLOGY</div>
              <p style={{fontSize:11,color:'var(--text2)',lineHeight:1.6}}>Shadow AI flags are <strong>probabilistic heuristics</strong> grounded in HIMSS 2024 deployment norms. Confidence scores reflect population-level rates. Forensic confirmation requires EHR audit log review.</p>
            </div>
            <div style={{padding:'14px 18px',borderRadius:10,background:'#eff6ff',border:'1px solid #bfdbfe'}}>
              <div style={{fontSize:10,fontFamily:'var(--font-m)',color:'#2563eb',letterSpacing:'0.08em',marginBottom:6,fontWeight:700}}>LAW CITATIONS</div>
              <p style={{fontSize:11,color:'var(--text2)',lineHeight:1.6}}>Requirements paraphrased from primary sources (TRAIGA, CMS, HHS, ONC). Source URLs embedded in knowledge base. This is a Tier 1 screening tool — consult a healthcare compliance attorney before acting.</p>
            </div>
          </div>
          {data?.audit_id&&(
            <div style={{padding:'8px 14px',borderRadius:6,background:'var(--bg)',border:'1px solid var(--border)',fontSize:10,color:'var(--text4)',fontFamily:'var(--font-m)',display:'flex',justifyContent:'space-between',marginBottom:10}}>
              <span>AUDIT RECORD: {data.audit_id}</span>
              <span>{new Date().toISOString().split('T')[0]} · Retained per compliance requirements</span>
            </div>
          )}
        </div>
      )}

      {/* ── PATIENT TAB ───────────────────────────────────────────────────── */}
      {scanType==='patient'&&<PatientTabView data={data} />}
    </div>
  )
}


// ── ROOT ───────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage]                 = useState('landing')
  const [result, setResult]             = useState(null)
  const [hospitalUser, setHospitalUser] = useState(null)
  const [batchPatient, setBatchPatient] = useState(null)

  const handleResult = data => { setResult(data); setPage('results') }
  const nav          = p => setPage(p || 'landing')
  const goHub        = () => setPage('hospital-hub')

  if (page === 'results' && result)
    return <Results data={result} onBack={() => { if (result?.scan_type==='hospital') goHub(); else setPage('landing'); setResult(null) }} />
  if (page === 'hospital-hub' && hospitalUser)
    return <HospitalHub user={hospitalUser} onMode={mode => { if (mode==='audit') setPage('hospital'); if (mode==='monitor') setPage('batch') }} onBack={() => { setPage('landing'); setHospitalUser(null) }} />
  if (page === 'batch' && hospitalUser)
    return <BatchDashboard user={hospitalUser} onBack={() => setPage('hospital-hub')} onPatientReport={p => { setBatchPatient(p); setPage('batch-report') }} />
  if (page === 'batch-report' && batchPatient)
    return <BatchPatientReport patient={batchPatient} user={hospitalUser} onBack={() => setPage('batch')} />
  if (page === 'howitworks') return <HowItWorks onBack={nav} />
  if (page === 'about')      return <About onBack={nav} />
  if (page === 'hospital-login')
    return <HospitalLogin onSuccess={u => { setHospitalUser(u); setPage('hospital-hub') }} onBack={() => setPage('landing')} />
  if (page === 'patient-login')
    return <PatientLogin onSuccess={data => handleResult(data)} onBack={() => setPage('landing')} />
  if (page === 'hospital' && hospitalUser)
    return <HospitalForm user={hospitalUser} onResult={handleResult} onBack={() => setPage('hospital-hub')} />
  return <Landing onMode={mode => setPage(mode === 'hospital' ? 'hospital-login' : 'patient-login')} onNav={nav} />
}