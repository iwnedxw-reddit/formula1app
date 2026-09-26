export type F1CalendarEvent = {
    eventId: string;
    round: number;
    season: string;
    start: Date;
    end: Date;
    sessionLabel: "Sprint Qualifying" | "Qualifying" | "Sprint" | "Race" | "FP1" | "FP2" | "FP3";
    location: string;
    sessionType: "practice" | "qualifying" | "sprint" | "sprint-qualifying" | "race";
    grandPrix: string;
};

export type SerializedF1CalendarEvent = Omit<F1CalendarEvent, "start" | "end"> & {
    start: string;
    end: string;
};

export const serializeCalendarEvent = (event: F1CalendarEvent): SerializedF1CalendarEvent => ({
    ...event,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
});

export const hydrateCalendarEvent = (event: SerializedF1CalendarEvent): F1CalendarEvent => ({
    ...event,
    start: new Date(event.start),
    end: new Date(event.end),
});

export const hydrateCalendarEvents = (events: SerializedF1CalendarEvent[]): F1CalendarEvent[] =>
    events.map(hydrateCalendarEvent).filter((event) =>
        !Number.isNaN(event.start.getTime()) && !Number.isNaN(event.end.getTime())
    );

export function findCurrentOrNextEvent(events: F1CalendarEvent[]): {
    isCurrentlyInEvent: boolean;
    currentIndex?: number;
    nextIndex?: number;
} {
    const now = new Date();
    const currentIndex = events.findIndex((event) => now >= event.start && now <= event.end);

    if (currentIndex !== -1) {
        return { isCurrentlyInEvent: true, currentIndex };
    }

    const nextIndex = events.findIndex((event) => event.start > now);
    return {
        isCurrentlyInEvent: false,
        nextIndex: nextIndex === -1 ? undefined : nextIndex,
    };
}
