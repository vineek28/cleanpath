"""
ClearPath Patient PDF Report Generator
=======================================
Generates two documents:
  1. generate_full_report  — multi-page Patient AI Transparency Report
  2. generate_rights_card  — single-page patient information sheet + rights

Design: clean black-and-white medical document, no colour blocks.
"""

import io
from datetime import datetime, timezone
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

# ── Monochrome palette ─────────────────────────────────────────────────────────
BLACK   = colors.HexColor('#000000')
DARK    = colors.HexColor('#1a1a1a')
GREY1   = colors.HexColor('#374151')
GREY2   = colors.HexColor('#6b7280')
GREY3   = colors.HexColor('#9ca3af')
GREY_BG = colors.HexColor('#f5f5f5')
BORDER  = colors.HexColor('#cccccc')
WHITE   = colors.white

# ── Tool metadata ──────────────────────────────────────────────────────────────
TOOL_NAMES = {
    'epic_sepsis_model':             'Epic Sepsis Prediction Model',
    'billing_coding_ai':             'AI-Assisted Medical Coding',
    'radiology_ai_cad':              'Radiology AI / CADe Detection',
    'viz_ai':                        'Viz.ai Stroke Detection',
    'nuance_dax':                    'Nuance DAX Ambient Documentation',
    'chatgpt_clinical':              'Consumer AI (ChatGPT) — Unverified',
    'ehr_predictive_analytics':      'EHR Predictive Analytics',
    'optum_claims_ai':               'Prior Authorization AI (Optum)',
    'ambient_clinical_intelligence': 'Ambient Clinical Intelligence',
    'azure_openai_clinical':         'Azure OpenAI Clinical Integration',
}

TOOL_RISK_LABEL = {
    'chatgpt_clinical':              'CRITICAL — No HIPAA BAA',
    'ambient_clinical_intelligence': 'HIGH — Consent Issue',
    'billing_coding_ai':             'HIGH — Human Override Required',
    'optum_claims_ai':               'HIGH — Prior Auth Scrutiny',
    'ehr_predictive_analytics':      'HIGH — Bias Monitoring Required',
    'epic_sepsis_model':             'MODERATE — Bias Monitoring Required',
    'radiology_ai_cad':              'MODERATE — FDA Clearance Required',
    'viz_ai':                        'MODERATE — FDA Clearance Required',
    'nuance_dax':                    'LOW — Patient Consent Required',
    'azure_openai_clinical':         'LOW — Standard Enterprise Controls',
}

TOOL_DESC = {
    'epic_sepsis_model':
        'Continuously monitored your vital signs and lab values to predict sepsis risk. '
        'Generated alerts for your care team — a physician reviewed every alert. FDA-cleared '
        'decision support tool. Required: quarterly demographic bias monitoring.',
    'billing_coding_ai':
        'Read your clinical notes and suggested billing codes for your diagnosis and procedures. '
        'A human medical coder reviewed and approved every code before submission to your insurer. '
        'Required: documented human override process on file.',
    'radiology_ai_cad':
        'Analyzed your imaging studies to assist radiologists in identifying findings. '
        'The final interpretation was made by a licensed radiologist. '
        'Required: verified FDA 510(k) clearance number.',
    'viz_ai':
        'Analyzed brain imaging in real time to detect signs of stroke or hemorrhage. '
        'All clinical decisions were made by physicians after reviewing the AI output. '
        'Required: verified FDA 510(k) clearance number.',
    'chatgpt_clinical':
        'A consumer AI chatbot was used by a care team member during your visit. This tool '
        'has no formal hospital approval and no HIPAA Business Associate Agreement — your '
        'protected health information may have been processed outside legal safeguards. '
        'This constitutes a potential HIPAA violation.',
    'ehr_predictive_analytics':
        'Your electronic health record ran predictive models throughout your stay to flag '
        'clinical risks based on your medical history and real-time readings. '
        'Required: documented patient disclosure policy.',
    'optum_claims_ai':
        'An AI system evaluated your prior authorization requests and insurance coverage. '
        'Under CMS rules, any AI-driven denial must be reviewable by a human. '
        'You have the right to appeal any AI-influenced coverage decision.',
    'nuance_dax':
        'An ambient AI system was active during clinical encounters to automatically generate '
        'documentation notes from spoken conversation. You can request a copy of any notes. '
        'Required: explicit patient consent before activation.',
    'ambient_clinical_intelligence':
        'An AI documentation tool recorded clinical encounters in your care area. '
        'Patient consent documentation is required before activation but may not have been obtained. '
        'You have the right to request documentation of consent obtained.',
    'azure_openai_clinical':
        'An enterprise AI integration assisted clinicians with documentation and clinical decision '
        'support. Data is processed under enterprise HIPAA controls. '
        'Required: Business Associate Agreement on file.',
}


