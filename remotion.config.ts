import { Config } from "@remotion/cli/config";

// Rendu : H.264, qualité élevée, concurrence adaptée à la machine.
Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setCrf(20);
Config.setJpegQuality(85);
Config.setOverwriteOutput(true);
Config.setConcurrency(process.env.REMOTION_CONCURRENCY ? Number(process.env.REMOTION_CONCURRENCY) : null);

// Chrome : sur GitHub Actions Remotion télécharge le sien ; ailleurs on peut
// pointer un Chromium déjà installé (ex. /opt/pw-browsers/.../chrome).
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
Config.setChromiumOpenGlRenderer("angle");
