import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { authorizeObjectAccess, type AuthenticatedActor } from "@fieldops/auth";
import { workOrderStatuses } from "@fieldops/domain";
import type { WorkOrderAuditItem, WorkOrderDetail, WorkOrderListResponse } from "@fieldops/types";
import { z } from "zod";

import { ALLOWED_ATTACHMENT_MIME_TYPES, AttachmentsService, MAX_ATTACHMENT_BYTES } from "../attachments/attachments.service.js";
import { CurrentActor, RequirePermissions } from "../auth/auth.decorators.js";
import { WorkOrdersService } from "./work-orders.service.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().optional(),
  status: z.string().optional()
});

const updateStatusSchema = z.object({
  status: z.enum(workOrderStatuses)
});

const updateChecklistSchema = z.object({
  answers: z.record(z.string(), z.unknown())
});

const addNoteSchema = z.object({
  body: z.string().trim().min(1).max(2_000)
});

const addSignatureSchema = z.object({
  attachmentId: z.string().trim().min(1),
  signerName: z.string().trim().min(1).max(200)
});

const auditQuerySchema = z.object({
  action: z.string().trim().min(1).optional(),
  actorUserId: z.string().trim().min(1).optional(),
  from: z.string().trim().min(10).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  to: z.string().trim().min(10).optional()
});

const uploadKindSchema = z.enum(["photo", "document", "signature"]).default("document");

@Controller("work-orders")
export class WorkOrdersController {
  constructor(
    @Inject(WorkOrdersService) private readonly workOrdersService: WorkOrdersService,
    @Inject(AttachmentsService) private readonly attachmentsService: AttachmentsService
  ) {}

  @Get()
  @RequirePermissions("work_order:read")
  async list(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Query() query: Record<string, string | string[] | undefined>
  ): Promise<WorkOrderListResponse> {
    const currentActor = requireActor(actor);
    const parsedQuery = listQuerySchema.safeParse(query);

    if (!parsedQuery.success) {
      throw new BadRequestException("Filtros inválidos para ordens de serviço.");
    }

    return this.workOrdersService.list({
      organizationId: currentActor.organizationId,
      ...parsedQuery.data
    });
  }

  @Get(":id")
  @RequirePermissions("work_order:read")
  async getById(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("id") id: string
  ): Promise<WorkOrderDetail> {
    const currentActor = requireActor(actor);
    const detail = await this.workOrdersService.getById(id, currentActor.organizationId);
    assertObjectPermission(currentActor, "work_order:read", detail);
    return detail;
  }

  @Get(":id/audit")
  @RequirePermissions("audit_log:read")
  async getAuditTrail(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("id") id: string,
    @Query() query: Record<string, string | string[] | undefined>
  ): Promise<readonly WorkOrderAuditItem[]> {
    const currentActor = requireActor(actor);
    const parsedQuery = auditQuerySchema.safeParse(query);

    if (!parsedQuery.success) {
      throw new BadRequestException("Filtros inválidos para auditoria.");
    }

    const detail = await this.workOrdersService.getById(id, currentActor.organizationId);
    assertObjectPermission(currentActor, "audit_log:read", detail);
    return this.workOrdersService.getAuditTrail(id, currentActor.organizationId, parsedQuery.data);
  }

  @Patch(":id/status")
  @RequirePermissions("work_order:update")
  async updateStatus(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("id") id: string,
    @Body() body: unknown
  ): Promise<WorkOrderDetail> {
    const currentActor = requireActor(actor);
    const parsedBody = updateStatusSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Status inválido para ordem de serviço.");
    }

    const detail = await this.workOrdersService.getById(id, currentActor.organizationId);
    assertObjectPermission(currentActor, "work_order:update", detail);

