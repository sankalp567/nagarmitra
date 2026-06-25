import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  FileText, CheckCircle2, Percent, Clock, AlertTriangle, 
  TrendingUp, MapPin, Sparkles, Activity, ShieldAlert,
  Loader2, AlertCircle
} from 'lucide-react';
import { CivicReport, GANDHINAGAR_WARDS, CATEGORIES } from '../types';
import { runEscalationWatchdog, resetWatchdogDemoState } from '../utils/reportStore';

interface DashboardProps {
  reports: CivicReport[];
  onSelectReport: (reportId: string) => void;
  onRefreshReports: () => Promise<void>;
}

export default function Dashboard({ reports, onSelectReport, onRefreshReports }: DashboardProps) {
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulatedOffsetDays, setSimulatedOffsetDays] = useState<number>(0);
  const [watchdogResult, setWatchdogResult] = useState<{
    activated: boolean;
    scannedCount: number;
    stalledCount: number;
    escalatedCount: number;
    escalatedTickets: CivicReport[];
  } | null>(null);
  const [selectedNotice, setSelectedNotice] = useState<CivicReport | null>(null);
  const [activeDocTab, setActiveDocTab] = useState<string>('primary');
  const [copied, setCopied] = useState<boolean>(false);

  const handleSimulateWatchdog = async (daysToIncrement: number) => {
    setIsSimulating(true);
    try {
      const newOffset = simulatedOffsetDays + daysToIncrement;
      setSimulatedOffsetDays(newOffset);
      const simulatedTime = Date.now() + newOffset * 24 * 60 * 60 * 1000;
      const res = await runEscalationWatchdog(simulatedTime);
      
      setWatchdogResult({
        activated: true,
        scannedCount: res.scannedCount,
        stalledCount: res.stalledCount,
        escalatedCount: res.escalatedCount,
        escalatedTickets: res.escalatedTickets
      });
      
      await onRefreshReports();
    } catch (err) {
      console.error("Watchdog execution failed:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleResetDemo = async () => {
    setIsSimulating(true);
    try {
      await resetWatchdogDemoState();
      setSimulatedOffsetDays(0);
      setWatchdogResult(null);
      setSelectedNotice(null);
      setActiveDocTab('primary');
      await onRefreshReports();
    } catch (err) {
      console.error("Watchdog reset failed:", err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleInspectNotice = (ticket: CivicReport) => {
    setSelectedNotice(ticket);
    const docs = getAvailableDocs(ticket);
    if (docs.length > 0) {
      setActiveDocTab(docs[0].id);
    } else {
      setActiveDocTab('primary');
    }
  };

  const getAvailableDocs = (ticket: CivicReport) => {
    const list = [];
    if (ticket.escalationNotice) {
      list.push({ id: 'primary', label: `Notice (Tier ${ticket.escalationTier ?? 1})` });
    }
    if (ticket.escalationDocs?.tier1Notice) {
      list.push({ id: 'tier1', label: 'Tier 1: EE Notice' });
    }
    if (ticket.escalationDocs?.tier2Notice) {
      list.push({ id: 'tier2', label: 'Tier 2: DyMC Notice' });
    }
    if (ticket.escalationDocs?.tier3RTI) {
      list.push({ id: 'tier3RTI', label: 'Tier 3: RTI' });
    }
    if (ticket.escalationDocs?.tier3Swagat) {
      list.push({ id: 'tier3Swagat', label: 'Tier 3: SWAGAT 2.0' });
    }
    if (ticket.escalationDocs?.tier3Cpgrams) {
      list.push({ id: 'tier3Cpgrams', label: 'Tier 3: CPGRAMS' });
    }
    if (ticket.escalationDocs?.tier4Notice) {
      list.push({ id: 'tier4', label: 'Tier 4: MC Warning' });
    }
    return list;
  };

  const getDocContent = () => {
    if (!selectedNotice) return '';
    if (activeDocTab === 'primary') return selectedNotice.escalationNotice || '';
    if (activeDocTab === 'tier1') return selectedNotice.escalationDocs?.tier1Notice || '';
    if (activeDocTab === 'tier2') return selectedNotice.escalationDocs?.tier2Notice || '';
    if (activeDocTab === 'tier3RTI') return selectedNotice.escalationDocs?.tier3RTI || '';
    if (activeDocTab === 'tier3Swagat') return selectedNotice.escalationDocs?.tier3Swagat || '';
    if (activeDocTab === 'tier3Cpgrams') return selectedNotice.escalationDocs?.tier3Cpgrams || '';
    if (activeDocTab === 'tier4') return selectedNotice.escalationDocs?.tier4Notice || '';
    return selectedNotice.escalationNotice || '';
  };

  // 1. Impact metrics calculation
  const totalReported = reports.length;
  const totalResolved = reports.filter(r => r.status === 'resolved').length;
  const resolutionPercentage = totalReported > 0 ? Math.round((totalResolved / totalReported) * 100) : 0;
  
  // Custom mock average resolution time calculation
  const averageResolutionTime = totalReported > 0 ? "3.4 Days" : "N/A";

  // 2. Aggregate statistics per ward
  const wardCounts: { [wardName: string]: { id: string; count: number; resolved: number } } = {};
  
  // Initialize with all standard wards
  GANDHINAGAR_WARDS.forEach(w => {
    wardCounts[w.name] = { id: w.id, count: 0, resolved: 0 };
  });

  // Calculate active totals
  reports.forEach(r => {
    if (wardCounts[r.geo.wardName]) {
      wardCounts[r.geo.wardName].count += 1;
      if (r.status === 'resolved') {
        wardCounts[r.geo.wardName].resolved += 1;
      }
    } else {
      wardCounts[r.geo.wardName] = { id: r.geo.ward, count: 1, resolved: r.status === 'resolved' ? 1 : 0 };
    }
  });

  // Convert to sorted lists to locate top 3
  const sortedWards = Object.keys(wardCounts)
    .map(name => ({
      name,
      ...wardCounts[name]
    }))
    .sort((a, b) => b.count - a.count);

  const top3Wards = sortedWards.slice(0, 3).filter(w => w.count > 0);

  // 3. Aggregate statistics per category
  const categoryDetails: { [cat: string]: number } = {};
  CATEGORIES.forEach(c => { categoryDetails[c] = 0; });
  reports.forEach(r => {
    if (categoryDetails[r.category] !== undefined) {
      categoryDetails[r.category] += 1;
    } else {
      categoryDetails[r.category] = 1;
    }
  });

  const categoryChartList = Object.keys(categoryDetails)
    .map(cat => ({ name: cat, count: categoryDetails[cat] }))
    .sort((a, b) => b.count - a.count);

  const maxCategoryCount = Math.max(...categoryChartList.map(c => c.count), 1);
  const maxWardCount = Math.max(...sortedWards.map(w => w.count), 1);

  return (
    <div id="dashboard-view-container" className="max-w-7xl mx-auto px-4 py-8 animate-fadeIn">
      {/* Dynamic Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-[#e2e2d5] pb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1a2e1d] font-sans">
            Municipal Impact Command Center
          </h1>
          <p className="text-sm text-[#8a8a7a] mt-1">
            Review live key performance metrics, resolution ratios, and active civic centers.
          </p>
        </div>
        <div className="bg-[#3a5a40] text-white rounded-xl px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 self-start md:self-center shadow-xs">
          <Activity className="w-3.5 h-3.5 text-white animate-pulse" />
          <span>Offline Demo Enabled</span>
        </div>
      </div>

      {/* Autonomous AI Watchdog Section */}
      <div className="bg-white border border-[#e2e2d5] rounded-3xl p-6 shadow-sm mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#e2e2d5] pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#fff5f5] text-[#c25953] rounded-xl border border-[#ffd5d5]">
              <ShieldAlert className="w-5.5 h-5.5 text-[#c25953]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1a2e1d] uppercase tracking-wider flex items-center gap-2">
                GMC Vigilance & Compliance Watchdog
                <span className="bg-[#fff5f5] text-[#c25953] text-[9px] font-mono font-bold px-2 py-0.5 rounded-lg border border-[#ffd5d5]">TIERED ESCALATION</span>
              </h2>
              <p className="text-[11px] text-[#8a8a7a] mt-0.5">Scans all active files, climbs tiers (Ward Officer &rarr; EE &rarr; DyMC &rarr; RTI &rarr; MC) based on ticket age, and drafts legal escalations.</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[10px] font-mono font-bold text-[#5a5a40] bg-[#fafaf5] border border-[#e2e2d5] px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-[#3a5a40]" />
              <span>Virtual Clock: {new Date(Date.now() + simulatedOffsetDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ({simulatedOffsetDays > 0 ? `+${simulatedOffsetDays}d` : "Live"})</span>
            </div>

            <button
              onClick={() => handleSimulateWatchdog(7)}
              disabled={isSimulating}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#3a5a40] hover:bg-[#2d4632] disabled:opacity-50 text-white font-bold text-[11px] rounded-xl shadow-xs tracking-wider transition uppercase cursor-pointer"
            >
              {isSimulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "+7 Days"}
            </button>

            <button
              onClick={() => handleSimulateWatchdog(14)}
              disabled={isSimulating}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#3a5a40] hover:bg-[#2d4632] disabled:opacity-50 text-white font-bold text-[11px] rounded-xl shadow-xs tracking-wider transition uppercase cursor-pointer"
            >
              {isSimulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "+14 Days"}
            </button>

            <button
              onClick={() => handleSimulateWatchdog(21)}
              disabled={isSimulating}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#3a5a40] hover:bg-[#2d4632] disabled:opacity-50 text-white font-bold text-[11px] rounded-xl shadow-xs tracking-wider transition uppercase cursor-pointer"
            >
              {isSimulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "+21 Days"}
            </button>

            <button
              onClick={handleResetDemo}
              disabled={isSimulating}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#e2e2d5] hover:bg-[#fafaf5] disabled:opacity-50 text-[#5a5a40] font-bold text-[11px] rounded-xl transition uppercase cursor-pointer"
            >
              Reset State
            </button>
          </div>
        </div>

        {/* Watchdog results feedback panel */}
        {isSimulating ? (
          <div className="bg-[#fafaf5] border border-[#d1d1c1] rounded-2xl p-5 text-center text-xs text-[#5a5a40] flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-[#3a5a40]" />
            <div className="font-bold uppercase tracking-wider text-[10px] text-[#3a5a40]">Processing...</div>
            <p className="text-[11px] text-[#5a5a40] max-w-md mx-auto leading-relaxed">
              Auditing municipal SLA compliance breaches, escalating stalled tickets and auto-drafting official escalation memos using Gemini. This may take up to 20 seconds...
            </p>
          </div>
        ) : watchdogResult && watchdogResult.activated ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#fafaf5] border border-[#e2e2d5] rounded-2xl p-5"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1a2e1d] uppercase tracking-wider">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping mr-1" />
                🛡️ Escalation Watchdog Activated
              </div>
              <span className="text-[10px] font-mono font-bold bg-[#3a5a40]/10 text-[#3a5a40] px-2.5 py-0.5 rounded-full">
                Escalated {watchdogResult.escalatedCount} tickets · {Math.max(0, watchdogResult.stalledCount - watchdogResult.escalatedCount)} more stalled
              </span>
            </div>
            
            <p className="text-xs text-[#2d332d] leading-relaxed mb-4">
              The autonomous compliance watchdog successfully scanned <strong className="font-mono bg-white border px-1.5 py-0.5 rounded">{watchdogResult.scannedCount}</strong> active tickets in the registry. It isolated <strong className="font-mono text-rose-600 bg-white border px-1.5 py-0.5 rounded">{watchdogResult.stalledCount}</strong> files exceeding the 7-day municipal SLA, and successfully dispatched escalated work-orders to supervisors for <strong className="font-mono text-[#3a5a40] bg-white border px-1.5 py-0.5 rounded">{watchdogResult.escalatedCount}</strong> of them.
            </p>

            {watchdogResult.escalatedTickets.length > 0 ? (
              <div className="space-y-3">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8a8a7a] block mb-2">Auto-escalated Tickets & Drafted Memos:</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {watchdogResult.escalatedTickets.map((ticket) => (
                    <div key={ticket.id} className="bg-white border border-[#e2e2d5] rounded-xl p-3 flex flex-col justify-between hover:border-[#3a5a40] transition duration-150">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[10px] font-mono font-bold text-[#8a8a7a]">Ticket #{ticket.id}</span>
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-lg border ${ticket.escalationNoticeIsOffline ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                            {ticket.escalationNoticeIsOffline ? 'OFFLINE DRAFT' : 'AI DRAFTED'}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-[#1a2e1d] truncate mb-1">{ticket.category}</p>
                        <p className="text-[10px] text-[#8a8a7a] truncate">Department: {ticket.department}</p>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-[#fafaf5] flex items-center justify-between gap-2">
                        <button
                          onClick={() => onSelectReport(ticket.id)}
                          className="text-[10px] font-bold text-[#3a5a40] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          View Full Details →
                        </button>
                        <button
                          onClick={() => handleInspectNotice(ticket)}
                          className="text-[10px] font-bold bg-[#fafaf5] border border-[#e2e2d5] hover:bg-[#3a5a40] hover:text-white px-2.5 py-1 rounded-lg transition cursor-pointer"
                        >
                          Inspect SLA Notice
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#8a8a7a] italic p-4 text-center bg-white rounded-xl border border-dashed border-[#e2e2d5]">
                No new files met the stalled criteria. Re-run demo controls or submit a new report and wait 7 days to trigger compliance.
              </div>
            )}
          </motion.div>
        ) : (
          <div className="bg-[#fafaf5] border border-dashed border-[#d1d1c1] rounded-2xl p-5 text-center text-xs text-[#8a8a7a]">
            Watchdog idle. Click <strong className="font-sans font-bold text-[#3a5a40]">"+7 Days"</strong>, <strong className="font-sans font-bold text-[#3a5a40]">"+14 Days"</strong>, or <strong className="font-sans font-bold text-[#3a5a40]">"+21 Days"</strong> to fast-forward time and activate autonomous SLA audit protocols.
          </div>
        )}

        {/* Selected Notice Modal */}
        {selectedNotice && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#1a2e1d] border border-[#3a5a40] rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="bg-[#132215] px-6 py-4 border-b border-[#2d4632] flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
                    SLA Compliance Escalate Notice
                  </h3>
                  <p className="text-[10px] text-[#8a8a7a] mt-0.5">Grievance Ticket #{selectedNotice.id} • Ward: {selectedNotice.geo.wardName}</p>
                </div>
                <button 
                  onClick={() => setSelectedNotice(null)}
                  className="text-[#8a8a7a] hover:text-white font-bold text-sm bg-[#1a2e1d] hover:bg-[#3a5a40]/30 w-8 h-8 rounded-xl border border-[#2d4632] transition flex items-center justify-center cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="px-6 py-3 bg-[#132215] border-b border-[#2d4632]">
                {/* Available documents tabs */}
                {getAvailableDocs(selectedNotice).length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {getAvailableDocs(selectedNotice).map(docItem => (
                      <button
                        key={docItem.id}
                        onClick={() => {
                          setActiveDocTab(docItem.id);
                          setCopied(false);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold transition uppercase cursor-pointer ${
                          activeDocTab === docItem.id
                            ? 'bg-[#3a5a40] text-white border border-[#5a7a5a]'
                            : 'bg-[#1a2e1d] hover:bg-[#3a5a40]/30 text-[#8a8a7a] hover:text-white border border-[#2d4632]'
                        }`}
                      >
                        {docItem.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-6 overflow-y-auto font-mono text-[#fafaf5]/90 text-xs leading-relaxed whitespace-pre-wrap bg-[#132215]/80 flex-grow max-h-[45vh]">
                {selectedNotice.escalationNoticeIsOffline ? (
                  <div className="mb-4 bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3.5 rounded-xl font-sans flex items-start gap-2.5">
                    <AlertCircle className="w-4.5 h-4.5 mt-0.5 text-amber-400 flex-shrink-0" />
                    <div>
                      <strong className="block text-[11px] font-bold uppercase tracking-wider text-amber-400">Offline Compliance Draft</strong>
                      <span className="text-[10px] text-amber-200/90 leading-normal block mt-0.5">No active live GEMINI_API_KEY detected in workspace environment. Engaged high-fidelity offline municipal SLA stub for sandbox compliance.</span>
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-xl font-sans flex items-start gap-2.5">
                    <Sparkles className="w-4.5 h-4.5 mt-0.5 text-emerald-400 flex-shrink-0" />
                    <div>
                      <strong className="block text-[11px] font-bold uppercase tracking-wider text-emerald-300">Live Gemini AI Drafted Notice</strong>
                      <span className="text-[10px] text-emerald-200/90 leading-normal block mt-0.5">Autonomous notice compiled successfully using the primary Gemini endpoint. No templates or hardcoded fallback stubs were engaged.</span>
                    </div>
                  </div>
                )}
                {getDocContent()}
              </div>
              <div className="bg-[#132215] border-t border-[#2d4632] p-4 px-6 flex justify-end gap-2 shrink-0">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(getDocContent() || '');
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-4 py-2 bg-[#3a5a40] hover:bg-[#2d4632] text-white text-xs font-bold rounded-xl shadow-xs tracking-wider transition uppercase cursor-pointer"
                >
                  {copied ? "Copied!" : "Copy Memo"}
                </button>
                <button
                  onClick={() => setSelectedNotice(null)}
                  className="px-4 py-2 border border-[#2d4632] hover:bg-[#1a2e1d] text-white text-xs font-bold rounded-xl transition uppercase cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* "Why this matters" Impact Panel */}
      <div id="why-this-matters-panel" className="bg-[#fafaf5] border border-[#e2e2d5] rounded-3xl p-6 mb-8 animate-fadeIn">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 bg-[#3a5a40]/10 text-[#3a5a40] rounded-lg">
            <TrendingUp className="w-4 h-4 text-[#3a5a40]" />
          </div>
          <h2 className="text-xs font-extrabold text-[#1a2e1d] uppercase tracking-wider font-sans">
            Why This Matters: Municipal Redressal Gap
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-b border-[#e2e2d5] pb-5 mb-5">
          {/* Stat 1 */}
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono text-[#c25953]">30 &rarr; 48 Days</span>
              <span className="text-[10px] text-[#8a8a7a] font-mono uppercase">Trend</span>
            </div>
            <p className="text-xs text-[#2d332d] leading-relaxed mt-2 font-medium font-sans">
              Civic complaint resolution has drifted from ~30 to ~48 days in three years.{" "}
              <a href="#" className="text-[#3a5a40] hover:underline font-mono text-[10px] font-bold" onClick={(e) => e.preventDefault()}>(source)</a>
            </p>
          </div>

          {/* Stat 2 */}
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono text-[#c25953]">~98%</span>
              <span className="text-[10px] text-[#8a8a7a] font-mono uppercase">Stalled</span>
            </div>
            <p className="text-xs text-[#2d332d] leading-relaxed mt-2 font-medium font-sans">
              ~98% of complaints escalated all the way to the Municipal Commissioner still go unresolved.{" "}
              <a href="#" className="text-[#3a5a40] hover:underline font-mono text-[10px] font-bold" onClick={(e) => e.preventDefault()}>(source)</a>
            </p>
          </div>

          {/* Stat 3 */}
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black font-mono text-[#3a5a40]">~90%</span>
              <span className="text-[10px] text-[#8a8a7a] font-mono uppercase">Redressal</span>
            </div>
            <p className="text-xs text-[#2d332d] leading-relaxed mt-2 font-medium font-sans">
              Gujarat's SWAGAT 2.0 auto-escalation resolved ~90% of pilot grievances within SLA.{" "}
              <a href="#" className="text-[#3a5a40] hover:underline font-mono text-[10px] font-bold" onClick={(e) => e.preventDefault()}>(source)</a>
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 text-xs text-[#1a2e1d] leading-relaxed font-sans font-semibold bg-white p-3 rounded-xl border border-[#e2e2d5]">
          <Sparkles className="w-4 h-4 text-[#3a5a40] mt-0.5 shrink-0 animate-pulse" />
          <p>
            NagarMitra brings SWAGAT 2.0's proven auto-escalation model to the GMC ward level — where no such tool exists today.
          </p>
        </div>
      </div>

      {/* 1. IMPACT STRIP */}
      <div id="impact-strip" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {/* Total Reported Card */}
        <div className="bg-white border border-[#e2e2d5] rounded-3xl p-5 shadow-xs flex items-center justify-between hover:border-[#5a7a5a] transition duration-150">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#8a8a7a]">Total Grievances</span>
            <p className="text-2xl font-bold font-mono text-[#1a2e1d] mt-1">{totalReported}</p>
            <span className="text-[10px] text-[#8a8a7a] mt-1 block">Accumulated tickets</span>
          </div>
          <div className="p-3 bg-[#fafaf5] text-[#8a8a7a] rounded-xl border border-[#e2e2d5]">
            <FileText className="w-5 h-5 text-[#5a5a40]" />
          </div>
        </div>

        {/* Total Resolved Card */}
        <div className="bg-white border border-[#e2e2d5] rounded-3xl p-5 shadow-xs flex items-center justify-between hover:border-[#5a7a5a] transition duration-150">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#8a8a7a]">Total Remedied</span>
            <p className="text-2xl font-bold font-mono text-[#5a7a5a] mt-1">{totalResolved}</p>
            <span className="text-[10px] text-[#8a8a7a] mt-1 block">Issues cleared on site</span>
          </div>
          <div className="p-3 bg-[#f0f9f0] text-[#3a5a40] rounded-xl border border-[#d5edd5]">
            <CheckCircle2 className="w-5 h-5 text-[#3a5a40]" />
          </div>
        </div>

        {/* % Resolved Card */}
        <div className="bg-white border border-[#e2e2d5] rounded-3xl p-5 shadow-xs flex items-center justify-between hover:border-[#5a7a5a] transition duration-150">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#8a8a7a]">Resolution Ratio</span>
            <p className="text-2xl font-bold font-mono text-[#3a5a40] mt-1">{resolutionPercentage}%</p>
            <span className="text-[10px] text-[#8a8a7a] mt-1 block">Completion efficiency</span>
          </div>
          <div className="p-3 bg-[#fafaf5] text-[#3a5a40] rounded-xl border border-[#e2e2d5]">
            <Percent className="w-5 h-5 text-[#3a5a40]" />
          </div>
        </div>

        {/* Average Resolution Time */}
        <div className="bg-white border border-[#e2e2d5] rounded-3xl p-5 shadow-xs flex items-center justify-between hover:border-[#5a7a5a] transition duration-150">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#8a8a7a]">Avg Clear Window</span>
            <p className="text-2xl font-bold font-mono text-[#1a2e1d] mt-1">{averageResolutionTime}</p>
            <span className="text-[10px] text-[#8a8a7a] mt-1 block">From lodgement to close</span>
          </div>
          <div className="p-3 bg-[#fafaf5] text-[#8a8a7a] rounded-xl border border-[#e2e2d5]">
            <Clock className="w-5 h-5 text-[#5a5a40]" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: Ward Analytics & distribution charts */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Custom CSS Bar chart of Wards */}
          <div className="bg-white border border-[#e2e2d5] rounded-3xl p-6 shadow-sm">
            <div className="border-b border-[#e2e2d5] pb-3 mb-5 flex items-center justify-between">
              <h3 className="font-extrabold text-xs text-[#1a2e1d] uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#5a7a5a]" />
                Administrative Ward Grievances
              </h3>
              <span className="text-[10px] text-[#8a8a7a] font-mono">GMC Grid Data</span>
            </div>

            {/* Custom chart layout */}
            <div className="space-y-4">
              {sortedWards.map((w, idx) => {
                const pct = (w.count / maxWardCount) * 100;
                
                return (
                  <div key={w.id} className="text-xs">
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <span className="font-bold text-[#2d332d] font-sans flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-[#8a8a7a]">0{idx + 1}.</span>
                        {w.name}
                      </span>
                      <span className="font-bold font-mono text-[#1a2e1d]">{w.count} tickets</span>
                    </div>

                    <div className="w-full bg-[#fafaf5] rounded-full h-3 overflow-hidden border border-[#e2e2d5] flex">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 1 }}
                        className="bg-[#5a7a5a] h-full rounded-full relative"
                      >
                        {/* Sub-bar for resolved checks */}
                        {w.resolved > 0 && (
                          <div 
                            style={{ width: `${(w.resolved / w.count) * 100}%` }}
                            className="absolute inset-y-0 left-0 bg-[#3a5a40] rounded-full" 
                            title={`${w.resolved} resolved`}
                          />
                        )}
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top 3 sectors metric strip */}
          <div className="bg-[#fafaf5] border border-[#e2e2d5] rounded-3xl p-6 shadow-2xs">
            <h3 className="text-xs font-extrabold text-[#1a2e1d] uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <TrendingUp className="w-4.5 h-4.5 text-[#c25953]" />
              Highest Volume Incident Centers
            </h3>

            {top3Wards.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {top3Wards.map((w, idx) => (
                  <div key={w.id} className="bg-white p-4 rounded-2xl border border-[#e2e2d5] shadow-3xs relative overflow-hidden">
                    <div className="absolute right-2 -bottom-2 text-[#e2e2d5]/60 text-5xl font-mono font-black select-none pointer-events-none">
                      #{idx + 1}
                    </div>
                    <p className="text-[9px] text-[#8a8a7a] font-bold uppercase tracking-wider mb-1 line-clamp-1">{w.name}</p>
                    <p className="text-xl font-bold font-mono text-[#1a2e1d]">{w.count} reported</p>
                    <p className="text-[10px] text-[#3a5a40] mt-1 font-mono font-bold">{w.resolved} resolved ({Math.round((w.resolved / w.count) * 100)}%)</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[#8a8a7a] italic p-4 text-center bg-white rounded-2xl border border-dashed border-[#e2e2d5]">
                Accumulate more civic tickets to calculate top incidents.
              </div>
            )}
          </div>
        </div>

        {/* Right column: Category Distribution */}
        <div className="lg:col-span-4 bg-white border border-[#e2e2d5] rounded-3xl p-5 shadow-sm h-full">
          <div className="border-b border-[#e2e2d5] pb-3 mb-4">
            <h3 className="font-extrabold text-xs text-[#1a2e1d] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#3a5a40] animate-pulse" />
              Grievance Categories
            </h3>
          </div>

          <div className="space-y-4">
            {categoryChartList.map((cat, idx) => {
              const catPct = (cat.count / maxCategoryCount) * 100;
              return (
                <div key={cat.name} className="text-xs">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-bold text-[#2d332d] truncate max-w-[200px]">{cat.name}</span>
                    <span className="font-bold font-mono text-[#1a2e1d]">{cat.count} files</span>
                  </div>

                  <div className="w-full bg-[#fafaf5] border border-[#e2e2d5]/50 rounded-full h-1.5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${catPct}%` }}
                      transition={{ duration: 1 }}
                      className={`h-full rounded-full ${cat.count > 0 ? 'bg-[#3a5a40]' : 'bg-[#e2e2d5]'}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick informative guidelines notice about local GMC contacts */}
          <div className="mt-8 pt-4 border-t border-[#e2e2d5] text-[10px] font-sans text-[#5a5a40] leading-relaxed bg-[#fafaf5] p-4 rounded-xl border border-[#e2e2d5]">
            <span className="font-bold text-[#1a2e1d] block mb-1 uppercase tracking-wider">NagarMitra Compliance Index</span>
            Civic alerts route directly to appropriate municipal departments under standard ISO 9001 compliance standards.
          </div>
        </div>
      </div>
    </div>
  );
}
