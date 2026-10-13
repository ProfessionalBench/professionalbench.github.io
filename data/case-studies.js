/* Paper-grounded case descriptions. Populate trajectory only with a verified released run.
   trajectory: { model: '...', steps: [{ title, phase: 'Know'|'Act'|'Close',
     summary, tool: optionalString, evidence: [{label, href:'cases/...'}] }] }
   Output links are optional local paths, added only when the corresponding files are released. */
window.PROFESSIONAL_CASES = [
  {
    id: 'finance', title: 'Repayment restructuring', figure: 'assets/case-finance.webp', page: 14,
    trajectory: null,
    deliverables: [
      {format:'XLSX + MD', title:'Repayment analysis and supporting work records', description:'4 required deliverables · 5 supplied inputs. See Figure 7 for the complete task requirements.'}
    ],
    responsibilities: {Know:'Assess the borrower’s evidence, constraints, and restructuring options.', Act:'Compare repayment scenarios and prepare a supported negotiation proposal.', Close:'Verify calculations, cross-file consistency, and proposed monitoring conditions.'}
  },
  {
    id: 'legal', title: 'Trade-secret investigation', figure: 'assets/case-legal.webp', page: 15,
    trajectory: null,
    deliverables: [
      {format:'DOCX', title:'Privilege-aware witness interview memorandum', description:'1 required deliverable · 5 supplied inputs. See Figure 8 for the complete task requirements.'}
    ],
    responsibilities: {Know:'Assess factual evidence, legal boundaries, and witness-specific issues.', Act:'Develop targeted interview questions and a privilege-aware interview plan.', Close:'Check evidentiary traceability, internal consistency, and practical usability.'}
  },
  {
    id: 'healthcare', title: 'Endocrine admission assessment', figure: 'assets/case-healthcare.webp', page: 16,
    trajectory: null,
    deliverables: [
      {format:'DOCX + MD', title:'Admission assessment and supporting clinical records', description:'4 required deliverables · 4 supplied inputs. See Figure 9 for the complete task requirements.'}
    ],
    responsibilities: {Know:'Integrate clinical evidence and identify time-sensitive risks.', Act:'Develop an emergency-first, staged assessment within the assigned role.', Close:'Verify consistency, safety, and traceability across the required records.'}
  }
];
