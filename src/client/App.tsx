import { faGithub } from "@fortawesome/free-brands-svg-icons";
import { faArrowUpFromBracket, faCalendarDays, faInfo, faRotateRight, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { exitExpandedMode, navigateTo, requestExpandedMode, showForm } from "@devvit/web/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import {
    findCurrentOrNextEvent,
    hydrateCalendarEvents,
    type SerializedF1CalendarEvent,
} from "../shared/calendarParser.js";
import { convertToF1Event, formatDateTime, versionLt } from "../shared/common.js";
import { getSessionFullName, SHORT_SESSION_NAMES, teamThemes } from "../shared/constants.js";
import type {
    LatestSessionPayload,
    SessionResultEntry,
    SessionScheduleEntry,
    StandingsEntrySummary,
    StandingsSummary,
} from "../shared/f1Data.js";

type DevvitWebViewGlobal = {
    context?: {
        appVersion?: string;
        postData?: Record<string, unknown>;
        subredditName?: string;
    };
};

type Tab = "home" | "drivers" | "constructors";
type Loadable<T> = {
    data: T | null;
    loading: boolean;
    error: string | null;
};

type AppMeta = {
    isModerator?: boolean;
    latestVersion?: string;
    totalRounds?: number;
    now?: string;
};

const normalizeTeam = (team: unknown) => {
    if (typeof team !== "string" || !(team in teamThemes)) {
        return "f1";
    }
    return team;
};

const readPostTeam = () =>
    normalizeTeam(
        ((globalThis as typeof globalThis & { devvit?: DevvitWebViewGlobal }).devvit
            ?.context?.postData as { team?: unknown } | undefined)?.team,
    );

const readAppVersion = () =>
    (globalThis as typeof globalThis & { devvit?: DevvitWebViewGlobal }).devvit?.context
        ?.appVersion;

const readSubredditName = () =>
    (globalThis as typeof globalThis & { devvit?: DevvitWebViewGlobal }).devvit?.context
        ?.subredditName;

const fetchJson = async <T,>(path: string): Promise<T> => {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }
    return response.json() as Promise<T>;
};

const formatDuration = (targetDate: Date) => {
    const diff = Math.max(0, targetDate.getTime() - Date.now());
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 0) {
        return `${days}D ${hours}H`;
    }

    if (hours === 0) {
        return `${minutes}M`;
    }

    return `${hours}H ${minutes}M`;
};

const isFiniteNumber = (value?: number | null): value is number =>
    typeof value === "number" && Number.isFinite(value);

const formatLiveLaps = (laps?: number | null, totalLaps?: number | null) => {
    if (!isFiniteNumber(laps) || !isFiniteNumber(totalLaps)) return null;
    return `${laps}/${totalLaps}`;
};

type CalendarApiResponse = {
    season: string;
    refreshedAt: string;
    isStale: boolean;
    totalRounds: number;
    events: SerializedF1CalendarEvent[];
};

const normalizeTeamName = (team: string): string =>
    team.toLowerCase().replace(/[^a-z0-9]+/g, "");

const resultMatchesTheme = (resultTeam: string | undefined, activeTheme: string): boolean => {
    if (!resultTeam || activeTheme === "f1") return false;
    const normalizedResult = normalizeTeamName(resultTeam);
    const aliases: Record<string, string[]> = {
        astonmartin: ["astonmartin"],
        redbull: ["redbull", "redbullracing"],
    };
    return (aliases[activeTheme] ?? [normalizeTeamName(activeTheme)])
        .some((candidate) => normalizedResult.includes(candidate));
};

const CALENDAR_STORAGE_KEY = "f1-calendar:v1";

