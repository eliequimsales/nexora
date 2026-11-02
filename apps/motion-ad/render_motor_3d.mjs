import puppeteer from 'puppeteer-core';
import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function renderVideo() {
  const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const htmlPath = path.resolve(__dirname, 'src', 'index_motor_3d.html');
  const outputDir = path.resolve(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const audioPath = path.resolve(outputDir, 'trilha_master_completa.mp3');
  const tempVideoPath = path.resolve(outputDir, 'temp_motor_3d_video.mp4');
  const finalOutputPath = path.resolve(outputDir, 'reel_motor_3d_nex.mp4');

  const FPS = 25;
  const DURATION_SECONDS = 51.6;
  const TOTAL_FRAMES = Math.floor(DURATION_SECONDS * FPS); // 1290 frames
  const WIDTH = 1080;
  const HEIGHT = 1920;

  console.log(`[Reel 3D Turbo Render - Framework Alvaric & Nex]`);
  console.log(`- Resolução: ${WIDTH}x${HEIGHT} (9:16 Vertical)`);
  console.log(`- Duração: ${DURATION_SECONDS}s (${TOTAL_FRAMES} frames a ${FPS} fps)`);
  console.log(`- Formato: Turbo MJPEG -> H.264 Pipe`);
  console.log(`- Trilha Master SFX + Narração: ${audioPath}`);
  console.log(`- Saída Final: ${finalOutputPath}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--hide-scrollbars',
      '--use-gl=angle',
      '--use-angle=d3d11',
      '--enable-webgl',
      `--window-size=${WIDTH},${HEIGHT}`
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });

  await page.evaluateOnNewDocument(() => {
    window.__PUPPETEER_CONTROLLER__ = true;
  });

  console.log(`[Render] Carregando cena 3D Three.js...`);
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  console.log(`[Render] Iniciando FFmpeg MJPEG pipe...`);
  const ffmpegArgs = [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-r', `${FPS}`,
    '-i', '-',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'veryfast',
    '-crf', '20',
    tempVideoPath
  ];

  const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
    stdio: ['pipe', 'inherit', 'inherit']
  });

  ffmpegProcess.on('error', (err) => {
    console.error('[FFmpeg Error]', err);
  });

  const startTime = Date.now();

  for (let frame = 0; frame < TOTAL_FRAMES; frame++) {
    const currentTime = frame / FPS;

    await page.evaluate((t) => {
      window.renderFrame(t);
    }, currentTime);

    const screenshotBuffer = await page.screenshot({
      type: 'jpeg',
      quality: 90
    });

    const canContinue = ffmpegProcess.stdin.write(screenshotBuffer);
    if (!canContinue) {
      await new Promise((resolve) => ffmpegProcess.stdin.once('drain', resolve));
    }

    if (frame % 75 === 0 || frame === TOTAL_FRAMES - 1) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const percent = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
      const fps = (frame / (elapsed > 0 ? elapsed : 1)).toFixed(1);
      console.log(`[Render Turbo] Frame ${frame}/${TOTAL_FRAMES} (${percent}%) - ${fps} fps - ${elapsed}s`);
    }
  }

  ffmpegProcess.stdin.end();

  await new Promise((resolve, reject) => {
    ffmpegProcess.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg falhou com código ${code}`));
    });
  });

  await browser.close();
  console.log(`[Render] Vídeo bruto compilado com sucesso.`);

  // Muxing com o Áudio Master
  console.log(`[Render] Mixando vídeo com a Trilha Sonora Master...`);
  const muxCmd = `ffmpeg -y -i "${tempVideoPath}" -i "${audioPath}" -c:v copy -c:a aac -b:a 192k -shortest "${finalOutputPath}"`;
  execSync(muxCmd, { stdio: 'inherit' });

  console.log(`\n=======================================================`);
  console.log(`🎬 REEL 3D RENDERIZADO COM SUCESSO!`);
  console.log(`📁 Arquivo: ${finalOutputPath}`);
  console.log(`=======================================================\n`);
}

renderVideo().catch((err) => {
  console.error('[Render Error]', err);
  process.exit(1);
});
