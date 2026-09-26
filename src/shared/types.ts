import { F1CalendarEvent } from "./calendarParser.js";

export type F1Session =
    | "fp1"
    | "fp2"
    | "fp3"
    | "qualifying"
    | "sprint"
    | "sprint-qualifying"
    | "race";

export type F1Event = {
    name: string;
    location: string;
    round: number;
    slug: string;
    totalRounds?: number;
    sessionLabel?: F1CalendarEvent["sessionLabel"];
    nextSession?: {
        name: F1Session;
        date: string;
    };
};

export type F1Result = {
    position: number;
    driver: {
        name: string;
        code: string;
        number: number;
    };
    team: string;
    time?: string;
    points: number;
};

export type F1RaceResult = {
    event: F1Event;
    results: F1Result[];
    session: F1Session;
    date: string;
};

export type AppState = "loading" | "no-race" | "show-results";
