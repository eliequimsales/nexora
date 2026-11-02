import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.resolve(__dirname, 'output');
const sfxDir = path.resolve(outputDir, 'sfx');

if (!fs.existsSync(sfxDir)) {
  fs.mkdirSync(sfxDir, { recursive: true });
}

console.log('[Sound Design] Sintetizando sound effects cinemáticos e da UI...');

// 1. Tic-tac (0.05s click)
execSync(`ffmpeg -y -f lavfi -i "sine=frequency=1800:duration=0.03" -af "afade=t=out:st=0.01:d=0.02,volume=0.4" "${path.join(sfxDir, 'tictac.wav')}"`, { stdio: 'ignore' });

// 2. Heartbeat (40Hz sub-bass pulse)
execSync(`ffmpeg -y -f lavfi -i "sine=frequency=48:duration=0.25" -af "afade=t=in:st=0:d=0.05,afade=t=out:st=0.1:d=0.15,volume=0.8" "${path.join(sfxDir, 'heartbeat.wav')}"`, { stdio: 'ignore' });

// 3. Screen ON (metal click + electrical hum)
execSync(`ffmpeg -y -f lavfi -i "sine=frequency=1200:duration=0.05" -f lavfi -i "sine=frequency=180:duration=0.15" -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1[a];[a]afade=t=out:st=0.12:d=0.08,volume=0.5" "${path.join(sfxDir, 'screen_on.wav')}"`, { stdio: 'ignore' });

// 4. WhatsApp Tri-tone (real classic 3-tone notification chime: 659Hz, 784Hz, 1046Hz)
execSync(`ffmpeg -y -f lavfi -i "sine=frequency=659:duration=0.08" -f lavfi -i "sine=frequency=784:duration=0.08" -f lavfi -i "sine=frequency=1046:duration=0.22" -filter_complex "[0:a][1:a][2:a]concat=n=3:v=0:a=1[a];[a]afade=t=out:st=0.28:d=0.1,volume=0.7" "${path.join(sfxDir, 'wa_tritone.wav')}"`, { stdio: 'ignore' });

// 5. Keyboard taps (light touch tap)
execSync(`ffmpeg -y -f lavfi -i "sine=frequency=2400:duration=0.02" -af "afade=t=out:st=0.005:d=0.015,volume=0.3" "${path.join(sfxDir, 'keyboard_tap.wav')}"`, { stdio: 'ignore' });

// 6. Message sent whoosh/pop (pitch 523Hz)
execSync(`ffmpeg -y -f lavfi -i "sine=frequency=523:duration=0.09" -af "afade=t=out:st=0.04:d=0.05,volume=0.5" "${path.join(sfxDir, 'msg_sent.wav')}"`, { stdio: 'ignore' });

// 7. Success chime (2 ascending notes: 784Hz -> 1174Hz)
execSync(`ffmpeg -y -f lavfi -i "sine=frequency=784:duration=0.09" -f lavfi -i "sine=frequency=1174:duration=0.3" -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1[a];[a]afade=t=out:st=0.25:d=0.14,volume=0.6" "${path.join(sfxDir, 'success_chime.wav')}"`, { stdio: 'ignore' });

// 8. Error buzzer (low harsh wave 120Hz)
execSync(`ffmpeg -y -f lavfi -i "sine=frequency=110:duration=0.22" -af "afade=t=out:st=0.16:d=0.06,volume=0.6" "${path.join(sfxDir, 'error_buzzer.wav')}"`, { stdio: 'ignore' });

// 9. Modern whoosh ascending (sweep)
execSync(`ffmpeg -y -f lavfi -i "sine=frequency=350:duration=0.25" -af "asetrate=44100*1.5,aresample=44100,afade=t=in:st=0:d=0.05,afade=t=out:st=0.15:d=0.1,volume=0.6" "${path.join(sfxDir, 'whoosh_up.wav')}"`, { stdio: 'ignore' });

// 10. Check tick (high clean tick 2200Hz)
execSync(`ffmpeg -y -f lavfi -i "sine=frequency=2200:duration=0.04" -af "afade=t=out:st=0.01:d=0.03,volume=0.45" "${path.join(sfxDir, 'check_tick.wav')}"`, { stdio: 'ignore' });

// 11. QR Scan laser beep (high sci-fi scanner chirp)
execSync(`ffmpeg -y -f lavfi -i "sine=frequency=1568:duration=0.07" -f lavfi -i "sine=frequency=2093:duration=0.12" -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1[a];[a]afade=t=out:st=0.14:d=0.05,volume=0.6" "${path.join(sfxDir, 'qr_scan.wav')}"`, { stdio: 'ignore' });

// 12. Cinematic Riser (sub-bass swell)
execSync(`ffmpeg -y -f lavfi -i "sine=frequency=60:duration=2.0" -af "afade=t=in:st=0:d=1.8,volume=0.5" "${path.join(sfxDir, 'cinematic_riser.wav')}"`, { stdio: 'ignore' });

// 13. Impact hit (sub-bass hit + low transient)
execSync(`ffmpeg -y -f lavfi -i "sine=frequency=55:duration=0.8" -af "afade=t=out:st=0.1:d=0.7,volume=0.7" "${path.join(sfxDir, 'impact_hit.wav')}"`, { stdio: 'ignore' });

// 14. Button Click (clean UI click)
execSync(`ffmpeg -y -f lavfi -i "sine=frequency=950:duration=0.04" -af "afade=t=out:st=0.01:d=0.03,volume=0.55" "${path.join(sfxDir, 'btn_click.wav')}"`, { stdio: 'ignore' });

