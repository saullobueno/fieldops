import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

import { BadRequestException, ForbiddenException, GoneException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { createStorageAdapter, type StorageAdapter } from "@fieldops/integrations";
import type pg from "pg";

import { POSTGRES_POOL } from "../infrastructure/infrastructure.module.js";

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf"
] as const;

export interface AttachmentUploadInput {
  readonly workOrderId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly body: Buffer;
}

export interface AttachmentUploadResult {
  readonly storageKey: string;
  readonly byteSize: number;
}

const REMOTE_DOWNLOAD_URL_TTL_SECONDS = 300;

export interface AttachmentAccessTicket {
  readonly byteSize?: number;
  readonly fileName?: string;
  readonly localPath?: string;
  readonly remoteUrl?: string;
  readonly mimeType?: string;
  readonly storageKey: string;
  readonly status: "ready";
  readonly expiresAt: string;
  readonly downloadMode: "signed-url" | "storage-proxy" | "redirect";
}

interface AttachmentRow {
  readonly byte_size: number;
  readonly file_name: string;
  readonly id: string;
  readonly mime_type: string;
  readonly organization_id: string;
  readonly revoked_at: Date | string | null;
}

@Injectable()
export class AttachmentsService {
  private readonly storageAdapter: StorageAdapter;

  constructor(
    @Optional() @Inject(POSTGRES_POOL) private readonly postgresPool?: pg.Pool
  ) {
    // Mesma lição da Fase 12 (MapsService): lê só as credenciais que este
    // serviço precisa, sem passar por `parseServerEnv` completo.
    const upstashBlobToken = process.env.UPSTASH_BLOB_TOKEN;

    this.storageAdapter = createStorageAdapter({
      localRootDir: process.env.ATTACHMENT_STORAGE_ROOT ?? "storage",
      upstashBlobToken
    });
  }

  async upload(input: AttachmentUploadInput): Promise<AttachmentUploadResult> {
    const storageKey = `work-orders/${input.workOrderId}/${randomUUID()}-${sanitizeFileName(input.fileName)}`;

    await this.storageAdapter.upload({
      body: input.body,
      key: storageKey,
      mimeType: input.mimeType
    });

    return { byteSize: input.body.byteLength, storageKey };
  }

  async createAccessTicket(input: {
    readonly storageKey: string;
    readonly expires: string | undefined;
    readonly signature: string | undefined;
  }): Promise<AttachmentAccessTicket> {
    const expiresAt = parseExpires(input.expires);

    if (!input.signature) {
      throw new BadRequestException("Assinatura do anexo não informada.");
    }

    if (Date.now() > expiresAt.getTime()) {
      throw new GoneException("URL assinada expirada.");
    }

    const expected = signAttachment(input.storageKey, input.expires!);
    if (!secureEqual(input.signature, expected)) {
      throw new ForbiddenException("Assinatura do anexo inválida.");
    }

    const attachment = await this.findAttachment(input.storageKey);
    if (attachment?.revoked_at) {
      throw new GoneException("Link revogado.");
    }

    const localPath = resolveStoragePath(input.storageKey);
    const remoteUrl = localPath
      ? undefined
      : await this.storageAdapter.getDownloadUrl(input.storageKey, REMOTE_DOWNLOAD_URL_TTL_SECONDS).catch(() => undefined);

    if (attachment) {
      await this.auditAttachmentAccess(attachment);
    }

    return {
      byteSize: attachment?.byte_size ?? readLocalByteSize(localPath),
      downloadMode: localPath ? "storage-proxy" : remoteUrl ? "redirect" : "signed-url",
      expiresAt: expiresAt.toISOString(),
      fileName: attachment?.file_name ?? path.basename(input.storageKey),
      localPath,
      mimeType: attachment?.mime_type ?? "application/octet-stream",
      remoteUrl,
      status: "ready",
      storageKey: input.storageKey
    };
  }

  async revoke(input: { readonly attachmentId: string; readonly organizationId: string; readonly actorUserId: string }): Promise<void> {
    if (!this.postgresPool) {
      throw new BadRequestException("Revogação de anexos requer um banco de dados configurado.");
    }

    const result = await this.postgresPool.query<{ storage_key: string }>(
      `update attachments
       set revoked_at = now()
       where id = $1 and organization_id = $2 and revoked_at is null
       returning storage_key`,
      [input.attachmentId, input.organizationId]
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException("Anexo não encontrado ou já revogado.");
    }

    await this.postgresPool.query(
      `insert into audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, metadata)
       values ($1, $2, 'revoke', 'attachment', $3, $4::jsonb)`,
      [input.organizationId, input.actorUserId, input.attachmentId, JSON.stringify({ source: "attachments-api" })]
    );
  }

  private async findAttachment(storageKey: string): Promise<AttachmentRow | undefined> {
    if (!this.postgresPool) {
      return undefined;
    }

    try {
      const result = await this.postgresPool.query<AttachmentRow>(
        `select id, organization_id, file_name, mime_type, byte_size, revoked_at
         from attachments
         where storage_key = $1
         limit 1`,
        [storageKey]
      );

      return result.rows[0];
    } catch {
      return undefined;
    }
  }

  private async auditAttachmentAccess(attachment: AttachmentRow): Promise<void> {
    if (!this.postgresPool) {
      return;
    }

    await this.postgresPool.query(
      `insert into audit_logs (organization_id, action, resource_type, resource_id, after, metadata)
       values ($1, 'export', 'attachment', $2, $3::jsonb, $4::jsonb)`,
      [
        attachment.organization_id,
        attachment.id,
        JSON.stringify({ storageKeyAccessed: true }),
        JSON.stringify({ source: "attachments-api" })
      ]
    );
  }
}

export function signAttachment(storageKey: string, expires: string): string {
  return createHmac("sha256", process.env.ATTACHMENT_URL_SECRET ?? "fieldops-demo-secret")
    .update(`${storageKey}:${expires}`)
    .digest("hex");
}

function parseExpires(value: string | undefined): Date {
  if (!value || !/^\d+$/.test(value)) {
    throw new BadRequestException("Expiração do anexo inválida.");
  }

  return new Date(Number(value) * 1000);
}

function secureEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function resolveStoragePath(storageKey: string): string | undefined {
  const root = path.resolve(process.env.ATTACHMENT_STORAGE_ROOT ?? "storage");
  const candidate = path.resolve(root, storageKey);

  if (!candidate.startsWith(`${root}${path.sep}`) && candidate !== root) {
    throw new ForbiddenException("Caminho de anexo inválido.");
  }

  if (!existsSync(candidate)) {
    return undefined;
  }

  return candidate;
}

function sanitizeFileName(fileName: string): string {
  const base = path.basename(fileName).trim() || "arquivo";
  return base.replaceAll(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

function readLocalByteSize(localPath: string | undefined): number | undefined {
  if (!localPath) {
    return undefined;
  }

  return statSync(localPath).size;
}
