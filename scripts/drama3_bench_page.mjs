// A page per voice of a scripts/drama3_bench.mjs run: its table of variants (speed, pace, words heard otherwise)
// and one line said under every variant, the takes compressed to Opus and laid in the page, which stays under
// 512 KB so it opens on its own. Writes <run>/<voice>.html.
//   FFMPEG=<ffmpeg.exe> node scripts/drama3_bench_page.mjs films/voice/bench/<date> [line]
// The line is one of the run's twelve; by default the one whose baseline take lasts nearest 8 s.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const [run, asked] = process.argv.slice(2)
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg'
const report = JSON.parse(fs.readFileSync(path.join(run, 'results.json'), 'utf8'))
const LABELS = {
  base: ['Базовый', 'Q4_K_S, cuda_perf, temperature и top_p по умолчанию, seed 7, образец целиком'],
  q3: ['Q3_K_S', 'эксперты сжаты сильнее: 18,9 ГиБ вместо 22,9'],
  q2: ['Q2_K', 'сжатие ещё сильнее: 15,9 ГиБ'],
  perf_off: ['perf_mode off', 'без ускорения CUDA, та же модель Q4_K_S'],
  temp_07: ['temperature 0.7', 'спокойнее и предсказуемее'],
  temp_13: ['temperature 1.3', 'живее и рискованнее'],
  top_p_08: ['top_p 0.8', 'выбор только из самых вероятных звуков'],
  top_p_097: ['top_p 0.97', 'выбор почти из всех'],
  seed_11: ['seed 11', 'другая случайность, всё остальное как в базовом'],
  seed_23: ['seed 23', 'третья случайность'],
  sample_5: ['Образец 5 с', 'клон по первым ~5 с записи'],
  sample_10: ['Образец 10 с', 'клон по первым ~10 с записи'],
  tag_status: ['Тег по статусу', 'перед строкой тег подачи: факт ровно, математика терпеливо, гипотеза с азартом'],
  tag_skeptic: ['Тег «скептик»', 'перед каждой строкой [dry and amused, a little skeptical]']
}
const NAMES = { theo: 'Theo (английский)', ru: 'YouTube · QxkFrDTCKxg_3594f32f (русский)' }
const escape = text => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-page-'))
const opus = (file, kbps) => {
  const out = path.join(tmp, path.basename(file) + '.ogg')
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', file, '-ac', '1', '-c:a', 'libopus', '-b:a', `${kbps}k`, '-application', 'voip', out])
  return fs.readFileSync(out).toString('base64')
}

for (const voice of Object.keys(NAMES)) {
  const takes = report.takes.filter(take => take.voice === voice)
  const base = takes.filter(take => take.variant === 'base' && take.speech)
  const line = asked ?? base.sort((a, b) => Math.abs(a.speech - 8) - Math.abs(b.speech - 8))[0]?.line
  const rows = report.summary.filter(row => row.voice === voice)
  const best = key => Math.min(...rows.map(row => row[key]).filter(value => value !== null))
  // The bitrate that keeps every take of the line in 512 KB with room for the table
  const seconds = takes.filter(take => take.line === line && take.speech).reduce((sum, take) => sum + take.speech, 0)
  const kbps = Math.max(12, Math.min(32, Math.floor(400 * 1024 * 8 / 1.34 / seconds / 1000)))
  const said = takes.find(take => take.line === line && take.variant === 'base')
  let html = `<!doctype html>
<html lang="ru"><meta charset="utf-8">
<style>
body { font-family: var(--font-sans); }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid var(--border); vertical-align: middle; }
th { color: var(--muted-foreground); font-weight: 500; }
td.n { font-family: var(--font-mono); text-align: right; white-space: nowrap; }
td.good { color: var(--success); }
td.bad { color: var(--destructive); }
small { color: var(--muted-foreground); }
audio { width: 230px; height: 32px; }
p { margin: 6px 0 12px; font-size: 13px; }
</style>
<p><b>${escape(NAMES[voice])}</b> — строка «${escape(line)}», как её услышало распознавание в базовом варианте: <i>${escape(said?.heard ?? '')}</i></p>
<table><tr><th>Вариант</th><th>Плеер</th><th>Работа на 1 с речи</th><th>Слов в минуту</th><th>Слов услышано иначе</th><th>Самая длинная пауза</th></tr>
`
  for (const row of rows) {
    const take = takes.find(each => each.variant === row.variant && each.line === line)
    const file = path.join(run, voice, row.variant, `${line}.wav`)
    const player = take?.speech && fs.existsSync(file) ? `<audio controls preload="none" src="data:audio/ogg;base64,${opus(file, kbps)}"></audio>` : '<small>нет дубля</small>'
    const mark = (key, value) => value === null ? '' : value === best(key) ? ' good' : ''
    html += `<tr><td>${escape(LABELS[row.variant][0])}<br><small>${escape(LABELS[row.variant][1])}</small></td><td>${player}</td>` +
      `<td class="n${mark('workPerSecond', row.workPerSecond)}">${row.workPerSecond ?? '—'} с</td><td class="n">${row.wordsPerMinute ?? '—'}</td>` +
      `<td class="n">${row.realOff}</td><td class="n${row.longestPause > 1 ? ' bad' : ''}">${row.longestPause} с</td></tr>\n`
  }
  html += `</table>\n<p><small>Звук в странице сжат до Opus ${kbps} кбит/с; полные WAV всех 12 строк — в ${escape(path.resolve(run, voice))}. «Работа на 1 с речи» — секунд от запроса до ответа на секунду готовой речи, меньше — быстрее; в ней и пересылка образца голоса. Её можно сравнивать только у вариантов, которые работали на видеокарте одни: базовый, Q3_K_S, Q2_K и perf_mode off; остальные шли по два сервера сразу. «Слов услышано иначе» — по всем 12 строкам, без чисел, записанных цифрами, и W вместо «дубль-вэ»: так распознавание пишет их в любом варианте. «Самая длинная пауза» — самая долгая тишина внутри строки среди всех 12; застрявшая в тишине модель дала бы секунды.</small></p>\n`
  html += '</html>\n'
  fs.writeFileSync(path.join(run, `${voice}.html`), html)
  console.log(`${voice}: ${line}, ${kbps} kbps, ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`)
}
fs.rmSync(tmp, { recursive: true, force: true })
