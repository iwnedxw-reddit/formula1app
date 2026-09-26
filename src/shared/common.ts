import { F1CalendarEvent } from "./calendarParser.js";
import { F1Event, F1Session } from "./types.js";

export const formatPositionLabel = (
    position: number | null | undefined,
    includeHash: boolean = true,
): string => {
    if (position == null) {
        return "DNF";
    }

    if (position === 1) return "P1";
    if (position === 2) return "P2";
    if (position === 3) return "P3";

    return `${position.toString()}.`;
};

export const mapSessionTypeToF1Session = (
    sessionType: F1CalendarEvent["sessionType"],
): F1Session => {
    switch (sessionType) {
        case "qualifying":
            return "qualifying";
        case "sprint":
            return "sprint";
        case "sprint-qualifying":
            return "sprint-qualifying";
        case "race":
            return "race";
        case "practice":
        default:
            return "fp1";
    }
};

export const determineSessionKey = (event: F1CalendarEvent): F1Session => {
    const sessionLabel = event.sessionLabel.toLowerCase();

    if (sessionLabel.includes("fp1") || sessionLabel.includes("practice 1"))
        return "fp1";
    if (sessionLabel.includes("fp2") || sessionLabel.includes("practice 2"))
        return "fp2";
    if (sessionLabel.includes("fp3") || sessionLabel.includes("practice 3"))
        return "fp3";
    if (
        sessionLabel.includes("sprint qualifying") ||
        sessionLabel.includes("shootout")
    )
        return "sprint-qualifying";
    if (sessionLabel.includes("qualifying")) return "qualifying";
    if (sessionLabel.includes("sprint")) return "sprint";
    if (sessionLabel.includes("grand prix") || sessionLabel.includes("race"))
        return "race";

    return mapSessionTypeToF1Session(event.sessionType);
};

// Convert F1CalendarEvent to F1Event format
export const convertToF1Event = (
    event: F1CalendarEvent,
    totalRounds: number,
): F1Event => {

    const mappedSession = determineSessionKey(event);
    return {
        name: event.grandPrix,
        location: event.location,
        round: event.round,
        slug: event.grandPrix.toLowerCase().replace(/\s+/g, "-"),
        totalRounds,
        nextSession: mappedSession
            ? {
                  name: mappedSession,
                  date: event.start.toISOString(),
              }
            : undefined,
        sessionLabel: event.sessionLabel,
    };
};

export function formatDateTime(targetTime: string, timezone = "UTC", locale = "en-US", enableYear = false) {
    const formatter = new Intl.DateTimeFormat(locale, {
        timeZone: timezone,
        weekday: "short",
        month: "short",
        year: enableYear? "numeric": undefined,
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });

    return formatter.format(new Date(targetTime));
}

type StickyContext = {
    reddit: {
        getCurrentSubredditName(): Promise<string>;
        getPostById(postId: string): Promise<{ stickied: boolean; unsticky(): Promise<void> | void }>;
    };
    redis: {
        get(key: string): Promise<string | undefined>;
        del(key: string): Promise<unknown>;
    };
};

export async function unstickyPreviousPost(context: StickyContext) {
    const subredditName = await context.reddit.getCurrentSubredditName();
    const previousScheduledPostID = await context.redis.get(
        `${subredditName}_stickied`,
    );
    if (previousScheduledPostID) {
        let prevPost = await context.reddit.getPostById(
            previousScheduledPostID,
        );
        if (prevPost.stickied) prevPost.unsticky();
        context.redis.del(`${subredditName}_stickied`);
        console.log(
            `Unsticked previous pinned scheduled post: ${previousScheduledPostID}`,
        );
    }
}

export function versionLt(v1: string, v2: string) {
  const a = v1.split('.').map(Number);
  const b = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}
