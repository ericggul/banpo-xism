import formidable from 'formidable';
import fs from 'fs/promises';
import path from 'path';
import picToJson from '../../lib/pic2json.server';

export const config = {
  api: {
    bodyParser: false,
  },
};

const uploadDir = path.join(process.cwd(), '.tmp-uploads');

const parseForm = async (req) => {
  await fs.mkdir(uploadDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const form = formidable({
      multiples: false,
      keepExtensions: true,
      uploadDir,
    });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }

      const fileEntries = Object.values(files || {});
      if (!fileEntries.length) {
        reject(new Error('No file uploaded'));
        return;
      }

      let uploaded = null;
      for (const entry of fileEntries) {
        if (Array.isArray(entry)) {
          if (entry.length > 0) {
            uploaded = entry[0];
            break;
          }
        } else if (entry) {
          uploaded = entry;
          break;
        }
      }

      if (!uploaded) {
        reject(new Error('No valid file provided'));
        return;
      }

      const normalisedPath = uploaded.filepath
        || uploaded.path
        || uploaded.file?.path
        || uploaded._writeStream?.path;

      resolve({
        fields,
        file: {
          ...uploaded,
          filepath: normalisedPath,
        },
      });
    });
  });
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const { file } = await parseForm(req);
    const filePath = file?.filepath;

    if (!filePath) {
      res.status(400).json({ error: 'Invalid file upload' });
      return;
    }

    const result = await picToJson(filePath);
    res.status(200).json(result);

    // Cleanup temporary file (ignore errors).
    fs.rm(filePath, { force: true }).catch(() => {});
  } catch (error) {
    console.error('pic2json handler error:', error);
    res.status(500).json({ error: error.message || 'Processing failed' });
  }
}
