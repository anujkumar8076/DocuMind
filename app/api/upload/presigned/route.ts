import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { generatePresignedUploadUrl } from '@/lib/storage/s3';
import { requireAuthSession, apiError } from '@/lib/api/response';
import { z } from 'zod';
import { DocumentStatus, Plan } from '@prisma/client';

const PresignedSchema = z.object({
  filename: z.string().min(1).max(255),
  fileType: z.enum(['application/pdf', 'text/plain', 'text/markdown', 'application/json']),
  fileSize: z.number().positive(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthSession();
    if (auth.errorResponse || !auth.userId) {
      return auth.errorResponse!;
    }
    const userId = auth.userId;
    const userPlan = auth.session?.user?.plan || Plan.FREE;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError('Malformed JSON payload', 'INVALID_JSON', 400);
    }

    const validated = PresignedSchema.safeParse(body);
    if (!validated.success) {
      return apiError('Validation error', 'VALIDATION_FAILED', 400, validated.error.flatten());
    }

    const { filename, fileType, fileSize } = validated.data;

    // Validate size limit based on subscription plan
    const maxSizeBytes = userPlan === Plan.PRO ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (fileSize > maxSizeBytes) {
      return apiError(
        `File exceeds maximum limit of ${userPlan === Plan.PRO ? '50MB' : '10MB'}.`,
        'FILE_TOO_LARGE',
        413
      );
    }

    // Generate S3 presigned URL
    const { uploadUrl, s3Key, s3Url } = await generatePresignedUploadUrl(userId, filename, fileType);

    // Create Document record in DB with PENDING status
    const document = await prisma.document.create({
      data: {
        userId,
        name: filename.replace(/\.[^/.]+$/, ''),
        originalFilename: filename,
        s3Key,
        s3Url,
        status: DocumentStatus.PENDING,
        fileSize,
        mimeType: fileType,
      },
    });

    return NextResponse.json(
      {
        uploadUrl,
        documentId: document.id,
        s3Key,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return apiError(message, 'INTERNAL_SERVER_ERROR', 500);
  }
}
