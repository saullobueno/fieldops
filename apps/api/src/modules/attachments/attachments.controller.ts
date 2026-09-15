import { createReadStream } from "node:fs";

import { Controller, Get, Param, Query, Res, StreamableFile } from "@nestjs/common";
import type { Response } from "express";

import { AttachmentsService, type AttachmentAccessTicket } from "./attachments.service.js";

@Controller("attachments")
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get(":storageKey")
  async getSignedAttachment(
    @Param("storageKey") storageKey: string,
    @Query("expires") expires: string | undefined,
    @Query("signature") signature: string | undefined,
    @Res({ passthrough: true }) response: Response
  ): Promise<AttachmentAccessTicket | StreamableFile> {
    const ticket = await this.attachmentsService.createAccessTicket({
      expires,
      signature,
      storageKey
    });

    if (ticket.downloadMode === "redirect" && ticket.remoteUrl) {
      // `redirect()` finaliza a resposta (`writableEnded = true`); o Nest
      // detecta isso e não tenta serializar o valor de retorno por cima.
      response.redirect(ticket.remoteUrl);
      return ticket;
    }

    if (!ticket.localPath) {
      return ticket;
    }

    response.set({
      "content-disposition": `attachment; filename="${ticket.fileName ?? "attachment"}"`,
      "content-length": ticket.byteSize?.toString(),
      "content-type": ticket.mimeType ?? "application/octet-stream"
    });

    return new StreamableFile(createReadStream(ticket.localPath));
  }
}
