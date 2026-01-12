import multer from 'multer';
const storage = multer.memoryStorage();
export const upload = multer({
    storage,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500MB limit (Video)
    },
    fileFilter: (req, file, cb) => {
        // Basic validation, can be enhanced
        if (file.mimetype.startsWith('video/') ||
            file.mimetype.startsWith('audio/') ||
            file.mimetype === 'application/pdf' ||
            file.mimetype.includes('msword') ||
            file.mimetype.includes('officedocument')) {
            cb(null, true);
        }
        else {
            cb(null, false);
            // or cb(new Error('Invalid file type'));
        }
    },
});
