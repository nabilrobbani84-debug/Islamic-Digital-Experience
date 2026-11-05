import { Body, Controller, Get, HttpCode, Post, Query } from "@nestjs/common";
import { CurrentAuth, parse } from "../common/http";
import type { AuthContext } from "../common/types";
import { parseCursor, pushSchema, SyncService } from "./sync.service";

@Controller("sync")
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post("push")
  @HttpCode(200)
  push(@CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    return this.sync.push(auth.userId, auth.sessionId, parse(pushSchema, body).changes);
  }

  @Get("pull")
  pull(@CurrentAuth() auth: AuthContext, @Query("cursor") cursor?: string) {
    return this.sync.pull(auth.userId, auth.sessionId, parseCursor(cursor), 200);
  }
}
