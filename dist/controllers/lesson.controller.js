import { PrismaClient } from '@prisma/client';
import { uploadToMux, uploadToCloudinary } from '../services/media.service';
const prisma = new PrismaClient();
export const uploadContent = async (req, res) => {
    try {
        const { title, description, courseCode, level, semester, academicSession, // maps to session
        type, 
        // Optional
        courseTitle, lecturer, instructions } = req.body;
        const file = req.file;
        if (!file) {
            return res.status(400).json({ message: 'File is required' });
        }
        // 1. Process Metadata
        const code = courseCode.toUpperCase().trim();
        const session = academicSession.trim();
        const sem = semester;
        const lvl = level;
        // 2. Find or Create Course
        // We try to find existing first
        let course = await prisma.course.findUnique({
            where: {
                code_session_semester_level: {
                    code,
                    session,
                    semester: sem,
                    level: lvl,
                }
            }
        });
        if (!course) {
            // Create if allowed? 
            // Requirement says "Requirements 6: Admin uploads...".
            // Usually user expects course to exist or be created.
            // Given provided metadata (courseTitle, lecturer), creation is implied if missing.
            course = await prisma.course.create({
                data: {
                    code,
                    session,
                    semester: sem,
                    level: lvl,
                    title: courseTitle || code, // Fallback
                    lecturer: lecturer,
                    description: description, // Maybe course desc? Or lesson desc?
                    // Using Lesson Description for Lesson. Course Description from metadata?
                }
            });
        }
        // 3. Upload File based on Type
        let fileUrl = '';
        if (type === 'VIDEO') {
            const { playbackId } = await uploadToMux(file.buffer);
            fileUrl = `https://stream.mux.com/${playbackId}.m3u8`; // Example Mux URL format
        }
        else {
            // Audio or PDF
            const resourceType = type === 'AUDIO' ? 'video' : 'raw'; // Cloudinary treats audio as video often, or raw/auto
            const { secure_url } = await uploadToCloudinary(file.buffer, resourceType);
            fileUrl = secure_url;
        }
        // 4. Create Lesson
        const lesson = await prisma.lesson.create({
            data: {
                title,
                description,
                type: type,
                fileUrl,
                fileSize: file.size,
                instructions,
                courseId: course.id,
            },
        });
        // 5. Response
        res.status(201).json({
            id: lesson.id,
            fileUrl: lesson.fileUrl,
            uploadedAt: lesson.createdAt,
            fileSize: lesson.fileSize,
            metadata: {
                title: lesson.title,
                description: lesson.description,
                courseCode: course.code,
                level: course.level,
                semester: course.semester,
                academicSession: course.session,
                type: lesson.type,
            }
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Upload failed', error });
    }
};