const readCachedCalendar = (): CalendarApiResponse | null => {
    if (typeof window === "undefined") return null;
    try {
        const stored = window.localStorage.getItem(CALENDAR_STORAGE_KEY);
        if (!stored) return null;
        const parsed = JSON.parse(stored) as Partial<CalendarApiResponse>;
        if (
            typeof parsed.season !== "string" ||
            typeof parsed.refreshedAt !== "string" ||
            typeof parsed.totalRounds !== "number" ||
            !Array.isArray(parsed.events)
        ) return null;
        return parsed as CalendarApiResponse;
    } catch {
        return null;
    }
};

const cacheCalendarLocally = (calendar: CalendarApiResponse): void => {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(calendar));
    } catch {
        // Redis-backed server data remains the source of truth when browser storage is unavailable.
    }
};

const formatPracticeLaps = (laps?: number | null) =>
    isFiniteNumber(laps) ? `Lap ${laps}` : null;

const mapSlugFromLocation = (name: string) =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "_")
        .replace(/^_+|_+$/g, "");

const isMapEntrypoint = () =>
    typeof window !== "undefined" &&
    (window.location.pathname.endsWith("/map.html") ||
        new URLSearchParams(window.location.search).get("view") === "map");

const formatRank = (rank?: number | null): string => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return rank == null ? "-" : `${rank}`;
};

const isMedalRank = (rank?: number | null): boolean => rank === 1 || rank === 2 || rank === 3;

function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(() =>
        typeof window === "undefined" ? false : window.matchMedia(query).matches,
    );

    useEffect(() => {
        const mediaQuery = window.matchMedia(query);
        const onChange = () => setMatches(mediaQuery.matches);
        onChange();
        mediaQuery.addEventListener("change", onChange);
        return () => mediaQuery.removeEventListener("change", onChange);
    }, [query]);

    return matches;
}

function useNow(intervalMs = 1000) {
    const [, setTick] = useState(0);

    useEffect(() => {
        const interval = window.setInterval(
            () => setTick((value) => value + 1),
            intervalMs,
        );
        return () => window.clearInterval(interval);
    }, [intervalMs]);
}

function ActionButton({
    children,
    onClick,
    variant = "solid",
}: {
    children: React.ReactNode;
    onClick: () => void;
    variant?: "solid" | "ghost";
}) {
    return (
        <button
            className={`action-button action-button--${variant}`}
            type="button"
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function StatusPill({ children }: { children: React.ReactNode }) {
    return <span className="status-pill">{children}</span>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
    return (
        <div className="empty-state">
            <strong>{title}</strong>
            {detail ? <span>{detail}</span> : null}
        </div>
    );
}

const formatScheduleTime = (session: SessionScheduleEntry): string => {
    const start = new Date(session.start);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const date = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
    }).format(start);
    const time = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).format(start);
    return `${date} · ${time}`;
};

function SessionSchedule({ schedule }: { schedule: SessionScheduleEntry[] }) {
    if (!schedule.length) {
        return <EmptyState title="Schedule unavailable" detail="" />;
    }

    return (
        <div className="session-schedule">
            {schedule.map((session) => (
                <div className="session-schedule-row" key={session.competitionId ?? `${session.titleTab}-${session.start}`}>
                    <span>{session.titleTab}</span>
                    <time dateTime={session.start}>{formatScheduleTime(session)}</time>
                </div>
            ))}
        </div>
    );
}

function AwaitingResults({ schedule }: { schedule: SessionScheduleEntry[] }) {
    return (
        <div className="awaiting-results">
            <strong>Awaiting results</strong>
            {schedule.length ? <SessionSchedule schedule={schedule} /> : null}
        </div>
    );
}

function Pager({
    page,
    pageCount,
    onPageChange,
}: {
    page: number;
    pageCount: number;
    onPageChange: (page: number) => void;
}) {
    if (pageCount <= 1) {
        return null;
    }

    return (
        <div className="pager">
            <button
                type="button"
                onClick={() => onPageChange(Math.max(0, page - 1))}
                disabled={page === 0}
            >
                Prev
            </button>
            <span>
                {page + 1}/{pageCount}
            </span>
            <button
                type="button"
                onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
                disabled={page === pageCount - 1}
            >
                Next
            </button>
        </div>
    );
}

