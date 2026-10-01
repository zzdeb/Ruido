const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const ENDPOINT = 'https://script.google.com/macros/s/AKfycbylHfGRyeWvKP11ImffiZT8JOXQl2YJ28sFtmgHSJ5t8oYSH1dDYNPkffawlFXuEl-asw/exec';
const FILE_PATH = path.join(__dirname, 'index.html');
const START_MARKER = '<!-- BANDAS_STATIC_START -->';
const END_MARKER = '<!-- BANDAS_STATIC_END -->';
const CUSTOM_BANDS = [
  {
    Nombre: 'Tu banda a medida',
    estilo: 'Personalizada',
    Descripcion: 'Elige tu repertorio de versiones, o tu tributo favorito. Nosotros ponemos los músicos y conformamos la banda para ti.',
    Setlist: 'Versión a medida\nTributo favorito\nTu set ideal',
    Instagram: '',
    Youtube: '',
    Logo: ''
  }
];

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeKey(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function pickFirstValue(raw = {}, aliases = []) {
  const normalizedAliases = aliases.map(normalizeKey);

  for (const [key, value] of Object.entries(raw || {})) {
    const normalizedKey = normalizeKey(key);
    if (normalizedAliases.includes(normalizedKey)) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return value;
      }
    }
  }

  for (const value of Object.values(raw || {})) {
    if (value && typeof value === 'object') {
      const nested = pickFirstValue(value, aliases);
      if (nested) return nested;
    }
  }

  return '';
}

function normalizeBand(raw = {}) {
  const get = (...keys) => {
    for (const key of keys) {
      const value = raw[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return '';
  };

  const logoValue = pickFirstValue(raw, [
    'Logo',
    'logo',
    'Logo link',
    'logo link',
    'logo_link',
    'logo-link',
    'logolink',
    'Logo URL',
    'logo url',
    'logo_url',
    'url_logo',
    'link_logo',
    'LogoLink',
    'logoLink',
    'imagen',
    'image',
    'Image',
    'img',
    'url'
  ]);

  return {
    Nombre: get('Nombre', 'nombre', 'name', 'banda', 'titulo') || 'Banda',
    estilo: get('estilo', 'style', 'genre', 'categoria', 'genero') || 'Covers',
    Descripcion: get('Descripcion', 'descripcion', 'description', 'bio', 'texto') || 'Repertorio disponible bajo demanda.',
    Setlist: get('Setlist', 'setlist', 'repertorio', 'songs', 'canciones', 'lista') || '',
    Instagram: get('Instagram', 'instagram', 'ig', 'instagram_url') || '',
    Youtube: get('Youtube', 'youtube', 'youtube_url', 'link_youtube') || '',
    Logo: normalizeLogoUrl(get(
      'Logo',
      'logo',
      'Logo link',
      'logo link',
      'Logo URL',
      'logo_url',
      'url_logo',
      'imagen',
      'image',
      'LogoLink',
      'logoLink'
    )) || normalizeLogoUrl(logoValue)
  };
}

function normalizeLogoUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';

  const driveId = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([^/?&]+)/);
  if (driveId) return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(driveId[1])}`;

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname === 'instagram.com' || hostname === 'www.instagram.com') return '';
  } catch (err) {
    return '';
  }

  return url;
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
  const logo = banda.Logo
    ? `<div class="band-logo"><img src="${escapeHtml(banda.Logo)}" alt="Logo de ${escapeHtml(banda.Nombre)}" loading="lazy" decoding="async"></div>`
    : '';
  const instagram = banda.Instagram
    ? `<a href="${banda.Instagram}" target="_blank" rel="noopener" class="band-link-secondary">Instagram</a>`
    : '<span class="band-link-secondary" style="cursor:default;">Instagram próx.</span>';

  const youtube = banda.Youtube
    ? `<a href="${banda.Youtube}" target="_blank" rel="noopener" class="band-link-secondary">YouTube</a>`
    : '';

  return `
    <article class="band-card">
      <div>
        ${logo}
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
  const hasLogoColumn = rawBands.some(item =>
    Object.keys(item).some(key => {
      const normalized = key.trim().toLowerCase();
      return ['logo', 'logo url', 'logo_url', 'url_logo', 'link_logo', 'logo link', 'logo_link', 'logolink', 'logo-link', 'imagen', 'image', 'img'].includes(normalized);
    })
  );
  if (!hasLogoColumn) {
    console.warn('El JSON de Apps Script no incluye ninguna columna de logo visible. Se continuará si el dato se entrega con otro nombre o si la fila está vacía.');
  }

  const bandas = [
    ...rawBands.map(item => normalizeBand(item)),
    ...CUSTOM_BANDS.map(item => normalizeBand(item))
  ].filter(item => item.Nombre && item.Nombre !== 'Banda');

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
