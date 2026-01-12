import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit (Video)
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    // Basic validation, can be enhanced
    if (file.mimetype.startsWith('video/') || 
        file.mimetype.startsWith('audio/') || 
        file.mimetype === 'application/pdf' ||
        file.mimetype.includes('msword') ||
        file.mimetype.includes('officedocument')) {
      cb(null, true);
    } else {
      cb(null, false);
      // or cb(new Error('Invalid file type'));
    }
  },
});

