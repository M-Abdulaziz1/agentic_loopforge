import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "../lib/cn";
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
  const current = session?.questions.find((q) => !answeredIds.has(q.id));

  async function sendAnswer(value: string) {
    if (!current || value.trim().length === 0) return;
    const res = await submit.mutateAsync({ question_id: current.id, answer: value });
    setAnswer("");
    if (res.loop_spec) navigate(`/specs/${res.loop_spec.id}`);
  }

  if (isLoading || !session) {
    return <div className="p-8 text-mut">Loading clarification…</div>;
  }

  const answerFor = (qid: string) =>
    session.answers.find((a) => a.question_id === qid)?.answer;
  const doneReqs = session.questions
    .filter((q) => answeredIds.has(q.id))
    .map((q) => q.missing_requirement);
  const pct = Math.round(session.clarity_score * 100);

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-7 py-4 text-sm text-mut">
        Goals / <b className="text-ink">Clarification</b>
        <span className="ml-auto rounded-full border border-[rgba(255,209,102,.35)] bg-[rgba(255,209,102,.15)] px-2.5 py-1 text-[11px] font-semibold text-[#ffe2a0]">
          {session.status === "ready"
            ? "ready"
            : `needs_clarification · ${session.questions.length - answeredIds.size} left`}
        </span>
      </div>

      <div className="grid flex-1 grid-cols-[1fr_340px] overflow-hidden">
        {/* chat */}
        <div className="flex min-h-0 flex-col border-r border-[var(--line)]">
          <div className="flex flex-1 flex-col gap-[18px] overflow-auto px-7 py-6">
            {session.questions.map((q) => (
              <div key={q.id} className="flex flex-col gap-[18px]">
                <Bubble who="maker">
                  <div className="mb-2 inline-block rounded-md border border-[rgba(255,209,102,.3)] bg-[rgba(255,209,102,.14)] px-1.5 py-px text-[10px] font-bold tracking-wide text-[#ffe2a0]">
                    CLARIFY · {q.missing_requirement.toUpperCase()}
                  </div>
                  <div className="font-semibold text-white">{q.question}</div>
                </Bubble>
                {answerFor(q.id) ? <Bubble who="user">{answerFor(q.id)}</Bubble> : null}
              </div>
            ))}
          </div>
          {current ? (
            <div className="border-t border-[var(--line)] px-7 py-4">
              {current.options.length > 0 ? (
                <div className="mb-3">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-mut">
                    Pick an answer
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {current.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        disabled={submit.isPending}
                        onClick={() => sendAnswer(opt)}
                        className="rounded-full border border-[rgba(184,166,255,.35)] bg-[var(--glass)] px-3.5 py-1.5 text-[13px] text-ink transition hover:border-[#cdbcff] hover:bg-[rgba(138,108,255,.16)] disabled:opacity-50"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="flex items-end gap-3">
                <textarea
                  aria-label="Answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder={
                    current.options.length > 0
                      ? "Or type your own answer…"
                      : "Answer the question…"
                  }
                  className="max-h-[120px] min-h-[48px] flex-1 resize-none rounded-xl border border-[var(--line2)] bg-white/[0.03] px-4 py-3 text-sm text-ink outline-none focus:border-[#cdbcff]"
                />
                <button
                  type="button"
                  onClick={() => sendAnswer(answer)}
                  disabled={submit.isPending || answer.trim().length === 0}
                  className="rounded-xl bg-gradient-to-br from-violet to-teal px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  Send ↵
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* requirements panel */}
        <div className="overflow-auto p-5">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-mut">
            Missing requirements
          </h3>
          <div className="mb-6 text-center">
            <div
              className="mx-auto mb-2.5 grid size-[120px] place-items-center rounded-full"
              style={{
                background: `conic-gradient(var(--teal) 0% ${pct}%, rgba(255,255,255,.08) ${pct}% 100%)`,
              }}
            >
              <div className="grid size-[98px] place-items-center rounded-full bg-[#0c0c20]">
                <span className="text-[28px] font-extrabold">
                  {pct}
                  <span className="text-[13px] font-semibold text-mut">%</span>
                </span>
              </div>
            </div>
            <div className="text-[13px] text-mut">clarity score</div>
          </div>
          {doneReqs.map((r) => (
            <Req key={r} kind="done" title={r} />
          ))}
          {session.missing_requirements.map((r, i) => (
            <Req key={r} kind={i === 0 ? "active" : "open"} title={r} />
          ))}
          <p className="mt-2 text-center text-xs leading-relaxed text-mut">
            When clarity is sufficient and no blocking gaps remain, LoopForge generates the
            loop spec for your review.
          </p>
        </div>
      </div>
    </div>
  );
}

function Bubble({ who, children }: { who: "maker" | "user"; children: React.ReactNode }) {
  return (
    <div className={cn("flex max-w-[78%] gap-3", who === "user" && "ml-auto flex-row-reverse")}>
      <div
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-[10px] text-sm",
          who === "maker"
            ? "bg-gradient-to-br from-violet to-teal"
            : "bg-[var(--glass2)] text-ink2",
        )}
      >
        {who === "maker" ? "◆" : "you"}
      </div>
      <div
        className={cn(
          "rounded-2xl border px-[15px] py-3 text-sm leading-relaxed",
          who === "maker"
            ? "rounded-tl-sm border-[var(--line)] bg-[var(--glass)] text-ink2"
            : "rounded-tr-sm border-[rgba(184,166,255,.35)] bg-gradient-to-br from-[rgba(138,108,255,.22)] to-[rgba(74,214,255,.12)] text-ink",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function Req({ kind, title }: { kind: "done" | "active" | "open"; title: string }) {
  return (
    <div
      className={cn(
        "mb-2.5 flex gap-3 rounded-xl border p-3",
        kind === "active"
          ? "border-[rgba(255,209,102,.4)] bg-[rgba(255,209,102,.07)]"
          : "border-[var(--line)] bg-[var(--glass)]",
      )}
    >
      <div
        className={cn(
          "mt-px grid size-5 shrink-0 place-items-center rounded-md text-xs",
          kind === "done" && "border border-[rgba(70,227,173,.5)] bg-[rgba(70,227,173,.25)] text-ok",
          kind === "active" && "border border-[rgba(255,209,102,.5)] text-warn",
          kind === "open" && "border border-[var(--line2)] bg-[var(--glass2)] text-mut",
        )}
      >
        {kind === "done" ? "✓" : kind === "active" ? "●" : "○"}
      </div>
      <b className="text-[13px]">{title}</b>
    </div>
  );
}
