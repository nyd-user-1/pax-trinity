import type { ResultSet } from "./types"
import { MA_WAVE_1 } from "./ma-wave-1"
import { MA_WAVE_2 } from "./ma-wave-2"
import { COMPUTED } from "./computed"

export type * from "./types"
export { MA_WAVE_1, MA_WAVE_2 }

/** Every transcribed or computed result set, oldest study wave first. */
export const RESULT_SETS: ResultSet[] = [MA_WAVE_1, MA_WAVE_2, ...COMPUTED]