// 15. Lo-Fi Ambient Minimalist Music Bed (atmospheric pulse bed 35.2s)
console.log('[Sound Design] Gerando trilha sonora Lo-Fi minimalista com sub-bass...');
execSync(`ffmpeg -y -f lavfi -i "sine=frequency=55:duration=35.2" -f lavfi -i "sine=frequency=110:duration=35.2" -filter_complex "[0:a]volume=0.18[b0];[1:a]volume=0.12[b1];[b0][b1]amix=inputs=2[bed];[bed]lowpass=f=250,afade=t=in:st=0:d=2.0,afade=t=out:st=33.5:d=1.7[bgm]" -map "[bgm]" "${path.join(sfxDir, 'bgm_bed.wav')}"`, { stdio: 'ignore' });

console.log('[Sound Design] Mixando SFX sincronizados na timeline oficial com a voz masterizada...');

// Timeline offsets (in ms):
// 0.0s: tictac 1 (300ms), 2 (1000ms), 3 (1700ms)
// 1.2s: heartbeat (1200ms)
// 3.0s: screen_on (3000ms)
// 5.2s: wa_tritone (5200ms)
// 6.8s: keyboard_tap (6800ms)
// 7.8s: msg_sent 1 (7800ms)
// 10.2s: msg_sent 2 (10200ms)
// 11.8s: success_chime (11800ms)
// 15.0s: error_buzzer (15000ms)
// 16.2s: whoosh_up (16200ms)
// 18.2s: check_tick 1 (18200ms)
// 19.4s: check_tick 2 (19400ms)
// 20.6s: check_tick 3 (20600ms)
// 23.8s: qr_scan (23800ms)
// 25.2s: success_chime 2 (25200ms)
// 28.0s: cinematic_riser (28000ms)
// 30.0s: impact_hit (30000ms)
// 32.2s: btn_click (32200ms)

const masterVoice = path.join(outputDir, 'voz_masterizada.mp3');
const mixedAudioOutput = path.join(outputDir, 'trilha_master_completa.mp3');

const complexFilter = [
  '[1:a]volume=0.25[bgm]',
  '[2:a]adelay=300|300[sfx01]',
  '[3:a]adelay=1200|1200[sfx02]',
  '[4:a]adelay=3000|3000[sfx03]',
  '[5:a]adelay=5200|5200[sfx04]',
  '[6:a]adelay=6800|6800[sfx05]',
  '[7:a]adelay=7800|7800[sfx06]',
  '[8:a]adelay=10200|10200[sfx07]',
  '[9:a]adelay=11800|11800[sfx08]',
  '[10:a]adelay=15000|15000[sfx09]',
  '[11:a]adelay=16200|16200[sfx10]',
  '[12:a]adelay=18200|18200[sfx11]',
  '[13:a]adelay=19400|19400[sfx12]',
  '[14:a]adelay=20600|20600[sfx13]',
  '[15:a]adelay=23800|23800[sfx14]',
  '[16:a]adelay=25200|25200[sfx15]',
  '[17:a]adelay=28000|28000[sfx16]',
  '[18:a]adelay=30000|30000[sfx17]',
  '[19:a]adelay=32200|32200[sfx18]',
  '[0:a][bgm][sfx01][sfx02][sfx03][sfx04][sfx05][sfx06][sfx07][sfx08][sfx09][sfx10][sfx11][sfx12][sfx13][sfx14][sfx15][sfx16][sfx17][sfx18]amix=inputs=20:duration=first:dropout_transition=2[aout]'
].join(';');

const ffmpegMixCmd = [
  'ffmpeg', '-y',
  '-i', `"${masterVoice}"`,
  '-i', `"${path.join(sfxDir, 'bgm_bed.wav')}"`,
  '-i', `"${path.join(sfxDir, 'tictac.wav')}"`,
  '-i', `"${path.join(sfxDir, 'heartbeat.wav')}"`,
  '-i', `"${path.join(sfxDir, 'screen_on.wav')}"`,
  '-i', `"${path.join(sfxDir, 'wa_tritone.wav')}"`,
  '-i', `"${path.join(sfxDir, 'keyboard_tap.wav')}"`,
  '-i', `"${path.join(sfxDir, 'msg_sent.wav')}"`,
  '-i', `"${path.join(sfxDir, 'msg_sent.wav')}"`,
  '-i', `"${path.join(sfxDir, 'success_chime.wav')}"`,
  '-i', `"${path.join(sfxDir, 'error_buzzer.wav')}"`,
  '-i', `"${path.join(sfxDir, 'whoosh_up.wav')}"`,
  '-i', `"${path.join(sfxDir, 'check_tick.wav')}"`,
  '-i', `"${path.join(sfxDir, 'check_tick.wav')}"`,
  '-i', `"${path.join(sfxDir, 'check_tick.wav')}"`,
  '-i', `"${path.join(sfxDir, 'qr_scan.wav')}"`,
  '-i', `"${path.join(sfxDir, 'success_chime.wav')}"`,
  '-i', `"${path.join(sfxDir, 'cinematic_riser.wav')}"`,
  '-i', `"${path.join(sfxDir, 'impact_hit.wav')}"`,
  '-i', `"${path.join(sfxDir, 'btn_click.wav')}"`,
  '-filter_complex', `"${complexFilter}"`,
  '-map', '"[aout]"',
  '-c:a', 'libmp3lame',
  '-b:a', '256k',
  `"${mixedAudioOutput}"`
].join(' ');

execSync(ffmpegMixCmd, { stdio: 'inherit' });
console.log(`[Sound Design] ✅ Áudio Master Completo gerado com sucesso em: ${mixedAudioOutput}`);
