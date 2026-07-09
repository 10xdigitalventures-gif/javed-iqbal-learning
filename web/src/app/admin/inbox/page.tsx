"use client";

import { NotificationsView } from "@/components/notifications-view";

// The admin-portal staff inbox. New support tickets and ticket assignments show
// up here as in-app (web) notifications, alongside a real-time SSE push.
export default function AdminInbox() {
  return <NotificationsView />;
}
