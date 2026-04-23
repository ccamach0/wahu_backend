import multer from 'multer';
import sharp from 'sharp';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  if (!allowedMimes.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
  }

  if (file.size > 10 * 1024 * 1024) {
    return cb(new Error('File size exceeds 10MB limit.'));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export async function processImage(req, res, next) {
  if (!req.file) {
    return next();
  }

  try {
    const compressed = await sharp(req.file.buffer)
      .resize(1920, 1440, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    req.file.buffer = compressed;
    req.file.mimetype = 'image/jpeg';
    req.file.originalname = req.file.originalname.replace(/\.[^/.]+$/, '.jpg');

    next();
  } catch (error) {
    res.status(400).json({ error: 'Failed to process image: ' + error.message });
  }
}

export const uploadSingle = upload.single('image');
