import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { parentPort, workerData } from 'node:worker_threads';
import { SaxesParser } from 'saxes';
import { getResolvedPDFJS } from 'unpdf';
import WordExtractor from 'word-extractor';
import { open } from 'yauzl';

const { path, contentType, maxCharacters } = workerData;
const maxWordXmlBytes = 8 * 1024 ** 2;
const wordNamespaces = new Set([
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  'http://purl.oclc.org/ooxml/wordprocessingml/main',
]);

async function pdfText() {
  const { getDocument } = await getResolvedPDFJS();
  const document = getDocument({
    data: new Uint8Array(await readFile(path)),
    isEvalSupported: false,
    useWasm: false,
    useWorkerFetch: false,
    useSystemFonts: false,
    verbosity: 0,
  });
  try {
    const pdf = await document.promise;
    let text = '';
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const { items } = await page.getTextContent();
      for (const item of items) {
        if ('str' in item) text += item.str + (item.hasEOL ? ' ' : '');
        if (text.length >= maxCharacters) return text.slice(0, maxCharacters);
      }
      text += ' ';
      page.cleanup();
    }
    return text;
  } finally {
    await document.destroy();
  }
}

function documentXml() {
  return new Promise((resolve, reject) => {
    open(path, { lazyEntries: true, autoClose: false }, (error, archive) => {
      if (error) return reject(error);
      function finish(failure, result) {
        archive.close();
        if (failure) reject(failure);
        else resolve(result);
      }
      if (archive.entryCount > 20_000)
        return finish(new Error('Too many ZIP entries'));
      archive.once('error', finish);
      archive.once('end', () => finish(null, ''));
      archive.on('entry', (entry) => {
        if (entry.fileName !== 'word/document.xml') return archive.readEntry();
        if (entry.uncompressedSize > maxWordXmlBytes)
          return finish(new Error('Word document XML is too large'));
        archive.openReadStream(entry, (failure, stream) => {
          if (failure) return finish(failure);
          const chunks = [];
          stream.once('error', finish);
          stream.on('data', (chunk) => chunks.push(chunk));
          stream.once('end', () =>
            finish(null, Buffer.concat(chunks).toString('utf8')),
          );
        });
      });
      archive.readEntry();
    });
  });
}

async function docxText() {
  let text = '';
  let readText = false;
  const xml = new SaxesParser({ xmlns: true });
  xml.on('doctype', () => {
    throw new Error('Word document uses a DTD');
  });
  xml.on('opentag', ({ uri, local }) => {
    readText = wordNamespaces.has(uri) && local === 't';
    if (wordNamespaces.has(uri) && ['tab', 'br', 'cr'].includes(local))
      text += ' ';
  });
  xml.on('text', (value) => {
    if (readText && text.length < maxCharacters)
      text += value.slice(0, maxCharacters - text.length);
  });
  xml.on('closetag', ({ uri, local }) => {
    readText = false;
    if (wordNamespaces.has(uri) && local === 'p') text += ' ';
  });
  xml.write(await documentXml()).close();
  return text;
}

async function extract() {
  switch (contentType) {
    case 'application/pdf':
      return pdfText();
    case 'application/msword':
      return (await new WordExtractor().extract(path)).getBody();
    default:
      return docxText();
  }
}

try {
  parentPort.postMessage((await extract()).slice(0, maxCharacters));
} catch {
  parentPort.postMessage('');
}
