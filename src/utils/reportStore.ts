import { collection, getDocs, addDoc, doc, updateDoc, query, orderBy, arrayUnion } from 'firebase/firestore';
import { db, auth, ensureAnonymousAuth } from '../firebase';
import { CivicReport, IssueStatus, ActionTimelineEntry } from '../types';
import { INITIAL_REPORTS, getSvgDataUriForCategory } from '../data/mockData';

const STORAGE_KEY = 'nagarmitra_reports';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function isQuotaOrOfflineError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || error.code || error).toLowerCase();
  return (
    msg.includes("quota") || 
    msg.includes("exhausted") || 
    msg.includes("offline") || 
    msg.includes("permission-denied") ||
    msg.includes("permission denied") ||
    msg.includes("rate limit") ||
    msg.includes("unavailable")
  );
}

export function logStoreError(message: string, error: any) {
  if (isQuotaOrOfflineError(error)) {
    console.warn(`${message} (Quota or Offline Fallback):`, error?.message || error);
  } else {
    console.error(message, error);
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  if (isQuotaOrOfflineError(error)) {
    console.warn('Firestore Access Limited (quota or permission): ', JSON.stringify(errInfo));
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  throw new Error(JSON.stringify(errInfo));
}

// Sanitize reports to guarantee all required fields match client and Firestore constraints
export function sanitizeReport(data: any, fallbackId?: string): Omit<CivicReport, 'id'> {
  let referenceId = data.referenceId;
  if (!referenceId) {
    const seed = fallbackId || data.id || '';
    if (seed) {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
      }
      const stableNum = 100000 + (Math.abs(hash) % 900000);
      referenceId = `GMC-REF-${stableNum}`;
    } else {
      referenceId = `GMC-REF-${Math.floor(100000 + Math.random() * 900000)}`;
    }
  }

  let photoUrl = data.photoUrl || '';
  const category = data.category || 'Others';
  if (!photoUrl || (typeof photoUrl === 'string' && photoUrl.startsWith('http') && (photoUrl.includes('wikimedia.org') || photoUrl.includes('c8.alamy.com') || photoUrl.includes('alamy.com')))) {
    photoUrl = getSvgDataUriForCategory(category);
  }

  return {
    referenceId,
    photoUrl,
    geo: {
      lat: Number(data.geo?.lat) || 23.2156,
      lng: Number(data.geo?.lng) || 72.6369,
      ward: data.geo?.ward || 'ward_01',
      wardName: data.geo?.wardName || 'Ward 1'
    },
    category,
    severity: Number(data.severity) || 3,
    aiAnalysis: {
      description: data.aiAnalysis?.description || '',
      hazards: Array.isArray(data.aiAnalysis?.hazards) ? data.aiAnalysis.hazards : [],
      confidence: Number(data.aiAnalysis?.confidence) || 0.8
    },
    department: data.department || 'GMC General Administration Directorate',
    officer: data.officer || 'Dr. Ramesh Patel (Executive Engineer)',
    complaintEn: data.complaintEn || '',
    complaintHi: data.complaintHi || '',
    complaintGu: data.complaintGu || `પ્રતિ,\nવોર્ડ અધિકારીશ્રી,\n${data.department || 'GMC સામાન્ય વહીવટ વિભાગ'},\nગાંધીનગર મહાનગરપાલિકા (GMC),\nગુજરાત.\n\nવિષય: સત્તાવાર ફરિયાદ - ${data.category || 'નાગરિક સમસ્યા'}.\n\nઆદરણીય સાહેબ/મેડમ,\nઆ નાગરમિત્ર પ્લેટફોર્મ દ્વારા પ્રાપ્ત થયેલ નાગરિક અહેવાલ છે. સમસ્યા અંગે વિગતવાર સમીક્ષા કરવા અને તાત્કાલિક નિવારણ લાવવા વિનંતી.\n\nઆભાર સહ,\nગાંધીનગરના સ્થાનિક રહેવાસી.`,
    status: data.status || 'open',
    createdAt: Number(data.createdAt) || Date.now(),
    lastEscalatedAt: data.lastEscalatedAt !== undefined && data.lastEscalatedAt !== null ? Number(data.lastEscalatedAt) : null,
    coWitnesses: Array.isArray(data.coWitnesses) ? data.coWitnesses : [],
    embedding: Array.isArray(data.embedding) ? data.embedding : [],
    duplicateOf: data.duplicateOf !== undefined && data.duplicateOf !== null ? String(data.duplicateOf) : null,
    escalationTier: data.escalationTier !== undefined ? Number(data.escalationTier) : 0,
    nextDueDate: data.nextDueDate !== undefined ? Number(data.nextDueDate) : (Number(data.createdAt) || Date.now()) + 7 * 24 * 60 * 60 * 1000,
    escalationDocs: data.escalationDocs || {},
    ...(data.note ? { note: data.note } : {}),
    ...(data.escalationNotice ? { escalationNotice: String(data.escalationNotice) } : {}),
    ...(data.escalationNoticeIsOffline !== undefined ? { escalationNoticeIsOffline: Boolean(data.escalationNoticeIsOffline) } : {}),
    ...(data.complaintSources ? { complaintSources: data.complaintSources } : {}),
    ...(data.escalationSources ? { escalationSources: data.escalationSources } : {}),
    ...(data.classificationReasoning ? { classificationReasoning: String(data.classificationReasoning) } : {}),
    ...(data.alternativeCategories ? { alternativeCategories: String(data.alternativeCategories) } : {}),
    ...(data.severityFactors ? { severityFactors: String(data.severityFactors) } : {}),
    actionTimeline: Array.isArray(data.actionTimeline) && data.actionTimeline.length > 0 
      ? data.actionTimeline 
      : [{
          action: "Issue Lodged",
          timestamp: Number(data.createdAt) || Date.now(),
          by: "Citizen",
          details: `Civic report registered under ${data.category || 'Others'} in ${data.geo?.wardName || 'Ward Area'}.`
        }]
  };
}

// Load reports initialized with the static dataset if storage is empty.
export function getLocalReports(): CivicReport[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_REPORTS));
      return INITIAL_REPORTS;
    }
    const list = JSON.parse(data);
    return list.map((item: any) => ({
      ...sanitizeReport(item, item.id),
      id: item.id
    }));
  } catch (e) {
    console.error("Local storage read failure:", e);
    return INITIAL_REPORTS;
  }
}

