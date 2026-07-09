import * as db from './db';
import { t } from './i18n';
import { localDayKey } from './time';

const PROJECT_HOURS = [10, 25, 50, 100, 250, 500, 1000];
const BLOCK_COUNTS = [10, 25, 50, 100, 250, 500, 1000];
const STREAK_DAYS = [3, 7, 14, 30, 60, 100];

const SEED_KEY = '_seeded';
const LOOKBACK_DAYS = 400;
const DAY_MS = 24 * 60 * 60 * 1000;

interface Achievement {
  key: string;
  message: string;
}

function isoDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return localDayKey(d);
}

async function computeAchieved(dailyGoalHours: number): Promise<Achievement[]> {
  const achieved: Achievement[] = [];

  const projects = await db.getProjectBreakdown();
  for (const p of projects) {
    if (p.project === 'Sem projeto') continue;
    const hours = p.total_sec / 3600;
    for (const th of PROJECT_HOURS) {
      if (hours >= th) {
        achieved.push({
          key: `proj:${p.project}:${th}`,
          message: t('mile.proj', String(th), p.project),
        });
      }
    }
  }

  const blockCount = await db.getSessionCount();
  for (const th of BLOCK_COUNTS) {
    if (blockCount >= th) {
      achieved.push({ key: `blocks:${th}`, message: t('mile.blocks', String(th)) });
    }
  }

  const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * DAY_MS).toISOString();
  const daily = await db.getDailyTotals(sinceIso);
  const totalsByDate = new Map(daily.map((d) => [d.date, d.total_sec]));
  let streak = 0;
  for (let i = 0; i < LOOKBACK_DAYS; i++) {
    const sec = totalsByDate.get(isoDateNDaysAgo(i)) ?? 0;
    if (i === 0 && sec / 3600 < dailyGoalHours) continue;
    if (sec / 3600 >= dailyGoalHours) streak++;
    else break;
  }
  for (const th of STREAK_DAYS) {
    if (streak >= th) {
      achieved.push({ key: `streak:${th}`, message: t('mile.streak', String(th)) });
    }
  }

  return achieved;
}

/**
 * Records newly-crossed milestones and returns their messages.
 * First run ever seeds all already-achieved milestones silently so
 * pre-existing history doesn't fire a burst of stale notifications.
 */
export async function checkMilestones(dailyGoalHours: number): Promise<string[]> {
  const achieved = await computeAchieved(dailyGoalHours);
  const existing = new Set(await db.getMilestoneKeys());
  const seeded = existing.has(SEED_KEY);

  const fresh: string[] = [];
  for (const a of achieved) {
    if (existing.has(a.key)) continue;
    const inserted = await db.insertMilestone(a.key);
    if (inserted && seeded) fresh.push(a.message);
  }
  if (!seeded) await db.insertMilestone(SEED_KEY);
  return fresh;
}