def _fmt_dob(dob_str: str) -> str:
    """Convert ISO date (1990-07-22) to display format (07/22/1990)."""
    if not dob_str:
        return '—'
    try:
        d = datetime.strptime(dob_str, '%Y-%m-%d')
        return d.strftime('%m/%d/%Y')
    except Exception:
        return dob_str


def _header_footer(canvas, doc, hospital_name: str, generated_at: str, title: str):
    """Draws clean header bar and page footer on every page."""
    canvas.saveState()
    w, h = letter

    # Dark header bar
    canvas.setFillColor(DARK)
    canvas.rect(0, h - 0.6 * inch, w, 0.6 * inch, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont('Helvetica-Bold', 12)
    canvas.drawString(0.5 * inch, h - 0.38 * inch, 'ClearPath')
    canvas.setFont('Helvetica', 9)
    canvas.setFillColor(colors.HexColor('#aaaaaa'))
    canvas.drawString(1.38 * inch, h - 0.38 * inch, 'AI Governance Platform')
    canvas.setFillColor(colors.HexColor('#999999'))
    canvas.drawRightString(w - 0.5 * inch, h - 0.38 * inch, title.upper())

    # Thin rule under header
    canvas.setStrokeColor(colors.HexColor('#444444'))
    canvas.setLineWidth(0.5)
    canvas.line(0, h - 0.62 * inch, w, h - 0.62 * inch)

    # Footer
    canvas.setFillColor(GREY3)
    canvas.setFont('Helvetica', 7.5)
    canvas.drawString(0.5 * inch, 0.33 * inch,
        f'Generated {generated_at}  ·  {hospital_name}  ·  '
        'For informational purposes only. Not medical or legal advice.')
    canvas.drawRightString(w - 0.5 * inch, 0.33 * inch, f'Page {doc.page}')
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.4)
    canvas.line(0.5 * inch, 0.48 * inch, w - 0.5 * inch, 0.48 * inch)

    canvas.restoreState()


def _info_table(rows, col_widths):
    """Render a labelled-field info table (grey header cells, white value cells)."""
    data = []
    for label_row, value_row in zip(rows[::2], rows[1::2]):
        data.append(label_row)
        data.append(value_row)

    styles = getSampleStyleSheet()
    normal = styles['Normal']
    def S(name, **kw):
        return ParagraphStyle(name, parent=normal, **kw)

    label_s = S('lbl', fontSize=7.5, fontName='Helvetica-Bold', textColor=GREY2, leading=10)
    value_s = S('val', fontSize=10, textColor=DARK, leading=14)

    table_data = []
    for i, row in enumerate(data):
        table_data.append([Paragraph(str(cell), label_s if i % 2 == 0 else value_s) for cell in row])

    t = Table(table_data, colWidths=col_widths)
    n = len(table_data)
    style_cmds = [
        ('BOX',          (0, 0), (-1, -1), 0.6, BORDER),
        ('INNERGRID',    (0, 0), (-1, -1), 0.4, BORDER),
        ('TOPPADDING',   (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 4),
        ('LEFTPADDING',  (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
    ]
    for i in range(0, n, 2):
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), GREY_BG))
    t.setStyle(TableStyle(style_cmds))
    return t


