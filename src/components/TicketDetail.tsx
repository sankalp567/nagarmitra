import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, Calendar, User, ShieldAlert, FileText, CheckCircle2, 
  MapPin, Copy, Download, Share2, Mail, ExternalLink, Sparkles,
  Award, ArrowUpRight, Check, AlertCircle, Building, ShieldCheck
} from 'lucide-react';
import { CivicReport, IssueStatus } from '../types';
import { updateReportStatus, addCoWitness } from '../utils/reportStore';

interface TicketDetailProps {
  report: CivicReport;
  onBack: () => void;
  onUpdateStatus: (reportId: string, status: IssueStatus) => void;
  onUpdateWitness: (reportId: string, email: string) => void;
}

export default function TicketDetail({ report, onBack, onUpdateStatus, onUpdateWitness }: TicketDetailProps) {
  const [activeLang, setActiveLang] = useState<'EN' | 'HI'>('EN');
  const [copied, setCopied] = useState<boolean>(false);
  const [witnessEmail, setWitnessEmail] = useState<string>('');
  const [witnessSuccess, setWitnessSuccess] = useState<string>('');

  const formattedDate = new Date(report.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Handle Clipboard Copy
  const handleCopy = () => {
    const textToCopy = activeLang === 'EN' ? report.complaintEn : report.complaintHi;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle file download
  const handleDownload = () => {
    const textToSave = activeLang === 'EN' ? report.complaintEn : report.complaintHi;
    const blob = new Blob([textToSave], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nagar_mitra_complaint_${report.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // WhatsApp sharing logic
  const handleWhatsAppShare = () => {
    const textToShare = activeLang === 'EN' ? report.complaintEn : report.complaintHi;
    const truncatedText = textToShare.slice(0, 400) + '... \n\nFiled via NagarMitra Gandhinagar.';
    const encoded = encodeURIComponent(truncatedText);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  // Email trigger logic
  const handleEmailTrigger = () => {
    const subject = activeLang === 'EN' 
      ? `[NagarMitra Grievance ${report.id}] Urgent ${report.category} Attention` 
      : `[नगरमित्र शिकायत ${report.id}] ${report.category} निवारण`;
    const body = activeLang === 'EN' ? report.complaintEn : report.complaintHi;
    window.open(`mailto:commissioner-gmc@gujarat.gov.in?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  // Handle manual co-witness registration
  const handleRegisterWitness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!witnessEmail || !witnessEmail.includes('@')) {
      alert("Please provide a valid email structure.");
      return;
    }
    const success = await addCoWitness(report.id, witnessEmail);
    if (success) {
      onUpdateWitness(report.id, witnessEmail);
      setWitnessSuccess(`Email ${witnessEmail} is now co-signed!`);
      setWitnessEmail('');
      setTimeout(() => setWitnessSuccess(''), 4000);
    }
  };

  // Status timelines configurations
  const timelineStages: { key: IssueStatus; title: string; desc: string }[] = [
    { key: 'open', title: 'Ticket Lodged', desc: 'Auto-categorized and registered via NagarMitra.' },
    { key: 'acknowledged', title: 'Officer Assigned', desc: 'Complaint formally reviewed by GMC nodal administrator.' },
    { key: 'escalated', title: 'Escalated', desc: 'Sent to secondary engineering grid for fast-track remediation.' },
    { key: 'resolved', title: 'Remediated', desc: 'Resolved on site. Citizen evaluation completed.' }
  ];

  const currentStageIndex = timelineStages.findIndex(s => s.key === report.status);

  return (
    <div id="ticket-detail-screen" className="max-w-5xl mx-auto px-4 py-8 animate-fadeIn">
      {/* Back button link */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[#5a5a40] hover:text-[#1a2e1d] font-bold text-xs uppercase tracking-wider mb-6 transition group"
      >
        <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform text-[#5a5a40]" />
        Back to Platform Overview
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Primary Dossier Column */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-[#e2e2d5] rounded-3xl overflow-hidden shadow-sm">
            {/* Top Image Preview Banner */}
            <div className="relative h-64 bg-slate-900">
              <img src={report.photoUrl} alt={report.category} className="w-full h-full object-cover opacity-90" />
              {/* Category tag overlay */}
              <div className="absolute bottom-4 left-4 bg-[#3a5a40]/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-[#5a7a5a] font-bold text-xs text-white uppercase tracking-wider">
                {report.category}
              </div>
            </div>

            {/* General Info block */}
            <div className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e2d5] pb-5 mb-5">
                <div>
                  <h3 className="text-[#8a8a7a] font-bold font-mono text-[9px] tracking-wider uppercase">Municipal Incident Dossier</h3>
                  <h1 className="text-xl font-extrabold text-[#1a2e1d] font-sans mt-0.5 flex items-center gap-2">
                    Ticket #{report.id}
                  </h1>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#8a8a7a] font-semibold flex items-center gap-1 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-[#8a8a7a]" />
                    {formattedDate}
                  </span>
                </div>
              </div>

              {/* Grid-based descriptors */}
              <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
                <div className="bg-[#fafaf5] p-3.5 rounded-2xl border border-[#e2e2d5]">
                  <span className="text-[#8a8a7a] font-extrabold uppercase tracking-wider text-[9px] block">Severity Index</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-bold font-mono text-[#2d332d]">{report.severity} / 5</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${report.severity >= 4 ? 'bg-[#c25953]' : report.severity === 3 ? 'bg-[#d19c4c]' : 'bg-[#5a7a5a]'}`} />
                  </div>
                </div>

                <div className="bg-[#fafaf5] p-3.5 rounded-2xl border border-[#e2e2d5]">
                  <span className="text-[#8a8a7a] font-extrabold uppercase tracking-wider text-[9px] block">Affiliated Sector</span>
                  <span className="text-[#2d332d] font-bold text-xs mt-1 block truncate" title={report.geo.wardName}>
                    {report.geo.wardName}
                  </span>
                </div>
              </div>

              {/* AI analysis card */}
              <div className="bg-[#fafaf5] rounded-3xl p-5 border border-[#e2e2d5] mb-6 animate-fadeIn">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-[#3a5a40] animate-pulse" />
                  <h3 className="font-extrabold text-xs text-[#1a2e1d] uppercase tracking-wider">AI Guard Evaluation</h3>
                </div>
                
                <p className="text-xs text-[#2d332d] leading-relaxed font-sans">{report.aiAnalysis.description}</p>
                
                {report.aiAnalysis.hazards.length > 0 && (
                  <div className="mt-4">
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#8a8a7a]">Risk Hazards Isolated</span>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {report.aiAnalysis.hazards.map((h, i) => (
                        <span key={i} className="text-[10px] font-bold font-sans bg-[#fff5f5] text-[#c25953] border border-[#ffd5d5] px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5 text-[#c25953]" />
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Department Contact Bureau details */}
              <div className="border-t border-[#e2e2d5] pt-5 space-y-4">
                <h3 className="font-extrabold text-xs text-[#1a2e1d] uppercase tracking-wider">Assigned GMC Department</h3>
                <div className="flex items-start gap-3 bg-[#fafaf5]/50 p-4 rounded-2xl border border-[#e2e2d5]">
                  <Building className="w-5 h-5 text-[#8a8a7a] mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-[#1a2e1d]">{report.department}</p>
                    <p className="text-[#8a8a7a] font-mono mt-1 flex items-center gap-1.5 text-[10px] font-semibold">
                      <User className="w-3.5 h-3.5 text-[#8a8a7a]" />
                      OFFICER: <span className="font-sans font-bold text-[#2d332d]">{report.officer}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bilingual complaint drafting card (Deep forest green compliance editor) */}
          <div id="complaint-draft-card" className="bg-[#1a2e1d] text-white rounded-3xl border border-[#3a5a40]/35 overflow-hidden shadow-md">
            {/* Tabs for Languages */}
            <div className="bg-[#132215] px-5 py-3 border-b border-[#2d4632] flex items-center justify-between">
              <span className="font-bold text-[10px] text-[#fafaf5] flex items-center gap-1.5 uppercase font-mono tracking-wider">
                <FileText className="w-4 h-4 text-[#5ag7a5a] text-[#5a7a5a]" />
                Administrative Draft
              </span>
              
              <div className="flex gap-1.5 p-0.5 bg-[#1a2e1d] rounded-xl border border-[#2d4632]">
                <button
                  onClick={() => setActiveLang('EN')}
                  className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg transition uppercase tracking-wider ${activeLang === 'EN' ? 'bg-[#3a5a40] text-white' : 'text-[#8a8a7a] hover:text-[#fafaf5]'}`}
                >
                  ENGLISH
                </button>
                <button
                  onClick={() => setActiveLang('HI')}
                  className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg transition uppercase tracking-wider ${activeLang === 'HI' ? 'bg-[#3a5a40] text-white' : 'text-[#8a8a7a] hover:text-[#fafaf5]'}`}
                >
                  हिंदी
                </button>
              </div>
            </div>

            {/* Message Body pre-formatted */}
            <div className="p-5 font-mono text-[#fafaf5]/90 text-xs leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto selection:bg-[#3a5a40]/60 selection:text-white bg-[#132215]/80">
              {activeLang === 'EN' ? report.complaintEn : report.complaintHi}
            </div>

            {/* Quick Action Button tray */}
            <div className="bg-[#132215] border-t border-[#2d4632] p-3 px-4 flex flex-wrap gap-2 justify-end">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2d4632] hover:border-[#3a5a40] bg-[#1a2e1d] text-[#fafaf5] font-bold text-[10px] uppercase tracking-wider transition duration-150 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Letter
                  </>
                )}
              </button>

              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2d4632] hover:border-[#3a5a40] bg-[#1a2e1d] text-[#fafaf5] font-bold text-[10px] uppercase tracking-wider transition duration-150 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download Plain text
              </button>

              <button
                onClick={handleWhatsAppShare}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#3a5a40] bg-[#3a5a40]/10 hover:bg-[#3a5a40]/30 text-[#fafaf5] font-bold text-[10px] uppercase tracking-wider transition duration-150 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                WhatsApp
              </button>

              <button
                onClick={handleEmailTrigger}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#5a7a5a] bg-[#5a7a5a]/10 hover:bg-[#5a7a5a]/30 text-[#fafaf5] font-bold text-[10px] uppercase tracking-wider transition duration-150 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                Email GMC Desk
              </button>
            </div>
          </div>
        </div>

        {/* Right timeline and co-witness signing panel */}
        <div className="lg:col-span-5 space-y-6">
          {/* Status timeline card */}
          <div className="bg-white border border-[#e2e2d5] rounded-3xl p-6 shadow-sm">
            <div className="border-b border-[#e2e2d5] pb-3 mb-4 flex items-center justify-between">
              <h3 className="font-extrabold text-xs text-[#1a2e1d] uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#3a5a40]" />
                Action Timeline
              </h3>
              <span className={`text-[9px] font-extrabold uppercase font-mono px-2.5 py-1 rounded-full border ${report.status === 'resolved' ? 'bg-[#f0f9f0] text-[#3a5a40] border-[#d5edd5]' : report.status === 'escalated' ? 'bg-[#fff5f5] text-[#c25953] border-[#ffd5d5] animate-pulse' : 'bg-[#fffbf0] text-[#b37d14] border-[#ffe8b3]'}`}>
                {report.status}
              </span>
            </div>

            {/* Vertical timeline stages list */}
            <div className="space-y-6 relative before:absolute before:left-3 mt-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#e2e2d5]">
              {timelineStages.map((stage, idx) => {
                const isPassed = idx <= currentStageIndex;
                const isCurrent = idx === currentStageIndex;
                
                return (
                  <div key={stage.key} className="flex gap-4 items-start pl-1 text-xs select-none">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center relative z-10 transition duration-300 ${isCurrent ? 'bg-[#3a5a40] ring-4 ring-[#fafaf5]' : isPassed ? 'bg-[#5a7a5a] text-white' : 'bg-[#fafaf5] border border-[#e2e2d5] text-[#8a8a7a]'}`}>
                      {isPassed && idx !== currentStageIndex ? (
                        <Check className="w-2.5 h-2.5 text-white" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-bold font-sans ${isCurrent ? 'text-[#3a5a40]' : isPassed ? 'text-[#1a2e1d]' : 'text-[#8a8a7a]'}`}>
                        {stage.title}
                      </h4>
                      <p className="text-[10px] text-[#5a5a40] leading-relaxed mt-0.5">{stage.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Interactive Sandbox administrative action controls */}
            <div className="border-t border-[#e2e2d5] pt-5 mt-6">
              <span className="text-[10px] font-extrabold text-[#8a8a7a] uppercase tracking-wider block mb-3.5">Administrative Controls (Demo Mode)</span>
              
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    updateReportStatus(report.id, 'acknowledged');
                    onUpdateStatus(report.id, 'acknowledged');
                  }}
                  className={`px-2 py-1.5 border border-[#e2e2d5] hover:bg-[#fafaf5] text-[10px] font-bold rounded-lg transition text-center cursor-pointer ${report.status === 'acknowledged' ? 'bg-[#fffbf0] text-[#b37d14] border-[#ffe8b3]' : 'text-[#5a5a40] text-xs'}`}
                >
                  Acknowledge
                </button>
                
                <button
                  onClick={() => {
                    updateReportStatus(report.id, 'escalated');
                    onUpdateStatus(report.id, 'escalated');
                  }}
                  className={`px-2 py-1.5 border border-[#e2e2d5] hover:bg-[#fafaf5] text-[10px] font-bold rounded-lg transition text-center cursor-pointer ${report.status === 'escalated' ? 'bg-[#fff5f5] text-[#c25953] border-[#ffd5d5]' : 'text-[#5a5a40] text-xs'}`}
                >
                  Escalate
                </button>

                <button
                  onClick={() => {
                    updateReportStatus(report.id, 'resolved');
                    onUpdateStatus(report.id, 'resolved');
                  }}
                  className={`px-2 py-1.5 border border-[#e2e2d5] hover:bg-[#fafaf5] text-[10px] font-bold rounded-lg transition text-center cursor-pointer ${report.status === 'resolved' ? 'bg-[#f0f9f0] text-[#3a5a40] border-[#d5edd5]' : 'text-[#5a5a40] text-xs'}`}
                >
                  Resolve
                </button>
              </div>
            </div>
          </div>

          {/* Co-witness signing validation */}
          <div className="bg-[#fafaf5] border border-[#e2e2d5] rounded-3xl p-6 shadow-2xs">
            <h3 className="font-extrabold text-xs text-[#1a2e1d] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#e2e2d5] pb-3 mb-3">
              <Award className="w-4 h-4 text-[#3a5a40]" />
              Community Endorsements
            </h3>

            <p className="text-xs text-[#5a5a40] leading-relaxed font-sans mb-4">
              Is this issue affecting you or your sector neighborhood? Register as a co-witness to raise administrative visibility and fast-track resolving schedules.
            </p>

            <span className="text-[9px] uppercase font-extrabold text-[#8a8a7a] block mb-2">Registered Witness Signatures ({report.coWitnesses.length})</span>
            {report.coWitnesses.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {report.coWitnesses.map((email, idx) => (
                  <span key={idx} className="text-[10px] font-mono tracking-wide bg-white font-bold px-2.5 py-1 rounded-lg text-[#2d332d] border border-[#e2e2d5] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#3a5a40]" />
                    {email}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-[10px] text-[#8a8a7a] font-mono mb-4 italic flex items-center gap-1 font-bold">
                <AlertCircle className="w-3.5 h-3.5 mr-0.5 text-[#c25953]" />
                No co-witnesses registered yet. Be the first to verify!
              </div>
            )}

            {/* Email form to add endorsement */}
            <form onSubmit={handleRegisterWitness} className="flex gap-2">
              <input
                type="email"
                required
                value={witnessEmail}
                onChange={(e) => setWitnessEmail(e.target.value)}
                placeholder="Ex: resident@gandhinagar.com"
                className="flex-1 bg-white border border-[#e2e2d5] text-xs rounded-xl p-2.5 focus:border-[#3a5a40] outline-none text-[#2d332d]"
              />
              <button
                type="submit"
                className="bg-[#3a5a40] hover:bg-[#2f4934] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-2xs uppercase tracking-wider cursor-pointer"
              >
                Sign
              </button>
            </form>

            {witnessSuccess && (
              <p className="text-xs text-[#3a5a40] mt-2.5 font-mono font-bold animate-pulse">{witnessSuccess}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
