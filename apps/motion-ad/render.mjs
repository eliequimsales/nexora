import puppeteer from 'puppeteer-core';
import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function renderVideo() {
  const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const htmlPath = path.resolve(__dirname, 'src', 'index.html');
  const outputDir = path.resolve(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const audioPath = path.resolve(outputDir, 'trilha_master_completa.mp3');
  const tempVideoPath = path.resolve(outputDir, 'temp_video_sublime.mp4');
  const finalOutputPath = path.resolve(outputDir, 'anuncio_motion_nexora_sublime.mp4');

  const FPS = 30;
  const DURATION_SECONDS = 35.2;
  const TOTAL_FRAMES = Math.floor(DURATION_SECONDS * FPS); // 1056 frames
  const WIDTH = 1080;
  const HEIGHT = 1920;

  console.log(`[Motion Render - Edição Sublime 3D]`);
  console.log(`- Resolução: ${WIDTH}x${HEIGHT} (9:16 Vertical)`);
  console.log(`- Duração: ${DURATION_SECONDS}s (${TOTAL_FRAMES} frames a ${FPS} fps)`);
  console.log(`- Trilha Master SFX + Lo-Fi: ${audioPath}`);
  console.log(`- Saída Final: ${finalOutputPath}`);

  console.log(`[Motion Render] Abrindo Chrome headless com aceleração WebGL/Canvas...`);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--hide-scrollbars',
      `--window-size=${WIDTH},${HEIGHT}`
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });

  await page.evaluateOnNewDocument(() => {
    window.__PUPPETEER_CONTROLLER__ = true;
  });

  console.log(`[Motion Render] Carregando cena 3D & texturas...`);
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  console.log(`[Motion Render] Iniciando FFmpeg pipe...`);
  const ffmpegArgs = [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'png',
    '-r', `${FPS}`,
    '-i', '-',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    '-crf', '18',
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
      type: 'png',
      omitBackground: false
    });

    const canContinue = ffmpegProcess.stdin.write(screenshotBuffer);
    if (!canContinue) {
      await new Promise((resolve) => ffmpegProcess.stdin.once('drain', resolve));
    }

    if (frame % 60 === 0 || frame === TOTAL_FRAMES - 1) {
      const percent = ((frame / TOTAL_FRAMES) * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[Progresso] Frame ${frame}/${TOTAL_FRAMES} (${percent}%) | Tempo: ${elapsed}s | Vídeo: ${currentTime.toFixed(1)}s`);
    }
  }

  console.log(`[Motion Render] Todos os quadros 3D processados. Fechando stream de vídeo...`);
  ffmpegProcess.stdin.end();

  await new Promise((resolve, reject) => {
    ffmpegProcess.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg video stream falhou com código ${code}`));
    });
  });

  await browser.close();

  console.log(`[Motion Render] Muxing do vídeo 3D com a Trilha Master (Voz + SFX + BGM)...`);
  const muxCmd = `ffmpeg -y -i "${tempVideoPath}" -i "${audioPath}" -c:v copy -c:a aac -b:a 256k -shortest "${finalOutputPath}"`;
  execSync(muxCmd, { stdio: 'inherit' });

  if (fs.existsSync(tempVideoPath)) {
    fs.unlinkSync(tempVideoPath);
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  const stats = fs.statSync(finalOutputPath);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`\n💎 VÍDEO SUBLIME 3D GERADO COM SUCESSO!`);
  console.log(`- Arquivo Final: ${finalOutputPath}`);
  console.log(`- Tamanho: ${sizeMb} MB`);
  console.log(`- Duração: ${DURATION_SECONDS}s`);
  console.log(`- Tempo Total de Render: ${totalDuration}s`);
}

renderVideo().catch((err) => {
  console.error('Falha na renderização:', err);
  process.exit(1);
});
