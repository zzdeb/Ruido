const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const ENDPOINT = 'https://script.google.com/macros/s/AKfycby_CxI8EoSA7VIkb2VmbEwF1lCCKU8zVZO2H18_n_04HjT9PmgoLPATMGWS2QaVDzPA5g/exec';
const FILE_PATH = path.join(__dirname, 'index.html');
const START_MARKER = '<!-- BANDAS_STATIC_START -->';
const END_MARKER = '<!-- BANDAS_STATIC_END -->';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeBand(raw = {}) {
  const get = (...keys) => {
    for (const key of keys) {
      const value = raw[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return '';
  };

  return {
    Nombre: get('Nombre', 'nombre', 'name', 'banda', 'titulo') || 'Banda',
    estilo: get('estilo', 'style', 'genre', 'categoria', 'genero') || 'Covers',
    Descripcion: get('Descripcion', 'descripcion', 'description', 'bio', 'texto') || 'Repertorio disponible bajo demanda.',
    Setlist: get('Setlist', 'setlist', 'repertorio', 'songs', 'canciones', 'lista') || '',
    Instagram: get('Instagram', 'instagram', 'ig', 'instagram_url') || '',
    Youtube: get('Youtube', 'youtube', 'youtube_url', 'link_youtube') || ''
  };
}

function renderSongList(setlist) {
  const songs = String(setlist || '')
    .split(/\n|;|\|/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 10);

  if (!songs.length) {
    return '<p class="repertoire-note">Repertorio a confirmar con la banda. Pídelo para recibir la lista completa.</p>';
  }

  return '<ul class="repertoire-songs">' + songs.map(song => `<li>${escapeHtml(song)}</li>`).join('') + '</ul>';
}

function renderBandCard(banda) {
  const instagram = banda.Instagram
    ? `<a href="${banda.Instagram}" target="_blank" rel="noopener" class="band-link-secondary">Instagram</a>`
    : '<span class="band-link-secondary" style="cursor:default;">Instagram próx.</span>';

  const youtube = banda.Youtube
    ? `<a href="${banda.Youtube}" target="_blank" rel="noopener" class="band-link-secondary">YouTube</a>`
    : '';

  return `
    <article class="band-card">
      <div>
        <span class="band-genre">${escapeHtml(banda.estilo)}</span>
        <h3>${escapeHtml(banda.Nombre)}</h3>
        <details class="band-repertoire">
          <summary>Repertorio</summary>
          <div class="repertoire-body">
            <p class="repertoire-note">${escapeHtml(banda.Descripcion)}</p>
            ${renderSongList(banda.Setlist)}
          </div>
        </details>
      </div>
      <div class="band-links">
        <a href="#contacto" class="band-link">Solicitar información →</a>
        ${instagram}
        ${youtube}
      </div>
    </article>
  `;
}

function loadJson(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br'
      }
    }, (res) => {
      const status = res.statusCode || 0;

      if (status >= 300 && status < 400 && res.headers.location) {
        if (redirects > 5) {
          reject(new Error('Demasiadas redirecciones seguidas'));
          return;
        }
        const nextUrl = new URL(res.headers.location, url).toString();
        resolve(loadJson(nextUrl, redirects + 1));
        res.resume();
        return;
      }

      const chunks = [];

      res.on('data', (chunk) => {
        chunks.push(Buffer.from(chunk));
      });

      res.on('end', () => {
        if (status >= 400) {
          reject(new Error(`HTTP ${status}: ${Buffer.concat(chunks).toString('utf8').slice(0, 200)}`));
          return;
        }

        let buffer = Buffer.concat(chunks);
        const encoding = (res.headers['content-encoding'] || '').toLowerCase();

        try {
          if (encoding.includes('gzip')) buffer = zlib.gunzipSync(buffer);
          else if (encoding.includes('br')) buffer = zlib.brotliDecompressSync(buffer);
          else if (encoding.includes('deflate')) buffer = zlib.inflateSync(buffer);
        } catch (err) {
          // Some endpoints return plain text without compression metadata.
        }

        const text = buffer.toString('utf8').trim();
        if (!text) {
          reject(new Error('Respuesta vacía del endpoint'));
          return;
        }

        try {
          resolve(JSON.parse(text));
        } catch (err) {
          reject(new Error('Respuesta no válida del endpoint: ' + text.slice(0, 250)));
        }
      });
    });

    req.on('error', reject);
  });
}

async function main() {
  const response = await loadJson(ENDPOINT);
  const rawBands = Array.isArray(response) ? response : (response.bandas || response.rows || response.data || []);
  const bandas = rawBands
    .map(item => normalizeBand(item))
    .filter(item => item.Nombre && item.Nombre !== 'Banda');

  const block = bandas.map(renderBandCard).join('\n');

  const html = fs.readFileSync(FILE_PATH, 'utf8');
  if (!html.includes(START_MARKER) || !html.includes(END_MARKER)) {
    throw new Error('Faltan los marcadores START/END en index.html');
  }

  const updated = html.replace(
    new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}`),
    `${START_MARKER}\n${block}\n${END_MARKER}`
  );

  fs.writeFileSync(FILE_PATH, updated, 'utf8');
  console.log(`Se han actualizado ${bandas.length} bandas en index.html`);
}

main().catch((error) => {
  console.error('Error al generar el HTML estático:', error.message);
  process.exit(1);
});
