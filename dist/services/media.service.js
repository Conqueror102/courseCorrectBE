import Mux from '@mux/mux-node';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import jwt from 'jsonwebtoken';
// Initialize Mux
const mux = new Mux({
    tokenId: env.MUX_TOKEN_ID,
    tokenSecret: env.MUX_TOKEN_SECRET,
});
// Initialize Cloudinary
cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
});
export { cloudinary };
/**
 * Get a Direct Upload URL for Mux (Video).
 */
export const getMuxUploadUrl = async () => {
    const upload = await mux.video.uploads.create({
        new_asset_settings: { playback_policy: ['signed'] },
        cors_origin: '*',
    });
    if (!upload.url)
        throw new Error('Failed to get Mux Upload URL');
    return upload.url;
};
/**
 * Get Cloudinary Signature for Direct Upload.
 */
export const getCloudinarySignature = (contentType) => {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const resourceType = contentType === 'PDF' ? 'raw' : 'video';
    const folder = 'course_content';
    const signature = cloudinary.utils.api_sign_request({
        timestamp: timestamp,
        folder: folder,
    }, env.CLOUDINARY_API_SECRET);
    return {
        signature,
        timestamp,
        cloudName: env.CLOUDINARY_CLOUD_NAME,
        apiKey: env.CLOUDINARY_API_KEY,
        resourceType,
        folder
    };
};
/**
 * Retrieve Asset ID from Mux Upload ID
 */
export const getAssetIdFromUpload = async (uploadId) => {
    try {
        const upload = await mux.video.uploads.retrieve(uploadId);
        if (upload.asset_id) {
            const asset = await mux.video.assets.retrieve(upload.asset_id);
            const playbackId = asset.playback_ids?.[0]?.id || null;
            return { assetId: upload.asset_id, playbackId };
        }
        return { assetId: null, playbackId: null };
    }
    catch {
        return { assetId: null, playbackId: null };
    }
};
/**
 * Generate signed Mux playback URL
 */
export const signMuxUrl = (playbackId) => {
    if (!playbackId || playbackId.startsWith('pending_'))
        return '';
    const keyId = env.MUX_SIGNING_KEY;
    const keySecret = env.MUX_PRIVATE_KEY;
    if (!keyId || !keySecret) {
        return `https://stream.mux.com/${playbackId}.m3u8`;
    }
    try {
        const token = jwt.sign({
            sub: playbackId,
            aud: 'v',
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
            kid: keyId,
        }, keySecret, { algorithm: 'RS256' });
        return `https://stream.mux.com/${playbackId}.m3u8?token=${token}`;
    }
    catch {
        return `https://stream.mux.com/${playbackId}.m3u8`;
    }
};
/**
 * Generate Cloudinary URL
 */
export const signCloudinaryUrl = (publicId, resourceType) => {
    try {
        return cloudinary.url(publicId, {
            resource_type: resourceType,
            sign_url: true,
            type: 'upload',
            secure: true
        });
    }
    catch {
        return `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload/${publicId}`;
    }
};