export function saveLocalReports(reports: CivicReport[]) {
  try {
    // Sort by createdAt desc to prioritize the most recent reports
    const sorted = [...reports].sort((a, b) => b.createdAt - a.createdAt);
    
    // Limit to the latest 30 reports to keep localStorage footprint ultra-lightweight
    const limited = sorted.slice(0, 30);

    // Strip heavy photoUrl fields
    const lightweightReports = limited.map(r => ({
      ...r,
      photoUrl: ""
    }));

    // Clear the key first to prevent transient double-allocation quota issues
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweightReports));
  } catch (e) {
    console.warn("[reportStore] Local storage write failed, trying even smaller set (latest 10):", e);
    try {
      const ultraPruned = [...reports]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 10)
        .map(r => ({ ...r, photoUrl: "" }));
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ultraPruned));
    } catch (innerErr) {
      console.error("[reportStore] Severe local storage write failure even with 10 reports:", innerErr);
    }
  }
}

export async function fetchReports(): Promise<CivicReport[]> {
  if (!db) {
    console.log("Firebase not configured. Serving from local storage.");
    return getLocalReports();
  }

  try {
    const fetchPromise = (async () => {
      await ensureAnonymousAuth();
      const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
      return await getDocs(q);
    })();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Firestore fetch timeout (15s exceeded)")), 15000);
    });

    const querySnapshot = await Promise.race([fetchPromise, timeoutPromise]);

    const serverReports: CivicReport[] = [];
    
    querySnapshot.forEach((docSnap) => {
      const docData = docSnap.data();
      const sanitized = sanitizeReport(docData, docSnap.id);
      serverReports.push({
        id: docSnap.id,
        ...sanitized
      } as CivicReport);
    });

    if (serverReports.length > 0) {
      saveLocalReports(serverReports);
    }

    if (serverReports.length === 0) {
      // Seed Firestore if empty with some base examples
      console.log("Firestore reports collection empty. Seeding with default data.");
      const localReports = getLocalReports();
      try {
        const seedPromises = localReports.map(async (rep) => {
          const { id, ...cleanRep } = rep;
          const sanitized = sanitizeReport(cleanRep, rep.id);
          try {
            await addDoc(collection(db, 'reports'), sanitized);
          } catch (err: any) {
            if (err?.code === 'permission-denied' || err?.message?.includes('permission') || err?.message?.includes('Permission')) {
              handleFirestoreError(err, OperationType.CREATE, 'reports');
            }
            throw err;
          }
        });

        const seedTimeout = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Firestore seeding timed out (8s exceeded)")), 8000);
        });

        await Promise.race([Promise.all(seedPromises), seedTimeout]);
        console.log("Firestore database seeded successfully with mock data.");
        return fetchReports(); // Fetch again after successful seeding
      } catch (seedError) {
        console.warn("Firestore seeding failed or timed out, proceeding with local reports:", seedError);
        return localReports;
      }
    }

    return serverReports;
  } catch (error) {
    logStoreError("Failed to query Firestore reports. Falling back to local storage:", error);
    return getLocalReports();
  }
}

export async function createReport(reportData: Omit<CivicReport, 'id'>): Promise<CivicReport> {
  // Ensure anonymous auth beforehand
  try {
    const authPromise = ensureAnonymousAuth();
    const authTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Anonymous Auth timeout (10s exceeded)")), 10000);
    });
    await Promise.race([authPromise, authTimeout]);
  } catch (authError) {
    console.warn("Auth check timed out or failed, continuing report creation flow:", authError);
  }

  const sanitized = sanitizeReport(reportData);

  if (!db) {
    console.log("Saving report to local storage (Firebase Offline).");
    const local = getLocalReports();
    const newReport: CivicReport = {
      ...sanitized,
      id: 'rep_local_' + Math.random().toString(36).substr(2, 9)
    };
    local.unshift(newReport);
    saveLocalReports(local);
    return newReport;
  }

  try {
    let docRef;
    try {
      const createPromise = addDoc(collection(db, 'reports'), sanitized);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Firestore addDoc timeout (15s exceeded)")), 15000);
      });
      docRef = await Promise.race([createPromise, timeoutPromise]);
    } catch (error: any) {
      if (error?.code === 'permission-denied' || error?.message?.includes('permission') || error?.message?.includes('Permission')) {
        handleFirestoreError(error, OperationType.CREATE, 'reports');
      }
      throw error;
    }
    return {
      ...sanitized,
      id: docRef.id
    };
  } catch (error) {
    logStoreError("Firestore report submit failed. Saving locally as fallback:", error);
    const local = getLocalReports();
    const newReport: CivicReport = {
      ...sanitized,
      id: 'rep_local_' + Math.random().toString(36).substr(2, 9)
    };
    local.unshift(newReport);
    saveLocalReports(local);
    return newReport;
  }
}

