import {
    hydrateCalendarEvents,
    serializeCalendarEvent,
    type F1CalendarEvent,
    type SerializedF1CalendarEvent,
} from "./calendarParser.js";
import { F1RaceResult, F1Result, F1Session } from "./types.js";

export type SessionDetails = {
    session_key: number;
    session_name?: string;
    session_type?: string;
    location?: string;
    country_name?: string;
    date_start?: string;
    date_end?: string;
    meeting_key?: number;
    year?: number;
    circuit_short_name?: string;
    gmt_offset?: string;
    country_code?: string;
    total_laps?: number;
};

export type SessionResultEntry = {
    session_key: number;
    position?: number | null;
    driver_number?: number;
    driver_first_name?: string;
    driver_last_name?: string;
    driver_short_name?: string;
    team_name?: string;
    time?: string;
    points?: number;
    duration?: number | null;
    gap_to_leader?: number | string | null;
    dnf?: boolean;
    dns?: boolean;
    dsq?: boolean;
    number_of_laps?: number;
    meeting_key?: number;
    qualifyingSegment?: "Q1" | "Q2" | "Q3";
};

export type LatestSessionPayload = {
    session: SessionDetails;
    results: SessionResultEntry[];
    selectedEventId?: string;
    grandPrixOptions?: GrandPrixOption[];
    selectedTitleTab?: string;
    options?: SessionOption[];
    sessions?: LatestSessionResults[];
    sessionSchedule?: SessionScheduleEntry[];
} | null;

export type GrandPrixOption = {
    eventId: string;
    label: string;
    detail?: string;
};

export type SessionOption = {
    competitionId?: string;
    titleTab: string;
    titleModule?: string;
};

export type LatestSessionResults = {
    titleTab: string;
    session: SessionDetails;
    results: SessionResultEntry[];
};

type EspnRacePackage = {
    racestrip?: {
        name?: string;
        shortName?: string;
        date?: string;
        endDate?: string;
        season?: number;
        sessionDetail?: EspnSessionDetail[];
        circuit?: {
            name?: string;
            countryFlag?: {
                alt?: string;
            };
        };
    };
    eventInfo?: {
        venue?: {
            address?: {
                city?: string;
                country?: string;
            };
            fullName?: string;
            circuit?: {
                laps?: number | string;
            };
        };
    };
    commentaries?: EspnCommentaryEntry[];
    positions?: EspnPositionEntry[];
};

type EspnScoreboard = {
    events?: EspnScoreboardEvent[];
    leagues?: Array<{
        calendar?: EspnCalendarSection[];
    }>;
};

export type SessionScheduleEntry = {
    competitionId?: string;
    titleTab: string;
    start: string;
    end: string;
};

type EspnScoreboardEvent = {
    id?: string;
    name?: string;
    shortName?: string;
    date?: string;
};

type CachedEspnPayload<T> = {
    fetchedAt: string;
    data: T;
};

type EspnSessionDetail = {
    competitionId?: string;
    titleTab?: string;
    competitionDate?: string;
};

type EspnCalendarSection = {
    label?: string;
    detail?: string;
    event?: {
        $ref?: string;
    };
};

type EspnCommentaryEntry = {
    competitionId?: string;
    titleTab?: string;
    titleModule?: string;
    session?: number;
};

type EspnPositionEntry = {
    competitionId?: string;
    titleTab?: string;
    raceType?: string;
    state?: string;
    date?: string;
    positions?: EspnPositionResult[];
};

type EspnPositionResult = {
    order?: number;
    raceType?: string;
    athleteInfo?: EspnAthleteInfo;
    stateInfo?: EspnStateInfo;
    q1?: { displayValue?: string };
    q2?: { displayValue?: string };
    q3?: { displayValue?: string };
};

type EspnAthleteInfo = {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    shortDisplayName?: string;
    shortName?: string;
    abbreviation?: string;
    team?: string;
    vehicle?: {
        number?: string;
        manufacturer?: string;
    };
};

type EspnStateInfo = {
    displayValue?: string;
    lapsCompleted?: string;
    place?: string;
    totalTime?: string;
    points?: number | string;
    behindTime?: string;
    fomGapToLeader?: string;
};

