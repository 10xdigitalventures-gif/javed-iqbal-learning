import {
  Controller,
  MessageEvent,
  Query,
  Sse,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Observable, interval, map, merge } from "rxjs";
import { RealtimeService } from "./realtime.service";

// Server-Sent Events endpoint.
//
// EventSource (the browser SSE client) cannot send Authorization headers, so we
// accept the JWT as a query-string token and verify it here. A 25s heartbeat
// keeps proxies/load balancers from closing the idle connection.
@Controller("events")
export class RealtimeController {
  constructor(
    private readonly realtime: RealtimeService,
    private readonly jwt: JwtService,
  ) {}

  @Sse()
  stream(@Query("token") token?: string): Observable<MessageEvent> {
    if (!token) throw new UnauthorizedException("Missing token");
    let userId: string;
    try {
      const payload = this.jwt.verify(token);
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException("Invalid token");
    }

    const events$ = this.realtime
      .subscribe(userId)
      .pipe(map((e) => ({ type: e.type, data: e.data }) as MessageEvent));

    const heartbeat$ = interval(25000).pipe(
      map(() => ({ type: "ping", data: JSON.stringify({ t: Date.now() }) }) as MessageEvent),
    );

    return merge(events$, heartbeat$);
  }
}
