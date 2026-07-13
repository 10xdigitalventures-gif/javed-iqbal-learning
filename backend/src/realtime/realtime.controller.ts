import {
  Controller,
  Headers,
  MessageEvent,
  Query,
  Sse,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Observable, interval, map, merge } from "rxjs";
import { RealtimeService } from "./realtime.service";

function cookieValue(raw: string | undefined, name: string): string | null {
  for (const part of (raw || "").split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

@Controller("events")
export class RealtimeController {
  constructor(
    private readonly realtime: RealtimeService,
    private readonly jwt: JwtService,
  ) {}

  @Sse()
  stream(
    @Query("token") token?: string,
    @Headers("cookie") cookie?: string,
  ): Observable<MessageEvent> {
    const jwtToken = token || cookieValue(cookie, "auth_token");
    if (!jwtToken) throw new UnauthorizedException("Missing token");
    let userId: string;
    try {
      const payload = this.jwt.verify(jwtToken) as any;
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException("Invalid token");
    }

    const events$ = this.realtime
      .subscribe(userId)
      .pipe(map((e) => ({ type: e.type, data: e.data }) as MessageEvent));

    const heartbeat$ = interval(25000).pipe(
      map(
        () =>
          ({
            type: "ping",
            data: JSON.stringify({ t: Date.now() }),
          }) as MessageEvent,
      ),
    );

    return merge(events$, heartbeat$);
  }
}