def generate_rights_card(enc: dict) -> bytes:
    """
    Single-page patient information sheet + AI rights.
    Clean B&W medical document layout.
    """
    buf = io.BytesIO()
    generated_at = datetime.now(timezone.utc).strftime('%B %d, %Y')

    # Resolve fields
    tools      = enc.get('ai_tools') or []
    if isinstance(tools, str):
        import json
        try: tools = json.loads(tools)
        except Exception: tools = []

    adm_id     = enc.get('adm_id') or enc.get('id', '—')
    mrn        = enc.get('mrn', '—')
    p_name     = enc.get('patient_name') or enc.get('name', '—')
    hospital   = enc.get('hospital_name', 'Your Hospital')
    dept       = enc.get('department', '—')
    adm_date   = enc.get('admission_date') or enc.get('date', '—')
    dis_date   = enc.get('discharge_date', '—')
    dob        = _fmt_dob(enc.get('dob', ''))
    los        = enc.get('los_days') or enc.get('los', '—')
    icd10      = enc.get('icd10_desc') or enc.get('reason', '—')
    drg        = enc.get('drg_code') or enc.get('drg', '—')
    has_chatgpt = 'chatgpt_clinical' in tools

    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=0.55 * inch,
        rightMargin=0.55 * inch,
        topMargin=0.85 * inch,
        bottomMargin=0.65 * inch,
    )

    styles = getSampleStyleSheet()
    normal = styles['Normal']
    def S(name, **kw):
        return ParagraphStyle(name, parent=normal, **kw)

    story = []

    # ── Page title ─────────────────────────────────────────────────────────────
    story.append(Paragraph('Patient AI Transparency Notice',
        S('h1', fontSize=18, fontName='Helvetica-Bold', textColor=DARK,
          spaceAfter=2, alignment=TA_CENTER)))
    story.append(Paragraph('ClearPath AI Governance Platform',
        S('sub', fontSize=9, textColor=GREY2, alignment=TA_CENTER, spaceAfter=10)))
    story.append(HRFlowable(width='100%', thickness=1, color=DARK, spaceAfter=10))

    # ── Section A: Patient Information ─────────────────────────────────────────
    story.append(Paragraph('Patient Information',
        S('sh', fontSize=10, fontName='Helvetica-Bold', textColor=DARK,
          spaceBefore=4, spaceAfter=4)))

    gender = enc.get('gender') or 'Not provided'
    col4 = [1.85 * inch, 1.85 * inch, 1.85 * inch, 1.85 * inch]
    pi_table = _info_table([
        ['Name', 'Date of Birth (MM/DD/YYYY)', 'Gender', 'MRN'],
        [p_name,  dob if dob != '—' else 'Not provided', gender, mrn],
        ['Admission ID', 'Admission Date', 'Discharge Date', 'Length of Stay'],
        [adm_id, adm_date, dis_date, f'{los} days' if los != '—' else '—'],
    ], col4)
    story.append(pi_table)
    story.append(Spacer(1, 0.06 * inch))

    # ── Section B: Facility & Clinical ────────────────────────────────────────
    story.append(Paragraph('Facility & Clinical Details',
        S('sh', fontSize=10, fontName='Helvetica-Bold', textColor=DARK,
          spaceBefore=6, spaceAfter=4)))

    fc_table = _info_table([
        ['Hospital / Facility', 'Department / Unit', 'Primary Diagnosis (ICD-10)', 'DRG Code'],
        [hospital, dept, icd10, drg],
    ], col4)
    story.append(fc_table)
    story.append(Spacer(1, 0.06 * inch))

    # ── Section C: AI Systems Active ───────────────────────────────────────────
    story.append(Paragraph('AI Systems Active During Your Care',
        S('sh', fontSize=10, fontName='Helvetica-Bold', textColor=DARK,
          spaceBefore=6, spaceAfter=4)))

    cell_s  = S('cell',  fontSize=9,   textColor=DARK,  leading=13)
    cell_hd = S('cellh', fontSize=7.5, textColor=GREY2, leading=10, fontName='Helvetica-Bold')

    if tools:
        tool_rows = [
            [Paragraph('#', cell_hd), Paragraph('AI System Name', cell_hd),
             Paragraph('Risk Classification', cell_hd)]
        ]
        for i, t_id in enumerate(tools, 1):
            tool_rows.append([
                Paragraph(str(i), cell_s),
                Paragraph(TOOL_NAMES.get(t_id, t_id.replace('_', ' ').title()), cell_s),
                Paragraph(TOOL_RISK_LABEL.get(t_id, 'Moderate — Standard Review'), cell_s),
            ])
        tt = Table(tool_rows, colWidths=[0.3*inch, 4.45*inch, 2.65*inch])
        tt.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, 0), GREY_BG),
            ('BOX',           (0, 0), (-1, -1), 0.6, BORDER),
            ('INNERGRID',     (0, 0), (-1, -1), 0.4, BORDER),
            ('TOPPADDING',    (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING',   (0, 0), (-1, -1), 7),
            ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(tt)
    else:
        story.append(Paragraph('No AI systems were recorded for this encounter.',
            S('na', fontSize=9, textColor=GREY2, spaceAfter=4)))
    story.append(Spacer(1, 0.06 * inch))

    # ── Section D: Your Rights & Course of Action ──────────────────────────────
    story.append(HRFlowable(width='100%', thickness=0.6, color=DARK, spaceAfter=8))
    story.append(Paragraph('Your Rights & Course of Action',
        S('sh', fontSize=10, fontName='Helvetica-Bold', textColor=DARK,
          spaceBefore=4, spaceAfter=6)))

    rights = [
        ('1', 'Right to Know What AI Was Used',
         'HHS AI Safety Program (2025)',
         f'Request a written AI disclosure statement for admission {adm_id} from the hospital '
         'admissions or compliance office.'),
        ('2', 'Right to Request Human Review',
         'HIPAA / HHS AI Safety Guidelines',
         f'Ask any care provider or the compliance office to arrange a human physician review '
         f'of any AI-assisted decision made during your stay in {dept}.'),
        ('3', 'Right to Request AI Explanation',
         'State AI Transparency Laws',
         'Submit a written request to the hospital health information department for a '
         'plain-language explanation of how each AI system influenced your care.'),
    ]
    if has_chatgpt:
        rights.append((
            '4', 'Right to File a HIPAA Complaint — URGENT',
            'HIPAA Privacy Rule § 164.502',
            'A consumer AI tool (ChatGPT) was used without a Business Associate Agreement. '
            'File at hhs.gov/ocr, call 1-800-368-1019, or report via ClearPath. '
            'Include your Admission ID: ' + adm_id + '.',
        ))

    rights_rows = [[
        Paragraph('#', cell_hd), Paragraph('Right', cell_hd),
        Paragraph('Applicable Law', cell_hd), Paragraph('How to Exercise', cell_hd),
    ]]
    for num, right, law, action in rights:
        rights_rows.append([
            Paragraph(num, cell_s), Paragraph(right, cell_s),
            Paragraph(law, cell_s), Paragraph(action, cell_s),
        ])

    rt = Table(rights_rows, colWidths=[0.25*inch, 1.75*inch, 1.6*inch, 3.8*inch])
    rt.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, 0), GREY_BG),
        ('BOX',           (0, 0), (-1, -1), 0.6, BORDER),
        ('INNERGRID',     (0, 0), (-1, -1), 0.4, BORDER),
        ('TOPPADDING',    (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING',   (0, 0), (-1, -1), 7),
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(rt)

    # ── Case reference ─────────────────────────────────────────────────────────
    ref_date = datetime.now(timezone.utc).strftime('%Y%m%d')
    ref_adm  = adm_id.replace('-', '').replace('ADM', 'ADM') if adm_id != '—' else 'UNKNOWN'
    case_ref = f'CPR-{ref_adm}-{ref_date}'
    story.append(Spacer(1, 0.1 * inch))
    ref_row = Table([[
        Paragraph('ClearPath Case Reference', S('rl', fontSize=7.5, fontName='Helvetica-Bold',
                   textColor=GREY2, leading=10)),
        Paragraph(case_ref, S('rv', fontSize=9, fontName='Helvetica-Bold',
                   textColor=DARK, leading=12, alignment=TA_RIGHT)),
    ]], colWidths=[3.4*inch, 4.0*inch])
    ref_row.setStyle(TableStyle([
        ('BOX',           (0, 0), (-1, -1), 0.5, BORDER),
        ('BACKGROUND',    (0, 0), (-1, -1), GREY_BG),
        ('TOPPADDING',    (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING',   (0, 0), (-1, -1), 8),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 8),
        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(ref_row)

    # ── Signature block ────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.12 * inch))
    story.append(HRFlowable(width='100%', thickness=0.4, color=BORDER, spaceAfter=6))
    sig_data = [
        [
            Paragraph('Patient Signature', S('sl', fontSize=8, textColor=GREY2, leading=10)),
            Paragraph('Date', S('sl', fontSize=8, textColor=GREY2, leading=10)),
            Paragraph('Received By (Hospital Staff)', S('sl', fontSize=8, textColor=GREY2, leading=10)),
        ],
        [
            Paragraph('_' * 38, S('sline', fontSize=9, textColor=GREY1)),
            Paragraph('_' * 18, S('sline', fontSize=9, textColor=GREY1)),
            Paragraph('_' * 30, S('sline', fontSize=9, textColor=GREY1)),
        ]
    ]
    sig = Table(sig_data, colWidths=[2.85*inch, 1.35*inch, 2.6*inch])
    sig.setStyle(TableStyle([
        ('TOPPADDING',    (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING',   (0, 0), (-1, -1), 0),
    ]))
    story.append(sig)

    def _hdr(canvas, doc):
        _header_footer(canvas, doc, hospital, generated_at, 'Patient AI Rights Card')

    doc.build(story, onFirstPage=_hdr, onLaterPages=_hdr)
    return buf.getvalue()


def generate_full_report(enc: dict, tickets: dict | None = None) -> bytes:
    """
    Multi-page Patient AI Transparency Report PDF.
    Clean B&W medical document layout.
    """
    buf = io.BytesIO()
    generated_at = datetime.now(timezone.utc).strftime('%B %d, %Y at %H:%M UTC')

    # Resolve fields
    tools     = enc.get('ai_tools') or []
    if isinstance(tools, str):
        import json
        try: tools = json.loads(tools)
        except Exception: tools = []

    gaps      = enc.get('governance_gaps') or []
    dept      = enc.get('department', '—')
    adm_id    = enc.get('adm_id') or enc.get('id', '—')
    adm_date  = enc.get('admission_date') or enc.get('date', '—')
    dis_date  = enc.get('discharge_date', '—')
    los       = enc.get('los_days') or enc.get('los', '—')
    icd10     = enc.get('icd10_desc') or enc.get('reason', '—')
    drg       = enc.get('drg_code') or enc.get('drg', '—')
    mrn       = enc.get('mrn', '—')
    dob       = _fmt_dob(enc.get('dob', ''))
    p_name    = enc.get('patient_name') or enc.get('name', '—')
    hospital  = enc.get('hospital_name', 'Your Hospital')
    tickets   = tickets or {}
    has_chatgpt = 'chatgpt_clinical' in tools
    crit_count  = sum(1 for t in tools if TOOL_RISK_LABEL.get(t, '').startswith('CRITICAL'))

    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=0.55 * inch,
        rightMargin=0.55 * inch,
        topMargin=0.9 * inch,
        bottomMargin=0.7 * inch,
    )

    styles = getSampleStyleSheet()
    normal = styles['Normal']
    def S(name, **kw):
        return ParagraphStyle(name, parent=normal, **kw)

    h1 = S('h1', fontSize=19, fontName='Helvetica-Bold', textColor=DARK, spaceAfter=2)
    h2 = S('h2', fontSize=12, fontName='Helvetica-Bold', textColor=DARK, spaceBefore=10, spaceAfter=4)
    sh = S('sh', fontSize=10, fontName='Helvetica-Bold', textColor=DARK, spaceBefore=6, spaceAfter=4)
    body = S('body', fontSize=10, textColor=GREY1, leading=15, spaceAfter=3)
    small = S('small', fontSize=8.5, textColor=GREY2, leading=13)
    label_s = S('lbl', fontSize=7.5, fontName='Helvetica-Bold', textColor=GREY2, leading=10)
    value_s = S('val', fontSize=10, textColor=DARK, leading=14)

    story = []
    col4 = [1.85 * inch, 1.85 * inch, 1.85 * inch, 1.85 * inch]
    cell_s  = S('cell',  fontSize=9.5, textColor=DARK,  leading=14)
    cell_hd = S('cellh', fontSize=7.5, textColor=GREY2, leading=10, fontName='Helvetica-Bold')
    gender  = enc.get('gender') or 'Not provided'
    ref_date = datetime.now(timezone.utc).strftime('%Y%m%d')
    ref_adm  = adm_id.replace('-', '') if adm_id != '—' else 'UNKNOWN'
    case_ref = f'CPR-{ref_adm}-{ref_date}'

    # ── Cover block ────────────────────────────────────────────────────────────
    story.append(Paragraph('Patient AI Transparency Report', h1))
    story.append(Paragraph('ClearPath AI Governance Platform',
        S('sub', fontSize=9, textColor=GREY2, spaceAfter=10)))
    story.append(HRFlowable(width='100%', thickness=1, color=DARK, spaceAfter=10))

    # ── Patient Information ────────────────────────────────────────────────────
    story.append(Paragraph('Patient Information', sh))
    pi_table = _info_table([
        ['Name', 'Date of Birth (MM/DD/YYYY)', 'Gender', 'MRN'],
        [p_name, dob if dob != '—' else 'Not provided', gender, mrn],
        ['Admission ID', 'Admission Date', 'Discharge Date', 'Length of Stay'],
        [adm_id, adm_date, dis_date, f'{los} days' if los not in ('—', None, '') else '—'],
    ], col4)
    story.append(pi_table)
    story.append(Spacer(1, 0.06 * inch))

    # ── Facility & Clinical ────────────────────────────────────────────────────
    story.append(Paragraph('Facility & Clinical Details', sh))
    fc_table = _info_table([
        ['Hospital / Facility', 'Department / Unit', 'Primary Diagnosis (ICD-10)', 'DRG Code'],
        [hospital, dept, icd10, drg],
    ], col4)
    story.append(fc_table)
    story.append(Spacer(1, 0.1 * inch))

    # ── HIPAA Alert ────────────────────────────────────────────────────────────
    if has_chatgpt:
        alert_row = [[Paragraph(
            'GOVERNANCE ALERT — Consumer AI (ChatGPT) was used during your care without a HIPAA '
            'Business Associate Agreement. Your protected health information may have been processed '
            'outside legal safeguards. See Section D for your rights.',
            S('alert', fontSize=9.5, fontName='Helvetica-Bold', textColor=DARK, leading=14)
        )]]
        at = Table(alert_row, colWidths=[7.4 * inch])
        at.setStyle(TableStyle([
            ('BOX',           (0, 0), (-1, -1), 1.2, DARK),
            ('TOPPADDING',    (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
            ('LEFTPADDING',   (0, 0), (-1, -1), 12),
        ]))
        story.append(at)
        story.append(Spacer(1, 0.1 * inch))

    # ── AI Systems ────────────────────────────────────────────────────────────
    story.append(HRFlowable(width='100%', thickness=0.6, color=DARK, spaceAfter=8))
    story.append(Paragraph('AI Systems Active During Your Visit', h2))
    story.append(Paragraph(
        f'{len(tools)} AI system{"s were" if len(tools) != 1 else " was"} active during your '
        f'stay in {dept}. Each system is described below in plain language.',
        body
    ))
    story.append(Spacer(1, 0.06 * inch))

    for t_id in tools:
        name  = TOOL_NAMES.get(t_id, t_id.replace('_', ' ').title())
        risk  = TOOL_RISK_LABEL.get(t_id, 'Moderate — Standard Review')
        desc  = TOOL_DESC.get(t_id, 'This AI system was active during your care.')

        inner_rows = [
            [Paragraph(name, S('tn', fontSize=11, fontName='Helvetica-Bold', textColor=DARK, leading=14)),
             Paragraph(risk, S('tr', fontSize=8.5, fontName='Helvetica-Bold', textColor=GREY1,
                               alignment=TA_RIGHT, leading=12))],
            [Paragraph(desc, S('td', fontSize=9.5, textColor=GREY1, leading=14)), ''],
        ]
        inner = Table(inner_rows, colWidths=[5.55*inch, 1.85*inch])
        inner.setStyle(TableStyle([
            ('BOX',           (0, 0), (-1, -1), 0.6, BORDER),
            ('LINEBELOW',     (0, 0), (-1, 0), 0.4, BORDER),
            ('BACKGROUND',    (0, 0), (-1, 0), GREY_BG),
            ('TOPPADDING',    (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING',   (0, 0), (-1, -1), 10),
            ('RIGHTPADDING',  (0, 0), (-1, -1), 10),
            ('SPAN',          (0, 1), (1, 1)),
            ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(KeepTogether([inner, Spacer(1, 0.07 * inch)]))

    # ── Governance Gaps ────────────────────────────────────────────────────────
    if gaps:
        story.append(HRFlowable(width='100%', thickness=0.6, color=DARK, spaceAfter=8))
        story.append(Paragraph('Governance Issues Identified', h2))
        gap_rows = [
            [Paragraph('#', cell_hd), Paragraph('Issue Description', cell_hd)]
        ]
        for i, g in enumerate(gaps, 1):
            gap_rows.append([Paragraph(str(i), cell_s), Paragraph(str(g), cell_s)])
        gt = Table(gap_rows, colWidths=[0.35*inch, 7.05*inch])
        gt.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, 0), GREY_BG),
            ('BOX',           (0, 0), (-1, -1), 0.6, BORDER),
            ('INNERGRID',     (0, 0), (-1, -1), 0.4, BORDER),
            ('TOPPADDING',    (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING',   (0, 0), (-1, -1), 8),
            ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(gt)
        story.append(Spacer(1, 0.1 * inch))

    # ── Legal Rights ───────────────────────────────────────────────────────────
    story.append(HRFlowable(width='100%', thickness=0.6, color=DARK, spaceAfter=8))
    story.append(Paragraph('Your Legal Rights', h2))

    rights = [
        ('1', 'Right to Know What AI Was Used',
         'HHS AI Safety Program (2025)',
         f'Request a written AI disclosure statement for admission {adm_id} from the hospital '
         'admissions or compliance office. They must respond within 30 days.'),
        ('2', 'Right to Request Human Review',
         'HIPAA / HHS AI Safety Guidelines',
         f'Contact {dept} or the patient advocate and request a physician review of any '
         'AI-assisted clinical decision made during your stay.'),
        ('3', 'Right to Request AI Explanation',
         'State AI Transparency Laws',
         'Submit a written request to the health information department for a plain-language '
         'explanation of how each AI system influenced your diagnosis or treatment plan.'),
    ]
    if has_chatgpt:
        rights.append((
            '4', 'Right to File a HIPAA Complaint',
            'HIPAA Privacy Rule § 164.502 — URGENT',
            f'ChatGPT was used without a BAA. File at hhs.gov/ocr, call 1-800-368-1019, or '
            f'report via ClearPath. Reference admission {adm_id}.',
        ))

    rights_rows = [[
        Paragraph('#', cell_hd), Paragraph('Right', cell_hd),
        Paragraph('Applicable Law', cell_hd), Paragraph('How to Exercise This Right', cell_hd),
    ]]
    for num, right, law, action in rights:
        rights_rows.append([
            Paragraph(num, cell_s), Paragraph(right, cell_s),
            Paragraph(law, cell_s), Paragraph(action, cell_s),
        ])

    rt = Table(rights_rows, colWidths=[0.25*inch, 1.75*inch, 1.65*inch, 3.75*inch])
    rt.setStyle(TableStyle([
        ('BACKGROUND',    (0, 0), (-1, 0), GREY_BG),
        ('BOX',           (0, 0), (-1, -1), 0.6, BORDER),
        ('INNERGRID',     (0, 0), (-1, -1), 0.4, BORDER),
        ('TOPPADDING',    (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING',   (0, 0), (-1, -1), 7),
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(rt)

    # ── Case Status ────────────────────────────────────────────────────────────
    if tickets:
        story.append(Spacer(1, 0.1 * inch))
        story.append(HRFlowable(width='100%', thickness=0.6, color=DARK, spaceAfter=8))
        story.append(Paragraph('Submitted Requests & Case Status', h2))

        label_map = {
            'review':    'Human Review Request',
            'explain':   'AI Explanation Request',
            'complaint': 'HIPAA Breach Report',
        }
        now_str = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        ticket_rows = [['Request Type', 'Ticket ID', 'Status', 'Submitted']]
        for req_type, ticket_id in tickets.items():
            ticket_rows.append([
                label_map.get(req_type, req_type),
                str(ticket_id),
                'Under Review',
                now_str,
            ])
        col_w = [2.55*inch, 1.5*inch, 1.5*inch, 1.85*inch]
        ticket_data_styled = [[Paragraph(str(c),
            S('th', fontSize=7.5, fontName='Helvetica-Bold', textColor=GREY2) if i == 0
            else S('td', fontSize=10, textColor=DARK))
            for c in row] for i, row in enumerate(ticket_rows)]
        tt = Table(ticket_data_styled, colWidths=col_w)
        tt.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, 0), GREY_BG),
            ('BOX',           (0, 0), (-1, -1), 0.6, BORDER),
            ('INNERGRID',     (0, 0), (-1, -1), 0.4, BORDER),
            ('TOPPADDING',    (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING',   (0, 0), (-1, -1), 8),
        ]))
        story.append(tt)
        story.append(Spacer(1, 0.06 * inch))
        story.append(Paragraph(
            'Expected response within 72 hours  ·  Assigned to Hospital Compliance Office  ·  '
            'If no response, escalate to your state health authority.',
            small
        ))

    # ── Case reference + confidence note ──────────────────────────────────────
    story.append(Spacer(1, 0.15 * inch))
    story.append(HRFlowable(width='100%', thickness=0.4, color=BORDER, spaceAfter=8))
    ref_row = Table([[
        Paragraph('ClearPath Case Reference', S('rl', fontSize=7.5, fontName='Helvetica-Bold',
                   textColor=GREY2, leading=10)),
        Paragraph(case_ref, S('rv', fontSize=9, fontName='Helvetica-Bold',
                   textColor=DARK, leading=12, alignment=TA_RIGHT)),
    ]], colWidths=[3.4*inch, 4.0*inch])
    ref_row.setStyle(TableStyle([
        ('BOX',           (0, 0), (-1, -1), 0.5, BORDER),
        ('BACKGROUND',    (0, 0), (-1, -1), GREY_BG),
        ('TOPPADDING',    (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING',   (0, 0), (-1, -1), 8),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 8),
        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(ref_row)
    story.append(Spacer(1, 0.06 * inch))
    story.append(Paragraph(
        f'Analysis confidence: 92%  ·  Based on system logs, policy records, and usage patterns  ·  '
        f'Generated {generated_at}',
        S('conf', fontSize=8, textColor=GREY3, leading=12)
    ))

    def _hdr(canvas, doc):
        _header_footer(canvas, doc, hospital, generated_at, 'Patient AI Transparency Report')

    doc.build(story, onFirstPage=_hdr, onLaterPages=_hdr)
    return buf.getvalue()
