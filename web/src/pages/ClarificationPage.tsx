import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Textarea } from "../components/ui/Field";
import { useClarification, useSubmitAnswer } from "../lib/api/clarification";

export function ClarificationPage() {
  const { goalId = "" } = useParams();
  const navigate = useNavigate();
  const { data: session, isLoading } = useClarification(goalId);
  const submit = useSubmitAnswer(goalId);
  const [answer, setAnswer] = useState("");

  const answeredIds = useMemo(
    () => new Set((session?.answers ?? []).map((a) => a.question_id)),
    [session],
  );

  if (isLoading || !session) {
    return <div className="p-8 text-mut">Loading clarification…</div>;
  }

  const questions = session.questions;
  const answeredQuestions = questions.filter((q) => answeredIds.has(q.id));
  const current = questions.find((q) => !answeredIds.has(q.id));
  const currentNumber = current
    ? questions.findIndex((q) => q.id === current.id) + 1
    : questions.length;
  const pct = Math.round(session.clarity_score * 100);
  const currentOptions = current?.options ?? [];
  const answerFor = (qid: string) =>
    session.answers.find((a) => a.question_id === qid)?.answer;

  async function sendAnswer(value: string) {
    if (!current || value.trim().length === 0) return;
    try {
      const res = await submit.mutateAsync({ question_id: current.id, answer: value });
      setAnswer("");
      if (res.loop_spec) navigate(`/specs/${res.loop_spec.id}`);
    } catch {
      // Surfaced below via submit.isError — no fake fallback.
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-7 py-4 text-sm text-mut">
        Goals / <b className="text-ink">Clarification</b>
        <span className="ml-auto rounded-full border border-[color-mix(in_srgb,var(--warn)_38%,var(--line))] bg-[color-mix(in_srgb,var(--warn)_15%,var(--surface))] px-2.5 py-1 text-[11px] font-semibold text-warn">
          {current
            ? `needs_clarification · ${questions.length - answeredQuestions.length} left`
            : "ready"}
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[640px] px-7 py-8">
          {/* progress */}
          <div className="mb-6 flex items-center gap-3 text-[13px] text-mut">
            <span>
              Question {Math.min(currentNumber, questions.length)} of {questions.length}
            </span>
            <span className="ml-auto inline-flex items-baseline gap-1 rounded-full border border-[var(--line2)] bg-[var(--glass)] px-3 py-1">
              <b className="text-ink">{pct}</b>
              <span className="text-[11px]">% clarity</span>
            </span>
          </div>

          {/* answered so far — compact */}
          {answeredQuestions.length > 0 ? (
            <div className="mb-5 space-y-2">
              {answeredQuestions.map((q) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-[var(--line)] bg-[var(--glass)] px-4 py-3"
                >
                  <div className="text-[12px] text-mut">{q.question}</div>
                  <div className="mt-1 flex items-center gap-2 text-[13.5px] text-ink">
                    <span aria-hidden className="text-ok">
                      ✓
                    </span>
                    {answerFor(q.id)}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* current question — one at a time */}
          {current ? (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6">
              <div className="mb-3 inline-block rounded-md border border-[color-mix(in_srgb,var(--warn)_32%,var(--line))] bg-[color-mix(in_srgb,var(--warn)_14%,var(--surface))] px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-warn">
                Clarify · {current.missing_requirement}
              </div>
              <h2 className="font-display text-[22px] leading-snug text-ink">
                {current.question}
              </h2>

              {currentOptions.length > 0 ? (
                <div className="mt-5 flex flex-col gap-2">
                  {currentOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      disabled={submit.isPending}
                      onClick={() => sendAnswer(opt)}
                      className="flex items-center gap-3 rounded-xl border border-[var(--line2)] bg-[var(--canvas-soft)] px-4 py-3 text-left text-[14px] text-ink transition hover:border-[var(--violet)] hover:bg-[color-mix(in_srgb,var(--violet)_11%,var(--surface))] disabled:opacity-50"
                    >
                      <span
                        aria-hidden
                        className="grid size-5 shrink-0 place-items-center rounded-full border border-[var(--line2)] text-[10px] text-mut"
                      >
                        ○
                      </span>
                      {opt}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-mut">
                  {currentOptions.length > 0 ? "Or type your own" : "Your answer"}
                </div>
                <div className="flex items-end gap-3">
                  <Textarea
                    aria-label="Answer"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type an answer…"
                    className="max-h-[120px] min-h-[48px] flex-1 resize-none"
                  />
                  <Button
                    size="lg"
                    onClick={() => sendAnswer(answer)}
                    disabled={answer.trim().length === 0}
                    loading={submit.isPending}
                  >
                    Send ↵
                  </Button>
                </div>
              </div>

              {submit.isError ? (
                <div className="mt-3 rounded-lg bg-[color-mix(in_srgb,var(--bad)_12%,var(--surface))] px-3 py-1.5 text-[12.5px] text-bad">
                  The LLM provider failed — check it in Settings and try again.
                </div>
              ) : null}
              {submit.isPending ? (
                <div className="mt-3 text-[12.5px] text-mut">Saving your answer…</div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-[color-mix(in_srgb,var(--ok)_32%,var(--line))] bg-[var(--glass)] p-6 text-center">
              <div className="text-[15px] font-bold text-ink">All questions answered</div>
              <p className="mt-1 text-[13px] text-mut">
                {submit.isError
                  ? "Spec generation failed — check your LLM provider in Settings, then re-answer to retry."
                  : "Generating your loop spec…"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