export type CalendarEventIndexEntry = {
    eventId: string;
    label: string;
    detail?: string;
    date: string;
};

export type CalendarSnapshot = {
    schemaVersion: string;
    season: string;
    refreshedAt: string;
    totalRounds: number;
    eventIndex: CalendarEventIndexEntry[];
    currentEventId?: string;
    latestResultsEventId?: string;
    events: SerializedF1CalendarEvent[];
};

export type CalendarSnapshotResult = {
    snapshot: CalendarSnapshot;
    isStale: boolean;
};

export type CalendarBackupStore = {
    read(key: string): Promise<string | undefined>;
    write(key: string, value: string): Promise<unknown>;
};

type StandingsStat = {
    name?: string;
    value?: number | string;
    displayValue?: string;
};

type RawStandingsEntry = {
    athlete?: {
        displayName?: string;
        abbreviation?: string;
    };
    team?: {
        displayName?: string;
        abbreviation?: string;
    };
    stats?: StandingsStat[];
};

type RawStandingsCategory = {
    name?: string;
    standings?: {
        entries?: RawStandingsEntry[];
    };
};

export type StandingsEntrySummary = {
    rank: number;
    name: string;
    points: number;
    code?: string;
    subtitle?: string;
    fullName?: string;
};

export type StandingsSummary = {
    drivers: StandingsEntrySummary[];
    constructors: StandingsEntrySummary[];
};

export type CacheReader = <T>(key: string, ttlSeconds: number, loader: () => Promise<T>) => Promise<T>;

const STANDINGS_ENDPOINT = "https://site.api.espn.com/apis/v2/sports/racing/f1/standings";
const ESPN_RACE_PACKAGE_ENDPOINT = (espnId: string) =>
    `https://site.api.espn.com/apis/site/v2/sports/racing/f1/racepackage?event=${espnId}`;
const ESPN_SCOREBOARD_ENDPOINT = (season: string) =>
    `https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard?dates=${encodeURIComponent(season)}`;
const ESPN_CACHE_KEY_VERSION = "v3";
export const CALENDAR_SCHEMA_VERSION = "v1";
const CALENDAR_CACHE_TTL_SECONDS = 24 * 60 * 60;
const RACE_PACKAGE_CACHE_TTL_SECONDS = 30;
const STANDINGS_CACHE_TTL_SECONDS = 60 * 60;
const GRAND_PRIX_SPONSOR_PREFIXES = [
    "MSC Cruises",
    "Qatar Airways",
    "Lenovo",
    "Aramco",
    "AWS",
    "Pirelli",
    "Crypto.com",
    "Gulf Air",
    "Heineken",
    "Rolex",
    "Etihad Airways",
    "Emirates",
    "STC",
    "Louis Vuitton",
    "Moet & Chandon",
    "Tag Heuer",
    "Singapore Airlines",
];

const extractEventId = (ref?: string): string | undefined => {
    const match = ref?.match(/\/events\/(\d+)/);
    return match?.[1];
};

const normalizeSponsorName = (value: string): string =>
    value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

const stripGrandPrixSponsorPrefix = (label: string): string => {
    const trimmed = label.trim();
    const normalizedLabel = normalizeSponsorName(trimmed);
    const prefix = GRAND_PRIX_SPONSOR_PREFIXES.find((candidate) =>
        normalizedLabel.startsWith(`${normalizeSponsorName(candidate)} `)
    );

    return prefix ? trimmed.slice(prefix.length).trim() : trimmed;
};

const formatGrandPrixLabel = (label: string): string =>
    stripGrandPrixSponsorPrefix(label).replace(/\bGrand Prix\b/g, "GP");

const toDate = (value?: string): Date | null => {
    if (!value) return null;
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : new Date(timestamp);
};

const toNumber = (value?: string | number | null): number | undefined => {
    if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
};

const SESSION_DURATION_MINUTES: Record<F1CalendarEvent["sessionLabel"], number> = {
    FP1: 60,
    FP2: 60,
    FP3: 60,
    "Sprint Qualifying": 45,
    Qualifying: 60,
    Sprint: 30,
    Race: 120,
};