function LatestResults({
    payload,
    loading,
    error,
    selectedTitle,
    activeTheme,
}: {
    payload: LatestSessionPayload | null;
    loading: boolean;
    error: string | null;
    selectedTitle?: string | null;
    activeTheme: string;
}) {
    const isCompact = useMediaQuery("(max-width: 620px)");
    const [page, setPage] = useState(0);
    const pageSize = 11;
    const selectedSession =
        selectedTitle && payload?.sessions
            ? payload.sessions.find((session) => session.titleTab === selectedTitle)
            : undefined;
    const results = selectedTitle ? selectedSession?.results ?? [] : payload?.results ?? [];
    const pageCount = isCompact ? Math.ceil(results.length / pageSize) : 1;
    const visibleResults = isCompact
        ? results.slice(page * pageSize, page * pageSize + pageSize)
        : results;

    useEffect(() => {
        setPage(0);
    }, [results.length, isCompact, selectedTitle]);

    useEffect(() => {
        if (pageCount > 0 && page >= pageCount) {
            setPage(pageCount - 1);
        }
    }, [page, pageCount]);

    if (loading && !payload) {
        return (
            <EmptyState
                title="Loading timing data"
                detail=""
            />
        );
    }

    if (error && !payload) {
        return <EmptyState title="Results unavailable" detail={error} />;
    }

    if (!results.length) {
        return <AwaitingResults schedule={payload?.sessionSchedule ?? []} />;
    }

    return (
        <>
            <div className="results-list">
                {visibleResults.map((result: SessionResultEntry) => {
                    const driverName =
                        `${result.driver_first_name ?? ""} ${result.driver_last_name ?? ""}`.trim() ||
                        result.driver_short_name ||
                        "Unknown Driver";
                    return (
                        <div
                            className={`result-row ${
                                result.position != null && result.position <= 3
                                    ? "is-podium"
                                    : ""
                            }`}
                            key={`${result.position}-${result.driver_short_name ?? driverName}`}
                        >
                            <span className={`position ${isMedalRank(result.position) ? "position--medal" : ""}`}>
                                {formatRank(result.position)}
                            </span>
                            <div>
                                <strong className={resultMatchesTheme(result.team_name, activeTheme) ? "is-theme-driver" : undefined}>
                                    {driverName}
                                </strong>
                                <span>{result.team_name || result.driver_short_name || "Formula 1"}</span>
                            </div>
                            <span className="points">
                                <span>
                                    {result.points
                                        ? `${result.points} pts`
                                        : result.time || (result.dnf ? "DNF" : "-")}
                                </span>
                                {result.qualifyingSegment ? (
                                    <small className="result-segment">({result.qualifyingSegment})</small>
                                ) : null}
                            </span>
                        </div>
                    );
                })}
            </div>
            {isCompact ? <Pager page={page} pageCount={pageCount} onPageChange={setPage} /> : null}
        </>
    );
}

