import { fromBuffer } from 'yauzl';

const workbookExpandedLimit = 16 * 1024 * 1024;

export async function checkWorkbookZip(buffer: Buffer) {
  // Check the expanded size before ExcelJS loads the archive into memory.
  await new Promise<void>((resolve, reject) => {
    fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) return reject(error);
      let expanded = 0;
      zip.on('error', reject);
      zip.on('end', resolve);
      if (zip.entryCount > 200) {
        zip.close();
        reject(new Error('Too many archive entries'));
        return;
      }
      zip.on('entry', (entry) => {
        expanded += entry.uncompressedSize;
        if (expanded > workbookExpandedLimit) {
          zip.close();
          reject(new Error('Expanded workbook is too large'));
          return;
        }
        // Stream each entry so the archive reader verifies its declared size.
        zip.openReadStream(entry, (entryError, stream) => {
          if (entryError || !stream) {
            zip.close();
            reject(entryError);
            return;
          }
          stream.on('error', (streamError) => {
            zip.close();
            reject(streamError);
          });
          stream.on('end', () => zip.readEntry());
          stream.resume();
        });
      });
      zip.readEntry();
    });
  });
}
