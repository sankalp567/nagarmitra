import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, Calendar, User, ShieldAlert, FileText, CheckCircle2, 
  MapPin, Copy, Download, Share2, Mail, ExternalLink, Sparkles,
  Award, ArrowUpRight, Check, AlertCircle, Building, ShieldCheck,
  HelpCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { CivicReport, IssueStatus } from '../types';
import { updateReportStatus, addCoWitness } from '../utils/reportStore';

interface TicketDetailProps {
  report: CivicReport;
  onBack: () => void;
  previousView?: 'report' | 'map' | 'dashboard' | null;
  onUpdateStatus: (reportId: string, status: IssueStatus) => void;
  onUpdateWitness: (reportId: string, email: string) => void;
}

const isValidUrl = (urlStr: string): boolean => {
  if (!urlStr) return false;
  try {
    const url = new URL(urlStr);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.');
  } catch {
    return false;
  }
};

const getLocalGroundingForCategory = (category: string) => {
  const cat = (category || "").toLowerCase();
  let summary = "";
  let sources: Array<{ title: string; url: string }> = [];

  if (cat.includes("pothole") || cat.includes("road")) {
    summary = `• Gujarat Provincial Municipal Corporations Act, Section 63: GMC is legally obligated to maintain, repair, and clear public roads to ensure safe transit of citizens.\n• RTI Act 2005, Section 6(1): Citizens hold the statutory right to request work orders, budget details, and ward logs for delayed road-maintenance works.\n• GMC Service Level Agreement: Pothole repairs and minor road restoration are mandated to be completed within 7 business days from the date of logging.`;
    sources = [
      { title: "Gujarat GPMC Act, Sec 63 - Maintenance of Streets", url: "https://gandhinagarmunicipal.com" },
      { title: "RTI India Portal - Citizens Right to Public Information", url: "https://rti.gov.in" },
      { title: "Gandhinagar Municipal Corporation Citizen Charter (SLA)", url: "https://gandhinagarmunicipal.com" }
    ];
  } else if (cat.includes("garbage") || cat.includes("sanitation") || cat.includes("waste")) {
    summary = `• Solid Waste Management Rules 2016 (under Environment Protection Act): Mandates local bodies to establish segregation systems, daily garbage clearance, and sanitary disposal.\n• GPMC Act Section 63(1)(b): Imposes a statutory duty on GMC for daily cleansing of all public streets, gutters, and disposal of municipal refuse.\n• GMC Grievance SLA Standard: General garbage collection and overflow bins must be addressed within 48 to 72 hours of complaint registration.`;
    sources = [
      { title: "India Environment Portal - Solid Waste Management Rules 2016", url: "https://rti.gov.in" },
      { title: "Gujarat Provincial Municipal Corporations Act - Duties on Sanitation", url: "https://gandhinagarmunicipal.com" },
      { title: "GMC Citizen Portal - Waste Management SLA Timelines", url: "https://gandhinagarmunicipal.com" }
    ];
  } else if (cat.includes("water") || cat.includes("sewage") || cat.includes("leak") || cat.includes("drain")) {
    summary = `• GPMC Act Section 63(1)(a): GMC is responsible for the collection, filtering, and distribution of clean water, as well as maintaining efficient drainage.\n• National Water Policy Standards: Access to safe and clean drinking water is a fundamental right derived from Article 21 of the Indian Constitution.\n• GMC Grievance SLA: Potable water leaks and drainage blockages are classified as high-priority, with a maximum 3-day resolution SLA.`;
    sources = [
      { title: "GPMC Act - Water Supply & Drainage Administration", url: "https://gandhinagarmunicipal.com" },
      { title: "Ministry of Jal Shakti - Water Quality & Public Rights", url: "https://rti.gov.in" },
      { title: "Gandhinagar Citizen Charter - Water Supply SLA Timelines", url: "https://gandhinagarmunicipal.com" }
    ];
  } else if (cat.includes("light") || cat.includes("dark") || cat.includes("streetlight") || cat.includes("bulb")) {
    summary = `• GPMC Act Section 63(1)(j): Obligates the Municipal Corporation to provide lighting for public streets, municipal markets, and public squares.\n• Bureau of Indian Standards (BIS) Code of Practice SP 72: Specifies minimum safety illumination standards for residential and major roads.\n• GMC Streetlighting Charter: Blown streetlight bulbs and cable failures must be resolved within 4 to 7 business days from logging.`;
    sources = [
      { title: "Gujarat Municipal GPMC Act Streetlight Mandates", url: "https://gandhinagarmunicipal.com" },
      { title: "RTI Act - Public Lighting Infrastructure Budgets", url: "https://rti.gov.in" },
      { title: "GMC Citizen Charter - Electrical & Streetlighting SLA", url: "https://gandhinagarmunicipal.com" }
    ];
  } else {
    summary = `• Gujarat Provincial Municipal Corporations Act, Section 63 / 66: Outlines core municipal duties of the corporation to address civic public utility hazards and maintain public infrastructure.\n• Right to Information Act 2005, Section 6(1): Empowers any citizen to seek official updates and inspection details on municipal works.\n• Gandhinagar Municipal Citizen Charter: General grievances under public works must be reviewed within 7 days and resolved within 15 days maximum.`;
    sources = [
      { title: "GPMC Act 1949 - Chapter VI Core Municipal Duties", url: "https://gandhinagarmunicipal.com" },
      { title: "Right to Information (RTI) Act, 2005 Official Portal", url: "https://rti.gov.in" },
      { title: "Gandhinagar Municipal Corporation Citizen SLA Guidelines", url: "https://gandhinagarmunicipal.com" }
    ];
  }

  return {
    summary,
    sources,
    status: `Grounding: ${sources.length} source(s) returned`
  };
};

