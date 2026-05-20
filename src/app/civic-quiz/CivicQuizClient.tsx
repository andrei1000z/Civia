"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, ArrowRight, RefreshCw, Trophy, Share2 } from "lucide-react";
import { CIVIC_QUIZ, QUIZ_QUESTIONS_PER_ROUND, PASSING_SCORE, type QuizQuestion } from "@/data/civic-quiz";
import { playSound } from "@/lib/liquid-civic/sound";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function CivicQuizClient() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  // Init: pick 10 random questions
  useEffect(() => {
    setQuestions(shuffle(CIVIC_QUIZ).slice(0, QUIZ_QUESTIONS_PER_ROUND));
  }, []);

  const q = useMemo(() => questions[current], [questions, current]);

  if (questions.length === 0) {
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-8 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">Se incarca quiz-ul...</p>
      </div>
    );
  }

  const handleSelect = (idx: number) => {
    if (revealed) return;
    setSelected(idx);
  };

  const handleConfirm = () => {
    if (selected === null || !q) return;
    setRevealed(true);
    const correct = q.answers[selected]?.correct === true;
    if (correct) {
      setScore((s) => s + 1);
      playSound("success");
    } else {
      playSound("error");
    }
  };

  const handleNext = () => {
    if (current + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setCurrent((c) => c + 1);
    setSelected(null);
    setRevealed(false);
  };

  const handleRestart = () => {
    setQuestions(shuffle(CIVIC_QUIZ).slice(0, QUIZ_QUESTIONS_PER_ROUND));
    setCurrent(0);
    setSelected(null);
    setRevealed(false);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    const passed = score >= PASSING_SCORE;
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="max-w-xl mx-auto text-center py-8">
        <div className={`w-20 h-20 mx-auto rounded-full ${passed ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-amber-100 dark:bg-amber-900/30"} flex items-center justify-center mb-4`}>
          {passed ? (
            <Trophy size={36} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          ) : (
            <RefreshCw size={36} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
          )}
        </div>
        <h2 className="font-[family-name:var(--font-sora)] text-3xl font-bold mb-2 lc-text-gradient">
          {passed ? "Felicitari, cetatean informat!" : "Aproape!"}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-1">
          Scor: <strong className="text-2xl text-[var(--color-text)]">{score}/{questions.length}</strong> ({pct}%)
        </p>
        <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
          {passed
            ? "Esti in top 5% cetateni romani la cunostinte civice. 🏆"
            : `Mai exersezi un pic — ai nevoie de ${PASSING_SCORE}/${questions.length} pentru badge.`}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={handleRestart}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Reia quiz-ul
          </button>
          <Link
            href="/ghiduri"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-xs)] bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm font-semibold text-[var(--color-text)] hover:border-[var(--color-primary)]/40 transition-colors"
          >
            Vezi ghiduri detaliate
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
          {passed && (
            <button
              type="button"
              onClick={() => {
                if (navigator.share) {
                  navigator
                    .share({
                      title: "Sunt Cetatean Informat pe Civia.ro!",
                      text: `Am obtinut ${score}/${questions.length} la Civic Quiz. Testeaza-te si tu:`,
                      url: typeof window !== "undefined" ? window.location.origin + "/civic-quiz" : "https://civia.ro/civic-quiz",
                    })
                    .catch(() => { /* user cancelled */ });
                }
              }}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-xs)] bg-gradient-to-r from-[var(--civic-emerald-500)] to-[var(--civic-aqua-500)] text-white text-sm font-semibold hover:brightness-110 transition-all lc-shine"
            >
              <Share2 size={14} aria-hidden="true" />
              Distribuie scorul
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!q) return null;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mb-2">
          <span>Intrebare {current + 1} / {questions.length}</span>
          <span>Scor: <strong className="text-[var(--color-primary)]">{score}</strong></span>
        </div>
        <div className="h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--civic-emerald-500)] to-[var(--civic-aqua-500)] transition-all duration-300"
            style={{ width: `${((current + (revealed ? 1 : 0)) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="lc-glass-2 rounded-[var(--radius-lg)] p-6 mb-6">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] mb-3">
          {q.topic === "petitii" ? "📜 OG 27/2002"
            : q.topic === "info-publice" ? "🔓 Legea 544/2001"
            : q.topic === "gdpr" ? "🛡️ GDPR"
            : q.topic === "dezbatere" ? "💬 Legea 52/2003"
            : "🏛️ Constitutie"}
        </p>
        <h2 className="font-[family-name:var(--font-sora)] text-lg sm:text-xl font-bold mb-5 text-[var(--color-text)] leading-snug">
          {q.question}
        </h2>

        <div className="space-y-2 mb-4">
          {q.answers.map((a, i) => {
            const isSelected = selected === i;
            const isCorrect = a.correct === true;
            const showCorrect = revealed && isCorrect;
            const showWrong = revealed && isSelected && !isCorrect;
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(i)}
                disabled={revealed}
                className={`w-full text-left flex items-start gap-3 p-3 rounded-[var(--radius-md)] border transition-all ${
                  showCorrect
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                    : showWrong
                      ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                      : isSelected
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/40"
                } disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]`}
              >
                <span
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                    showCorrect
                      ? "border-emerald-500 bg-emerald-500"
                      : showWrong
                        ? "border-red-500 bg-red-500"
                        : isSelected
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
                          : "border-[var(--color-border)]"
                  }`}
                  aria-hidden="true"
                >
                  {showCorrect && <CheckCircle2 size={12} className="text-white" />}
                  {showWrong && <XCircle size={12} className="text-white" />}
                </span>
                <span className={`text-sm leading-snug ${
                  showCorrect ? "text-emerald-700 dark:text-emerald-300 font-medium"
                    : showWrong ? "text-red-700 dark:text-red-300"
                    : "text-[var(--color-text)]"
                }`}>
                  {a.text}
                </span>
              </button>
            );
          })}
        </div>

        {/* Explanation reveal */}
        {revealed && (
          <div className="mt-4 p-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] border border-[var(--color-border)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
              Explicatie
            </p>
            <p className="text-sm text-[var(--color-text)] leading-relaxed">
              {q.explanation}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        {!revealed ? (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selected === null}
            className="inline-flex items-center gap-2 h-12 px-6 rounded-[var(--radius-xs)] bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-primary)]"
          >
            Confirma raspuns
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-2 h-12 px-6 rounded-[var(--radius-xs)] bg-gradient-to-r from-[var(--civic-emerald-500)] to-[var(--civic-aqua-500)] text-white font-semibold hover:brightness-110 transition-all lc-shine focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
            autoFocus
          >
            {current + 1 >= questions.length ? "Vezi scor final" : "Urmatoarea"}
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