function StandingsList({
    title,
    entries,
    loading,
    error,
    variant = "grid",
    showFullName = false,
    activeTheme,
}: {
    title: string;
    entries: StandingsEntrySummary[];
    loading: boolean;
    error: string | null;
    variant?: "grid" | "single";
    showFullName?: boolean;
    activeTheme?: string;
}) {
    const [expanded, setExpanded] = useState<string | null>(null);
    const isCompact = useMediaQuery("(max-width: 620px)");
    const [page, setPage] = useState(0);
    const pageSize = 11;
    const pageCount = isCompact ? Math.ceil(entries.length / pageSize) : 1;
    const visibleEntries = isCompact
        ? entries.slice(page * pageSize, page * pageSize + pageSize)
        : entries;

    useEffect(() => {
        setPage(0);
        setExpanded(null);
    }, [entries.length, isCompact, variant]);

    useEffect(() => {
        if (pageCount > 0 && page >= pageCount) {
            setPage(pageCount - 1);
        }
    }, [page, pageCount]);

    if (loading && !entries.length) {
        return (
            <EmptyState
                title={`Loading ${title.toLowerCase()}`}
                detail="Fetching championship order."
            />
        );
    }

    if (error && !entries.length) {
        return <EmptyState title={`${title} unavailable`} detail={error} />;
    }

    if (!entries.length) {
        return (
            <EmptyState
                title={`No ${title.toLowerCase()} found`}
                detail="Standings will appear here after a successful refresh."
            />
        );
    }

    return (
        <>
            <div className={`standings-list standings-list--${variant}`}>
                {visibleEntries.map((entry) => {
                    const originalIndex = entries.findIndex(
                        (item) => item.rank === entry.rank && item.name === entry.name,
                    );
                    const id = `${entry.rank}-${entry.name}`;
                    const isExpanded = expanded === id;
                    const delta =
                        originalIndex <= 0
                            ? undefined
                            : Math.max(
                                  0,
                                  (entries[originalIndex - 1]?.points ?? entry.points) -
                                      entry.points,
                              );
                    return (
                        <button
                            className={`standing-row ${isExpanded ? "is-expanded" : ""}`}
                            key={id}
                            type="button"
                            onClick={() => setExpanded(isExpanded ? null : id)}
                        >
                            <span className={`position ${isMedalRank(entry.rank) ? "position--medal" : ""}`}>
                                {formatRank(entry.rank)}
                            </span>
                            <div>
                                <strong className={activeTheme && resultMatchesTheme(entry.name, activeTheme) ? "is-theme-team" : undefined}>
                                    {showFullName ? entry.fullName ?? entry.name : entry.name}
                                </strong>
                                <span>{entry.subtitle || entry.code || entry.fullName || "Formula 1"}</span>
                            </div>
                            <span className="points points--standings">
                                <span>{entry.points}</span>
                                {delta == null ? <small></small> : <small>-{delta}</small>}
                            </span>
                        </button>
                    );
                })}
            </div>
            {isCompact ? <Pager page={page} pageCount={pageCount} onPageChange={setPage} /> : null}
        </>
    );
}

