// createPlatform(): wires the repository, gateways, clock and services into one facade.
// Framework-free ESM (no React, no DOM). Runs in the browser (localStorage) and under `node --test` (in-memory storage).

import { createLocalRepo } from "./adapters/local.js";
import { createClock, systemClock } from "./clock.js";
import { makeExec } from "./core.js";
import { SEED } from "./seed.js";
import { createMockPaymentGateway } from "./gateways/payment.mock.js";
import { createMockNotifyGateway } from "./gateways/notify.mock.js";
import { createLocalUploadGateway } from "./gateways/upload.local.js";
import { SYSTEM, can, assertCan, scopeFilter, inScope, fieldMask, applyMask, refundLimit, MATRIX, ROLES } from "./policy/permissions.js";
import { eligibility } from "./policy/cancellation.js";
import { ORDER_MACHINE, STATUS_OF, CUSTOMER_STATUSES } from "./machines/order.js";
import { PAYMENT_MACHINE } from "./machines/payment.js";
import { REFUND_MACHINE } from "./machines/refund.js";
import { TICKET_MACHINE } from "./machines/ticket.js";
import { ASSIGNMENT_MACHINE } from "./machines/assignment.js";
import { install as installInventory, checkInventory } from "./services/inventory.js";
import { install as installNotifications } from "./services/notifications.js";
import { install as installPayments } from "./services/payments.js";
import { install as installRefunds } from "./services/refunds.js";
import { install as installOrders } from "./services/orders.js";
import { install as installDelivery } from "./services/delivery.js";
import { install as installTickets } from "./services/tickets.js";
import { install as installAudit } from "./services/audit.js";
import { install as installAuth } from "./services/auth.js";
import { install as installCatalog } from "./services/catalog.js";
import { install as installJobs } from "./services/jobs.js";

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const merge = (base, over) => {
  if (!isObj(over)) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : v;
  return out;
};

/**
 * @param {object} [opts]
 * @param {{getItem,setItem,removeItem}} [opts.storage]  defaults to window.localStorage, else an in-memory Map
 * @param {object} [opts.clock]    { now(), iso(), advance(ms) }  defaults to the real clock; tests pass createClock()
 * @param {object} [opts.seed]     defaults to the bundled demo seed
 * @param {object} [opts.policies] overrides merged over seed policies
 * @param {object} [opts.gateways] { payment, notify, upload }  defaults to the mock gateways
 * @param {object} [opts.flags]    { autoDispatch?: boolean }
 */
export function createPlatform(opts = {}) {
  const clock = opts.clock || systemClock;
  const seed = opts.seed || SEED;
  const repo = createLocalRepo({ storage: opts.storage, seed, namespace: opts.namespace || "kn:v1", clock });
  const policies = merge(seed.policies, opts.policies);
  const gateways = { payment: createMockPaymentGateway(), notify: createMockNotifyGateway(), upload: createLocalUploadGateway(), ...(opts.gateways || {}) };
  const ctx = { repo, clock, policies, templates: seed.templates, gateways, flags: opts.flags || {}, secrets: { otp: "demo-otp-secret-not-secret" }, fn: {} };
  const exec = makeExec(ctx);

  const api = { repo, clock, policies, gateways, SYSTEM };
  api.inventory = installInventory(ctx, exec);
  api.notifications = installNotifications(ctx, exec);
  api.payments = installPayments(ctx, exec);
  ctx.fn.paymentsApi = api.payments;
  api.refunds = installRefunds(ctx, exec);
  api.orders = installOrders(ctx, exec);
  api.delivery = installDelivery(ctx, exec);
  api.tickets = installTickets(ctx, exec);
  api.audit = installAudit(ctx, exec);
  api.auth = installAuth(ctx, exec);
  api.catalog = installCatalog(ctx, exec);
  api.jobs = installJobs(ctx, exec, api);

  api.actor = (userId) => api.auth.actor(userId);
  api.can = can;
  api.assertCan = assertCan;
  api.scopeFilter = scopeFilter;
  api.inScope = inScope;
  api.fieldMask = fieldMask;
  api.applyMask = applyMask;
  api.refundLimit = (actor) => refundLimit(actor, policies);
  api.cancelEligibility = eligibility;
  api.checkInventory = (store_id) => repo.read((tx) => checkInventory(tx, store_id));
  api.subscribe = (cb) => repo.subscribe(cb);
  api.reset = () => repo.reset();
  api.machines = { order: ORDER_MACHINE, payment: PAYMENT_MACHINE, refund: REFUND_MACHINE, ticket: TICKET_MACHINE, assignment: ASSIGNMENT_MACHINE, STATUS_OF, CUSTOMER_STATUSES };
  api.MATRIX = MATRIX;
  api.ROLES = ROLES;
  return api;
}

export { createClock, systemClock, SEED };
export { PlatformError } from "./errors.js";
export { SYSTEM, can, assertCan } from "./policy/permissions.js";
export { createMockPaymentGateway } from "./gateways/payment.mock.js";
export { createMockNotifyGateway } from "./gateways/notify.mock.js";
export { createLocalUploadGateway } from "./gateways/upload.local.js";
export { createMemoryStorage } from "./adapters/local.js";
