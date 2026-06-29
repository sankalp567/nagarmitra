import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  FileText, CheckCircle2, Percent, Clock, AlertTriangle, 
  TrendingUp, MapPin, Sparkles, Activity, ShieldAlert,
  Loader2, AlertCircle, Award, History
} from 'lucide-react';
import { CivicReport, GANDHINAGAR_WARDS, CATEGORIES } from '../types';
import { runEscalationWatchdog, resetWatchdogDemoState } from '../utils/reportStore';
import { getCivicScore, getContributions, getCivicTierInfo } from '../utils/civicScore';

// Global in-memory cache to persist bulletins across tab switching (component unmount/remount)
const bulletinMemoryCache: Record<string, string> = {};

function AnimatedCounter({ value }: { value: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 800; // ms
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress * (2 - progress);
      setCount(Math.floor(ease * value));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(value);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <>{count}</>;
}

interface DashboardProps {
  reports: CivicReport[];
  onSelectReport: (reportId: string) => void;
  onRefreshReports: () => Promise<void>;
}

export default function Dashboard({ reports, onSelectReport, onRefreshReports }: DashboardProps) {
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulatedOffsetDays, setSimulatedOffsetDays] = useState<number>(() => {
    return Number(localStorage.getItem('simulatedOffsetDays') || '0');
  });
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

  const [civicPoints, setCivicPoints] = useState<number>(0);
  const [contributions, setContributions] = useState<any[]>([]);

  React.useEffect(() => {
    const updateScore = () => {
      setCivicPoints(getCivicScore());
      setContributions(getContributions());
    };
    updateScore();
    window.addEventListener('nagarmitra_civic_score_updated', updateScore);
    return () => {
      window.removeEventListener('nagarmitra_civic_score_updated', updateScore);
    };
  }, []);

  React.useEffect(() => {
    localStorage.setItem('simulatedOffsetDays', String(simulatedOffsetDays));
  }, [simulatedOffsetDays]);

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

  // State to store civic health scores prediction
  const [healthPrediction, setHealthPrediction] = useState<string>('');
  const [loadingPrediction, setLoadingPrediction] = useState<boolean>(false);

  // Calculation of Civic Health Score for each ward
  const calculatedWards = React.useMemo(() => {
    const virtualNow = Date.now() + simulatedOffsetDays * 24 * 60 * 60 * 1000;
    const window14d = 14 * 24 * 60 * 60 * 1000;

    const wardsWithTickets = GANDHINAGAR_WARDS.filter(ward => {
      const wardReports = reports.filter(r => r.geo.ward === ward.id);
      return wardReports.length > 0;
    });

    return wardsWithTickets.map(ward => {
      const wardReports = reports.filter(r => r.geo.ward === ward.id);
      
      const openReports = wardReports.filter(r => r.status !== 'resolved' && r.status !== 'confirmed-resolved');
      const resolvedReports = wardReports.filter(r => r.status === 'resolved' || r.status === 'confirmed-resolved');
      const openCount = openReports.length;
      const resolvedCount = resolvedReports.length;
      const total = wardReports.length;

      // Report velocity in last 14 days of virtual timeline
      const velocity14d = wardReports.filter(r => r.createdAt >= (virtualNow - window14d)).length;

      // Average severity of open issues
      const avgSeverity = openReports.length > 0 
        ? openReports.reduce((sum, r) => sum + r.severity, 0) / openReports.length 
        : 0;

      // Average age of open tickets in days
      const avgAgeDays = openReports.length > 0 
        ? openReports.reduce((sum, r) => sum + Math.max(0, (virtualNow - r.createdAt)), 0) / openReports.length / (24 * 60 * 60 * 1000) 
        : 0;

      // New Score formula:
      // - Start at 100
      // - Subtract 10 per open ticket in the ward
      // - Subtract 5 additional per ticket that has been escalated (tier > 0)
      // - Add 15 per resolved ticket
      // - Clamp between 0 and 100
      let score = 100;
      score -= openCount * 10;
      
      const escalatedCount = wardReports.filter(r => (r.escalationTier ?? 0) > 0).length;
      score -= escalatedCount * 5;
      
      score += resolvedCount * 15;

      const finalScore = Math.max(0, Math.min(100, score));

      // Colored badge: 0–40 = red "Critical", 41–70 = orange "Needs Attention", 71–100 = green "Healthy"
      let statusLabel = "Healthy";
      let statusColor = "text-emerald-700 bg-emerald-50 border-emerald-100";
      let badgeColor = "bg-emerald-500";
      let barColor = "bg-emerald-500";

      if (finalScore <= 40) {
        statusLabel = "Critical";
        statusColor = "text-rose-700 bg-rose-50 border-rose-100";
        badgeColor = "bg-rose-500";
        barColor = "bg-rose-500";
      } else if (finalScore <= 70) {
        statusLabel = "Needs Attention";
        statusColor = "text-amber-700 bg-amber-50 border-amber-100";
        badgeColor = "bg-amber-500";
        barColor = "bg-amber-500";
      }

      return {
        ward,
        score: finalScore,
        total,
        openCount,
        resolvedCount,
        avgAgeDays: Math.round(avgAgeDays * 10) / 10,
        avgSeverity: Math.round(avgSeverity * 10) / 10,
        velocity14d,
        statusLabel,
        statusColor,
        badgeColor,
        barColor
      };
    })
    .sort((a, b) => a.score - b.score); // sorted from lowest (most urgent) to highest score
  }, [reports, simulatedOffsetDays]);

  const atRiskWardsSummary = React.useMemo(() => {
    const sortedAtRisk = [...calculatedWards]
      .filter(ws => ws.total > 0)
      .sort((a, b) => a.score - b.score);
    
    if (sortedAtRisk.length === 0) return '';
    return sortedAtRisk.slice(0, 2).map(ws => 
      `- Ward: ${ws.ward.name}, Score: ${ws.score}/100, Open Tickets: ${ws.openCount}/${ws.total}, Average Age: ${ws.avgAgeDays} days, Average Severity: ${ws.avgSeverity}/5, 14d Report Velocity: ${ws.velocity14d} tickets.`
    ).join('\n');
  }, [calculatedWards]);

  // Systemic Pattern Detection (2 or more tickets in same ward and same category)
  const systemicPatterns = React.useMemo(() => {
    // 1. Scan all tickets in the store
    // 2. Open tickets means status !== 'resolved'
    const openTickets = reports.filter(r => r.status !== 'resolved');

    // 3. Group by category + wardName
    const groups: { [key: string]: CivicReport[] } = {};
    openTickets.forEach(r => {
      const wardId = r.geo.ward;
      const wardName = r.geo.wardName || GANDHINAGAR_WARDS.find(w => w.id === wardId)?.name || 'Unknown Ward';
      const category = r.category;
      const key = `${category}_${wardName}`;
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(r);
    });

    // 4. Any group with 2+ open tickets = a detected pattern
    const virtualNow = Date.now() + simulatedOffsetDays * 24 * 60 * 60 * 1000;
    const patterns = Object.entries(groups)
      .filter(([_, tickets]) => tickets.length >= 2)
      .map(([key, tickets]) => {
        const first = tickets[0];
        const wardId = first.geo.ward;
        const wardName = first.geo.wardName || GANDHINAGAR_WARDS.find(w => w.id === wardId)?.name || 'Unknown Ward';
        
        // Calculate X: days elapsed since oldest ticket's creation up to virtualNow, minimum 1
        const dates = tickets.map(t => t.createdAt);
        const earliestTime = Math.min(...dates);
        const days = Math.max(1, Math.ceil((virtualNow - earliestTime) / (1000 * 60 * 60 * 24)));

        const descriptions = tickets.map(t => t.note || t.aiAnalysis?.description || t.category).join('; ');
        
        return {
          id: `pattern_${first.category}_${wardName}`,
          category: first.category,
          wardName: wardName,
          count: tickets.length,
          days,
          descriptions,
          tickets
        };
      })
      .sort((a, b) => b.count - a.count);

    return patterns.slice(0, 3);
  }, [reports, simulatedOffsetDays]);

  React.useEffect(() => {
    if (!atRiskWardsSummary) {
      setHealthPrediction("AI-predicted: All municipal wards are operating at perfect baseline health with zero active complaints registered across Gandhinagar.");
      return;
    }

    setLoadingPrediction(true);
    const fetchPrediction = async () => {
      try {
        const response = await fetch('/api/predictive-health', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ atRiskWardsSummary })
        });
        const data = await response.json();
        if (data.success && data.prediction) {
          setHealthPrediction(data.prediction);
        } else {
          setHealthPrediction("AI-predicted: Civic health prediction is currently offline. Review the computed scores below.");
        }
      } catch (err) {
        console.error("Failed to fetch predictive health note:", err);
        setHealthPrediction("AI-predicted: Civic health prediction is currently offline. Review the computed scores below.");
      } finally {
        setLoadingPrediction(false);
      }
    };

    fetchPrediction();
  }, [atRiskWardsSummary]);

  // State to store generated systemic bulletins, pre-populated from module-level cache
  const [bulletinCache, setBulletinCache] = useState<{ [clusterId: string]: { text: string; loading: boolean } }>(() => {
    const initial: { [clusterId: string]: { text: string; loading: boolean } } = {};
    Object.entries(bulletinMemoryCache).forEach(([key, val]) => {
      initial[key] = { text: val, loading: false };
    });
    return initial;
  });

  React.useEffect(() => {
    systemicPatterns.forEach(pattern => {
      // If we already have a loading/loaded status in component state, do not trigger fetch again
      if (bulletinCache[pattern.id]) return;

      // Check if it's already in the module level cache
      if (bulletinMemoryCache[pattern.id]) {
        setBulletinCache(prev => ({
          ...prev,
          [pattern.id]: { text: bulletinMemoryCache[pattern.id], loading: false }
        }));
        return;
      }

      // Set loading state
      setBulletinCache(prev => ({
        ...prev,
        [pattern.id]: { text: '', loading: true }
      }));

      const fetchBulletin = async () => {
        try {
          const ticketDetails = pattern.tickets.map(t => 
            `Ref ID: ${t.referenceId}, Description: ${t.aiAnalysis?.description || t.category}, Note: ${t.note || 'None'}`
          );

          // Build prompt matching user instruction exactly
          const customPrompt = `You are a municipal intelligence system. Generate a concise civic bulletin for officials about a detected pattern: ${pattern.count} ${pattern.category} issues reported in ${pattern.wardName} within the past ${pattern.days} days. The issues are: ${pattern.descriptions}. Identify the likely root cause, assess urgency, and recommend one immediate departmental action. Keep it under 80 words. No fluff.`;

          const response = await fetch('/api/systemic-bulletin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              wardName: pattern.wardName,
              category: pattern.category,
              count: pattern.count,
              ticketDetails,
              customPrompt
            })
          });

          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
          }

          const data = await response.json();
          if (data.success && data.bulletin) {
            bulletinMemoryCache[pattern.id] = data.bulletin;
            setBulletinCache(prev => ({
              ...prev,
              [pattern.id]: { text: data.bulletin, loading: false }
            }));
          } else {
            throw new Error(data.error || "Failed to fetch bulletin text");
          }
        } catch (err) {
          console.error("Failed to generate systemic bulletin:", err);
          setBulletinCache(prev => ({
            ...prev,
            [pattern.id]: { text: 'AI busy — bulletin pending', loading: false }
          }));
        }
      };

      fetchBulletin();
    });
  }, [systemicPatterns]);

  // 1. Impact metrics calculation
  const totalReported = reports.length;
  const totalResolved = reports.filter(r => r.status === 'resolved' || r.status === 'confirmed-resolved').length;
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
      if (r.status === 'resolved' || r.status === 'confirmed-resolved') {
        wardCounts[r.geo.wardName].resolved += 1;
      }
    } else {
      wardCounts[r.geo.wardName] = { id: r.geo.ward, count: 1, resolved: (r.status === 'resolved' || r.status === 'confirmed-resolved') ? 1 : 0 };
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
                Escalation Watchdog Activated
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



      {/* AI Systemic Alerts Section */}
      {systemicPatterns.length > 0 && (
        <div id="systemic-alerts-panel" className="bg-[#fffdfa] border border-[#f5d0a9] rounded-3xl p-6 mb-8 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#f5d0a9] pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-rose-500/10 text-rose-700 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-rose-600 animate-pulse" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-[#1a2e1d] uppercase tracking-wider font-sans">
                  AI Systemic Alerts
                </h2>
                <p className="text-[11px] text-[#8a8a7a] mt-0.5 font-medium">
                  Proactive multi-ticket failure patterns autonomously detected by the NagarMitra Intelligence Engine.
                </p>
              </div>
            </div>
            <span className="bg-rose-50 border border-rose-200 text-rose-800 text-[9px] font-mono font-bold px-2.5 py-1 rounded-full uppercase tracking-wider self-start sm:self-center">
              Active Alerts: {systemicPatterns.length}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {systemicPatterns.map((pattern) => {
              const cache = bulletinCache[pattern.id];
              return (
                <div 
                  key={pattern.id} 
                  className="bg-white border border-[#e2e2d5] rounded-2xl p-5 flex flex-col justify-between gap-3 shadow-3xs hover:border-rose-400/60 transition duration-150"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="text-sm font-extrabold text-[#1a2e1d] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-600 mt-1.5 flex-shrink-0" />
                        <span>
                          {pattern.count} {pattern.category} Issues — {pattern.wardName}
                        </span>
                      </div>
                      <span className="bg-[#4285F4] text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-3xs font-sans">
                        Gemini Intelligence
                      </span>
                    </div>

                    {/* Body */}
                    <div className="bg-[#fafaf5] border border-[#e2e2d5] p-4 rounded-xl relative overflow-hidden">
                      {cache?.loading ? (
                        <div className="flex items-center gap-2 py-1 text-xs text-[#8a8a7a]">
                          <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                          <span>NagarMitra is scanning pattern root causes with Gemini...</span>
                        </div>
                      ) : (
                        <p className="text-xs text-[#2d332d] font-sans leading-relaxed">
                          {cache?.text || 'AI busy — bulletin pending'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between border-t border-[#f0f0eb] pt-3 text-[10px] text-[#8a8a7a] font-medium font-sans">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-rose-500" />
                      Auto-detected by NagarMitra Intelligence Engine
                    </span>
                    <span className="font-mono text-[9px] bg-gray-100 px-1.5 py-0.5 rounded">
                      N={pattern.count} · Range: {pattern.days}d
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Civic Health Score Predictive Panel */}
      <div id="civic-health-score-panel" className="bg-white border border-[#e2e2d5] rounded-3xl p-6 mb-8 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e2d5] pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[#3a5a40]/10 text-[#3a5a40] rounded-lg">
              <Activity className="w-5 h-5 text-[#3a5a40]" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[#1a2e1d] uppercase tracking-wider font-sans">
                GMC Ward Civic Health Index — Powered by NagarMitra Intelligence
              </h2>
              <p className="text-[11px] text-[#8a8a7a] mt-0.5 font-medium">
                Real-time civic health score calculation based on active/escalated reports and municipal resolution velocity.
              </p>
            </div>
          </div>
          <span className="bg-[#3a5a40]/10 border border-[#3a5a40]/20 text-[#3a5a40] text-[9px] font-mono font-bold px-2.5 py-1 rounded-full uppercase tracking-wider self-start sm:self-center">
            SLA Health Analytics
          </span>
        </div>

        {/* AI Predictive Note Card */}
        <div className="bg-[#fafaf5] border border-[#e2e2d5] p-4 rounded-2xl mb-6 relative overflow-hidden flex flex-col md:flex-row gap-4 items-start shadow-3xs">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-[#3a5a40]" />
          <div className="p-2 bg-white rounded-xl border border-[#e2e2d5] shadow-3xs shrink-0 self-start">
            <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
          </div>
          <div className="space-y-1.5 flex-grow">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-black text-[#1a2e1d] tracking-wider font-sans">
                AI-Predicted Ward Health Forecast
              </span>
              <span className="bg-emerald-100 text-emerald-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-widest font-mono">
                AI-Predicted
              </span>
            </div>
            {loadingPrediction ? (
              <div className="flex items-center gap-2 text-xs text-[#8a8a7a] py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3a5a40]" />
                <span>Forecasting next ward risks with Gemini...</span>
              </div>
            ) : (
              <p className="text-xs text-[#2d332d] font-semibold leading-relaxed font-sans">
                {healthPrediction || "Review the computed health indices for each of the municipal wards below."}
              </p>
            )}
          </div>
        </div>

        {/* Grid of Wards and Health Scores */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {calculatedWards.map((ws) => {
            return (
              <div 
                key={ws.ward.id} 
                className="bg-white border border-[#e2e2d5] hover:border-[#3a5a40]/30 rounded-2xl p-5 flex flex-col justify-between gap-3 shadow-3xs transition duration-150"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] text-[#8a8a7a] font-mono font-bold block">
                      {ws.ward.representative.split(' (')[0]}
                    </span>
                    <h4 className="text-xs font-bold text-[#1a2e1d] truncate max-w-[170px]" title={ws.ward.name}>
                      {ws.ward.name}
                    </h4>
                  </div>
                  
                  {/* Color-Coded Score Badge */}
                  <div className={`px-2.5 py-1 rounded-xl border font-mono font-bold text-[10px] uppercase tracking-wider ${ws.statusColor} flex items-center gap-1.5 shadow-3xs`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${ws.badgeColor}`} />
                    <span>{ws.statusLabel} · {ws.score}</span>
                  </div>
                </div>

                {/* Interactive Health Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] text-[#8a8a7a] font-bold">
                    <span>Health Index Score</span>
                    <span>{ws.score}%</span>
                  </div>
                  <div className="w-full bg-[#fafaf5] border border-[#e2e2d5]/60 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${ws.barColor} transition-all duration-500`}
                      style={{ width: `${ws.score}%` }}
                    />
                  </div>
                </div>

                {/* Number of open issues */}
                <div className="flex items-center justify-between pt-2 border-t border-[#fafaf5] text-[10px] font-bold text-[#5a5a40]">
                  <span>Open Issues</span>
                  <span className="font-mono text-[#1a2e1d]">
                    {ws.openCount} {ws.openCount === 1 ? 'ticket' : 'tickets'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Community Contributors & Civic Score Panel */}
      <div id="community-contributors-panel" className="bg-white border border-[#e2e2d5] rounded-3xl p-6 mb-8 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e2d5] pb-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[#3a5a40]/10 text-[#3a5a40] rounded-lg">
              <Award className="w-5 h-5 text-[#3a5a40]" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[#1a2e1d] uppercase tracking-wider font-sans">
                Community Contribution & Civic Score
              </h2>
              <p className="text-[11px] text-[#8a8a7a] mt-0.5 font-medium">
                Tracking citizen participation and engagement in maintaining Ward infrastructure across Gandhinagar.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="bg-[#3a5a40]/10 border border-[#3a5a40]/20 text-[#3a5a40] text-[9px] font-mono font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              Score: {civicPoints} Pts
            </span>
            {getCivicTierInfo(civicPoints).isGold ? (
              <span className="bg-[#fffbf0] border border-[#b37d14]/35 text-[#b37d14] text-[9px] font-sans font-bold px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse">
                {getCivicTierInfo(civicPoints).name}
              </span>
            ) : (
              <span className="bg-[#fafaf5] border border-[#e2e2d5] text-[#8a8a7a] text-[9px] font-sans font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                {getCivicTierInfo(civicPoints).name}
              </span>
            )}
          </div>
        </div>

        {/* Score & Breakdown Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Score Display Box */}
          <div className="bg-[#fafaf5] border border-[#e2e2d5] p-5 rounded-2xl flex flex-col justify-between shadow-3xs md:col-span-1">
            <div>
              <span className="text-[10px] uppercase font-black text-[#1a2e1d] tracking-wider font-sans block mb-1">
                Active Session Score
              </span>
              {/* Tier name in a small muted label above the score number */}
              <div className="text-[11px] font-medium text-[#8a8a7a]">
                {getCivicTierInfo(civicPoints).name}
              </div>
              <div className="text-3xl font-extrabold text-[#3a5a40] mt-1">{civicPoints} Points</div>
              <p className="text-[10px] text-[#8a8a7a] mt-1.5 leading-relaxed">
                Points are earned by submitting reports (+1), co-signing existing complaints (+2), or escalating unresolved issues to Executive Engineer (+3).
              </p>
            </div>
            {getCivicTierInfo(civicPoints).isGold && (
              <div className="mt-4 pt-3 border-t border-[#e2e2d5] text-[10px] font-extrabold text-[#b37d14] uppercase tracking-wider">
                Rank: {getCivicTierInfo(civicPoints).name} Medal Awarded
              </div>
            )}
          </div>

          {/* Recent Contributions Breakdown */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-1.5 mb-1">
              <History className="w-4 h-4 text-[#8a8a7a]" />
              <span className="text-[10px] uppercase font-black text-[#1a2e1d] tracking-wider font-sans">
                Recent Contributions Breakdown
              </span>
            </div>
            
            {contributions.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-[#e2e2d5] rounded-2xl bg-[#fafaf5]/40 text-xs text-[#8a8a7a] font-medium font-sans">
                No contributions recorded in this session yet. Submit a grievance or co-sign a ticket to begin.
              </div>
            ) : (
              <div className="space-y-2">
                {contributions.slice(0, 3).map((contrib, idx) => {
                  let typeLabel = "Report Filed";
                  let typeColor = "text-[#3a5a40] bg-[#f0f9f0] border-[#d5edd5]";
                  if (contrib.type === 'cowitness') {
                    typeLabel = "Co-Witness Co-Sign";
                    typeColor = "text-[#4285F4] bg-[#4285F4]/5 border-[#4285F4]/15";
                  } else if (contrib.type === 'escalation') {
                    typeLabel = "Tier-1 Escalation";
                    typeColor = "text-[#c25953] bg-[#fff5f5] border-[#ffd5d5]";
                  }

                  return (
                    <div key={idx} className="flex items-center justify-between p-3 border border-[#e2e2d5] rounded-xl bg-white hover:bg-[#fafaf5] transition shadow-3xs">
                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] font-extrabold uppercase font-mono px-2 py-0.5 rounded-md border ${typeColor}`}>
                          {typeLabel}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-[#1a2e1d]">
                            Ticket ID: <span className="font-mono">{contrib.ticketId}</span>
                          </div>
                          <div className="text-[9px] text-[#8a8a7a] font-medium mt-0.5">
                            {new Date(contrib.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-extrabold text-[#3a5a40] font-mono">
                        +{contrib.points} Pts
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* "Why This Matters" Statistics Banner */}
      <div id="why-this-matters-banner" className="bg-[#fafaf5] border border-[#e2e2d5] rounded-3xl p-6 mb-8 animate-fadeIn">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 bg-[#3a5a40]/10 text-[#3a5a40] rounded-lg">
            <TrendingUp className="w-4 h-4 text-[#3a5a40]" />
          </div>
          <h2 className="text-xs font-extrabold text-[#1a2e1d] uppercase tracking-wider font-sans">
            Why This Matters: Municipal Redressal Gap
          </h2>
        </div>

        {/* Grid of 4 Sourced Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-4">
          {/* Card 1 */}
          <div className="bg-white border border-[#e2e2d5] rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-[#5a7a5a] transition duration-150">
            <div>
              <p className="text-2xl font-bold font-mono text-[#c25953]">48 days</p>
              <p className="text-[11px] text-[#2d332d] leading-relaxed mt-2 font-medium font-sans">
                Average civic complaint resolution time in Indian cities (up from 30 days in 2021 — Praja Foundation)
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white border border-[#e2e2d5] rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-[#5a7a5a] transition duration-150">
            <div>
              <p className="text-2xl font-bold font-mono text-[#c25953]">~98%</p>
              <p className="text-[11px] text-[#2d332d] leading-relaxed mt-2 font-medium font-sans">
                Escalations to Municipal Commissioner that remain unresolved
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white border border-[#e2e2d5] rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-[#5a7a5a] transition duration-150">
            <div>
              <p className="text-2xl font-bold font-mono text-[#c25953]">6M+</p>
              <p className="text-[11px] text-[#2d332d] leading-relaxed mt-2 font-medium font-sans">
                Complaints on MoHUA Swachhata app — with no escalation matrix
              </p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-white border border-[#e2e2d5] rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-[#5a7a5a] transition duration-150">
            <div>
              <p className="text-2xl font-bold font-mono text-[#3a5a40]">~90%</p>
              <p className="text-[11px] text-[#2d332d] leading-relaxed mt-2 font-medium font-sans">
                Grievance SLA met by Gujarat's SWAGAT 2.0 auto-escalation pilot — proof the model works
              </p>
            </div>
          </div>
        </div>

        {/* Muted footnote */}
        <p className="text-[11px] text-[#8a8a7a] font-sans font-medium italic mt-4 pl-1">
          NagarMitra applies this proven model at the GMC ward level — where no such tool exists today.
        </p>
      </div>

      <div className="flex items-center justify-between mb-4 mt-2">
        <h3 className="text-xs font-extrabold text-[#1a2e1d] uppercase tracking-wider font-sans">
          Municipal Performance Metrics
        </h3>
        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          LIVE DEMO — Gandhinagar Civic Data
        </span>
      </div>

      {/* 1. IMPACT STRIP */}
      <div id="impact-strip" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {/* Total Reported Card */}
        <div className="bg-white border border-[#e2e2d5] rounded-3xl p-5 shadow-xs flex items-center justify-between hover:border-[#5a7a5a] transition duration-150">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#8a8a7a]">Total Grievances</span>
            <p className="text-2xl font-bold font-mono text-[#1a2e1d] mt-1">
              <AnimatedCounter value={totalReported} />
            </p>
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
