// Demo upload gateway: keeps tiny files as data URLs. A real one returns object-storage keys behind signed URLs.

import { PlatformError } from "../errors.js";

export function createLocalUploadGateway() {
  let failing = false;
  const gw = {
    name: "local",
    willFail() { failing = true; return gw; },
    recover() { failing = false; return gw; },
    store(att) {
      if (failing) throw new PlatformError("UPSTREAM_UNAVAILABLE", "Upload service is unavailable.", { op: "upload" });
      return { storage_key: att.data || `demo://${att.file_name}`, scan_status: "skipped" };
    },
  };
  return gw;
}