function MapModal({
    mapSlug,
    onClose,
    expanded,
}: {
    mapSlug: string | null;
    onClose: () => void;
    expanded: boolean;
}) {
    if (!mapSlug) {
        return null;
    }

    const closeMap = (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        if (expanded) {
            try {
                exitExpandedMode(event.nativeEvent);
                return;
            } catch {
                // Keep the close action useful during local browser testing.
            }
        }
        onClose();
    };

    return (
        <div className="modal-backdrop" role="presentation" onClick={closeMap}>
            <div
                className={`map-modal${expanded ? " map-modal--expanded" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-label="Circuit map"
                onClick={(event) => event.stopPropagation()}
            >
                <button
                    className="close-button"
                    type="button"
                    onClick={closeMap}
                    aria-label="Close map"
                >
                    X
                </button>
                <TransformWrapper
                    initialScale={1}
                    minScale={1}
                    maxScale={4}
                    centerOnInit
                    centerZoomedOut
                    wheel={{ step: 0.15 }}
                    pinch={{ step: 4 }}
                    doubleClick={{ mode: "toggle", step: 1 }}
                    panning={{ velocityDisabled: true }}
                >
                    <TransformComponent
                        wrapperClass="map-transform-wrapper"
                        contentClass="map-transform-content"
                    >
                        <img
                            src={`/maps/${mapSlug}.png`}
                            alt="Circuit map"
                            draggable={false}
                        />
                    </TransformComponent>
                </TransformWrapper>
            </div>
        </div>
    );
}

export function App() {
    const [initialCalendar] = useState(readCachedCalendar);
    const [mapOpenedExpanded] = useState(isMapEntrypoint);
    const [tab, setTab] = useState<Tab>("home");
    const [team] = useState(readPostTeam);
    const [appVersion] = useState(readAppVersion);
    const [subredditName] = useState(readSubredditName);
    const [selectedGrandPrixId, setSelectedGrandPrixId] = useState<string | null>(null);
    const [selectedResultTitle, setSelectedResultTitle] = useState<string | null>(null);
    const [showCalendar, setShowCalendar] = useState(false);
    const resultsSelectionBeforeCalendar = useRef<{
        eventId: string | null;
        sessionTitle: string | null;
    } | null>(null);
    const [latest, setLatest] = useState<Loadable<LatestSessionPayload>>({
        data: null,
        loading: true,
        error: null,
    });
    const [standings, setStandings] = useState<Loadable<StandingsSummary>>({
        data: null,
        loading: true,
        error: null,
    });
    const [calendar, setCalendar] = useState<Loadable<CalendarApiResponse>>({
        data: initialCalendar,
        loading: initialCalendar === null,
        error: null,
    });
    const [meta, setMeta] = useState<AppMeta>({});
    const [mapSlug, setMapSlug] = useState<string | null>(null);
    const theme = teamThemes[team] ?? teamThemes.f1;

    useNow();

    const calendarState = useMemo(() => {
        const calendarEvents = hydrateCalendarEvents(calendar.data?.events ?? []);
        const status = findCurrentOrNextEvent(calendarEvents);
        const index = status.currentIndex ?? status.nextIndex ?? 0;
        const event = calendarEvents[index];
        return {
            status,
            event,
            eventModel: event
                ? convertToF1Event(event, calendar.data?.totalRounds ?? meta.totalRounds ?? 24)
                : null,
        };
    }, [calendar.data, meta.totalRounds]);

    const loadCalendar = useCallback(async () => {
        setCalendar((value) => ({ ...value, loading: true, error: null }));
        try {
            const response = await fetchJson<CalendarApiResponse>("/api/calendar");
            cacheCalendarLocally(response);
            setCalendar({ data: response, loading: false, error: null });
        } catch (error) {
            setCalendar((value) => ({
                data: value.data,
                loading: false,
                error: error instanceof Error ? error.message : "Unable to load calendar.",
            }));
        }
    }, []);

    const loadLatest = useCallback(async () => {
        setLatest((value) => ({ ...value, loading: true, error: null }));
        try {
            const path = selectedGrandPrixId
                ? `/api/latest-session?eventId=${encodeURIComponent(selectedGrandPrixId)}`
                : "/api/latest-session";
            const response = await fetchJson<{ latestSession: LatestSessionPayload }>(
                path,
            );
            setLatest({ data: response.latestSession, loading: false, error: null });
        } catch (error) {
            setLatest((value) => ({
                data: value.data,
                loading: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Unable to load latest session.",
            }));
        }
    }, [selectedGrandPrixId]);

    const loadStandings = useCallback(async () => {
        setStandings((value) => ({ ...value, loading: true, error: null }));
        try {
            const response = await fetchJson<StandingsSummary>("/api/standings");
            setStandings({ data: response, loading: false, error: null });
        } catch (error) {
            setStandings((value) => ({
                data: value.data,
                loading: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Unable to load standings.",
            }));
        }
    }, []);

    const refreshAll = useCallback(() => {
        void loadCalendar();
        void loadLatest();
        void loadStandings();
        void fetchJson<AppMeta>("/api/app-meta").then(setMeta).catch(() => undefined);
    }, [loadCalendar, loadLatest, loadStandings]);

    useEffect(() => {
        refreshAll();
    }, [refreshAll]);

    useEffect(() => {
        setSelectedResultTitle(latest.data?.selectedTitleTab ?? null);
    }, [latest.data?.selectedTitleTab]);

    useEffect(() => {
        if (latest.data?.selectedEventId) {
            setSelectedGrandPrixId(latest.data.selectedEventId);
        }
    }, [latest.data?.selectedEventId]);

    useEffect(() => {
        if (!calendarState.status.isCurrentlyInEvent) {
            return;
        }
        const interval = window.setInterval(refreshAll, 30000);
        return () => window.clearInterval(interval);
    }, [calendarState.status.isCurrentlyInEvent, refreshAll]);

    const nextEvent = calendarState.event;
    const calendarIsPending = calendar.loading && !calendar.data;
    useEffect(() => {
        if (isMapEntrypoint() && nextEvent && !mapSlug) {
            setMapSlug(mapSlugFromLocation(nextEvent.location));
        }
    }, [mapSlug, nextEvent]);

    const nextSession = calendarState.eventModel?.nextSession;
    const countdownTarget = nextEvent?.start;
    const listTitle =
        tab === "home"
            ? latest.data?.session.location ?? latest.data?.session.circuit_short_name ?? "Latest Session"
            : tab === "drivers"
              ? "Driver Standings"
              : "Constructor Standings";
    const resultOptions = latest.data?.options ?? [];
    const grandPrixOptions = latest.data?.grandPrixOptions ?? [];
    const selectedGrandPrixValue = selectedGrandPrixId ?? latest.data?.selectedEventId ?? "";
    const selectedResultValue =
        selectedResultTitle ??
        latest.data?.selectedTitleTab ??
        latest.data?.session.session_name ??
        "";
    const fallbackTimerValue = countdownTarget ? formatDuration(countdownTarget) : "--";
    const currentSessionLabel = nextEvent?.sessionLabel;
    const liveLapCount = latest.data?.results[0]?.number_of_laps;
    const timerValue =
        calendarState.status.isCurrentlyInEvent &&
        (currentSessionLabel === "Race" || currentSessionLabel === "Sprint")
            ? (formatLiveLaps(liveLapCount, latest.data?.session.total_laps) ??
              fallbackTimerValue)
            : calendarState.status.isCurrentlyInEvent &&
                (currentSessionLabel === "FP1" ||
                    currentSessionLabel === "FP2" ||
                    currentSessionLabel === "FP3")
              ? (formatPracticeLaps(liveLapCount) ?? fallbackTimerValue)
              : countdownTarget
                ? fallbackTimerValue
                : "--";
    const shouldShowUpdateIcon =
        Boolean(meta.isModerator && appVersion && meta.latestVersion) &&
        versionLt(appVersion ?? "0.0.0", meta.latestVersion ?? "0.0.0");
    const showAboutApp = useCallback(async () => {
        const result = await showForm({
            title: `About Formula 1 App${appVersion ? ` - v${appVersion}` : ""}`,
            description:
                "Track live sessions, results, and championship standings.",
            acceptLabel: "Learn More",
            cancelLabel: "Cancel",
            fields: [],
        });

        if (result.action === "SUBMITTED") {
            navigateTo("https://developers.reddit.com/apps/formula1-app");
        }
    }, [appVersion]);
    const showGitHubIssuesForm = useCallback(async () => {
        const result = await showForm({
            title: "GitHub Issues",
            description: "Use GitHub Issues to report bugs, request features, or share feedback.",
            acceptLabel: "Open GitHub",
            cancelLabel: "Cancel",
            fields: [],
        });

        if (result.action === "SUBMITTED") {
            navigateTo("https://github.com/iwnedxw-reddit/formula1app/issues");
        }
    }, []);
    const showUpdateForm = useCallback(async () => {
        const result = await showForm({
            title: "App Update Available (This is only shown for Mods)",
            description: "A new version of the app is available. Please update.",
            acceptLabel: "Update",
            cancelLabel: "Later",
            fields: [],
        });

        if (result.action === "SUBMITTED") {
            navigateTo(
                subredditName
                    ? `https://developers.reddit.com/r/${subredditName}/apps/formula1-app`
                    : "https://developers.reddit.com/apps/formula1-app",
            );
        }
    }, [subredditName]);
    return (
        <main
            className="app-shell"
            style={
                {
                    "--accent": theme.darkText,
                    "--accent-strong": theme.buttonColor,
                } as React.CSSProperties
            }
        >
            <div className="orb orb-one" />
            <div className="orb orb-two" />
            <section className={`tracker-card${tab === "home" ? "" : " tracker-card--full"}`}>
                {tab === "home" ? (
                    <aside className="race-summary">
                        <h1>{nextEvent ? nextEvent.grandPrix : calendarIsPending ? "Loading calendar" : "Season complete"}</h1>
                        <p>{nextEvent ? nextEvent.location : calendarIsPending ? "Checking the latest schedule" : "No upcoming sessions"}</p>
                        <span className="round-line">
                            {nextEvent
                                ? `Round ${calendarState.eventModel?.round ?? "-"} of ${meta.totalRounds ?? calendarState.eventModel?.totalRounds ?? "-"}`
                                : calendarIsPending ? "Calendar pending" : "Season complete"}
                        </span>
                        <time>
                            {countdownTarget
                                ? formatDateTime(
                                      countdownTarget.toISOString(),
                                      Intl.DateTimeFormat().resolvedOptions().timeZone,
                                      "en-US",
                                      false,
                                  )
                                : calendarIsPending ? "Calendar pending" : "No upcoming sessions"}
                        </time>

                        <div className="session-card">
                            <strong>
                                {nextEvent
                                    ? getSessionFullName(nextEvent.sessionLabel)
                                    : "Formula 1"}
                            </strong>
                            <span>{calendarState.status.isCurrentlyInEvent ? "Live now" : "starts in"}</span>
                            <b>{timerValue}</b>
                        </div>

                        {nextEvent ? (
                            <div className="side-actions">
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        try {
                                            requestExpandedMode(event.nativeEvent, "map");
                                            return;
                                        } catch {
                                            // The inline modal remains available as a fallback.
                                        }
                                        setMapSlug(mapSlugFromLocation(nextEvent.location));
                                    }}
                                >
                                    View Track
                                </button>
                            </div>
                        ) : null}

                        <div className="quick-actions">
                            {shouldShowUpdateIcon ? (
                                <button
                                    className="update-button"
                                    type="button"
                                    onClick={showUpdateForm}
                                    aria-label={`Update available: version ${meta.latestVersion}`}
                                    title={`Update available: version ${meta.latestVersion}`}
                                >
                                    <FontAwesomeIcon icon={faArrowUpFromBracket} />
                                </button>
                            ) : (
                                <button
                                    className="info-button"
                                    type="button"
                                    onClick={showAboutApp}
                                    aria-label="App information"
                                    title="App information"
                                >
                                    <FontAwesomeIcon icon={faInfo} />
                                </button>
                            )}
                            <button
                                className="calendar-button"
                                type="button"
                                onClick={() => {
                                    resultsSelectionBeforeCalendar.current = {
                                        eventId: selectedGrandPrixValue || null,
                                        sessionTitle: selectedResultValue || null,
                                    };
                                    if (nextEvent?.eventId) {
                                        setSelectedGrandPrixId(nextEvent.eventId);
                                        setSelectedResultTitle(null);
                                    }
                                    setShowCalendar(true);
                                }}
                                aria-label="View session schedule"
                                title="View session schedule"
                            >
                                <FontAwesomeIcon icon={faCalendarDays} />
                            </button>
                        </div>
                        <div className="github-action">
                            <button
                                type="button"
                                onClick={showGitHubIssuesForm}
                                aria-label="Open GitHub issues"
                                title="GitHub issues"
                            >
                                <FontAwesomeIcon icon={faGithub} />
                            </button>
                        </div>
                    </aside>
                ) : null}

                <section
                    className={`data-board${tab === "home" ? "" : " data-board--full"}${tab === "drivers" ? " data-board--drivers" : ""}${tab === "constructors" ? " data-board--teams" : ""}`}
                >
                    {tab === "home" ? (
                        <header>
                            {grandPrixOptions.length ? (
                            <select
                                className="grand-prix-select"
                                value={selectedGrandPrixValue}
                                onChange={(event) => {
                                    setSelectedGrandPrixId(event.target.value);
                                    setSelectedResultTitle(null);
                                }}
                                aria-label="Select Grand Prix"
                            >
                                {grandPrixOptions.map((option) => (
                                    <option key={option.eventId} value={option.eventId}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <strong>{listTitle}</strong>
                        )}
                            {showCalendar ? (
                                <button
                                    className="calendar-close-button"
                                    type="button"
                                    onClick={() => {
                                        const previous = resultsSelectionBeforeCalendar.current;
                                        setSelectedGrandPrixId(previous?.eventId ?? null);
                                        setSelectedResultTitle(previous?.sessionTitle ?? null);
                                        resultsSelectionBeforeCalendar.current = null;
                                        setShowCalendar(false);
                                    }}
                                    aria-label="Close session schedule"
                                    title="Back to race results"
                                >
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            ) : resultOptions.length ? (
                            <select
                                className="session-select"
                                value={selectedResultValue}
                                onChange={(event) => setSelectedResultTitle(event.target.value)}
                                aria-label="Select results session"
                            >
                                {resultOptions.map((option) => (
                                    <option key={option.titleTab} value={option.titleTab}>
                                        {option.titleTab}
                                    </option>
                                ))}
                            </select>
                        ) : null}
                        </header>
                    ) : null}

                    {tab === "home" && showCalendar ? (
                        <div className="calendar-schedule-panel">
                            {latest.data?.selectedEventId !== selectedGrandPrixValue ? (
                                <EmptyState
                                    title={latest.error ? "Schedule unavailable" : "Loading schedule"}
                                    detail={latest.error ?? ""}
                                />
                            ) : (
                                <SessionSchedule schedule={latest.data?.sessionSchedule ?? []} />
                            )}
                        </div>
                    ) : null}
                    {tab === "home" && !showCalendar ? (
                        <LatestResults
                            payload={latest.data}
                            loading={latest.loading}
                            error={latest.error}
                            selectedTitle={selectedResultValue}
                            activeTheme={team}
                        />
                    ) : null}
                    {tab === "drivers" ? (
                        <StandingsList
                            title="Driver standings"
                            entries={standings.data?.drivers ?? []}
                            loading={standings.loading}
                            error={standings.error}
                            showFullName
                        />
                    ) : null}
                    {tab === "constructors" ? (
                        <StandingsList
                            title="Constructor standings"
                            entries={standings.data?.constructors ?? []}
                            loading={standings.loading}
                            error={standings.error}
                            variant="single"
                            activeTheme={team}
                        />
                    ) : null}
                </section>

                <nav className="bottom-dock" aria-label="Tracker views">
                    <button
                        className="dock-icon-button"
                        type="button"
                        onClick={() => navigateTo(theme.buttonRedirectLink)}
                        aria-label="Open Formula 1 results"
                        title="Open Formula 1 results"
                    >
                        <img className="dock-logo" src={`/teams/logos/${team}.png`} alt="" aria-hidden="true" />
                    </button>
                    <button className={tab === "drivers" ? "is-active" : ""} type="button" onClick={() => setTab("drivers")}>
                        Drivers
                    </button>
                    <button
                        className={tab === "home" ? "is-active" : ""}
                        type="button"
                        onClick={() => setTab("home")}
                    >
                        Home
                    </button>
                    <button className={tab === "constructors" ? "is-active" : ""} type="button" onClick={() => setTab("constructors")}>
                        Teams
                    </button>
                    <button
                        className="dock-icon-button"
                        type="button"
                        onClick={refreshAll}
                        aria-label="Refresh"
                        title="Refresh"
                    >
                        <FontAwesomeIcon icon={faRotateRight} />
                    </button>
                </nav>
            </section>

            <MapModal
                mapSlug={mapSlug}
                expanded={mapOpenedExpanded}
                onClose={() => setMapSlug(null)}
            />
        </main>
    );
}