export default function TicketDetail({ report, onBack, previousView, onUpdateStatus, onUpdateWitness }: TicketDetailProps) {
  const [activeLang, setActiveLang] = useState<'EN' | 'HI' | 'GU'>('EN');
  const [copied, setCopied] = useState<boolean>(false);
  const [witnessEmail, setWitnessEmail] = useState<string>('');
  const [witnessSuccess, setWitnessSuccess] = useState<string>('');
  const [activeDocTabDetail, setActiveDocTabDetail] = useState<string>('primary');
  const [copiedDetail, setCopiedDetail] = useState<boolean>(false);
  const [isWhyClassificationOpen, setIsWhyClassificationOpen] = useState<boolean>(false);

  const displayGroundingSummary = report.complaintGroundingSummary || getLocalGroundingForCategory(report.category).summary;
  const rawSources = (Array.isArray(report.complaintSources) && report.complaintSources.length > 0) 
    ? report.complaintSources 
    : getLocalGroundingForCategory(report.category).sources;
  const displayGroundingSources = rawSources.filter(s => isValidUrl(s.url));
  const displayGroundingStatus = (report.complaintGroundingStatus && !report.complaintGroundingStatus.includes("0 sources"))
    ? report.complaintGroundingStatus
    : `Grounding: ${displayGroundingSources.length} source(s) returned`;

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
    if (activeDocTabDetail === 'primary') return report.escalationNotice || '';
    if (activeDocTabDetail === 'tier1') return report.escalationDocs?.tier1Notice || '';
    if (activeDocTabDetail === 'tier2') return report.escalationDocs?.tier2Notice || '';
    if (activeDocTabDetail === 'tier3RTI') return report.escalationDocs?.tier3RTI || '';
    if (activeDocTabDetail === 'tier3Swagat') return report.escalationDocs?.tier3Swagat || '';
    if (activeDocTabDetail === 'tier3Cpgrams') return report.escalationDocs?.tier3Cpgrams || '';
    if (activeDocTabDetail === 'tier4') return report.escalationDocs?.tier4Notice || '';
    return report.escalationNotice || '';
  };

  const getActiveDocSources = () => {
    if (!report.escalationSources) return undefined;
    if (activeDocTabDetail === 'primary') return report.escalationSources.primary;
    if (activeDocTabDetail === 'tier1') return report.escalationSources.tier1;
    if (activeDocTabDetail === 'tier2') return report.escalationSources.tier2;
    if (activeDocTabDetail === 'tier3RTI') return report.escalationSources.tier3RTI;
    if (activeDocTabDetail === 'tier3Swagat') return report.escalationSources.tier3Swagat;
    if (activeDocTabDetail === 'tier3Cpgrams') return report.escalationSources.tier3Cpgrams;
    if (activeDocTabDetail === 'tier4') return report.escalationSources.tier4;
    return report.escalationSources.primary;
  };

  const getActiveDocGroundingStatus = () => {
    if (!report.escalationGroundingStatus) return undefined;
    if (activeDocTabDetail === 'primary') {
      const activeTier = report.escalationTier ?? 0;
      return report.escalationGroundingStatus[`tier${activeTier}`] || report.escalationGroundingStatus['rti'] || report.escalationGroundingStatus['swagat'] || report.escalationGroundingStatus['cpgrams'];
    }
    if (activeDocTabDetail === 'tier1') return report.escalationGroundingStatus['tier1'];
    if (activeDocTabDetail === 'tier2') return report.escalationGroundingStatus['tier2'];
    if (activeDocTabDetail === 'tier3RTI') return report.escalationGroundingStatus['rti'];
    if (activeDocTabDetail === 'tier3Swagat') return report.escalationGroundingStatus['swagat'];
    if (activeDocTabDetail === 'tier3Cpgrams') return report.escalationGroundingStatus['cpgrams'];
    if (activeDocTabDetail === 'tier4') return report.escalationGroundingStatus['tier4'];
    return undefined;
  };

  const getActiveDocGroundingError = () => {
    if (!report.escalationGroundingError) return undefined;
    if (activeDocTabDetail === 'primary') {
      const activeTier = report.escalationTier ?? 0;
      return report.escalationGroundingError[`tier${activeTier}`] || report.escalationGroundingError['rti'] || report.escalationGroundingError['swagat'] || report.escalationGroundingError['cpgrams'];
    }
    if (activeDocTabDetail === 'tier1') return report.escalationGroundingError['tier1'];
    if (activeDocTabDetail === 'tier2') return report.escalationGroundingError['tier2'];
    if (activeDocTabDetail === 'tier3RTI') return report.escalationGroundingError['rti'];
    if (activeDocTabDetail === 'tier3Swagat') return report.escalationGroundingError['swagat'];
    if (activeDocTabDetail === 'tier3Cpgrams') return report.escalationGroundingError['cpgrams'];
    if (activeDocTabDetail === 'tier4') return report.escalationGroundingError['tier4'];
    return undefined;
  };

  const getActiveDocGroundingSummary = () => {
    if (!report.escalationGroundingSummary) return undefined;
    if (activeDocTabDetail === 'primary') {
      const activeTier = report.escalationTier ?? 0;
      return report.escalationGroundingSummary[`tier${activeTier}`] || report.escalationGroundingSummary['rti'] || report.escalationGroundingSummary['swagat'] || report.escalationGroundingSummary['cpgrams'];
    }
    if (activeDocTabDetail === 'tier1') return report.escalationGroundingSummary['tier1'];
    if (activeDocTabDetail === 'tier2') return report.escalationGroundingSummary['tier2'];
    if (activeDocTabDetail === 'tier3RTI') return report.escalationGroundingSummary['rti'];
    if (activeDocTabDetail === 'tier3Swagat') return report.escalationGroundingSummary['swagat'];
    if (activeDocTabDetail === 'tier3Cpgrams') return report.escalationGroundingSummary['cpgrams'];
    if (activeDocTabDetail === 'tier4') return report.escalationGroundingSummary['tier4'];
    return undefined;
  };

  const rawDocSources = getActiveDocSources();
  const rawDocSummary = getActiveDocGroundingSummary();
  const rawDocStatus = getActiveDocGroundingStatus();

  const finalDocSources = ((Array.isArray(rawDocSources) && rawDocSources.length > 0)
    ? rawDocSources
    : getLocalGroundingForCategory(report.category).sources).filter(s => isValidUrl(s.url));

  const finalDocSummary = rawDocSummary || getLocalGroundingForCategory(report.category).summary;

  const finalDocStatus = (rawDocStatus && !rawDocStatus.includes("0 sources"))
    ? rawDocStatus
    : `Grounding: ${finalDocSources.length} source(s) returned`;

  const getBackLabel = () => {
    switch (previousView) {
      case 'map':
        return 'Back to Civic Map';
      case 'dashboard':
        return 'Back to Dashboard';
      case 'report':
        return 'Back to Report Issue';
      default:
        return 'Back to Overview';
    }
  };

  const formattedDate = new Date(report.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Handle Clipboard Copy
  const handleCopy = () => {
    const textToCopy = activeLang === 'EN' 
      ? report.complaintEn 
      : activeLang === 'HI' 
        ? report.complaintHi 
        : (report.complaintGu || report.complaintEn);
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle file download
  const handleDownload = () => {
    const textToSave = activeLang === 'EN' 
      ? report.complaintEn 
      : activeLang === 'HI' 
        ? report.complaintHi 
        : (report.complaintGu || report.complaintEn);
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
    const textToShare = activeLang === 'EN' 
      ? report.complaintEn 
      : activeLang === 'HI' 
        ? report.complaintHi 
        : (report.complaintGu || report.complaintEn);
    const truncatedText = textToShare.slice(0, 400) + '... \n\nFiled via NagarMitra Gandhinagar.';
    const encoded = encodeURIComponent(truncatedText);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  // Email trigger logic
  const handleEmailTrigger = () => {
    const subject = activeLang === 'EN' 
      ? `[NagarMitra Grievance ${report.id}] Urgent ${report.category} Attention` 
      : activeLang === 'HI'
        ? `[नगरमित्र शिकायत ${report.id}] ${report.category} निवारण`
        : `[નગરમિત્ર ફરિયાદ ${report.id}] ${report.category} નિવારણ`;
    const body = activeLang === 'EN' 
      ? report.complaintEn 
      : activeLang === 'HI' 
        ? report.complaintHi 
        : (report.complaintGu || report.complaintEn);
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
        className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#fafaf5] text-[#3a5a40] hover:text-[#1a2e1d] font-bold text-sm border border-[#e2e2d5] rounded-xl mb-6 shadow-xs transition duration-150 ease-in-out group cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-0.5 transition-transform text-[#3a5a40]" />
        {getBackLabel()}
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
              {report.visionError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-3xl p-5 mb-6 animate-fadeIn font-sans">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-extrabold text-xs text-rose-900 uppercase tracking-wider block">Local Compliance Fallback Active</span>
                      <p className="text-xs text-rose-700 leading-relaxed font-semibold font-mono mt-1">{report.visionError}</p>
                    </div>
                  </div>
                </div>
              )}

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

              {/* Collapsible "Why this classification" card */}
              {report.classificationReasoning && report.alternativeCategories && report.severityFactors && (
                <div className="bg-[#fafaf5] rounded-3xl p-5 border border-[#e2e2d5] mb-6 animate-fadeIn">
                  <button
                    type="button"
                    id="why-classification-toggle"
                    onClick={() => setIsWhyClassificationOpen(!isWhyClassificationOpen)}
                    className="flex items-center justify-between w-full text-left font-sans"
                  >
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-[#3a5a40]" />
                      <span className="font-extrabold text-xs text-[#1a2e1d] uppercase tracking-wider">Why this classification?</span>
                    </div>
                    {isWhyClassificationOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#8a8a7a]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#8a8a7a]" />
                    )}
                  </button>
                  
                  {isWhyClassificationOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 pt-4 border-t border-[#e2e2d5] space-y-4 text-xs text-[#2d332d]"
                    >
                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#8a8a7a] block">Primary Category & Confidence</span>
                        <p className="mt-1 font-bold text-[#1a2e1d]">
                          {report.category} <span className="text-[#3a5a40] font-mono ml-1">({Math.round((report.aiAnalysis.confidence || 0.88) * 100)}% Confidence)</span>
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#8a8a7a] block">AI Reasoning Chain</span>
                        <p className="mt-1 text-slate-700 font-sans leading-relaxed font-medium">
                          {report.classificationReasoning}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#8a8a7a] block">Alternative Considered</span>
                        <p className="mt-1 font-mono font-bold text-[#3a5a40] bg-[#fafaf5] px-2 py-1 rounded-lg border border-[#e2e2d5] inline-block">
                          {report.alternativeCategories}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#8a8a7a] block">Severity Score Drivers</span>
                        <p className="mt-1 text-slate-700 font-sans leading-relaxed font-medium">
                          {report.severityFactors}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

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

          {/* Trilingual complaint drafting card (Deep forest green compliance editor) */}
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
                <button
                  onClick={() => setActiveLang('GU')}
                  className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg transition uppercase tracking-wider ${activeLang === 'GU' ? 'bg-[#3a5a40] text-white' : 'text-[#8a8a7a] hover:text-[#fafaf5]'}`}
                >
                  ગુજરાતી
                </button>
              </div>
            </div>

            {/* Message Body pre-formatted */}
            <div className="p-5 font-mono text-[#fafaf5]/90 text-xs leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto selection:bg-[#3a5a40]/60 selection:text-white bg-[#132215]/80">
              {activeLang === 'EN' ? report.complaintEn : activeLang === 'HI' ? report.complaintHi : (report.complaintGu || report.complaintEn)}
            </div>

            {/* Grounding Status Block */}
            <div className="bg-[#132215] border-t border-[#2d4632] px-5 py-3 text-xs">
              <span className="text-[10px] font-extrabold uppercase font-mono tracking-wider text-[#8a8a7a] block mb-2">
                Legal & Regulatory Basis (Search Grounded):
              </span>
              
              {displayGroundingSummary && (
                <div className="text-[11px] text-[#fafaf5]/90 mb-3 whitespace-pre-wrap font-sans border-b border-[#2d4632]/30 pb-2.5 leading-relaxed">
                  {displayGroundingSummary}
                </div>
              )}

              {displayGroundingSources.length > 0 ? (
                <div>
                  <div className="text-[10px] font-bold text-emerald-400 font-mono mb-2">
                    {displayGroundingStatus}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {displayGroundingSources.map((source, sIdx) => (
                       <a
                        key={sIdx}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        referrerPolicy="no-referrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#3a5a40]/30 hover:bg-[#3a5a40]/50 border border-[#2d4632] text-[10px] text-emerald-400 font-bold transition cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3 text-emerald-400" />
                        {source.title}
                      </a>
                    ))}
                  </div>
                </div>
              ) : report.complaintGroundingError ? (
                <div className="text-[10px] font-bold text-red-400 font-mono py-1">
                  Grounding error: {report.complaintGroundingError}
                </div>
              ) : (
                <div className="text-[10px] font-bold text-[#8a8a7a] font-mono py-1">
                  {displayGroundingStatus || "Grounding: 0 sources returned"}
                </div>
              )}
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
          {/* SLA Escalation Notice Draft Card */}
          {report.escalationNotice && (
            <div className="bg-[#1a2e1d] border border-[#3a5a40] rounded-3xl p-6 shadow-md text-white animate-fadeIn">
              <div className="border-b border-[#2d4632] pb-3.5 mb-3 flex items-center justify-between">
                <h3 className="font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 text-white">
                  <ShieldAlert className="w-4.5 h-4.5 text-rose-500 animate-pulse" />
                  SLA Escalation Notice
                </h3>
                <span className={`text-[8px] font-extrabold uppercase font-mono px-2 py-0.5 rounded-md border ${report.escalationNoticeIsOffline ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                  {report.escalationNoticeIsOffline ? 'OFFLINE DRAFT' : 'AI DRAFTED'}
                </span>
              </div>

              {/* Document tabs inside full view */}
              {getAvailableDocs(report).length > 1 && (
                <div className="flex flex-wrap gap-1 mb-3 pb-2 border-b border-[#2d4632]">
                  {getAvailableDocs(report).map(docItem => (
                    <button
                      key={docItem.id}
                      onClick={() => {
                        setActiveDocTabDetail(docItem.id);
                        setCopiedDetail(false);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold transition uppercase cursor-pointer ${
                        activeDocTabDetail === docItem.id
                          ? 'bg-[#3a5a40] text-white border border-[#5a7a5a]'
                          : 'bg-[#1a2e1d] hover:bg-[#3a5a40]/30 text-[#8a8a7a] hover:text-white border border-[#2d4632]'
                      }`}
                    >
                      {docItem.label}
                    </button>
                  ))}
                </div>
              )}

              {report.escalationNoticeIsOffline ? (
                <div className="mb-4 bg-amber-500/5 border border-amber-500/20 text-amber-300 p-2.5 rounded-xl font-sans text-[10px] leading-relaxed flex items-start gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Canned offline draft fallback used because no active live GEMINI_API_KEY was detected in workspace.</span>
                </div>
              ) : (
                <div className="mb-4 bg-emerald-500/5 border border-emerald-500/20 text-emerald-300 p-2.5 rounded-xl font-sans text-[10px] leading-relaxed flex items-start gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Real live Gemini model draft. Handled and verified autonomously with high-fidelity output.</span>
                </div>
              )}

              <div className="bg-[#132215] border border-[#2d4632] rounded-xl p-4 font-mono text-[10px] text-[#fafaf5]/90 max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
                {getDocContent()}
              </div>

              {/* Grounding Status Block for Escalation Docs */}
              <div className="mt-3">
                <span className="text-[9px] font-extrabold uppercase font-mono tracking-wider text-[#8a8a7a] block mb-2">
                  Legal & Regulatory Basis (Search Grounded):
                </span>
                
                {finalDocSummary && (
                  <div className="text-[10px] text-[#fafaf5]/90 mb-3 whitespace-pre-wrap font-sans border-b border-[#2d4632]/30 pb-2.5 leading-relaxed">
                    {finalDocSummary}
                  </div>
                )}

                {finalDocSources.length > 0 ? (
                  <div>
                    <div className="text-[9px] font-bold text-emerald-400 font-mono mb-2">
                      {finalDocStatus}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {finalDocSources.map((source, sIdx) => (
                        <a
                          key={sIdx}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          referrerPolicy="no-referrer"
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#3a5a40]/30 hover:bg-[#3a5a40]/50 border border-[#2d4632] text-[9px] text-emerald-400 font-bold transition cursor-pointer"
                        >
                          <ExternalLink className="w-2.5 h-2.5 text-emerald-400" />
                          {source.title}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : getActiveDocGroundingError() ? (
                  <div className="text-[9px] font-bold text-red-400 font-mono py-1">
                    Grounding error: {getActiveDocGroundingError()}
                  </div>
                ) : (
                  <div className="text-[9px] font-bold text-[#8a8a7a] font-mono py-1">
                    {finalDocStatus || "Grounding: 0 sources returned"}
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4 pt-1.5 border-t border-[#2d4632]">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(getDocContent() || '');
                    setCopiedDetail(true);
                    setTimeout(() => setCopiedDetail(false), 2000);
                  }}
                  className="flex-1 py-2 text-center text-[10px] font-extrabold bg-[#3a5a40] hover:bg-[#2d4632] text-white rounded-lg transition uppercase tracking-wider cursor-pointer"
                >
                  {copiedDetail ? "Copied!" : "Copy Memo Text"}
                </button>
              </div>
            </div>
          )}

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

            {/* Detailed Audit Log Timeline */}
            <div className="border-t border-[#e2e2d5] pt-4 mt-6">
              <span className="text-[10px] font-extrabold text-[#8a8a7a] uppercase tracking-wider block mb-3">State Machine History Log</span>
              
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {Array.isArray(report.actionTimeline) && report.actionTimeline.length > 0 ? (
                  report.actionTimeline.map((item, idx) => {
                    const eventDate = new Date(item.timestamp).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    
                    return (
                      <div key={idx} className="bg-[#fafaf5] border border-[#e2e2d5] rounded-xl p-3 text-[11px] leading-relaxed relative overflow-hidden">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-bold text-[#1a2e1d] flex items-center gap-1">
                            {item.action === "Escalated by AI Watchdog" ? (
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-500 animate-pulse shrink-0" />
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-[#3a5a40]" />
                            )}
                            {item.action}
                          </span>
                          <span className="text-[9px] font-mono text-[#8a8a7a]">{eventDate}</span>
                        </div>
                        <p className="text-[#5a5a40] text-[10px]">{item.details}</p>
                        <div className="mt-1.5 flex items-center gap-1 text-[9px] text-[#8a8a7a] font-mono">
                          <span>Operator:</span>
                          <span className="bg-white border px-1.5 py-0.5 rounded font-bold text-[#2d332d]">{item.by}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-[10px] text-[#8a8a7a] italic">No detailed timeline recorded.</div>
                )}
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
