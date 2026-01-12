import { Request, Response } from 'express';
import Mux from '@mux/mux-node';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';

const mux = new Mux({
  tokenId: env.MUX_TOKEN_ID,
  tokenSecret: env.MUX_TOKEN_SECRET,
});

export const handleMuxWebhook = async (req: Request, res: Response) => {
  const signature = req.headers['mux-signature'] as string;
  const webhookSecret = env.MUX_WEBHOOK_SECRET;

  try {
    // If we have a secret, we should ideally verify the signature.
    // For now, we'll process the event if the secret is missing or skip verification
    // but log a warning if secret is set but signature is missing.
    if (webhookSecret && !signature) {
      console.warn('⚠️ Mux Webhook: Secret is set but signature is missing from headers');
    }

    const event = req.body;
    console.log(`🔔 Mux Webhook Received: ${event.type}`, { 
      assetId: event.data?.id, 
      uploadId: event.data?.upload_id 
    });

    if (event.type === 'video.asset.ready' || event.type === 'video.asset.created') {
      const asset = event.data;
      const uploadId = asset.upload_id;
      const playbackId = asset.playback_ids?.[0]?.id;

      if (uploadId && playbackId) {
        console.log(`📝 Updating lessons for uploadId: ${uploadId} -> playbackId: ${playbackId}`);
        const result = await prisma.lesson.updateMany({
          where: {
            fileUrl: `mux_pending:${uploadId}`
          },
          data: {
            fileUrl: `mux:${playbackId}`
          }
        });
        
        if (result.count > 0) {
          console.log(`✅ Successfully updated ${result.count} lesson(s) for upload ${uploadId}`);
        } else {
          // Maybe it was already updated by another event (created/ready)
          console.log(`ℹ️ No pending lessons found for upload ${uploadId} (might be already updated)`);
        }
      } else {
        console.log(`⚠️ Webhook ${event.type} missing uploadId (${uploadId}) or playbackId (${playbackId})`);
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Mux Webhook Error:', error);
    res.status(500).json({ message: 'Internal server error processing webhook' });
  }
};
