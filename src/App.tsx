import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Map, BarChart3, HelpCircle, FileText, 
  Sparkles, ShieldCheck, Database, Loader2, AlertCircle,
  MessageSquare
} from 'lucide-react';
import { ensureAnonymousAuth } from './firebase';
import { fetchReports } from './utils/reportStore';
import { CivicReport, IssueStatus } from './types';

// Importing custom components
import ReportIssue from './components/ReportIssue';
import CivicMap from './components/CivicMap';
import TicketDetail from './components/TicketDetail';
import Dashboard from './components/Dashboard';
import NagarMitraChat from './components/NagarMitraChat';

type Screen = 'report' | 'map' | 'chat' | 'dashboard' | 'ticket-detail';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('report');
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<string>('Connecting...');
  const [previousView, setPreviousView] = useState<Screen | null>(null);

  // Centralized navigation function to handle state updates and pushState
  const navigateTo = (screen: Screen, reportId: string | null = null, pushHistory = true) => {
    let prev = previousView;
    if (screen === 'ticket-detail') {
      if (currentScreen !== 'ticket-detail') {
        prev = currentScreen;
        setPreviousView(currentScreen);
      }
    } else {
      prev = null;
      setPreviousView(null);
    }

    setCurrentScreen(screen);
    setSelectedReportId(reportId);

    if (pushHistory) {
      window.history.pushState({
        screen,
        selectedReportId: reportId,
        previousView: prev
      }, '', '');
    }
  };

  // Synchronize browser back button PopState actions
  useEffect(() => {
    if (!window.history.state) {
      window.history.replaceState({
        screen: 'report',
        selectedReportId: null,
        previousView: null
      }, '', '');
    }

    const handlePopState = (event: PopStateEvent) => {
      if (event.state) {
        const { screen, selectedReportId: popId, previousView: popPrev } = event.state;
        setCurrentScreen(screen || 'report');
        setSelectedReportId(popId || null);
        setPreviousView(popPrev || null);
      } else {
        setCurrentScreen('report');
        setSelectedReportId(null);
        setPreviousView(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Load active reports and user authentication context on startup
  useEffect(() => {
    async function initPlatform() {
      try {
        setAuthStatus('Securing anonymous auth...');
        const user = await ensureAnonymousAuth();
        if (user) {
          setAuthStatus(`User Anonymous ID: ${user.uid.substring(0, 6)}...`);
        } else {
          setAuthStatus('Local Sandbox Authentication active');
        }

        const retrievedReports = await fetchReports();
        setReports(retrievedReports);
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        setLoading(false);
      }
    }
    initPlatform();
  }, []);

  // Update lists locally when reports are submitted or altered in child screens
  const handleReportCreated = (newReport: CivicReport) => {
    setReports(prev => {
      const exists = prev.some(r => r.id === newReport.id);
      if (exists) {
        return prev.map(r => r.id === newReport.id ? newReport : r);
      }
      return [newReport, ...prev];
    });
  };

  const handleUpdateStatus = (reportId: string, status: IssueStatus) => {
    setReports(prev => 
      prev.map(r => r.id === reportId ? { ...r, status, lastEscalatedAt: status === 'escalated' ? Date.now() : r.lastEscalatedAt } : r)
    );
  };

  const handleUpdateWitness = (reportId: string, email: string) => {
    setReports(prev =>
      prev.map(r => r.id === reportId ? { ...r, coWitnesses: r.coWitnesses.includes(email) ? r.coWitnesses : [...r.coWitnesses, email] } : r)
    );
  };

  const handleUpdateReasoning = (
    reportId: string,
    reasoning: { classificationReasoning: string; alternativeCategories: string; severityFactors: string }
  ) => {
    setReports(prev =>
      prev.map(r => r.id === reportId ? { ...r, ...reasoning } : r)
    );
  };

  const activeReport = reports.find(r => r.id === selectedReportId);

  // Trigger Detail views from search click
  const handleNavigateToDetail = (reportId: string) => {
    navigateTo('ticket-detail', reportId);
  };

  const handleRefreshReports = async () => {
    try {
      const retrievedReports = await fetchReports();
      setReports(retrievedReports);
    } catch (error) {
      console.error("Failed to refresh reports list:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] flex flex-col text-[#2d332d] selection:bg-[#3a5a40]/25 selection:text-[#1a2e1d] antialiased font-sans">
      {/* Dynamic Nav Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#e2e2d5] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* NagarMitra bilingual logo layout */}
          <div 
            onClick={() => navigateTo('report')} 
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            {/* Indian national green & orange custom stylized roundel */}
            <div className="w-9 h-9 rounded-xl bg-[#3a5a40] border border-[#3a5a40] flex items-center justify-center text-white relative overflow-hidden shadow-sm">
              <span className="font-mono text-sm font-black text-white">N</span>
              <div className="absolute top-0 left-0 w-2.5 h-full bg-amber-500 opacity-20" />
              <div className="absolute top-0 right-0 w-2.5 h-full bg-emerald-500 opacity-20" />
            </div>
            
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-[#1a2e1d] font-sans group-hover:text-[#3a5a40] transition">
                NagarMitra
              </span>
              <span className="text-[9px] font-medium font-sans text-[#8a8a7a] leading-none">
                गांधीनगर नागरिक मंच
              </span>
            </div>
          </div>

          {/* Navigation Bar Selector */}
          <nav className="hidden sm:flex items-center gap-1 bg-[#fafaf5] p-1 rounded-xl border border-[#e2e2d5]">
            <button
              onClick={() => navigateTo('report')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition flex items-center gap-1.5 cursor-pointer ${currentScreen === 'report' ? 'bg-[#3a5a40] text-white shadow-xs' : 'text-[#8a8a7a] hover:text-[#2d332d]'}`}
            >
              <Plus className="w-3.5 h-3.5" />
              Report Issue
            </button>

            <button
              onClick={() => navigateTo('map')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition flex items-center gap-1.5 cursor-pointer ${currentScreen === 'map' ? 'bg-[#3a5a40] text-white shadow-xs' : 'text-[#8a8a7a] hover:text-[#2d332d]'}`}
            >
              <Map className="w-3.5 h-3.5" />
              Civic Map
            </button>

            <button
              onClick={() => navigateTo('chat')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition flex items-center gap-1.5 cursor-pointer ${currentScreen === 'chat' ? 'bg-[#3a5a40] text-white shadow-xs' : 'text-[#8a8a7a] hover:text-[#2d332d]'}`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              💬 Ask NagarMitra
            </button>

            <button
              onClick={() => navigateTo('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition flex items-center gap-1.5 cursor-pointer ${currentScreen === 'dashboard' ? 'bg-[#3a5a40] text-white shadow-xs' : 'text-[#8a8a7a] hover:text-[#2d332d]'}`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Dashboard
            </button>
          </nav>

          {/* Authentication & platform status badges */}
          <div className="flex items-center gap-3">
            <div className="text-[10px] font-mono bg-[#fafaf5] border border-[#e2e2d5] px-2.5 py-1 rounded-lg text-[#8a8a7a] flex items-center gap-1.5 max-w-xs truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-[#5a7a5a] flex-shrink-0" />
              <span className="truncate hidden md:inline">{authStatus}</span>
              <span className="md:hidden">Auth Safe</span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation tab overlays */}
        <div className="sm:hidden grid grid-cols-4 border-t border-[#e2e2d5] p-1 bg-[#fafaf5]/50">
          <button
            onClick={() => navigateTo('report')}
            className={`py-2 text-center text-xs font-bold transition flex flex-col items-center gap-0.5 ${currentScreen === 'report' ? 'text-[#3a5a40] border-b-2 border-[#3a5a40]' : 'text-[#8a8a7a]'}`}
          >
            <Plus className="w-4 h-4" />
            Report
          </button>
          
          <button
            onClick={() => navigateTo('map')}
            className={`py-2 text-center text-xs font-bold transition flex flex-col items-center gap-0.5 ${currentScreen === 'map' ? 'text-[#3a5a40] border-b-2 border-[#3a5a40]' : 'text-[#8a8a7a]'}`}
          >
            <Map className="w-4 h-4" />
            Civic Map
          </button>

          <button
            onClick={() => navigateTo('chat')}
            className={`py-2 text-center text-xs font-bold transition flex flex-col items-center gap-0.5 ${currentScreen === 'chat' ? 'text-[#3a5a40] border-b-2 border-[#3a5a40]' : 'text-[#8a8a7a]'}`}
          >
            <MessageSquare className="w-4 h-4" />
            Ask NM
          </button>

          <button
            onClick={() => navigateTo('dashboard')}
            className={`py-2 text-center text-xs font-bold transition flex flex-col items-center gap-0.5 ${currentScreen === 'dashboard' ? 'text-[#3a5a40] border-b-2 border-[#3a5a40]' : 'text-[#8a8a7a]'}`}
          >
            <BarChart3 className="w-4 h-4" />
            Metrics
          </button>
        </div>
      </header>

      {/* Primary Workspace Container */}
      <main className="flex-grow">
        {loading ? (
          <div className="h-[400px] flex flex-col items-center justify-center text-center p-8">
            <Loader2 className="w-8 h-8 text-[#3a5a40] animate-spin mb-3" />
            <span className="text-sm font-semibold text-[#2d332d]">Initializing NagarMitra Civic Portal...</span>
            <span className="text-[10px] font-mono text-[#8a8a7a] mt-1">Acquiring secure connection and seeding sectors...</span>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentScreen + (selectedReportId || '')}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
            >
              {currentScreen === 'report' && (
                <ReportIssue 
                  onReportCreated={handleReportCreated} 
                  onNavigateToDetail={handleNavigateToDetail}
                />
              )}

              {currentScreen === 'map' && (
                <CivicMap 
                  reports={reports} 
                  onSelectReport={handleNavigateToDetail}
                />
              )}

              {currentScreen === 'chat' && (
                <NagarMitraChat />
              )}

              {currentScreen === 'dashboard' && (
                <Dashboard 
                  reports={reports} 
                  onSelectReport={handleNavigateToDetail}
                  onRefreshReports={handleRefreshReports}
                />
              )}

              {currentScreen === 'ticket-detail' && activeReport && (
                <TicketDetail 
                  report={activeReport}
                  previousView={previousView}
                  onBack={() => {
                    if (window.history.state && window.history.state.screen === 'ticket-detail') {
                      window.history.back();
                    } else {
                      const defaultBack = reports.some(r => r.id === activeReport.id && r.id.startsWith('rep_local_')) ? 'report' : 'map';
                      navigateTo(defaultBack, null);
                    }
                  }}
                  onUpdateStatus={handleUpdateStatus}
                  onUpdateWitness={handleUpdateWitness}
                  onUpdateReasoning={handleUpdateReasoning}
                />
              )}

              {currentScreen === 'ticket-detail' && !activeReport && (
                <div className="p-8 max-w-sm mx-auto text-center">
                  <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2 animate-bounce" />
                  <h4 className="font-bold text-[#2d332d]">Ticket Missing or Deleted</h4>
                  <p className="text-xs text-[#8a8a7a] mt-1">This report doesn't exist in local compliance caches. Return and choose another grid.</p>
                  <button 
                    onClick={() => navigateTo('report')}
                    className="mt-4 px-4 py-2 bg-[#3a5a40] text-white rounded-lg text-xs font-semibold"
                  >
                    Back to Portal
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Universal Footer */}
      <footer className="h-12 bg-[#e2e2d5] border-t border-[#d1d1c1] px-4 sm:px-8 mt-12 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0 py-2">
        <div className="flex gap-4 text-[10px] font-bold text-[#5a5a40] uppercase tracking-wider">
          <span className="hover:text-[#1a2e1d] cursor-pointer transition">About NagarMitra</span>
          <span className="hover:text-[#1a2e1d] cursor-pointer transition">Terms of Service</span>
          <span className="hover:text-[#1a2e1d] cursor-pointer transition">Privacy Policy</span>
        </div>
        <div className="text-[10px] font-medium text-[#8a8a7a] text-center sm:text-right">
          Powered by Local Governance Cloud • Gandhinagar Municipal Corporation
        </div>
      </footer>
    </div>
  );
}
