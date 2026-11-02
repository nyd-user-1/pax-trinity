// DEPRECATED (2026-11-02): the old address of the sends tick, kept answering because an external scheduler may
// still POST /api/fielding/tick in production. It is /api/sends/tick (lib/sends) under its old name; remove it
// once nothing calls it. This file and the stored row keys are the only places the old word stays.
export { POST } from "@/app/api/sends/tick/route"
export const dynamic = "force-dynamic"
