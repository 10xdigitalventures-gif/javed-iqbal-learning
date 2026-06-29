// Backward-compatible re-export.
// All new code should import from "./offlineCourseSecure" directly.
// This file is kept so older imports still resolve.
export {
  downloadLesson,
  downloadLessonSecure,
  validateAndGetLocalUri,
  getDrmConfig,
  localLessonUri,
  isLessonDownloaded,
  removeLesson,
  removeCourse,
  downloadedLessons,
  downloadedCountForCourse,
  getOfflineStatus,
  enforceCourseAccess,
} from "./offlineCourseSecure";
export type { OfflineLesson, DrmConfig, OfflineStatus } from "./offlineCourseSecure";