export async function updateReportStatus(reportId: string, status: IssueStatus): Promise<boolean> {
  if (!db || reportId.startsWith('rep_local_')) {
    const local = getLocalReports();
    const index = local.findIndex(r => r.id === reportId);
    if (index !== -1) {
      local[index].status = status;
      if (status === 'escalated') {
        local[index].lastEscalatedAt = Date.now();
      }
      saveLocalReports(local);
      return true;
    }
    return false;
  }

  try {
    const docRef = doc(db, 'reports', reportId);
    const updates: Partial<CivicReport> = { status };
    if (status === 'escalated') {
      updates.lastEscalatedAt = Date.now();
    }
    try {
      await updateDoc(docRef, updates);
    } catch (error: any) {
      if (error?.code === 'permission-denied' || error?.message?.includes('permission') || error?.message?.includes('Permission')) {
        handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
      }
      throw error;
    }
    return true;
  } catch (error) {
    logStoreError("Firestore status modify failed. Attempting local edit:", error);
    const local = getLocalReports();
    const index = local.findIndex(r => r.id === reportId);
    if (index !== -1) {
      local[index].status = status;
      saveLocalReports(local);
      return true;
    }
    return false;
  }
}

export async function updateReportReasoning(
  reportId: string,
  reasoning: {
    classificationReasoning: string;
    alternativeCategories: string;
    severityFactors: string;
  }
): Promise<boolean> {
  const local = getLocalReports();
  const index = local.findIndex(r => r.id === reportId);
  if (index !== -1) {
    local[index].classificationReasoning = reasoning.classificationReasoning;
    local[index].alternativeCategories = reasoning.alternativeCategories;
    local[index].severityFactors = reasoning.severityFactors;
    saveLocalReports(local);
  }

  if (!db || reportId.startsWith('rep_')) {
    return index !== -1;
  }

  try {
    const docRef = doc(db, 'reports', reportId);
    await updateDoc(docRef, {
      classificationReasoning: reasoning.classificationReasoning,
      alternativeCategories: reasoning.alternativeCategories,
      severityFactors: reasoning.severityFactors
    });
    return true;
  } catch (error) {
    logStoreError("Firestore reasoning update failed:", error);
    return index !== -1;
  }
}

export async function addCoWitness(reportId: string, email: string): Promise<boolean> {
  const local = getLocalReports();
  const index = local.findIndex(r => r.id === reportId);
  if (index !== -1) {
    if (!local[index].coWitnesses.includes(email)) {
      local[index].coWitnesses.push(email);
      saveLocalReports(local);
    }
  }

  if (!db || reportId.startsWith('rep_local_')) {
    return index !== -1;
  }

  try {
    const docRef = doc(db, 'reports', reportId);
    try {
      await updateDoc(docRef, {
        coWitnesses: arrayUnion(email)
      });
    } catch (error: any) {
      if (error?.code === 'permission-denied' || error?.message?.includes('permission') || error?.message?.includes('Permission')) {
        handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
      }
      throw error;
    }
    return true;
  } catch (error) {
    logStoreError("Firestore witness attachment failed:", error);
    return index !== -1;
  }
}

export async function citizenEscalateReport(
  reportId: string,
  nextTier: number,
  nextOfficer: string,
  timelineEntry: ActionTimelineEntry
): Promise<boolean> {
  const local = getLocalReports();
  const index = local.findIndex(r => r.id === reportId);
  if (index !== -1) {
    local[index].status = 'Disputed' as IssueStatus;
    local[index].escalationTier = nextTier;
    local[index].officer = nextOfficer;
    if (!local[index].actionTimeline) {
      local[index].actionTimeline = [];
    }
    local[index].actionTimeline.push(timelineEntry);
    saveLocalReports(local);
  }

  if (!db || reportId.startsWith('rep_local_')) {
    return index !== -1;
  }

  try {
    const docRef = doc(db, 'reports', reportId);
    try {
      await updateDoc(docRef, {
        status: 'Disputed',
        escalationTier: nextTier,
        officer: nextOfficer,
        actionTimeline: arrayUnion(timelineEntry)
      });
    } catch (error: any) {
      if (error?.code === 'permission-denied' || error?.message?.includes('permission') || error?.message?.includes('Permission')) {
        handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
      }
      throw error;
    }
    return true;
  } catch (error) {
    logStoreError("Firestore citizen escalation failed:", error);
    return index !== -1;
  }
}

export async function confirmReportResolution(
  reportId: string,
  timelineEntry: ActionTimelineEntry
): Promise<boolean> {
  const local = getLocalReports();
  const index = local.findIndex(r => r.id === reportId);
  if (index !== -1) {
    local[index].status = 'confirmed-resolved' as IssueStatus;
    if (!local[index].actionTimeline) {
      local[index].actionTimeline = [];
    }
    local[index].actionTimeline.push(timelineEntry);
    saveLocalReports(local);
  }

  if (!db || reportId.startsWith('rep_local_')) {
    return index !== -1;
  }

  try {
    const docRef = doc(db, 'reports', reportId);
    try {
      await updateDoc(docRef, {
        status: 'confirmed-resolved',
        actionTimeline: arrayUnion(timelineEntry)
      });
    } catch (error: any) {
      if (error?.code === 'permission-denied' || error?.message?.includes('permission') || error?.message?.includes('Permission')) {
        handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
      }
      throw error;
    }
    return true;
  } catch (error) {
    logStoreError("Firestore confirm resolution failed:", error);
    return index !== -1;
  }
}



