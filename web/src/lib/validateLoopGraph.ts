export type GraphError = { code: string; message: string };

/**
 * Pure validation of a loop graph (agents + handoffs). Returns all problems found.
 * Used by the Loop Builder to block Save/Approve while invalid. The backend re-validates.
 */
export function validateLoopGraph(
  agents: string[],
  handoffs: Array<Record<string, string>>,
): GraphError[] {
  const errors: GraphError[] = [];
  if (agents.length === 0) {
    return [{ code: "EMPTY", message: "Add at least one agent." }];
  }

  const set = new Set(agents);
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const name of agents) {
    incoming.set(name, 0);
    outgoing.set(name, 0);
  }

  for (const h of handoffs) {
    const { from, to } = h;
    if (!from || !to) continue;
    if (!set.has(from) || !set.has(to)) {
      errors.push({
        code: "UNKNOWN_ENDPOINT",
        message: `Handoff references an unknown agent: ${!set.has(from) ? from : to}.`,
      });
      continue;
    }
    if (from === to) {
      errors.push({ code: "SELF_LOOP", message: `Agent "${from}" hands off to itself.` });
      continue;
    }
    outgoing.set(from, (outgoing.get(from) ?? 0) + 1);
    incoming.set(to, (incoming.get(to) ?? 0) + 1);
  }

  if (agents.length > 1) {
    const orphans = agents.filter(
      (a) => (incoming.get(a) ?? 0) === 0 && (outgoing.get(a) ?? 0) === 0,
    );
    for (const o of orphans) {
      errors.push({ code: "ORPHAN", message: `Agent "${o}" is not connected to the loop.` });
    }
  }

  const entries = agents.filter((a) => (incoming.get(a) ?? 0) === 0);
  if (entries.length === 0) {
    errors.push({ code: "NO_ENTRY", message: "No entry agent (every agent has an incoming handoff)." });
  }

  const terminals = agents.filter((a) => (outgoing.get(a) ?? 0) === 0);
  if (terminals.length === 0) {
    errors.push({
      code: "NO_TERMINAL",
      message: "No terminal agent (every agent hands off — the loop never ends).",
    });
  }

  return errors;
}