    return this.workOrdersService.updateStatus({
      actorName: currentActor.id,
      actorUserId: currentActor.id,
      id,
      organizationId: currentActor.organizationId,
      status: parsedBody.data.status
    });
  }

  @Patch(":id/checklist")
  @RequirePermissions("work_order:update")
  async updateChecklist(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("id") id: string,
    @Body() body: unknown
  ): Promise<WorkOrderDetail> {
    const currentActor = requireActor(actor);
    const parsedBody = updateChecklistSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Respostas inválidas para checklist.");
    }

    const detail = await this.workOrdersService.getById(id, currentActor.organizationId);
    assertObjectPermission(currentActor, "work_order:update", detail);

    return this.workOrdersService.updateChecklist({
      actorUserId: currentActor.id,
      answers: parsedBody.data.answers,
      id,
      organizationId: currentActor.organizationId
    });
  }

  @Post(":id/notes")
  @RequirePermissions("work_order:update")
  async addNote(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("id") id: string,
    @Body() body: unknown
  ): Promise<WorkOrderDetail> {
    const currentActor = requireActor(actor);
    const parsedBody = addNoteSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Nota inválida para ordem de serviço.");
    }

    const detail = await this.workOrdersService.getById(id, currentActor.organizationId);
    assertObjectPermission(currentActor, "work_order:update", detail);

    return this.workOrdersService.addNote({
      actorName: currentActor.id,
      actorUserId: currentActor.id,
      body: parsedBody.data.body,
      id,
      organizationId: currentActor.organizationId
    });
  }

  @Patch(":id/notes/:noteId")
  @RequirePermissions("work_order:update")
  async updateNote(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("id") id: string,
    @Param("noteId") noteId: string,
    @Body() body: unknown
  ): Promise<WorkOrderDetail> {
    const currentActor = requireActor(actor);
    const parsedBody = addNoteSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Nota inválida para ordem de serviço.");
    }

    const detail = await this.workOrdersService.getById(id, currentActor.organizationId);
    assertObjectPermission(currentActor, "work_order:update", detail);

    return this.workOrdersService.updateNote({
      actorUserId: currentActor.id,
      body: parsedBody.data.body,
      id,
      noteId,
      organizationId: currentActor.organizationId
    });
  }

  @Delete(":id/notes/:noteId")
  @RequirePermissions("work_order:update")
  async deleteNote(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("id") id: string,
    @Param("noteId") noteId: string
  ): Promise<WorkOrderDetail> {
    const currentActor = requireActor(actor);
    const detail = await this.workOrdersService.getById(id, currentActor.organizationId);
    assertObjectPermission(currentActor, "work_order:update", detail);

    return this.workOrdersService.deleteNote({
      actorUserId: currentActor.id,
      id,
      noteId,
      organizationId: currentActor.organizationId
    });
  }

  @Post(":id/signature")
  @RequirePermissions("work_order:update")
  async addSignature(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("id") id: string,
    @Body() body: unknown
  ): Promise<WorkOrderDetail> {
    const currentActor = requireActor(actor);
    const parsedBody = addSignatureSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException("Dados inválidos para assinatura.");
    }

    const detail = await this.workOrdersService.getById(id, currentActor.organizationId);
    assertObjectPermission(currentActor, "work_order:update", detail);

    return this.workOrdersService.addSignature({
      actorUserId: currentActor.id,
      attachmentId: parsedBody.data.attachmentId,
      id,
      organizationId: currentActor.organizationId,
      signerName: parsedBody.data.signerName
    });
  }

  @Post(":id/attachments")
  @RequirePermissions("work_order:update")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_ATTACHMENT_BYTES } }))
  async addAttachment(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body("kind") kind: unknown
  ): Promise<WorkOrderDetail> {
    const currentActor = requireActor(actor);

    if (!file) {
      throw new BadRequestException("Nenhum arquivo enviado.");
    }

    if (!(ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de arquivo não suportado: ${file.mimetype}. Tipos aceitos: ${ALLOWED_ATTACHMENT_MIME_TYPES.join(", ")}.`
      );
    }

    const parsedKind = uploadKindSchema.safeParse(kind);
    if (!parsedKind.success) {
      throw new BadRequestException("Tipo de anexo inválido.");
    }

    const detail = await this.workOrdersService.getById(id, currentActor.organizationId);
    assertObjectPermission(currentActor, "work_order:update", detail);

    const uploaded = await this.attachmentsService.upload({
      body: file.buffer,
      fileName: file.originalname,
      mimeType: file.mimetype,
      workOrderId: id
    });

    return this.workOrdersService.addAttachment({
      actorName: currentActor.id,
      actorUserId: currentActor.id,
      byteSize: uploaded.byteSize,
      fileName: file.originalname,
      id,
      kind: parsedKind.data,
      mimeType: file.mimetype,
      organizationId: currentActor.organizationId,
      storageKey: uploaded.storageKey
    });
  }

  @Post(":id/attachments/:attachmentId/revoke")
  @RequirePermissions("work_order:update")
  async revokeAttachment(
    @CurrentActor() actor: AuthenticatedActor | undefined,
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string
  ): Promise<WorkOrderDetail> {
    const currentActor = requireActor(actor);
    const detail = await this.workOrdersService.getById(id, currentActor.organizationId);
    assertObjectPermission(currentActor, "work_order:update", detail);

    await this.attachmentsService.revoke({
      actorUserId: currentActor.id,
      attachmentId,
      organizationId: currentActor.organizationId
    });

    return this.workOrdersService.getById(id, currentActor.organizationId);
  }
}

function requireActor(actor: AuthenticatedActor | undefined): AuthenticatedActor {
  if (!actor) {
    throw new UnauthorizedException("Ator autenticado não informado.");
  }

  return actor;
}

function assertObjectPermission(
  actor: AuthenticatedActor,
  permission: Parameters<typeof authorizeObjectAccess>[1],
  workOrder: WorkOrderDetail
): void {
  const decision = authorizeObjectAccess(actor, permission, workOrder);

  if (!decision.allowed) {
    throw new ForbiddenException(decision.reason);
  }
}
