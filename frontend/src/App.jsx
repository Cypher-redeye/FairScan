import { useState, useRef } from 'react';
import demoCsvUrl from '../../data/UCI_Adult_Income_Dataset.csv?url';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

function App() {
  const [activeScreen, setActiveScreen] = useState('upload');
  const [file, setFile] = useState(null);
  const [demoFile, setDemoFile] = useState(false);
  const [columns, setColumns] = useState([]);
  const [outcomeCol, setOutcomeCol] = useState('');
  const [protectedCol, setProtectedCol] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const reportRef = useRef(null);

  const downloadPDF = async () => {
    if (!reportRef.current) return;
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('FairScan_Audit_Report.pdf');
    } catch (err) {
      console.error("PDF generation failed", err);
      alert("Failed to generate PDF.");
    }
  };

  const handleFile = (f) => {
    if (!f.name.endsWith('.csv')) {
      alert("Please upload a CSV file.");
      return;
    }
    setFile(f);
    setDemoFile(false);
    setOutcomeCol('');
    setProtectedCol('');
    setResults(null);
    setError(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const firstLine = text.split(/\r?\n/)[0];
      if (firstLine) {
        const headers = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        setColumns(headers);
      }
    };
    reader.readAsText(f);
  };

  const handleDemo = async () => {
    setLoading(true);
    try {
      const res = await fetch(demoCsvUrl);
      if (!res.ok) throw new Error("Demo dataset not found locally. Please upload a file.");
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/csv' });
      const f = new File([blob], "UCI_Adult_Income_Dataset.csv", { type: 'text/csv' });
      handleFile(f);
      setDemoFile(true);
      setOutcomeCol('income');
      setProtectedCol('sex');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const runAudit = async () => {
    if (!file || !outcomeCol || !protectedCol) return;
    setLoading(true);
    setError(null);
    setResults(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('outcome_col', outcomeCol);
    formData.append('protected_col', protectedCol);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      
      const res = await fetch(`${API_BASE_URL}/api/audit`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.errors);
        setActiveScreen('dashboard');
        setLoading(false);
        return;
      }

      // Fetch AI
      let aiData = { 
        explanation: "<em>AI Explanation temporarily unavailable due to API rate limits. Please wait 15-30 seconds and try again.</em>", 
        recommendations: ["Wait for API rate limit to reset.", "Retry the audit in a few moments."] 
      };
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      try {
        const explainRes = await fetch(`${API_BASE_URL}/api/explain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dpd: data.metrics.demographicParityDiff,
            dir: data.metrics.disparateImpactRatio,
            protected_col: protectedCol,
            groupStats: data.groupStats
          })
        });
        if (explainRes.ok) {
          aiData = await explainRes.json();
        }
      } catch (e) {
        console.warn("AI generation failed", e);
      }
      
      setResults({ ...data, ai: aiData });
      setActiveScreen('dashboard');
    } catch (err) {
      setError([err.message]);
      setActiveScreen('dashboard');
    } finally {
      setLoading(false);
    }
  };

  const canAudit = file && outcomeCol && protectedCol && (outcomeCol !== protectedCol);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-[56px] flex items-center justify-between px-6 bg-[var(--card)] border-b border-[var(--border)]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-[var(--text-primary)] font-bold text-[1.05rem] tracking-tight">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
            FairScan
          </div>
        </div>
        <nav className="flex items-center gap-0.5">
          <button onClick={() => setActiveScreen('upload')} className={`btn-nav ${activeScreen === 'upload' ? 'active' : ''}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload
          </button>
          <button onClick={() => setActiveScreen('dashboard')} disabled={!results && !error} className={`btn-nav ${activeScreen === 'dashboard' ? 'active' : ''} disabled:opacity-40`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Dashboard
          </button>
          <button onClick={() => setActiveScreen('report')} disabled={!results || error} className={`btn-nav ${activeScreen === 'report' ? 'active' : ''} disabled:opacity-40`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Report
          </button>
        </nav>
        <div className="flex items-center text-[0.8rem] text-[var(--text-tertiary)] font-medium">
          {file ? file.name : "No file uploaded"}
        </div>
      </header>

      <main className="pt-[56px] min-h-screen">
        {/* SCREEN: UPLOAD */}
        {activeScreen === 'upload' && (
          <div className="flex justify-center items-center min-h-[calc(100vh-56px)] py-10 px-6">
            <div className="card w-full max-w-[560px] pt-9 px-8 pb-8">
              <div className="card-header">
                <h1 className="card-title">Upload Dataset</h1>
                <p className="w-full text-[0.87rem] text-[var(--text-secondary)] mt-[-4px] leading-relaxed">Upload a CSV file to begin the bias audit. We'll analyze your data for demographic disparities.</p>
              </div>

              {!file ? (
                <>
                  <div 
                    className="border-2 border-dashed border-[var(--border)] rounded-lg p-10 text-center cursor-pointer hover:border-[var(--text-tertiary)] hover:bg-[#FAFAF8] transition-colors mb-5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="inline-flex text-[var(--text-tertiary)] mb-3">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    </div>
                    <p className="text-[0.93rem] font-medium text-[var(--text-primary)] mb-1">Drag & drop your CSV file here</p>
                    <p className="text-[0.8rem] text-[var(--text-tertiary)]">or <span className="text-[var(--accent)] underline underline-offset-2 font-medium">click to browse</span></p>
                    <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
                  </div>

                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-[1px] bg-[var(--border)]"></div>
                    <span className="text-[0.78rem] font-medium text-[var(--text-tertiary)] lowercase">or</span>
                    <div className="flex-1 h-[1px] bg-[var(--border)]"></div>
                  </div>

                  <button type="button" onClick={handleDemo} disabled={loading} className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-5 border-2 border-dashed border-[var(--border)] rounded-lg bg-[#FAFAF8] text-[var(--text-secondary)] text-[0.87rem] font-semibold hover:border-[var(--text-tertiary)] hover:bg-[#F4F3F0] hover:text-[var(--text-primary)] mb-5 transition-colors disabled:opacity-50">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                    Try Demo Dataset
                    <span className="text-[0.68rem] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full ml-1">UCI Adult Income</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-[#FAFAF8] border border-[var(--border)] rounded-lg mb-5">
                  <div className="text-[var(--text-tertiary)] flex"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
                  <div className="flex-1 flex flex-col">
                    <span className="text-[0.87rem] font-semibold text-[var(--text-primary)]">{file.name}</span>
                    <span className="text-[0.75rem] text-[var(--text-tertiary)]">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <button onClick={() => setFile(null)} className="p-1 text-[var(--text-tertiary)] hover:bg-[var(--red-bg)] hover:text-[var(--red)] rounded transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.8rem] font-semibold text-[var(--text-secondary)] tracking-[0.01em]">Outcome Column</label>
                  <div className="relative">
                    <select value={outcomeCol} onChange={e => setOutcomeCol(e.target.value)} disabled={!file} className="form-select">
                      <option value="" disabled>Select column...</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[0.8rem] font-semibold text-[var(--text-secondary)] tracking-[0.01em]">Protected Attribute</label>
                  <div className="relative">
                    <select value={protectedCol} onChange={e => setProtectedCol(e.target.value)} disabled={!file} className="form-select">
                      <option value="" disabled>Select column...</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </span>
                  </div>
                </div>
              </div>

              <button onClick={runAudit} disabled={!canAudit || loading} className="btn-primary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                {loading ? "Running Audit..." : "Run Bias Audit"}
              </button>
            </div>
          </div>
        )}

        {/* SCREEN: DASHBOARD */}
        {activeScreen === 'dashboard' && (
          <div className="p-6 pb-20">
            {error && (
              <div className="max-w-[600px] mx-auto mb-8 p-8 border border-[var(--red-border)] bg-[var(--red-bg)] rounded-xl">
                <div className="flex items-center gap-2.5 mb-4 text-[var(--red)]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <h2 className="text-[1.1rem] font-semibold m-0">Dataset Validation Failed</h2>
                </div>
                <ul className="m-0 pl-6 text-[var(--red)] text-[0.95rem] leading-relaxed flex flex-col gap-2 list-disc">
                  {error.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
                <button onClick={() => setActiveScreen('upload')} className="mt-6 inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-[var(--red)] text-white text-[0.9rem] font-semibold hover:bg-red-800 transition-colors">
                  ← Go Back & Select Different Columns
                </button>
              </div>
            )}

            {!error && results && (
              <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr_360px] gap-5 items-stretch">
                
                {/* LEFT: Summary */}
                <div className="card p-6 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-[1.05rem] font-[700] tracking-tight">Audit Summary</h2>
                    <div className={`px-2.5 py-[3px] rounded-full text-[0.7rem] font-[700] tracking-wide border ${results.risk === 'High Risk' ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]' : results.risk === 'Medium Risk' ? 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]' : 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]'}`}>
                      {results.risk}
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-[0.65rem] font-[700] text-[var(--text-tertiary)] uppercase tracking-wider">AI Explanation</h3>
                      <span className="inline-flex items-center gap-1 text-[0.6rem] font-[700] text-[#4F46E5] bg-[#EEF2FF] px-2 py-0.5 rounded-full uppercase tracking-wider">
                        ✦ GEMINI
                      </span>
                    </div>
                    <p 
                      className="text-[0.85rem] text-[var(--text-secondary)] leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: results.ai?.explanation }}
                    />
                  </div>
                  
                  <div className="mt-8">
                    <h3 className="text-[0.65rem] font-[700] text-[var(--text-tertiary)] uppercase tracking-wider mb-4">Recommended Fixes</h3>
                    <ul className="flex flex-col gap-4">
                      {(results.ai?.recommendations?.length > 0 ? results.ai.recommendations : ["Review dataset balance.", "Check threshold logic."]).map((r, i) => (
                        <li key={i} className="flex items-start gap-3 text-[0.85rem] text-[var(--text-secondary)] leading-relaxed">
                          <span className="shrink-0 w-[5px] h-[5px] rounded-full bg-[var(--green)] mt-[8px]"></span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* CENTER: CSS Bar Chart */}
                <div className="card p-6 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-[1.05rem] font-[700] tracking-tight">Approval Rates by Group</h2>
                    <span className="text-[0.75rem] text-[var(--text-tertiary)] font-medium">Protected attribute: {protectedCol}</span>
                  </div>
                  <div className="flex-1 flex flex-col justify-center my-4 pl-[3.5rem] pr-2">
                    <div className="relative w-full border-l border-b border-[var(--border)] pb-2 pl-4 min-h-[240px] pt-4 flex flex-col">
                      {/* Grid lines */}
                      {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(tick => (
                        <div key={tick} className="absolute top-0 bottom-0 border-l border-[var(--border-light)] pointer-events-none" style={{ left: `calc(${tick}% + 1rem)` }}></div>
                      ))}
                      
                      {[...results.groupStats].sort((a, b) => b.rate - a.rate).map((g) => {
                        const rateNum = +(g.rate * 100).toFixed(1);
                        const isMin = Math.min(...results.groupStats.map(gs => gs.rate)) === g.rate && results.groupStats.length > 1;
                        const barColor = isMin ? "bg-[#d9a071]" : "bg-[#769777]"; 
                        
                        return (
                          <div key={g.group} className="relative z-10 flex items-center group w-full mb-6 last:mb-0">
                            <span className="absolute -left-[4.5rem] text-[0.8rem] font-[500] text-[var(--text-primary)] w-[3.8rem] text-right truncate pr-2">{g.group}</span>
                            <div className={`h-10 rounded-r-md ${barColor} shadow-sm transition-all duration-500 flex items-center min-w-[4px]`} style={{ width: `${rateNum}%` }}>
                              <span className="absolute text-[0.75rem] font-bold text-[var(--text-primary)] ml-2 whitespace-nowrap" style={{ left: `${rateNum}%` }}>{rateNum.toFixed(1)}%</span>
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* X-axis labels */}
                      <div className="absolute -bottom-6 left-4 right-0 flex justify-between text-[0.7rem] text-[var(--text-tertiary)]">
                        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(tick => (
                          <span key={tick} style={{ transform: 'translateX(-50%)' }}>{tick}%</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Metrics */}
                <div className="card p-6 h-full flex flex-col">
                  <h2 className="text-[1.05rem] font-[700] tracking-tight mb-8">Fairness Metrics</h2>
                  
                  <div className="flex justify-between pb-2 border-b border-[var(--border)] mb-4">
                    <span className="text-[0.65rem] font-[700] text-[var(--text-tertiary)] uppercase tracking-wider">Metric</span>
                    <div className="flex items-center gap-6">
                      <span className="text-[0.65rem] font-[700] text-[var(--text-tertiary)] uppercase tracking-wider w-8 text-right">Value</span>
                      <span className="text-[0.65rem] font-[700] text-[var(--text-tertiary)] uppercase tracking-wider w-12 text-center">Status</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-5">
                    {/* DPD */}
                    <div className="flex items-center justify-between pb-5 border-b border-[var(--border-light)]">
                      <div className="flex flex-col gap-1 pr-2">
                        <span className="text-[0.85rem] font-semibold text-[var(--text-primary)]">Demographic Parity Difference</span>
                        <span className="text-[0.65rem] text-[var(--text-tertiary)] font-mono tracking-tighter">|P(Ŷ=1|A=a) − P(Ŷ=1|A=b)|</span>
                      </div>
                      <div className="flex items-center gap-6 shrink-0">
                        <span className="text-[0.95rem] font-bold text-[var(--text-primary)] w-8 text-right">{results.metrics.demographicParityDiff.toFixed(2)}</span>
                        <span className={`w-12 text-center py-1 rounded-full text-[0.65rem] font-bold border ${results.metrics.demographicParityDiff <= 0.10 ? 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]' : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'}`}>
                          {results.metrics.demographicParityDiff <= 0.10 ? 'Pass' : 'Fail'}
                        </span>
                      </div>
                    </div>

                    {/* DIR */}
                    <div className="flex items-center justify-between pb-5 border-b border-[var(--border-light)]">
                      <div className="flex flex-col gap-1 pr-2">
                        <span className="text-[0.85rem] font-semibold text-[var(--text-primary)]">Disparate Impact Ratio</span>
                        <span className="text-[0.65rem] text-[var(--text-tertiary)] font-mono tracking-tighter">min(rate) / max(rate)</span>
                      </div>
                      <div className="flex items-center gap-6 shrink-0">
                        <span className="text-[0.95rem] font-bold text-[var(--text-primary)] w-8 text-right">{results.metrics.disparateImpactRatio.toFixed(2)}</span>
                        <span className={`w-12 text-center py-1 rounded-full text-[0.65rem] font-bold border ${results.metrics.disparateImpactRatio >= 0.80 ? 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]' : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'}`}>
                          {results.metrics.disparateImpactRatio >= 0.80 ? 'Pass' : 'Fail'}
                        </span>
                      </div>
                    </div>

                    {/* EOD */}
                    <div className="flex items-center justify-between pb-5 border-b border-[var(--border-light)]">
                      <div className="flex flex-col gap-1 pr-2">
                        <span className="text-[0.85rem] font-semibold text-[var(--text-primary)]">Equalized Odds Difference</span>
                        <span className="text-[0.65rem] text-[var(--text-tertiary)] font-mono tracking-tighter">mean |rate_a - rate_b| across groups</span>
                      </div>
                      <div className="flex items-center gap-6 shrink-0">
                        <span className="text-[0.95rem] font-bold text-[var(--text-primary)] w-8 text-right">{results.metrics.equalizedOddsDiff.toFixed(2)}</span>
                        <span className={`w-12 text-center py-1 rounded-full text-[0.65rem] font-bold border ${results.metrics.equalizedOddsDiff <= 0.10 ? 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]' : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'}`}>
                          {results.metrics.equalizedOddsDiff <= 0.10 ? 'Pass' : 'Fail'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-6">
                    <div className="flex items-start gap-2 p-3 bg-[#FAFAF8] rounded-md text-[0.7rem] text-[var(--text-tertiary)] leading-relaxed">
                      <svg className="shrink-0 mt-[2px]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                      <span>Thresholds based on EEOC four-fifths rule and academic fairness benchmarks.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCREEN: REPORT */}
        {activeScreen === 'report' && results && !error && (
          <div className="flex flex-col items-center py-8 px-6 pb-20">
            <div className="w-full max-w-[800px] flex justify-end mb-4">
              <button onClick={downloadPDF} className="flex items-center gap-2 py-2 px-4 rounded-md bg-[#18181B] text-white font-medium hover:bg-black transition-colors shadow-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Download PDF
              </button>
            </div>
            <div ref={reportRef} className="card w-full max-w-[800px] py-11 px-12 bg-[var(--card)] text-[var(--text-primary)]">
              <div className="flex items-center justify-between mb-7">
                <div className="flex items-center gap-2.5 font-bold text-[1.2rem] tracking-tight">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  FairScan
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[0.9rem] font-[650]">Bias Audit Report</span>
                  <span className="text-[0.78rem] text-[var(--text-tertiary)]">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              </div>

              <div className="h-[1px] bg-[var(--border)] my-7"></div>

              <div className="flex flex-col gap-7">
                <div>
                  <h3 className="text-[0.93rem] font-[650] mb-3.5 tracking-tight">1. Dataset Overview</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <div className="flex flex-col gap-0.5"><span className="text-[0.73rem] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">File</span><span className="text-[0.87rem] font-medium">{file ? file.name : 'Dataset'}</span></div>
                    <div className="flex flex-col gap-0.5"><span className="text-[0.73rem] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Rows</span><span className="text-[0.87rem] font-medium">{results.totalRows.toLocaleString()}</span></div>
                    <div className="flex flex-col gap-0.5"><span className="text-[0.73rem] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Outcome Column</span><span className="text-[0.87rem] font-medium">{outcomeCol}</span></div>
                    <div className="flex flex-col gap-0.5"><span className="text-[0.73rem] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">Protected Attribute</span><span className="text-[0.87rem] font-medium">{protectedCol}</span></div>
                  </div>
                </div>

                <div>
                  <h3 className="text-[0.93rem] font-[650] mb-3.5 tracking-tight">2. Risk Assessment</h3>
                  <div className="flex items-center justify-between p-3.5 bg-[#FAFAF8] rounded-lg border border-[var(--border-light)]">
                    <span className="text-[0.87rem] font-medium">Overall Bias Severity</span>
                    <span className={`badge ${results.risk === 'High Risk' ? 'badge-red' : results.risk === 'Medium Risk' ? 'badge-amber' : 'badge-green'}`}>{results.risk}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-[0.93rem] font-[650] mb-3.5 tracking-tight">3. AI Explanation</h3>
                  <p 
                    className="text-[0.87rem] text-[var(--text-secondary)] leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: results.ai?.explanation }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {loading && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#F7F6F3]/85 backdrop-blur-[4px]">
          <div className="text-center">
            <div className="w-9 h-9 border-[3px] border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-[0.93rem] font-semibold text-[var(--text-primary)] mb-1">Running bias audit...</p>
            <p className="text-[0.8rem] text-[var(--text-tertiary)]">Analyzing demographic disparities</p>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