const parseCalendarSession = (
    title?: string,
): Pick<F1CalendarEvent, "sessionLabel" | "sessionType"> | null => {
    const normalized = title?.trim().toLowerCase() ?? "";
    if (!normalized) return null;
    if (normalized.includes("sprint qualifying") || normalized.includes("shootout")) {
        return { sessionLabel: "Sprint Qualifying", sessionType: "sprint-qualifying" };
    }
    if (normalized.includes("qualifying")) {
        return { sessionLabel: "Qualifying", sessionType: "qualifying" };
    }
    if (normalized.includes("sprint")) {
        return { sessionLabel: "Sprint", sessionType: "sprint" };
    }
    if (normalized === "race" || normalized.includes("grand prix")) {
        return { sessionLabel: "Race", sessionType: "race" };
    }
    if (normalized.includes("practice 1") || normalized === "fp1") {
        return { sessionLabel: "FP1", sessionType: "practice" };
    }
    if (normalized.includes("practice 2") || normalized === "fp2") {
        return { sessionLabel: "FP2", sessionType: "practice" };
    }
    if (normalized.includes("practice 3") || normalized === "fp3") {
        return { sessionLabel: "FP3", sessionType: "practice" };
    }
    return null;
};

export const normalizeRacePackageCalendar = (
    racePackage: EspnRacePackage,
    eventId: string,
    round: number,
    season: string,
): F1CalendarEvent[] => {
    const packageSeason = racePackage.racestrip?.season;
    if (packageSeason != null && String(packageSeason) !== season) {
        throw new Error(`ESPN race package season ${packageSeason} did not match ${season}`);
    }

    const raceName = stripGrandPrixSponsorPrefix(
        racePackage.racestrip?.name ?? racePackage.racestrip?.shortName ?? "Formula 1 Grand Prix",
    ).replace(/\bGP\b/g, "Grand Prix");
    const venue = racePackage.eventInfo?.venue;
    const location = venue?.address?.city ?? venue?.fullName ?? racePackage.racestrip?.circuit?.name ??
        venue?.address?.country ?? racePackage.racestrip?.circuit?.countryFlag?.alt ?? "Formula 1";

    return (racePackage.racestrip?.sessionDetail ?? [])
        .map<F1CalendarEvent | null>((session) => {
            const sessionInfo = parseCalendarSession(session.titleTab);
            const start = toDate(session.competitionDate);
            if (!sessionInfo || !start) {
                console.warn("Skipping unknown or invalid ESPN calendar session", session.titleTab);
                return null;
            }
            const duration = SESSION_DURATION_MINUTES[sessionInfo.sessionLabel];
            return {
                eventId,
                round,
                season,
                start,
                end: new Date(start.getTime() + duration * 60_000),
                ...sessionInfo,
                location,
                grandPrix: raceName,
            };
        })
        .filter((event): event is F1CalendarEvent => event !== null)
        .sort((a, b) => a.start.getTime() - b.start.getTime());
};

const buildEventIndex = (scoreboard: EspnScoreboard): CalendarEventIndexEntry[] => {
    const calendarById = new Map(
        (scoreboard.leagues?.[0]?.calendar ?? [])
            .map((section) => {
                const eventId = extractEventId(section.event?.$ref);
                return eventId ? [eventId, section] as const : null;
            })
            .filter((entry): entry is readonly [string, EspnCalendarSection] => entry !== null),
    );

    const rawEvents = scoreboard.events ?? [];
    const events = rawEvents
        .map<CalendarEventIndexEntry | null>((event) => {
            const date = toDate(event.date);
            if (!event.id || !date) return null;
            const section = calendarById.get(event.id);
            const sourceLabel = section?.label ?? event.name ?? event.shortName;
            if (!sourceLabel) return null;
            return {
                eventId: event.id,
                label: formatGrandPrixLabel(sourceLabel),
                detail: section?.detail,
                date: date.toISOString(),
            };
        })
        .filter((event): event is CalendarEventIndexEntry => event !== null)
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    if (events.length !== rawEvents.length) {
        throw new Error("ESPN scoreboard contained incomplete calendar events");
    }
    return events;
};

