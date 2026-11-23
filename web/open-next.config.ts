import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache binding yet (no R2/KV needed for the current screens).
export default defineCloudflareConfig();
