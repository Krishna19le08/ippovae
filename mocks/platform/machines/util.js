import { PlatformError } from "../errors.js";

// A machine is { name, states, events: { [event]: { from: [...]|null, to, actors?: [...] } } }.
// from === null means "no current state" (creation). to === null means "state unchanged".
export function defineMachine(name, states, events) {
  return Object.freeze({ name, states, events });
}

export function allowedEvents(machine, state, actorRole) {
  return Object.entries(machine.events)
    .filter(([, e]) => e.from && e.from.includes(state) && (!actorRole || !e.actors || e.actors.includes(actorRole)))
    .map(([n]) => n);
}

// Pure: returns the next state or throws INVALID_TRANSITION (from-state) / FORBIDDEN (actor role).
export function step(machine, state, event, actorRoles = null) {
  const e = machine.events[event];
  if (!e) throw new PlatformError("INVALID_TRANSITION", `Unknown ${machine.name} event.`, { from: state, event, allowed_events: allowedEvents(machine, state) });
  const fromOk = state == null ? e.from === null : !!e.from && e.from.includes(state);
  if (!fromOk) {
    throw new PlatformError("INVALID_TRANSITION", `Event ${event} is not allowed from ${state}.`, { from: state, event, allowed_events: allowedEvents(machine, state) });
  }
  if (actorRoles && e.actors && !actorRoles.some((r) => e.actors.includes(r))) {
    throw new PlatformError("FORBIDDEN", `Your role cannot perform ${event}.`, { from: state, event, allowed_roles: e.actors });
  }
  return e.to === null ? state : e.to;
}
