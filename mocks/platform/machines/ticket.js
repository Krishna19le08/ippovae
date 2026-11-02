import { defineMachine, step } from "./util.js";
export const TICKET_STATES = ["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "ESCALATED", "RESOLVED", "CLOSED"];
const SUPPORT = ["support_agent", "support_supervisor", "super_admin"];
const SUP = ["support_supervisor", "super_admin"];
export const TICKET_MACHINE = defineMachine("ticket", TICKET_STATES, {
  create: { from: null, to: "OPEN" },
  claim: { from: ["OPEN"], to: "IN_PROGRESS", actors: SUPPORT },
  assign: { from: ["OPEN", "IN_PROGRESS"], to: "IN_PROGRESS", actors: SUP },
  request_info: { from: ["IN_PROGRESS"], to: "WAITING_FOR_CUSTOMER", actors: SUPPORT },
  customer_reply: { from: ["WAITING_FOR_CUSTOMER"], to: "IN_PROGRESS", actors: ["customer"] },
  escalate: { from: ["OPEN", "IN_PROGRESS"], to: "ESCALATED", actors: [...SUPPORT, "system"] },
  take_escalation: { from: ["ESCALATED"], to: "IN_PROGRESS", actors: SUP },
  resolve: { from: ["IN_PROGRESS", "ESCALATED"], to: "RESOLVED", actors: SUPPORT },
  auto_close_waiting: { from: ["WAITING_FOR_CUSTOMER"], to: "CLOSED", actors: ["system"] },
  close: { from: ["RESOLVED", "OPEN"], to: "CLOSED", actors: ["customer", "system", ...SUPPORT] },
  reopen: { from: ["RESOLVED"], to: "IN_PROGRESS", actors: ["customer", ...SUP] },
});
export const nextTicketState = (s, e, roles) => step(TICKET_MACHINE, s, e, roles);
