export type IssueStatus = 'open' | 'acknowledged' | 'escalated' | 'resolved';

export interface ActionTimelineEntry {
  action: string;
  timestamp: number;
  by: string;
  details?: string;
}

export interface Ward {
  id: string;
  name: string;
  representative: string;
}

export interface GeoLocation {
  lat: number;
  lng: number;
  ward: string;
  wardName: string;
}

export interface AIAnalysis {
  description: string;
  hazards: string[];
  confidence: number;
}

export interface CivicReport {
  id: string; // Document ID
  referenceId: string; // Human-readable stable reference ID
  photoUrl: string;
  geo: GeoLocation;
  category: string;
  severity: number; // 1 to 5
  aiAnalysis: AIAnalysis;
  department: string;
  officer: string;
  complaintEn: string;
  complaintHi: string;
  complaintGu?: string;
  status: IssueStatus;
  createdAt: number; // epoch ms
  lastEscalatedAt: number | null;
  coWitnesses: string[];
  embedding: number[];
  duplicateOf: string | null;
  note?: string; // Optional manual note
  escalationNotice?: string;
  escalationNoticeIsOffline?: boolean;
  escalationTier?: number; // 0 to 4
  nextDueDate?: number; // epoch ms
  escalationDocs?: {
    tier1Notice?: string;
    tier2Notice?: string;
    tier3RTI?: string;
    tier3Swagat?: string;
    tier3Cpgrams?: string;
    tier4Notice?: string;
  };
  actionTimeline?: ActionTimelineEntry[];
  complaintSources?: Array<{ title: string; url: string }>;
  escalationSources?: Record<string, Array<{ title: string; url: string }>>;
  complaintGroundingStatus?: string;
  complaintGroundingError?: string;
  complaintGroundingSummary?: string;
  escalationGroundingStatus?: Record<string, string>;
  escalationGroundingError?: Record<string, string>;
  escalationGroundingSummary?: Record<string, string>;
  classificationReasoning?: string;
  alternativeCategories?: string;
  severityFactors?: string;
  visionError?: string;
}

export interface StepActivity {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  detail: string;
  time?: string;
}

export const GANDHINAGAR_WARDS: Ward[] = [
  { id: 'ward_01', name: 'Ward 1 (Sectors 1-7)', representative: 'Dr. Ramesh Patel (Executive Engineer)' },
  { id: 'ward_02', name: 'Ward 2 (Sectors 8-14)', representative: 'Smt. Geetaben Solanki (Senior Inspector)' },
  { id: 'ward_03', name: 'Ward 3 (Sectors 15-21)', representative: 'Shri Amit Shah (Zonal Officer)' },
  { id: 'ward_04', name: 'Ward 4 (Sectors 22-30)', representative: 'Shri Vikram Rathore (Assistant Engineer)' },
  { id: 'ward_05', name: 'Ward 5 (Kudasan & Sargasan)', representative: 'Smt. Priya Sharma (Health Officer)' },
  { id: 'ward_06', name: 'Ward 6 (Infocity & Indroda)', representative: 'Shri Nilesh Mehta (IT & Sanitation Chief)' },
  { id: 'ward_07', name: 'Ward 7 (Pethapur & Randheja)', representative: 'Shri Haresh Bhagat (Roads Supervisor)' },
  { id: 'ward_08', name: 'Ward 8 (Vavol & Shalimar)', representative: 'Shri Sanjay Raval (Water Works)' },
  { id: 'ward_09', name: 'Ward 9 (Chiloda & Outskirts)', representative: 'Smt. Varsha Patel (Civic Inspector)' }
];

export const CATEGORIES = [
  'Potholes & Roads',
  'Garbage & Sanitation',
  'Water Supply & Sewage',
  'Streetlights',
  'Stray Animals & Safety',
  'Public Parks & Footpaths',
  'Traffic & Obstruction',
  'Others'
];