const isValidCalendarSnapshot = (value: unknown, season: string): value is CalendarSnapshot => {
    if (!value || typeof value !== "object") return false;
    const snapshot = value as Partial<CalendarSnapshot>;
    if (
        snapshot.schemaVersion !== CALENDAR_SCHEMA_VERSION ||
        snapshot.season !== season ||
        !toDate(snapshot.refreshedAt) ||
        !Number.isInteger(snapshot.totalRounds) ||
        Number(snapshot.totalRounds) < 1 ||
        !Array.isArray(snapshot.eventIndex) ||
        snapshot.eventIndex.length < 1 ||
        !Array.isArray(snapshot.events)
    ) return false;

    return snapshot.eventIndex.every((event) =>
        typeof event?.eventId === "string" && typeof event?.label === "string" && Boolean(toDate(event?.date))
    ) && snapshot.events.every((event) =>
        typeof event?.eventId === "string" &&
        event.season === season &&
        Boolean(toDate(event.start)) &&
        Boolean(toDate(event.end))
    );
};

const fetchEspnJson = async <T>(url: string, description: string): Promise<T> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${description} failed with status ${response.status}`);
    return response.json() as Promise<T>;
};

const fetchCachedEspnJson = async <T>(
    cache: CacheReader,
    key: string,
    url: string,
    description: string,
): Promise<CachedEspnPayload<T>> => cache<CachedEspnPayload<T>>(
    key,
    CALENDAR_CACHE_TTL_SECONDS,
    async () => ({
        fetchedAt: new Date().toISOString(),
        data: await fetchEspnJson<T>(url, description),
    }),
);

const buildFreshCalendarSnapshot = async (cache: CacheReader, season: string): Promise<CalendarSnapshot> => {
    const cachedScoreboard = await fetchCachedEspnJson<EspnScoreboard>(
        cache,
        `F1CalendarScoreboard:${ESPN_CACHE_KEY_VERSION}:${season}`,
        ESPN_SCOREBOARD_ENDPOINT(season),
        "ESPN scoreboard request",
    );
    const scoreboard = cachedScoreboard.data;
    const eventIndex = buildEventIndex(scoreboard);
    if (!eventIndex.length) throw new Error(`ESPN returned no calendar events for ${season}`);

    const now = Date.now();
    let candidateIndex = 0;
    for (let i = 0; i < eventIndex.length; i++) {
        if (Date.parse(eventIndex[i].date) <= now) candidateIndex = i;
        else break;
    }

    let selectedEvents: F1CalendarEvent[] = [];
    let selectedIndex = candidateIndex;
    let refreshedAt = cachedScoreboard.fetchedAt;
    for (let i = candidateIndex; i < eventIndex.length; i++) {
        const candidate = eventIndex[i];
        const cachedRacePackage = await fetchCachedEspnJson<EspnRacePackage>(
            cache,
            `F1CalendarRacePackage:${ESPN_CACHE_KEY_VERSION}:${candidate.eventId}`,
            ESPN_RACE_PACKAGE_ENDPOINT(candidate.eventId),
            `ESPN race package request for ${candidate.eventId}`,
        );
        const racePackage = cachedRacePackage.data;
        if (Date.parse(cachedRacePackage.fetchedAt) > Date.parse(refreshedAt)) {
            refreshedAt = cachedRacePackage.fetchedAt;
        }
        const events = normalizeRacePackageCalendar(racePackage, candidate.eventId, i + 1, season);
        const sessionCount = racePackage.racestrip?.sessionDetail?.length ?? 0;
        if (
            sessionCount < 5 ||
            events.length !== sessionCount ||
            !events.some((event) => event.sessionLabel === "Race") ||
            !events.some((event) => event.sessionLabel === "Qualifying")
        ) {
            throw new Error(`ESPN returned an incomplete session calendar for ${candidate.eventId}`);
        }
        selectedIndex = i;
        if (events.some((event) => event.end.getTime() >= now)) {
            selectedEvents = events;
            break;
        }
        if (i === eventIndex.length - 1) selectedEvents = [];
    }

    const firstSelectedStart = selectedEvents[0]?.start.getTime();
    const latestResultsIndex = selectedEvents.length && firstSelectedStart != null && firstSelectedStart > now
        ? Math.max(0, selectedIndex - 1)
        : selectedEvents.length
          ? selectedIndex
          : eventIndex.length - 1;

    const snapshot: CalendarSnapshot = {
        schemaVersion: CALENDAR_SCHEMA_VERSION,
        season,
        refreshedAt,
        totalRounds: eventIndex.length,
        eventIndex,
        currentEventId: selectedEvents.length ? eventIndex[selectedIndex]?.eventId : undefined,
        latestResultsEventId: eventIndex[latestResultsIndex]?.eventId,
        events: selectedEvents.map(serializeCalendarEvent),
    };
    if (!isValidCalendarSnapshot(snapshot, season)) throw new Error("ESPN calendar snapshot failed validation");
    return snapshot;
};

export const getCalendarBackupKey = (season: string): string =>
    `F1Calendar:lastGood:${CALENDAR_SCHEMA_VERSION}:${season}`;

export const fetchCalendarSnapshot = async (
    cache: CacheReader,
    backup: CalendarBackupStore,
    season: string,
): Promise<CalendarSnapshotResult> => {
    const backupKey = getCalendarBackupKey(season);
    try {
        const snapshot = await buildFreshCalendarSnapshot(cache, season);
        if (!isValidCalendarSnapshot(snapshot, season)) throw new Error("Cached ESPN calendar snapshot failed validation");
        const serialized = JSON.stringify(snapshot);
        if (await backup.read(backupKey) !== serialized) {
            await backup.write(backupKey, serialized);
        }
        return { snapshot, isStale: false };
    } catch (error) {
        console.error("Unable to refresh ESPN calendar; attempting last-good snapshot", error);
        const stored = await backup.read(backupKey);
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as unknown;
                if (isValidCalendarSnapshot(parsed, season)) return { snapshot: parsed, isStale: true };
            } catch (parseError) {
                console.error("Unable to parse last-good ESPN calendar snapshot", parseError);
            }
        }
        throw new Error(`Formula 1 calendar is unavailable for ${season}`);
    }
};

export const hydrateCalendarSnapshotEvents = (snapshot: CalendarSnapshot): F1CalendarEvent[] =>
    hydrateCalendarEvents(snapshot.events);

const grandPrixOptionsFromSnapshot = (snapshot: CalendarSnapshot): GrandPrixOption[] =>
    snapshot.eventIndex.map(({ eventId, label, detail }) => ({ eventId, label, detail }));

const buildSessionSchedule = (racePackage: EspnRacePackage): SessionScheduleEntry[] =>
    (racePackage.racestrip?.sessionDetail ?? [])
        .map<SessionScheduleEntry | null>((session) => {
            const sessionInfo = parseCalendarSession(session.titleTab);
            const start = toDate(session.competitionDate);
            if (!sessionInfo || !start) return null;
            return {
                competitionId: session.competitionId,
                titleTab: session.titleTab?.trim() || sessionInfo.sessionLabel,
                start: start.toISOString(),
                end: new Date(
                    start.getTime() + SESSION_DURATION_MINUTES[sessionInfo.sessionLabel] * 60_000,
                ).toISOString(),
            };
        })
        .filter((session): session is SessionScheduleEntry => session !== null)
        .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

const splitDisplayName = (displayName?: string): { firstName?: string; lastName?: string } => {
    if (!displayName) return {};
    const [first, ...rest] = displayName.trim().split(/\s+/);
    return { firstName: first, lastName: rest.length ? rest.join(" ") : undefined };
};

const normalizeSessionType = (entry: EspnPositionEntry): string => {
    const reference = `${entry.raceType ?? ""} ${entry.titleTab ?? ""}`.toLowerCase();
    if (reference.includes("race") && !reference.includes("sprint")) return "race";
    if (reference.includes("sprint") && reference.includes("qualifying")) return "sprint-qualifying";
    if (reference.includes("sprint")) return "sprint";
    if (reference.includes("qualifying")) return "qualifying";
    return "practice";
};

const deriveSessionKey = (entry: EspnPositionEntry): number =>
    toNumber(entry.competitionId ?? undefined) ??
    toNumber(toDate(entry.date)?.getTime() ?? undefined) ??
    Math.floor(Date.now() / 1000);

const mapResults = (entry: EspnPositionEntry, sessionKey: number): SessionResultEntry[] =>
    entry.positions?.map((position) => {
        const athlete = position.athleteInfo ?? {};
        const state = position.stateInfo ?? {};
        const nameFromDisplay = splitDisplayName(athlete.displayName ?? athlete.shortName);
        const positionNumber = toNumber(position.order ?? state.place) ?? null;
        const qualifyingSegment = position.q3?.displayValue
            ? "Q3"
            : position.q2?.displayValue
              ? "Q2"
              : position.q1?.displayValue
                ? "Q1"
                : undefined;
        let timeValue =
            positionNumber === 1
                ? (state.totalTime ?? position.q3?.displayValue ?? position.q2?.displayValue ?? position.q1?.displayValue ?? state.displayValue ?? "")
                : (state.fomGapToLeader ?? state.behindTime ?? state.totalTime ?? position.q3?.displayValue ?? position.q2?.displayValue ?? position.q1?.displayValue ?? state.displayValue ?? "");

        if (state.displayValue === "Retired") timeValue = "DNF";
        if (state.displayValue === "DQ") timeValue = "DQ";

        return {
            session_key: sessionKey,
            position: positionNumber,
            driver_number: toNumber(athlete.vehicle?.number ?? undefined),
            driver_first_name: nameFromDisplay.firstName ?? athlete.firstName,
            driver_last_name: nameFromDisplay.lastName ?? athlete.lastName,
            driver_short_name: athlete.abbreviation ?? athlete.shortDisplayName ?? athlete.shortName,
            team_name: athlete.team ?? athlete.vehicle?.manufacturer ?? undefined,
            time: timeValue,
            points: toNumber(state.points ?? undefined),
            number_of_laps: toNumber(state.lapsCompleted ?? undefined),
            qualifyingSegment,
        };
    }) ?? [];

const buildSessionSummary = (
    racePackage: EspnRacePackage,
    entry: EspnPositionEntry,
    sessionKey: number,
): SessionDetails => {
    const raceInfo = racePackage.racestrip ?? {};
    const date = entry.date ?? raceInfo.date ?? raceInfo.endDate;
    const totalLaps = toNumber(racePackage.eventInfo?.venue?.circuit?.laps);
    return {
        session_key: sessionKey,
        session_name: entry.titleTab ?? entry.raceType ?? "Session",
        session_type: normalizeSessionType(entry),
        location: raceInfo.name ?? raceInfo.circuit?.name,
        country_name: raceInfo.circuit?.countryFlag?.alt,
        date_start: date,
        date_end: date,
        meeting_key: raceInfo.season,
        year: raceInfo.season,
        circuit_short_name: raceInfo.shortName ?? raceInfo.name,
        total_laps: totalLaps,
    };
};

const getSessionTitle = (entry: EspnPositionEntry): string =>
    entry.titleTab ?? entry.raceType ?? "Session";

const mapSessionWithResults = (
    racePackage: EspnRacePackage,
    entry: EspnPositionEntry,
): LatestSessionResults | null => {
    const sessionKey = deriveSessionKey(entry);
    const results = mapResults(entry, sessionKey).filter((result) => result.position != null);
    if (!results.length) return null;

    return {
        titleTab: getSessionTitle(entry),
        session: buildSessionSummary(racePackage, entry, sessionKey),
        results,
    };
};

const buildSessionOptions = (racePackage: EspnRacePackage): SessionOption[] => {
    const seen = new Set<string>();
    const options: SessionOption[] = [];

    for (const commentary of racePackage.commentaries ?? []) {
        const titleTab = commentary.titleTab?.trim();
        if (!titleTab || seen.has(titleTab)) continue;
        seen.add(titleTab);
        options.push({
            competitionId: commentary.competitionId,
            titleTab,
            titleModule: commentary.titleModule,
        });
    }

    if (options.length) return options;

    for (const position of racePackage.positions ?? []) {
        const titleTab = getSessionTitle(position).trim();
        if (!titleTab || seen.has(titleTab)) continue;
        seen.add(titleTab);
        options.push({ competitionId: position.competitionId, titleTab });
    }

    return options.reverse();
};

const selectLatestAvailableSession = (
    sessions: LatestSessionResults[],
    options: SessionOption[],
): LatestSessionResults | null => {
    const sessionByTitle = new Map(sessions.map((session) => [session.titleTab, session]));
    for (const option of [...options].reverse()) {
        const session = sessionByTitle.get(option.titleTab);
        if (session) return session;
    }
    return sessions[0] ?? null;
};

export const fetchLatestSession = async (
    cache: CacheReader,
    calendar: CalendarSnapshot,
    eventId?: string,
): Promise<LatestSessionPayload> => {
    const grandPrixOptions = grandPrixOptionsFromSnapshot(calendar);
    const latestEspnId = eventId ?? calendar.latestResultsEventId ?? calendar.currentEventId;
    if (!latestEspnId) return null;

    const racePackage = await cache<EspnRacePackage | null>(`LatestSessionRacePackage:${ESPN_CACHE_KEY_VERSION}:${latestEspnId}`, RACE_PACKAGE_CACHE_TTL_SECONDS, async () => {
        const response = await fetch(ESPN_RACE_PACKAGE_ENDPOINT(latestEspnId));
        return response.ok ? ((await response.json()) as EspnRacePackage) : null;
    });
    if (!racePackage) return null;

    const sessions = (racePackage.positions ?? [])
        .map((entry) => mapSessionWithResults(racePackage, entry))
        .filter((entry): entry is LatestSessionResults => entry !== null);

    const options = buildSessionOptions(racePackage);
    const sessionSchedule = buildSessionSchedule(racePackage);
    const selected = selectLatestAvailableSession(sessions, options);
    if (!selected) {
        const fallbackSession: SessionDetails = {
            session_key: toNumber(racePackage.commentaries?.[0]?.competitionId) ?? Math.floor(Date.now() / 1000),
            session_name: racePackage.commentaries?.[0]?.titleTab ?? "Session",
            session_type: "practice",
            location: racePackage.racestrip?.name ?? "Formula 1",
            country_name: racePackage.racestrip?.circuit?.countryFlag?.alt,
            date_start: racePackage.racestrip?.date,
            date_end: racePackage.racestrip?.endDate,
            meeting_key: racePackage.racestrip?.season,
            year: racePackage.racestrip?.season,
            circuit_short_name: racePackage.racestrip?.shortName ?? racePackage.racestrip?.name,
            total_laps: toNumber(racePackage.eventInfo?.venue?.circuit?.laps),
        };
        return {
            session: fallbackSession,
            results: [],
            selectedEventId: latestEspnId,
            grandPrixOptions,
            selectedTitleTab: options[0]?.titleTab,
            options,
            sessions,
            sessionSchedule,
        };
    }

    return {
        session: selected.session,
        results: selected.results,
        selectedEventId: latestEspnId,
        grandPrixOptions,
        selectedTitleTab: selected.titleTab,
        options,
        sessions,
        sessionSchedule,
    };
};

const createEmptySessions = (): Record<F1Session, string> => ({
    fp1: "",
    fp2: "",
    fp3: "",
    qualifying: "",
    sprint: "",
    "sprint-qualifying": "",
    race: "",
});

const mapToF1Session = (session: SessionDetails): F1Session | null => {
    const type = session.session_type?.toLowerCase() ?? "";
    const name = session.session_name?.toLowerCase() ?? "";
    if (type === "race") return "race";
    if (type === "qualifying") return "qualifying";
    if (type.includes("sprint")) return name.includes("shootout") || name.includes("qualifying") ? "sprint-qualifying" : "sprint";
    if (type === "practice" || name.includes("practice")) {
        if (name.includes(" 2") || name.endsWith("2")) return "fp2";
        if (name.includes(" 3") || name.endsWith("3")) return "fp3";
        return "fp1";
    }
    return null;
};

export const formatSessionResults = (
    session: SessionDetails,
    results?: SessionResultEntry[],
): F1RaceResult | null => {
    if (!Array.isArray(results) || results.length === 0) return null;

    const sessionKey = `session-${session.session_key}`;
    const f1Session = mapToF1Session(session) ?? "race";
    const sessionDate = session.date_start ?? session.date_end ?? "";
    const sessions = createEmptySessions();
    if (sessionDate) sessions[f1Session] = sessionDate;

    const formatDuration = (duration?: number | null): string | undefined => {
        if (duration == null || Number.isNaN(duration)) return undefined;
        const totalSeconds = Math.floor(duration);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const millis = Math.round((duration - totalSeconds) * 1000);
        return `${minutes}:${seconds.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`;
    };

    const formatGap = (gap?: number | string | null): string | undefined => {
        if (gap == null) return undefined;
        if (typeof gap === "string") return gap;
        return Number.isFinite(gap) ? `+${gap.toFixed(3)}s` : undefined;
    };

    const formattedResults = results
        .map<F1Result | null>((result) => {
            if (result.position == null) return null;
            const displayName = `${result.driver_first_name ?? ""} ${result.driver_last_name ?? ""}`.trim() ||
                result.driver_short_name?.toUpperCase() ||
                (result.driver_number ? `Driver ${result.driver_number}` : "Unknown Driver");
            const fallbackSource = displayName.split(" ").filter(Boolean).pop() ?? "";
            const driverCode = (result.driver_short_name ?? fallbackSource.slice(0, 3) ?? "UNK").toUpperCase();
            return {
                position: result.position,
                driver: {
                    name: displayName,
                    code: driverCode || "UNK",
                    number: result.driver_number ?? 0,
                },
                team: result.team_name ?? "Unknown Team",
                time: result.time ?? formatDuration(result.duration) ?? formatGap(result.gap_to_leader),
                points: result.points ?? 0,
            };
        })
        .filter((result): result is F1Result => result !== null)
        .sort((a, b) => a.position - b.position);

    if (!formattedResults.length) return null;

    return {
        event: {
            name: session.location ?? session.country_name ?? "Formula 1",
            location: session.country_name ?? session.location ?? "Unknown",
            round: 1,
            slug: sessionKey,
        },
        results: formattedResults,
        session: f1Session,
        date: session.date_end ?? session.date_start ?? new Date().toISOString(),
    };
};

const findStatNumber = (stats: StandingsStat[] | undefined, statName: string): number | undefined => {
    const stat = stats?.find((item) => (item.name ?? "").toLowerCase() === statName.toLowerCase());
    return stat ? toNumber(stat.value) ?? toNumber(stat.displayValue) : undefined;
};

const mapStandingsEntries = (
    entries: RawStandingsEntry[] | undefined,
    type: "driver" | "constructor",
): StandingsEntrySummary[] =>
    (entries ?? [])
        .map<StandingsEntrySummary | null>((entry) => {
            const rank = findStatNumber(entry.stats, "rank");
            const points = findStatNumber(entry.stats, type === "driver" ? "championshipPts" : "points");
            if (rank == null || points == null) return null;

            const nameSource = type === "driver" ? entry.athlete : entry.team;
            const subtitleSource = type === "driver" ? entry.team : undefined;
            const parts = (nameSource?.displayName ?? "").trim().split(/\s+/);
            const lastName = type === "driver" && parts.length > 1 ? parts[parts.length - 1] : "";

            return {
                rank,
                points,
                name: type === "driver" ? lastName || nameSource?.displayName || "Unknown" : nameSource?.displayName ?? "Unknown",
                fullName: nameSource?.displayName ?? "Unknown",
                code: nameSource?.abbreviation,
                subtitle: subtitleSource?.displayName,
            };
        })
        .filter((entry): entry is StandingsEntrySummary => entry !== null)
        .sort((a, b) => a.rank - b.rank);

export const fetchStandings = async (
    cache: CacheReader,
    season?: string,
): Promise<StandingsSummary> => {
    try {
        const payload = await cache<{ children?: RawStandingsCategory[] }>(`DriverAndTeamStandingsData:${ESPN_CACHE_KEY_VERSION}`, STANDINGS_CACHE_TTL_SECONDS, async () => {
            const response = await fetch(season ? `${STANDINGS_ENDPOINT}?season=${season}` : STANDINGS_ENDPOINT);
            if (!response.ok) throw new Error(`Failed to fetch standings: ${response.status}`);
            return (await response.json()) as { children?: RawStandingsCategory[] };
        });
        const categories = Array.isArray(payload.children) ? payload.children : [];
        const findCategory = (label: string) =>
            categories.find((category) => (category.name ?? "").toLowerCase() === label.toLowerCase());
        return {
            drivers: mapStandingsEntries(findCategory("Driver Standings")?.standings?.entries, "driver"),
            constructors: mapStandingsEntries(findCategory("Constructor Standings")?.standings?.entries, "constructor"),
        };
    } catch {
        return { drivers: [], constructors: [] };
    }
};
