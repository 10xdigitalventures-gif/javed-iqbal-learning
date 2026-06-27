"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Flame, Star, Trophy, Award } from "lucide-react";
import { api } from "@/lib/api";
import { Card, Spinner, ErrorText } from "@/components/ui";
import { PageHeader } from "@/components/shell";

type Badge = {
  key: string;
  name: string;
  description: string;
  icon: string;
  metric: string;
  threshold: number;
  current: number;
  progress: number;
  earned: boolean;
  earnedAt: string | null;
};

type Profile = {
  points: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDay: string | null;
  stats: { lessons: number; courses: number; reviews: number };
  badges: Badge[];
  earnedCount: number;
  totalBadges: number;
};

type LeaderRow = {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  points: number;
  currentStreak: number;
  isMe: boolean;
};

type Leaderboard = { rows: LeaderRow[]; me: LeaderRow | null };

function localDay(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}

// Built as a helper (not an inline object) to keep the JSX simple.
function barWidth(progress: number): CSSProperties {
  return { width: Math.round(Math.min(1, Math.max(0, progress)) * 100) + "%" };
}

export default function AchievementsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Record a daily check-in (keeps the streak alive), then fall back to a
    // plain profile read if the check-in call fails. Non-fatal either way.
    api<Profile>("/gamification/checkin", { method: "POST", body: { day: localDay() } })
      .then(setProfile)
      .catch(() =>
        api<Profile>("/gamification/me")
          .then(setProfile)
          .catch((e) => setError(e.message)),
      );
    api<Leaderboard>("/gamification/leaderboard?limit=20")
      .then(setBoard)
      .catch(() => undefined);
  }, []);

  if (error) return <ErrorText message={error} />;
  if (!profile)
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );

  return (
    <div>
      <PageHeader
        title="Achievements"
        subtitle="Earn points, keep your streak, and unlock badges as you learn"
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="flex flex-col items-center justify-center py-6">
          <Star className="mb-2 h-6 w-6 text-amber-500" />
          <div className="text-2xl font-bold">{profile.points}</div>
          <div className="text-sm text-gray-500">Points</div>
        </Card>
        <Card className="flex flex-col items-center justify-center py-6">
          <Flame className="mb-2 h-6 w-6 text-orange-500" />
          <div className="text-2xl font-bold">{profile.currentStreak}</div>
          <div className="text-sm text-gray-500">Day streak</div>
        </Card>
        <Card className="flex flex-col items-center justify-center py-6">
          <Trophy className="mb-2 h-6 w-6 text-yellow-600" />
          <div className="text-2xl font-bold">{profile.longestStreak}</div>
          <div className="text-sm text-gray-500">Best streak</div>
        </Card>
        <Card className="flex flex-col items-center justify-center py-6">
          <Award className="mb-2 h-6 w-6 text-emerald-600" />
          <div className="text-2xl font-bold">
            {profile.earnedCount}/{profile.totalBadges}
          </div>
          <div className="text-sm text-gray-500">Badges</div>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Badges</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {profile.badges.map((b) => (
          <Card
            key={b.key}
            className={"flex flex-col items-center py-5 text-center " + (b.earned ? "" : "opacity-60")}
          >
            <div className={"mb-2 text-4xl " + (b.earned ? "" : "grayscale")} aria-hidden>
              {b.icon}
            </div>
            <div className="font-semibold">{b.name}</div>
            <div className="mt-1 text-xs text-gray-500">{b.description}</div>
            {b.earned ? (
              <div className="mt-2 text-xs font-medium text-emerald-600">Unlocked</div>
            ) : (
              <div className="mt-3 w-full">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full rounded-full bg-orange-500" style={barWidth(b.progress)} />
                </div>
                <div className="mt-1 text-[11px] text-gray-400">
                  {b.current}/{b.threshold}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Leaderboard</h2>
      <Card className="p-0">
        {!board || board.rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No rankings yet. Complete lessons to climb the board!
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {board.rows.map((r) => (
              <li
                key={r.userId}
                className={"flex items-center gap-3 px-4 py-3 " + (r.isMe ? "bg-orange-50" : "")}
              >
                <span className="w-6 text-center font-semibold text-gray-500">{r.rank}</span>
                {r.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600">
                    {r.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="flex-1 truncate font-medium">
                  {r.name}
                  {r.isMe ? <span className="ml-2 text-xs text-orange-600">(You)</span> : null}
                </span>
                <span className="flex items-center gap-1 text-sm text-gray-500">
                  <Flame className="h-3.5 w-3.5 text-orange-400" />
                  {r.currentStreak}
                </span>
                <span className="w-16 text-right font-semibold">{r.points}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {board && board.me && !board.rows.some((r) => r.isMe) ? (
        <Card className="mt-3 flex items-center gap-3 px-4 py-3">
          <span className="w-6 text-center font-semibold text-gray-500">{board.me.rank}</span>
          <span className="flex-1 font-medium">
            {board.me.name}
            <span className="ml-2 text-xs text-orange-600">(You)</span>
          </span>
          <span className="w-16 text-right font-semibold">{board.me.points}</span>
        </Card>
      ) : null}
    </div>
  );
}
