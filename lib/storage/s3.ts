import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'documind-documents-storage';

export interface PresignedUrlResult {
  uploadUrl: string;
  s3Key: string;
  s3Url: string;
}

/**
 * Generates a presigned PUT URL for secure, direct-from-client uploads to S3
 */
export async function generatePresignedUploadUrl(
  userId: string,
  filename: string,
  mimeType: string
): Promise<PresignedUrlResult> {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const s3Key = `documents/${userId}/${timestamp}_${sanitizedFilename}`;

  if (!process.env.AWS_ACCESS_KEY_ID) {
    // Local / development mock upload URL
    return {
      uploadUrl: `/api/upload/mock?key=${encodeURIComponent(s3Key)}`,
      s3Key,
      s3Url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`,
    };
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 minutes

  return {
    uploadUrl,
    s3Key,
    s3Url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`,
  };
}

/**
 * Fetches document content from S3 as a Buffer
 */
export async function getDocumentBuffer(s3Key: string): Promise<Buffer> {
  if (!process.env.AWS_ACCESS_KEY_ID) {
    throw new Error(`S3 is not configured. Document key: ${s3Key}`);
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  });

  const response = await s3Client.send(command);
  const byteArray = await response.Body?.transformToByteArray();
  if (!byteArray) {
    throw new Error(`Failed to retrieve file body from S3 for key: ${s3Key}`);
  }

  return Buffer.from(byteArray);
}

/**
 * Deletes a file from S3
 */
export async function deleteDocumentFromS3(s3Key: string): Promise<void> {
  if (!process.env.AWS_ACCESS_KEY_ID) return;

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  });

  await s3Client.send(command);
}