export function getOfficerForDeptAndTier(department: string, tier: number): string {
  const dept = (department || "").toLowerCase();
  
  if (tier === 0) {
    if (dept.includes("road") || dept.includes("engineering")) {
      return "Assistant Engineer (Roads & Engineering)";
    } else if (dept.includes("electrical") || dept.includes("light")) {
      return "Assistant Engineer (Electrical & Streetlights)";
    } else if (dept.includes("water") && !dept.includes("drainage") && !dept.includes("sewage")) {
      return "Assistant Engineer (Water Supply & Works)";
    } else if (dept.includes("solid") || dept.includes("waste") || dept.includes("sanitation") || dept.includes("garbage")) {
      return "Ward Sanitary Inspector (Sanitation)";
    } else if (dept.includes("drainage") || dept.includes("storm") || dept.includes("sewage")) {
      return "Assistant Engineer (Drainage & Sewerage)";
    } else {
      return "Assistant Ward Officer (Administration)";
    }
  }
  
  if (tier === 1) {
    if (dept.includes("road") || dept.includes("engineering")) {
      return "Executive Engineer, Roads & Engineering";
    } else if (dept.includes("electrical") || dept.includes("light")) {
      return "Superintendent Engineer, Electrical";
    } else if (dept.includes("water") && !dept.includes("drainage") && !dept.includes("sewage")) {
      return "Executive Engineer, Water Works";
    } else if (dept.includes("solid") || dept.includes("waste") || dept.includes("sanitation") || dept.includes("garbage")) {
      return "Executive Engineer, Solid Waste Management";
    } else if (dept.includes("drainage") || dept.includes("storm") || dept.includes("sewage")) {
      return "Executive Engineer, Drainage & Stormwater";
    } else {
      return "Executive Engineer, General Administration";
    }
  }
  
  if (tier === 2) {
    if (dept.includes("road") || dept.includes("engineering") || dept.includes("drainage") || dept.includes("storm")) {
      return "Deputy Municipal Commissioner, Engineering & Projects";
    } else if (dept.includes("solid") || dept.includes("waste") || dept.includes("sanitation") || dept.includes("garbage")) {
      return "Deputy Municipal Commissioner, Solid Waste Management";
    } else {
      return "Deputy Municipal Commissioner, Public Services & Health";
    }
  }
  
  if (tier === 3) {
    return "Public Information Officer (PIO) & DyMC";
  }
  
  // tier 4
  return "Municipal Commissioner, GMC";
}

