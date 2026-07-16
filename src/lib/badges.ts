// Focus badges — lifetime focused hours milestones shown on profiles.

export interface Badge {
  hours: number;
  icon: string;
  labelPt: string;
  labelEn: string;
}

export const BADGES: Badge[] = [
  { hours: 0.5, icon: '🌱', labelPt: '30 minutos', labelEn: '30 minutes' },
  { hours: 1, icon: '⏱️', labelPt: '1 hora', labelEn: '1 hour' },
  { hours: 5, icon: '🔥', labelPt: '5 horas', labelEn: '5 hours' },
  { hours: 10, icon: '⚡', labelPt: '10 horas', labelEn: '10 hours' },
  { hours: 50, icon: '💪', labelPt: '50 horas', labelEn: '50 hours' },
  { hours: 100, icon: '🏆', labelPt: '100 horas', labelEn: '100 hours' },
  { hours: 500, icon: '💎', labelPt: '500 horas', labelEn: '500 hours' },
  { hours: 1000, icon: '👑', labelPt: '1.000 horas', labelEn: '1,000 hours' },
  { hours: 5000, icon: '🐐', labelPt: '5.000 horas', labelEn: '5,000 hours' },
];

export function unlockedBadges(totalSec: number): Badge[] {
  const h = totalSec / 3600;
  return BADGES.filter((b) => h >= b.hours);
}

export function nextBadge(totalSec: number): Badge | null {
  const h = totalSec / 3600;
  return BADGES.find((b) => h < b.hours) ?? null;
}
