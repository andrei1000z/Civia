/**
 * Civic badges based on user activity.
 * Calculated dynamically from DB counts — no stored score field needed.
 */

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  threshold: number; // minimum count to earn
}

export const BADGES = {
  sesizari: [
    { id: "first-sesizare", name: "Prima sesizare", icon: "🌱", description: "Ai depus prima sesizare", threshold: 1 },
    { id: "active-citizen", name: "Cetățean activ", icon: "🌿", description: "5 sesizări depuse", threshold: 5 },
    { id: "civic-leader", name: "Civic Leader", icon: "🌳", description: "20 sesizări depuse", threshold: 20 },
    { id: "hero-bucharest", name: "Hero București", icon: "🏆", description: "50 sesizări depuse", threshold: 50 },
  ],
  votes: [
    { id: "first-vote", name: "Prima voce", icon: "👍", description: "Ai votat prima sesizare", threshold: 1 },
    { id: "regular-voter", name: "Votant fidel", icon: "🗳️", description: "50 voturi date", threshold: 50 },
  ],
  comments: [
    { id: "first-comment", name: "Primul comentariu", icon: "💬", description: "Ai lăsat un comentariu", threshold: 1 },
    { id: "active-commenter", name: "Vocea comunității", icon: "📢", description: "20 comentarii", threshold: 20 },
  ],
  verifications: [
    { id: "first-verify", name: "Verificator", icon: "✅", description: "Ai verificat o rezolvare", threshold: 1 },
    { id: "trusted-verifier", name: "Verificator de încredere", icon: "🛡️", description: "10 verificări", threshold: 10 },
  ],
  resolved: [
    { id: "first-resolved", name: "Problemă rezolvată!", icon: "🎉", description: "O sesizare de-a ta a fost rezolvată", threshold: 1 },
    { id: "impact-maker", name: "Impact real", icon: "⭐", description: "5 sesizări rezolvate", threshold: 5 },
  ],
  // 2026-05-19: streak — zile consecutive cu cel putin o actiune civica
  // (sesizare, vot, comentariu, verificare). Anti-churn retention loop.
  streak: [
    { id: "streak-3", name: "Streak 3 zile", icon: "🔥", description: "3 zile consecutiv cu actiune civica", threshold: 3 },
    { id: "streak-7", name: "Streak o saptamana", icon: "🚀", description: "7 zile consecutiv activ", threshold: 7 },
    { id: "streak-30", name: "Streak o luna", icon: "💎", description: "30 zile consecutiv activ", threshold: 30 },
    { id: "streak-100", name: "Streak 100 zile", icon: "👑", description: "100 zile consecutiv — civic guardian", threshold: 100 },
  ],
};

export interface UserBadges {
  earned: { badge: Badge; count: number }[];
  next: { badge: Badge; current: number; remaining: number }[];
}

export function computeBadges(counts: {
  sesizari: number;
  votes: number;
  comments: number;
  verifications: number;
  resolved: number;
  streak?: number;
}): UserBadges {
  const earned: UserBadges["earned"] = [];
  const next: UserBadges["next"] = [];

  const checkCategory = (category: Badge[], count: number) => {
    for (const badge of category) {
      if (count >= badge.threshold) {
        earned.push({ badge, count });
      } else {
        next.push({ badge, current: count, remaining: badge.threshold - count });
        break; // only show next unearned badge per category
      }
    }
  };

  checkCategory(BADGES.sesizari, counts.sesizari);
  checkCategory(BADGES.votes, counts.votes);
  checkCategory(BADGES.comments, counts.comments);
  checkCategory(BADGES.verifications, counts.verifications);
  checkCategory(BADGES.resolved, counts.resolved);
  if (counts.streak !== undefined) checkCategory(BADGES.streak, counts.streak);

  return { earned, next };
}

/**
 * Calculeaza streak-ul de zile consecutive cu activitate civica.
 *
 * Input: array de timestamps (ISO strings) — actiuni ale userului.
 * Output: numarul de zile consecutive cu macar o actiune, terminand
 * azi sau ieri (daca azi nu are activitate, streak-ul nu se rupe inca).
 *
 * Folosit pe pagina /cont pentru a afisa „Streak: 7 zile" + badge.
 */
export function computeStreak(timestamps: string[]): number {
  if (timestamps.length === 0) return 0;

  // Convert la „zile" UTC (dd) ca sa nu fie sensibil la timezone.
  const days = new Set<string>();
  for (const t of timestamps) {
    try {
      const d = new Date(t);
      if (Number.isNaN(d.getTime())) continue;
      days.add(d.toISOString().slice(0, 10));
    } catch {
      // skip invalid
    }
  }
  if (days.size === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  // Daca nici azi nici ieri nu are activitate, streak-ul s-a rupt.
  if (!days.has(today) && !days.has(yesterday)) return 0;

  // Numara consecutiv de la today inapoi
  let streak = 0;
  // Start cu azi sau ieri (cel mai recent care are activitate).
  let cursor = days.has(today) ? today : yesterday;
  while (days.has(cursor)) {
    streak += 1;
    const prev = new Date(`${cursor}T00:00:00Z`);
    prev.setUTCDate(prev.getUTCDate() - 1);
    cursor = prev.toISOString().slice(0, 10);
  }
  return streak;
}