// Client-side high-fidelity fallback stubs
export function getLocalOfflineEscalationStub(
  report: CivicReport,
  tier: number,
  docType: 'notice' | 'rti' | 'swagat' | 'cpgrams',
  now: number
): string {
  let tierDays = 7;
  if (tier === 2) tierDays = 14;
  else if (tier === 3) tierDays = 21;
  else if (tier === 4) tierDays = 28;

  const originalFilingDate = new Date(report.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const noticeDate = new Date(report.createdAt + tierDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const daysUnresolved = tierDays;

  const { id: ticketId, category, department, geo } = report;
  const wardName = geo?.wardName || "Gandhinagar Ward Area";
  const officer = getOfficerForDeptAndTier(department, tier - 1);

  if (tier === 1) {
    return `[OFFLINE COMPLIANCE WARNING - NO LIVE CONNECTION]

TO: Executive Engineer (Circle Level), GMC ${department}
FROM: NagarMitra Civic Desk, on behalf of the complainant
DATE: ${noticeDate}

SUBJECT: MANDATORY SLA BREACH ESCALATION NOTICE (TIER 1) - TICKET #${ticketId}

Respected Sir/Madam,

This is an automated compliance escalation notice dispatched because the registered civic ticket #${ticketId} under "${category}" in "${wardName}" has breached the municipal service delivery agreement of 7 days (unresolved for ${daysUnresolved} days since logged on ${originalFilingDate}).

Issue Parameters:
- Ticket ID: ${ticketId} (Use verbatim)
- Date Logged (Original Filing Date): ${originalFilingDate}
- Notice Date: ${noticeDate}
- Category: ${category}
- Current Status: OPEN (STALLED)
- Days Unresolved: ${daysUnresolved} Days
- Original Assigned Department: ${department}
- Original Assigned Officer: ${officer}

As the Executive Engineer of this circle, you are requested to immediately override the current stalled status, conduct an on-site inspection, and issue an expedited fast-track engineering work order immediately.

Respectfully submitted,
NagarMitra Civic Desk, on behalf of the complainant`;
  }

  if (tier === 2) {
    return `[OFFLINE COMPLIANCE WARNING - NO LIVE CONNECTION]

TO: Deputy Municipal Commissioner (DyMC), Gandhinagar Municipal Corporation (GMC)
FROM: NagarMitra Civic Desk, on behalf of the complainant
DATE: ${noticeDate}

SUBJECT: URGENT TIER 2 SLA BREACH ESCALATION NOTICE - TICKET #${ticketId}

Respected Sir/Madam,

This is to bring to your direct administrative attention a critical SLA breach that has persisted for ${daysUnresolved} days. Despite a Tier 1 escalation dispatched to the Executive Engineer on Day 7, no corrective action has been logged for Ticket #${ticketId} ("${category}") which was logged on ${originalFilingDate}.

Issue Parameters:
- Ticket ID: ${ticketId}
- Date Logged (Original Filing Date): ${originalFilingDate}
- Notice Date: ${noticeDate}
- Ward Area: ${wardName}
- Days Unresolved: ${daysUnresolved} Days (SLA: 7 Days)
- Department: ${department}
- Original Officer: ${officer}

We have officially notified the complainant of this Tier 2 SLA breach. Under the Gujarat Municipalities Act and GMC Citizen Charter standards, we demand your direct administrative intervention to hold the concerned department accountable and fast-track this pending work.

Respectfully submitted,
NagarMitra Civic Desk, on behalf of the complainant`;
  }

  if (tier === 3) {
    if (docType === 'rti') {
      return `[OFFLINE COMPLIANCE WARNING - NO LIVE CONNECTION]

FORM 'A'
RTI APPLICATION UNDER SECTION 6(1) AND SECTION 7(1) OF THE RTI ACT, 2005

TO:
The Public Information Officer (PIO)
Department: ${department}
Gandhinagar Municipal Corporation (GMC)

1. Name of the Applicant: NagarMitra Civic Desk, on behalf of the complainant
2. Address: Sector 11, Gandhinagar, Gujarat, India
3. Particulars of Information Sought under Section 6(1):
   a) Provide the names, designations, and daily progress logs of all ward officers and engineering staff assigned to inspect and resolve Ticket #${ticketId} ("${category}") which was filed on ${originalFilingDate} and is currently outstanding for ${daysUnresolved} days.
   b) Provide a certified copy of all file notings, correspondence, internal memos, and emails exchanged regarding this ticket since its inception.
   c) Under Section 7(1) of the RTI Act, if this delay compromises public safety or health (e.g., road hazards, open sewage), state the specific reasons for non-compliance with the 7-day municipal SLA.
   d) Provide details of any penal/disciplinary proceedings initiated against the negligent officer (${officer}) under GMC Service Conduct Rules.

4. Application Fee: Rs. 10/- paid via Indian Postal Order (IPO No: 45F 982148)
5. Whether the Applicant belongs to BPL category: No

Place: Gandhinagar
Date: ${noticeDate}

Signature of the Applicant
NagarMitra Civic Desk, on behalf of the complainant`;
    }

    if (docType === 'swagat') {
      return `[OFFLINE COMPLIANCE WARNING - NO LIVE CONNECTION]

PETITION TO SWAGAT 2.0 (STATE WIDE ATTENTION ON GRIEVANCES BY APPLICATION OF TECHNOLOGY)
Addressed to the Chief Minister's Secretariat, Government of Gujarat
Portal: swagat.gujarat.gov.in

Grievance Details:
- GMC Ticket ID: ${ticketId}
- Department: ${department}
- Target Ward: ${wardName}
- Duration of Negligence: ${daysUnresolved} Days
- Date Logged (Original Filing Date): ${originalFilingDate}
- Filing Date: ${noticeDate}

Respected Chief Minister's Grievance Cell,

We hereby submit this SWAGAT 2.0 petition against the Gandhinagar Municipal Corporation (GMC) for persistent failure to resolve a critical civic issue under category "${category}". The issue was logged via local grievance systems on ${originalFilingDate} but has been stalled for ${daysUnresolved} days.

Multiple escalations to the Executive Engineer and Deputy Municipal Commissioner have yielded no results, representing a breakdown of local grievance redressal. We request CM-level online review and direct instruction to the GMC Commissioner to resolve this public grievance immediately.

Respectfully submitted,
NagarMitra Civic Desk, on behalf of the complainant`;
    }

    // cpgrams
    return `[OFFLINE COMPLIANCE WARNING - NO LIVE CONNECTION]

COMPLAINT REGISTERED IN CENTRALIZED PUBLIC GRIEVANCE REDRESS AND MONITORING SYSTEM (CPGRAMS)
Department of Administrative Reforms and Public Grievances, Government of India
Portal: pgportal.gov.in

Grievance Parameters:
- Sector: Urban Development / Municipal Administration
- State: Gujarat
- Local Authority: Gandhinagar Municipal Corporation (GMC)
- Reference Ticket ID: ${ticketId}
- Delay Period: ${daysUnresolved} Days
- Date Logged (Original Filing Date): ${originalFilingDate}
- Filing Date: ${noticeDate}

Description of Grievance:
The complainant registered a civic grievance (Ticket ID: ${ticketId}) regarding "${category}" in Gandhinagar Ward "${wardName}". Despite clear guidelines under the National Urban Livelihoods/Municipal SLA Charters, the issue remains unresolved for ${daysUnresolved} days since it was logged on ${originalFilingDate}. This persistent delay is a severe violation of public service delivery standards. We request a central audit and monitoring intervention.

Respectfully submitted,
NagarMitra Civic Desk, on behalf of the complainant`;
  }

  // tier 4
  return `[OFFLINE COMPLIANCE WARNING - NO LIVE CONNECTION]

TO: The Municipal Commissioner, Gandhinagar Municipal Corporation (GMC)
FROM: NagarMitra Civic Desk, on behalf of the complainant
DATE: ${noticeDate}

SUBJECT: FINAL PRE-PROSECUTION SLA ADMINISTRATIVE NOTICE & INJUNCTION WARNING - TICKET #${ticketId}

Respected Sir,

This is a final administrative warning issued directly to your office. The civic ticket #${ticketId} ("${category}") was logged on ${originalFilingDate} and remains unresolved for an egregious ${daysUnresolved} days, breaching every reasonable standard of governance.

Prior compliance actions taken:
- Day 7: Escalate to Executive Engineer, Roads & Engineering
- Day 14: Escalate to Deputy Municipal Commissioner (DyMC)
- Day 21: Filed Formal RTI Application and parallel SWAGAT 2.0 and CPGRAMS portal complaints

Since the issue continues to remain stalled, we are preparing to file a formal writ petition in the High Court of Gujarat for public negligence and seeking disciplinary action against the responsible ward engineers. This is your final 7-day notice to resolve the issue before legal filings.

Respectfully submitted,
NagarMitra Civic Desk, on behalf of the complainant`;
}

export async function updateReportAfterWatchdogEscalation(
  reportId: string, 
  lastEscalatedAt: number, 
  escalationNotice: string, 
  escalationNoticeIsOffline: boolean,
  escalationTier: number,
  nextDueDate: number,
  officer: string,
  escalationDocs: any,
  actionTimelineEntries: ActionTimelineEntry[],
  escalationSources?: any,
  escalationGroundingStatus?: Record<string, string>,
  escalationGroundingError?: Record<string, string>,
  escalationGroundingSummary?: Record<string, string>
): Promise<boolean> {
  if (!db || reportId.startsWith('rep_local_')) {
    const local = getLocalReports();
    const index = local.findIndex(r => r.id === reportId);
    if (index !== -1) {
      local[index].status = 'escalated';
      local[index].lastEscalatedAt = lastEscalatedAt;
      local[index].escalationNotice = escalationNotice;
      local[index].escalationNoticeIsOffline = escalationNoticeIsOffline;
      local[index].escalationTier = escalationTier;
      local[index].nextDueDate = nextDueDate;
      local[index].officer = officer;
      local[index].escalationDocs = escalationDocs;
      if (escalationSources) {
        local[index].escalationSources = escalationSources;
      }
      if (escalationGroundingStatus) {
        local[index].escalationGroundingStatus = escalationGroundingStatus;
      }
      if (escalationGroundingError) {
        local[index].escalationGroundingError = escalationGroundingError;
      }
      if (escalationGroundingSummary) {
        local[index].escalationGroundingSummary = escalationGroundingSummary;
      }
      
      const timeline = local[index].actionTimeline || [];
      for (const entry of actionTimelineEntries) {
        if (!timeline.some(t => t.timestamp === entry.timestamp && t.action === entry.action)) {
          timeline.push(entry);
        }
      }
      local[index].actionTimeline = timeline;
      
      saveLocalReports(local);
      return true;
    }
    return false;
  }

  try {
    const docRef = doc(db, 'reports', reportId);
    try {
      const updatePayload: any = {
        status: 'escalated' as IssueStatus,
        lastEscalatedAt,
        escalationNotice,
        escalationNoticeIsOffline,
        escalationTier,
        nextDueDate,
        officer,
        escalationDocs,
        actionTimeline: arrayUnion(...actionTimelineEntries)
      };
      if (escalationSources) {
        updatePayload.escalationSources = escalationSources;
      }
      if (escalationGroundingStatus) {
        updatePayload.escalationGroundingStatus = escalationGroundingStatus;
      }
      if (escalationGroundingError) {
        updatePayload.escalationGroundingError = escalationGroundingError;
      }
      if (escalationGroundingSummary) {
        updatePayload.escalationGroundingSummary = escalationGroundingSummary;
      }
      await updateDoc(docRef, updatePayload);
    } catch (error: any) {
      if (error?.code === 'permission-denied' || error?.message?.includes('permission') || error?.message?.includes('Permission')) {
        handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
      }
      throw error;
    }
    return true;
  } catch (error) {
    logStoreError("Firestore watchdog status modify failed. Attempting local edit:", error);
    const local = getLocalReports();
    const index = local.findIndex(r => r.id === reportId);
    if (index !== -1) {
      local[index].status = 'escalated';
      local[index].lastEscalatedAt = lastEscalatedAt;
      local[index].escalationNotice = escalationNotice;
      local[index].escalationNoticeIsOffline = escalationNoticeIsOffline;
      local[index].escalationTier = escalationTier;
      local[index].nextDueDate = nextDueDate;
      local[index].officer = officer;
      local[index].escalationDocs = escalationDocs;
      if (escalationSources) {
        local[index].escalationSources = escalationSources;
      }
      if (escalationGroundingStatus) {
        local[index].escalationGroundingStatus = escalationGroundingStatus;
      }
      if (escalationGroundingError) {
        local[index].escalationGroundingError = escalationGroundingError;
      }
      if (escalationGroundingSummary) {
        local[index].escalationGroundingSummary = escalationGroundingSummary;
      }
      
      const timeline = local[index].actionTimeline || [];
      for (const entry of actionTimelineEntries) {
        if (!timeline.some(t => t.timestamp === entry.timestamp && t.action === entry.action)) {
          timeline.push(entry);
        }
      }
      local[index].actionTimeline = timeline;
      
      saveLocalReports(local);
      return true;
    }
    return false;
  }
}

export async function resetWatchdogDemoState(): Promise<boolean> {
  if (!db) {
    const local = getLocalReports();
    const updated = local.map(r => {
      if (r.status === 'escalated') {
        const cleanedTimeline = (r.actionTimeline || []).filter(t => t.by !== 'AI Watchdog');
        return {
          ...r,
          status: 'open' as IssueStatus,
          lastEscalatedAt: null,
          escalationNotice: undefined,
          escalationNoticeIsOffline: undefined,
          escalationTier: 0,
          nextDueDate: r.createdAt + 7 * 24 * 60 * 60 * 1000,
          officer: getOfficerForDeptAndTier(r.department, 0),
          escalationDocs: {},
          actionTimeline: cleanedTimeline
        };
      }
      return r;
    });
    saveLocalReports(updated);
    return true;
  }

  try {
    const q = query(collection(db, 'reports'));
    const querySnapshot = await getDocs(q);
    
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      if (data.status === 'escalated') {
        const docRef = doc(db, 'reports', docSnap.id);
        const cleanedTimeline = (data.actionTimeline || []).filter((t: any) => t.by !== 'AI Watchdog');
        await updateDoc(docRef, {
          status: 'open',
          lastEscalatedAt: null,
          escalationNotice: null,
          escalationNoticeIsOffline: null,
          escalationTier: 0,
          nextDueDate: Number(data.createdAt || Date.now()) + 7 * 24 * 60 * 60 * 1000,
          officer: getOfficerForDeptAndTier(data.department || '', 0),
          escalationDocs: {},
          actionTimeline: cleanedTimeline
        });
      }
    }
    return true;
  } catch (error) {
    logStoreError("Failed to reset Firestore demo state, falling back to local:", error);
    const local = getLocalReports();
    const updated = local.map(r => {
      if (r.status === 'escalated') {
        const cleanedTimeline = (r.actionTimeline || []).filter(t => t.by !== 'AI Watchdog');
        return {
          ...r,
          status: 'open' as IssueStatus,
          lastEscalatedAt: null,
          escalationNotice: undefined,
          escalationNoticeIsOffline: undefined,
          escalationTier: 0,
          nextDueDate: r.createdAt + 7 * 24 * 60 * 60 * 1000,
          officer: getOfficerForDeptAndTier(r.department, 0),
          escalationDocs: {},
          actionTimeline: cleanedTimeline
        };
      }
      return r;
    });
    saveLocalReports(updated);
    return true;
  }
}

export function isStalled(report: CivicReport, now: number): boolean {
  if (report.status === 'resolved') return false;
  
  const ageInDays = Math.floor((now - report.createdAt) / (24 * 60 * 60 * 1000));
  let targetTier = 0;
  if (ageInDays >= 28) {
    targetTier = 4;
  } else if (ageInDays >= 21) {
    targetTier = 3;
  } else if (ageInDays >= 14) {
    targetTier = 2;
  } else if (ageInDays >= 7) {
    targetTier = 1;
  }
  
  const currentTier = report.escalationTier ?? 0;
  return targetTier > currentTier;
}

export async function runEscalationWatchdog(now: number): Promise<{
  scannedCount: number;
  stalledCount: number;
  escalatedCount: number;
  escalatedTickets: CivicReport[];
}> {
  const allReports = await fetchReports();
  
  const stalledReports = allReports.filter(report => isStalled(report, now));
  
  // Sort stalled reports by severity (descending) so we prioritize most critical tickets first
  const sortedStalledReports = [...stalledReports].sort((a, b) => (b.severity || 0) - (a.severity || 0));
  
  // Escalate AT MOST the top 5 tickets per run
  const reportsToEscalate = sortedStalledReports.slice(0, 5);
  const escalatedTickets: CivicReport[] = [];

  for (const report of reportsToEscalate) {
    const ageInDays = Math.floor((now - report.createdAt) / (24 * 60 * 60 * 1000));
    let targetTier = 0;
    if (ageInDays >= 28) {
      targetTier = 4;
    } else if (ageInDays >= 21) {
      targetTier = 3;
    } else if (ageInDays >= 14) {
      targetTier = 2;
    } else if (ageInDays >= 7) {
      targetTier = 1;
    }

    const currentTier = report.escalationTier ?? 0;
    if (targetTier <= currentTier) continue;

    const docs: any = { ...(report.escalationDocs || {}) };
    const escalationSources: any = { ...(report.escalationSources || {}) };
    const escalationGroundingStatus: Record<string, string> = { ...(report.escalationGroundingStatus || {}) };
    const escalationGroundingError: Record<string, string> = { ...(report.escalationGroundingError || {}) };
    const escalationGroundingSummary: Record<string, string> = { ...(report.escalationGroundingSummary || {}) };
    const newTimelineEntries: ActionTimelineEntry[] = [];
    let latestNotice = '';
    let isAnyOffline = false;

    for (let t = currentTier + 1; t <= targetTier; t++) {
      let tierDays = 7;
      if (t === 2) tierDays = 14;
      else if (t === 3) tierDays = 21;
      else if (t === 4) tierDays = 28;

      const originalFilingDate = new Date(report.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const noticeDate = new Date(report.createdAt + tierDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const daysUnresolved = tierDays;
      const targetOfficer = getOfficerForDeptAndTier(report.department, t);

      let noticeForThisTier = '';
      let isOfflineForThisTier = false;

      if (t === 3) {
        // Fetch rti, swagat, cpgrams with 20s timeout
        const fetchDoc = async (docType: 'rti' | 'swagat' | 'cpgrams') => {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s per-call timeout
            
            const response = await fetch('/api/escalate-notice', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              signal: controller.signal,
              body: JSON.stringify({
                ticketId: report.id,
                currentDate: noticeDate,
                category: report.category,
                severity: report.severity,
                department: report.department,
                officer: targetOfficer,
                wardName: report.geo?.wardName || "Gandhinagar Ward Area",
                daysUnresolved,
                tier: 3,
                docType,
                originalFilingDate,
                noticeDate
              })
            });
            clearTimeout(timeoutId);
            if (response.ok) {
              const resJson = await response.json();
              if (resJson.sources) {
                if (docType === 'rti') escalationSources.tier3RTI = resJson.sources;
                else if (docType === 'swagat') escalationSources.tier3Swagat = resJson.sources;
                else if (docType === 'cpgrams') escalationSources.tier3Cpgrams = resJson.sources;
              }
              if (resJson.groundingStatus) {
                escalationGroundingStatus[docType] = resJson.groundingStatus;
              } else {
                escalationGroundingStatus[docType] = (resJson.sources && resJson.sources.length > 0)
                  ? `Grounding: ${resJson.sources.length} source(s) returned`
                  : "Grounding: 0 sources returned";
              }
              if (resJson.groundingError) {
                escalationGroundingError[docType] = resJson.groundingError;
              }
              if (resJson.groundingSummary) {
                escalationGroundingSummary[docType] = resJson.groundingSummary;
              }
              return { text: resJson.notice || '', isOffline: false };
            }
          } catch (err: any) {
            console.warn(`Failed fetching tier 3 ${docType}`, err);
            escalationGroundingError[docType] = err?.message || String(err);
          }
          return { text: getLocalOfflineEscalationStub(report, 3, docType, report.createdAt + tierDays * 24 * 60 * 60 * 1000), isOffline: true };
        };

        const [rtiRes, swagatRes, cpgramsRes] = await Promise.all([
          fetchDoc('rti'),
          fetchDoc('swagat'),
          fetchDoc('cpgrams')
        ]);

        docs.tier3RTI = rtiRes.text;
        docs.tier3Swagat = swagatRes.text;
        docs.tier3Cpgrams = cpgramsRes.text;
        isOfflineForThisTier = rtiRes.isOffline || swagatRes.isOffline || cpgramsRes.isOffline;
        noticeForThisTier = rtiRes.text; // Default display
      } else {
        // Single notice fetch (Tier 1, 2, or 4) with 20s timeout
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

          const response = await fetch('/api/escalate-notice', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            signal: controller.signal,
            body: JSON.stringify({
              ticketId: report.id,
              currentDate: noticeDate,
              category: report.category,
              severity: report.severity,
              department: report.department,
              officer: targetOfficer,
              wardName: report.geo?.wardName || "Gandhinagar Ward Area",
              daysUnresolved,
              tier: t,
              docType: 'notice',
              originalFilingDate,
              noticeDate
            })
          });
          clearTimeout(timeoutId);
          if (response.ok) {
            const resJson = await response.json();
            noticeForThisTier = resJson.notice || '';
            if (resJson.sources) {
              if (t === 1) escalationSources.tier1 = resJson.sources;
              else if (t === 2) escalationSources.tier2 = resJson.sources;
              else if (t === 4) escalationSources.tier4 = resJson.sources;
            }
            const key = `tier${t}`;
            if (resJson.groundingStatus) {
              escalationGroundingStatus[key] = resJson.groundingStatus;
            } else {
              escalationGroundingStatus[key] = (resJson.sources && resJson.sources.length > 0)
                ? `Grounding: ${resJson.sources.length} source(s) returned`
                : "Grounding: 0 sources returned";
            }
            if (resJson.groundingError) {
              escalationGroundingError[key] = resJson.groundingError;
            }
            if (resJson.groundingSummary) {
              escalationGroundingSummary[key] = resJson.groundingSummary;
            }
          } else {
            throw new Error("HTTP non-OK response");
          }
        } catch (err: any) {
          noticeForThisTier = getLocalOfflineEscalationStub(report, t, 'notice', report.createdAt + tierDays * 24 * 60 * 60 * 1000);
          isOfflineForThisTier = true;
          const key = `tier${t}`;
          escalationGroundingError[key] = err?.message || String(err);
        }

        if (t === 1) docs.tier1Notice = noticeForThisTier;
        if (t === 2) docs.tier2Notice = noticeForThisTier;
        if (t === 4) docs.tier4Notice = noticeForThisTier;
      }

      if (isOfflineForThisTier) {
        isAnyOffline = true;
      }

      if (t === targetTier) {
        latestNotice = noticeForThisTier;
        if (t === 1 && escalationSources.tier1) escalationSources.primary = escalationSources.tier1;
        else if (t === 2 && escalationSources.tier2) escalationSources.primary = escalationSources.tier2;
        else if (t === 3 && escalationSources.tier3RTI) escalationSources.primary = escalationSources.tier3RTI;
        else if (t === 4 && escalationSources.tier4) escalationSources.primary = escalationSources.tier4;
      }

      let tierName = '';
      let tierDetails = '';
      if (t === 1) {
        tierName = "Tier 1: Executive Engineer";
        tierDetails = `Ticket breached SLA of 7 days (unresolved for ${daysUnresolved} days since logged on ${originalFilingDate}). Auto-escalated to Executive Engineer. Firm compliance memo drafted by AI on ${noticeDate}.`;
      } else if (t === 2) {
        tierName = "Tier 2: Deputy Municipal Commissioner (DyMC)";
        tierDetails = `Ticket unresolved for ${daysUnresolved} days since logged on ${originalFilingDate}. Escalated to Deputy Municipal Commissioner (DyMC) and complainant formally notified on ${noticeDate}. Higher-tier compliance warning drafted by AI.`;
      } else if (t === 3) {
        tierName = "Tier 3: Statutory RTI & Portal filings";
        tierDetails = `Ticket unresolved for ${daysUnresolved} days since logged on ${originalFilingDate}. Auto-drafted a formal RTI Application (Sec 7(1)), and parallel SWAGAT 2.0 & CPGRAMS petition filings on ${noticeDate}.`;
      } else if (t === 4) {
        tierName = "Tier 4: Municipal Commissioner (Final warning)";
        tierDetails = `Ticket unresolved for an egregious ${daysUnresolved} days since logged on ${originalFilingDate}. Escalated to Municipal Commissioner with a final pre-prosecution legal summons draft on ${noticeDate}.`;
      }

      let decisionChain = '';
      if (t === 1) {
        decisionChain = `Observed: 7 days unresolved, status 'open' → SLA breached → drafted Executive Engineer escalation → self-checked notice against ticket data ✓`;
      } else if (t === 2) {
        decisionChain = `Observed: 14 days unresolved, status 'escalated' → Tier 1 ignored → drafted Deputy Municipal Commissioner (DyMC) escalation → self-checked notice against ticket data ✓`;
      } else if (t === 3) {
        decisionChain = `Observed: 21 days unresolved, status 'escalated' → Tier 2 ignored → drafted Statutory RTI & SWAGAT/CPGRAMS petitions → self-checked filings against ticket data ✓`;
      } else if (t === 4) {
        decisionChain = `Observed: 28 days unresolved, status 'escalated' → Tier 3 ignored → drafted Municipal Commissioner Final summons → self-checked summons against ticket data ✓`;
      }

      newTimelineEntries.push({
        action: `Escalated to ${tierName}`,
        timestamp: report.createdAt + tierDays * 24 * 60 * 60 * 1000,
        by: "AI Watchdog",
        details: `${tierDetails}\n\nDecision Chain: ${decisionChain}`
      });
    }

    const finalOfficer = getOfficerForDeptAndTier(report.department, targetTier);
    let nextDueDate = now + 7 * 24 * 60 * 60 * 1000; // Next tier due in 7 days
    if (targetTier === 4) {
      nextDueDate = now + 14 * 24 * 60 * 60 * 1000; // Final SLA
    }

    const success = await updateReportAfterWatchdogEscalation(
      report.id,
      now,
      latestNotice,
      isAnyOffline,
      targetTier,
      nextDueDate,
      finalOfficer,
      docs,
      newTimelineEntries,
      escalationSources,
      escalationGroundingStatus,
      escalationGroundingError,
      escalationGroundingSummary
    );

    if (success) {
      escalatedTickets.push({
        ...report,
        status: 'escalated',
        lastEscalatedAt: now,
        escalationNotice: latestNotice,
        escalationNoticeIsOffline: isAnyOffline,
        escalationTier: targetTier,
        nextDueDate,
        officer: finalOfficer,
        escalationDocs: docs,
        escalationSources,
        escalationGroundingStatus,
        escalationGroundingError,
        actionTimeline: [...(report.actionTimeline || []), ...newTimelineEntries]
      });
    }
  }

  return {
    scannedCount: allReports.length,
    stalledCount: stalledReports.length,
    escalatedCount: escalatedTickets.length,
    escalatedTickets
  };
}
