import { useEffect } from "react";
import * as ScreenCapture from "expo-screen-capture";

// Block screenshots / screen recording while protected content (books,
// audiobooks, course lessons) is on screen. Capture is automatically re-allowed
// when the screen unmounts. All calls are best-effort and never throw, so a
// platform that does not support capture blocking simply degrades gracefully.
export function useContentProtection() {
  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    };
  }, []);
}
