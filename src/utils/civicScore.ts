export interface Contribution {
  type: 'report' | 'cowitness' | 'escalation';
  ticketId: string;
  timestamp: number;
  points: number;
  severityBonus?: number;
}

export interface CivicTierInfo {
  name: string;
  isGold: boolean;
}

export function getCivicTierInfo(score: number): CivicTierInfo {
  if (score <= 2) {
    return { name: "Concerned Citizen", isGold: false };
  } else if (score <= 6) {
    return { name: "Active Reporter", isGold: false };
  } else if (score <= 14) {
    return { name: "Civic Champion", isGold: true };
  } else if (score <= 24) {
    return { name: "Ward Guardian", isGold: true };
  } else {
    return { name: "Community Sentinel", isGold: true };
  }
}

export function getWardImpactInfo(wardId: string): { name: string; population: string } {
  const defaultWards: Record<string, { name: string; population: string }> = {
    'ward_01': { name: 'Ward 1 — Sector 1-9', population: '38,000' },
    'ward_02': { name: 'Ward 2 — Sector 10-17', population: '35,000' },
    'ward_03': { name: 'Ward 3 — Sector 18-24', population: '31,000' },
    'ward_04': { name: 'Ward 4 — Sector 25-28', population: '28,000' },
    'ward_05': { name: 'Ward 5 — New Ranip', population: '42,000' },
    'ward_06': { name: 'Ward 6 — Chandkheda', population: '45,000' },
    'ward_07': { name: 'Ward 7 — Adalaj', population: '22,000' },
    'ward_08': { name: 'Ward 8 — Pethapur', population: '18,000' },
    'ward_09': { name: 'Ward 9 — Mansa', population: '29,000' }
  };
  return defaultWards[wardId] || { name: 'this ward', population: '30,000' };
}

export function getMilestoneText(milestoneId: string): string {
  switch (milestoneId) {
    case 'first_report':
      return "First complaint on record — you have started the accountability trail.";
    case 'first_cowitness':
      return "Co-witness registered — your report now strengthens an existing complaint.";
    case 'first_escalation':
      return "Your complaint has reached the Executive Engineer. The system is watching.";
    case 'reached_champion':
      return "Civic Champion status reached. Your contributions are on record.";
    default:
      return "";
  }
}

export function getAchievedMilestones(): string[] {
  if (typeof window === 'undefined') return [];
  const milestonesStr = localStorage.getItem("nagarmitra_milestones");
  try {
    const parsed = milestonesStr ? JSON.parse(milestonesStr) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function registerMilestone(milestoneId: string): boolean {
  if (typeof window === 'undefined') return false;
  const milestonesStr = localStorage.getItem("nagarmitra_milestones");
  let milestones: string[] = [];
  try {
    milestones = milestonesStr ? JSON.parse(milestonesStr) : [];
    if (!Array.isArray(milestones)) milestones = [];
  } catch {
    milestones = [];
  }

  if (milestones.includes(milestoneId)) {
    return false;
  }

  milestones.push(milestoneId);
  localStorage.setItem("nagarmitra_milestones", JSON.stringify(milestones));
  return true;
}

export function getJustUnlockedMilestone(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem("nagarmitra_just_unlocked");
}

export function clearJustUnlockedMilestone() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem("nagarmitra_just_unlocked");
}

export function addCivicPoints(type: 'report' | 'cowitness' | 'escalation', ticketId: string, severity?: number) {
  let points = 0;
  let severityBonus = 0;

  if (type === 'report') {
    points = 1;
    if (severity === 4) {
      severityBonus = 1;
    } else if (severity === 5) {
      severityBonus = 2;
    }
    points += severityBonus;
  } else if (type === 'cowitness') {
    points = 2;
  } else if (type === 'escalation') {
    points = 3;
  }

  if (points === 0) return;

  // 1. Update points
  const currentPointsStr = localStorage.getItem("nagarmitra_civic_score");
  const currentPoints = currentPointsStr ? parseInt(currentPointsStr, 10) : 0;
  const newPoints = currentPoints + points;
  localStorage.setItem("nagarmitra_civic_score", String(newPoints));

  // 2. Add contribution record
  const contribsStr = localStorage.getItem("nagarmitra_contributions");
  let contribs: Contribution[] = [];
  try {
    contribs = contribsStr ? JSON.parse(contribsStr) : [];
    if (!Array.isArray(contribs)) contribs = [];
  } catch {
    contribs = [];
  }

  // Prevent duplicate contribution records of the same type for the same ticketId to keep it robust
  const exists = contribs.some(c => c.type === type && c.ticketId === ticketId);
  if (!exists) {
    const newRecord: Contribution = {
      type,
      ticketId,
      timestamp: Date.now(),
      points,
      ...(severityBonus > 0 ? { severityBonus } : {})
    };

    contribs.unshift(newRecord); // Prepend to show most recent first
    localStorage.setItem("nagarmitra_contributions", JSON.stringify(contribs));
  }

  // 3. Register milestones
  let newlyUnlocked: string | null = null;
  if (type === 'report') {
    if (registerMilestone('first_report')) {
      newlyUnlocked = 'first_report';
    }
  } else if (type === 'cowitness') {
    if (registerMilestone('first_cowitness')) {
      newlyUnlocked = 'first_cowitness';
    }
  } else if (type === 'escalation') {
    if (registerMilestone('first_escalation')) {
      newlyUnlocked = 'first_escalation';
    }
  }

  if (newPoints >= 7) {
    if (registerMilestone('reached_champion')) {
      // Prioritize the champion milestone if achieved
      newlyUnlocked = 'reached_champion';
    }
  }

  if (newlyUnlocked) {
    localStorage.setItem("nagarmitra_just_unlocked", newlyUnlocked);
  } else {
    localStorage.removeItem("nagarmitra_just_unlocked");
  }
  
  // Custom event so that active screens can update in real-time if they want
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('nagarmitra_civic_score_updated'));
  }
}

export function getCivicScore(): number {
  if (typeof window === 'undefined') return 0;
  const currentPointsStr = localStorage.getItem("nagarmitra_civic_score");
  return currentPointsStr ? parseInt(currentPointsStr, 10) : 0;
}

export function getContributions(): Contribution[] {
  if (typeof window === 'undefined') return [];
  const contribsStr = localStorage.getItem("nagarmitra_contributions");
  try {
    const parsed = contribsStr ? JSON.parse(contribsStr) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
