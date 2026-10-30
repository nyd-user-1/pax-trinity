import { Config } from "@remotion/cli/config"

// Remotion Studio and the CLI (npm run video:studio): the entry is the video
// layer's registry root. Templates import only remotion, @remotion/*, react,
// zod and src/video's own files, so no webpack override is needed.
Config.setEntryPoint("src/video/index.ts")
Config.setVideoImageFormat("jpeg")
Config.setOverwriteOutput(true)
