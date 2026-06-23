import { Injectable } from "@nestjs/common";
import { Observable, Subject, filter, map } from "rxjs";

// A single in-process event hub. Each connected user gets a filtered stream of
// the events addressed to them. This replaces the old 5-second polling with
// true server-push (Server-Sent Events). For multi-instance deployments, swap
// the Subject for a Redis pub/sub adapter (see DEPLOYMENT.md).
export type RealtimeEvent = {
  userId: string;
  event: string;
  data: Record<string, unknown>;
};

@Injectable()
export class RealtimeService {
  private readonly stream$ = new Subject<RealtimeEvent>();

  // Emit an event addressed to a specific user.
  emit(userId: string, event: string, data: Record<string, unknown> = {}) {
    this.stream$.next({ userId, event, data });
  }

  // An SSE-friendly observable of events for one user.
  subscribe(userId: string): Observable<{ type: string; data: string }> {
    return this.stream$.asObservable().pipe(
      filter((e) => e.userId === userId),
      map((e) => ({ type: e.event, data: JSON.stringify(e.data) })),
    );
  }
}
