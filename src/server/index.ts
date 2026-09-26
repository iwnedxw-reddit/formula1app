import { cache, context, createServer, getServerPort, reddit, redis, scheduler, settings } from "@devvit/web/server";
import type { TaskRequest, TaskResponse } from "@devvit/web/server";
import express from "express";
import { DateTime } from "luxon";
import {
    convertToF1Event,
    formatDateTime,
    unstickyPreviousPost,
} from "../shared/common.js";
import {
    fetchCalendarSnapshot,
    fetchLatestSession,
    fetchStandings,
    formatSessionResults,
    hydrateCalendarSnapshotEvents,
    type CacheReader,
    type LatestSessionPayload,
    type StandingsSummary,
} from "../shared/f1Data.js";
import { teamOptionsInForms, teamThemes } from "../shared/constants.js";

type JsonRecord = Record<string, unknown>;
type SelectValue = string | string[] | undefined;

const app = express();
app.use(express.json());

const cacheReader: CacheReader = async (key, ttlSeconds, loader) =>
    cache(loader as () => Promise<any>, { key, ttl: ttlSeconds }) as Promise<any>;

const getSeason = async (): Promise<string> =>
    (await settings.get<string>("season"))?.trim() || String(new Date().getUTCFullYear());

const getCalendar = async () => {
    const season = await getSeason();
    return fetchCalendarSnapshot(cacheReader, {
        read: (key) => redis.get(key),
        write: (key, value) => redis.set(key, value),
    }, season);
};

const asString = (value: unknown, fallback = ""): string =>
    typeof value === "string" ? value : fallback;

const firstSelected = (value: SelectValue, fallback?: string): string | undefined => {
    if (Array.isArray(value)) return value[0] ?? fallback;
    return value ?? fallback;
};

const getTimezone = (): string => {
    const raw = context.metadata?.["devvit-accept-timezone"]?.values?.[0];
    return typeof raw === "string" && raw ? raw : "UTC";
};

const convertToUTC = (date: string, time: string, timezone: string): string => {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    return DateTime.fromObject({ year, month, day, hour, minute }, { zone: timezone }).toUTC().toISO()!;
};

const getFlairOptions = async () => {
    const templates = await reddit.getPostFlairTemplates(context.subredditName);
    return templates.map((template) => ({ label: template.text, value: template.id }));
};

const commentSortOptions = [
    { label: "Best", value: "CONFIDENCE" },
    { label: "Top", value: "TOP" },
    { label: "New", value: "NEW" },
    { label: "Controversial", value: "CONTROVERSIAL" },
    { label: "Old", value: "OLD" },
    { label: "Q&A", value: "QA" },
];

const postConfigForm = (flairOptions: { label: string; value: string }[]) => ({
    title: "Formula 1 Tracker Post Configuration",
    acceptLabel: "Submit",
    fields: [
        { type: "string", name: "postTitle", label: "Edit Post Title", defaultValue: "Formula 1 Tracker", required: true },
        { type: "select", name: "team", label: "Choose your subreddit's team", multiSelect: false, options: teamOptionsInForms, required: true, defaultValue: ["f1"] },
        { type: "boolean", name: "addToHighlights", label: "Add to Highlights?", helpText: "Pin this post; it will unpin automatically when a new post is created.", defaultValue: false, required: true },
        { type: "select", name: "commentSort", label: "Sort the comments by", multiSelect: false, options: commentSortOptions, required: true, defaultValue: ["CONFIDENCE"] },
        { type: "select", name: "postFlair", label: "Set Post Flair (Not required)", multiSelect: false, options: flairOptions },
        { type: "boolean", name: "shouldSchedule", label: "Schedule the post?", helpText: "Next Step: Set Date and Time", defaultValue: false, required: true },
    ],
});

const schedulePostForm = (data: JsonRecord, flairOptions: { label: string; value: string }[]) => ({
    title: "Schedule Post",
    description: "Enter your local date and time",
    acceptLabel: "Schedule",
    fields: [
        { type: "string", name: "timezone", label: "Timezone", required: true, defaultValue: data.timezone, disabled: true },
        { type: "string", name: "date", label: "Date (YYYY-MM-DD)", placeholder: "2024-12-31", required: true, defaultValue: data.datePlaceholder, helpText: "Enter the date for the scheduled post." },
        { type: "string", name: "time", label: "Time (HH:MM, 24h)", placeholder: "14:30", required: true, defaultValue: data.timePlaceholder, helpText: "Enter the time for the scheduled post." },
        { type: "string", name: "postTitle", label: "Edit Post Title", defaultValue: data.postTitle || "Formula 1 Tracker", required: true },
        { type: "select", name: "team", label: "Choose your subreddit's team", multiSelect: false, options: teamOptionsInForms, required: true, defaultValue: [firstSelected(data.team as SelectValue, "f1")] },
        { type: "boolean", name: "addToHighlights", label: "Add to Highlights?", helpText: "Pin this post; it will unpin automatically when a new post is created.", defaultValue: Boolean(data.addToHighlights) },
        { type: "select", name: "commentSort", label: "Sort the comments by", multiSelect: false, options: commentSortOptions, required: true, defaultValue: data.commentSort ?? ["CONFIDENCE"] },
        { type: "select", name: "postFlair", label: "Set Post Flair (Not required)", multiSelect: false, options: flairOptions, defaultValue: data.postFlair },
    ],
});

const modifyScheduledPostsForm = (jobsData: Record<string, JsonRecord>, timezone: string) => ({
    title: "Scheduled F1 Tracker Posts",
    description: Object.keys(jobsData).length > 0 ? "Turn off the scheduled posts you want to delete." : "No scheduled posts.",
    acceptLabel: "Confirm",
    cancelLabel: "Back",
    fields: Object.entries(jobsData).map(([jobId, job]) => ({
        type: "boolean",
        name: jobId,
        label: `Title: ${job.name}`,
        helpText: `Scheduled at: ${formatDateTime(String(job.runAt), timezone, "en-CA", true)}, Add to Highlights: ${job.addToHighlights} ${job.unpinDateString ? `(unpin: ${formatDateTime(String(job.unpinDateString), timezone, "en-CA", true)})` : ""}, Flair: ${job.postFlair ?? "None"}, Comment: ${job.commentSort === "CONFIDENCE" ? "BEST" : job.commentSort}, Team: ${job.team}`,
        required: true,
        defaultValue: true,
    })),
});

const discussionConfigForm = (data: JsonRecord, flairOptions: { label: string; value: string }[]) => ({
    title: "Discussion Thread Automation Configuration (Beta: Please report any issues)",
    description: "Note: discussion posts are scheduled every race week's Tuesday (GMT 00:00). Use Modify Scheduled Posts to review generated posts.",
    acceptLabel: "Preview Title",
    fields: [
        {
            type: "group",
            label: "Enable Automatic Discussion Posts for:",
            fields: [
                { type: "boolean", name: "fp1", label: "Free Practice 1", defaultValue: Boolean(data.fp1) },
                { type: "boolean", name: "fp2", label: "Free Practice 2", defaultValue: Boolean(data.fp2) },
                { type: "boolean", name: "fp3", label: "Free Practice 3", defaultValue: Boolean(data.fp3) },
                { type: "boolean", name: "fp", label: "Free Practice (FP1, FP2, FP3 combined)", helpText: "Creates one thread at FP1 and unpins after FP3, or FP1 on sprint weekends.", defaultValue: Boolean(data.fp) },
                { type: "boolean", name: "sprintQualifying", label: "Sprint Qualifying", defaultValue: Boolean(data.sprintQualifying) },
                { type: "boolean", name: "qualifying", label: "Qualifying", defaultValue: Boolean(data.qualifying) },
                { type: "boolean", name: "sprintRace", label: "Sprint Race", defaultValue: Boolean(data.sprintRace) },
                { type: "boolean", name: "race", label: "Race", defaultValue: Boolean(data.race) },
                { type: "boolean", name: "weekend", label: "Weekend", helpText: "Creates one thread at FP1 and unpins after the main race.", defaultValue: Boolean(data.weekend) },
            ],
        },
        {
            type: "group",
            label: "Post Settings",
            helpText: asString(data.errorMessage),
            fields: [
                { type: "number", name: "minutesBefore", label: "How many minutes before the session start should the post go live?", defaultValue: Number(data.minutesBefore ?? 30) },
                { type: "number", name: "minutesAfter", label: "How many minutes after the session ends should the post be unpinned?", helpText: "Recommended to set this to at least 30 minutes after session end to allow for delays.", defaultValue: Number(data.minutesAfter ?? 30) },
                { type: "string", name: "postTitleTemplate", label: "Post Title Template", defaultValue: asString(data.postTitleTemplate, "{year} {raceName} {sessionName} Discussion Thread"), required: true, helpText: "Example: {year} {raceName} {sessionName} Discussion Thread -> 2026 Australian GP Qualifying Discussion Thread" },
                { type: "select", name: "team", label: "Choose your subreddit's team", multiSelect: false, options: teamOptionsInForms, required: true, defaultValue: data.team ?? ["f1"] },
                { type: "select", name: "commentSort", label: "Sort the comments by", multiSelect: false, options: commentSortOptions, required: true, defaultValue: data.commentSort ?? ["CONFIDENCE"] },
                { type: "select", name: "postFlair", label: "Set Post Flair (Not required)", multiSelect: false, options: flairOptions, defaultValue: data.postFlair },
            ],
        },
    ],
});

const confirmDiscussionConfigForm = (data: JsonRecord) => ({
    title: "Discussion Posts Title Preview",
    description: `${data.postTitleTemplate} -> ${convertTemplateToTitle(asString(data.postTitleTemplate), 2026, "Australian GP", "Qualifying")}`,
    acceptLabel: "Confirm",
    rejectLabel: "Cancel",
    fields: [
        {
            type: "group",
            label: "Note: If you have already scheduled posts using this feature, delete existing scheduled posts via Modify Scheduled Posts, then repeat this process.",
            fields: [],
        },
    ],
});

export function convertTemplateToTitle(template: string, year: number, raceName: string, sessionName: string): string {
    const values: Record<"year" | "raceName" | "sessionName", string | number> = { year, raceName, sessionName };
    return template.replace(/\{([^}]+)\}/g, (_match, key: string) =>
        key in values ? String(values[key as keyof typeof values]) : `{${key}}`,
    );
}

const createPost = async (postTitle: string, teamInput: SelectValue) => {
    const team = firstSelected(teamInput, "f1") ?? "f1";
    await unstickyPreviousPost({
        reddit: {
            getCurrentSubredditName: async () => context.subredditName,
            getPostById: (postId) => reddit.getPostById(postId as any),
        },
        redis,
    });
    return reddit.submitCustomPost({
        title: postTitle,
        subredditName: context.subredditName,
        entry: "default",
        textFallback: {
            text: "Formula 1 Tracker: countdowns, results, standings, and race discussion.",
        },
        postData: { team },
    });
};

const finishPostSetup = async (
    post: Awaited<ReturnType<typeof createPost>>,
    values: JsonRecord,
    unpinDateString?: string,
) => {
    if (values.addToHighlights) {
        await post.sticky();
        await redis.set(`${post.subredditName}_stickied`, post.id);
    }
    const commentSort = firstSelected(values.commentSort as SelectValue);
    if (commentSort) await post.setSuggestedCommentSort(commentSort as any);
    const postFlair = firstSelected(values.postFlair as SelectValue);
    if (postFlair) {
        await reddit.setPostFlair({
            subredditName: post.subredditName,
            postId: post.id,
            flairTemplateId: postFlair,
        });
    }
    if (unpinDateString) {
        await scheduler.runJob({
            name: "unpinScheduledPost",
            runAt: new Date(unpinDateString),
            data: { postID: post.id },
        });
    }
};

const scheduleTheRaceDiscussionPostsJob = async () => {
    const previousCron = await redis.get("scheduleTheRaceDiscussionPosts");
    const newCron = (await settings.get<string>("cron")) ?? "0 0 * * 2";
    if (previousCron === newCron) return;

    const previousJobID = await redis.get("scheduleTheRaceDiscussionPostsJobID");
    if (previousJobID) {
        try {
            await scheduler.cancelJob(previousJobID);
        } catch (error) {
            console.warn("Could not cancel previous discussion automation job", error);
        }
    }
    await redis.set("scheduleTheRaceDiscussionPosts", newCron);
    const jobid = await scheduler.runJob({ name: "scheduleTheRaceDiscussionPosts", cron: newCron });
    await scheduler.runJob({
        name: "scheduleTheRaceDiscussionPosts",
        runAt: new Date(Date.now() + 10_000),
    });
    await redis.set("scheduleTheRaceDiscussionPostsJobID", jobid);
};

const runStartupScheduling = async (source: "app-installed" | "app-upgraded") => {
    try {
        await scheduleTheRaceDiscussionPostsJob();
        return { ok: true };
    } catch (error) {
        console.error(`Failed to schedule discussion automation from ${source}`, error);
        return {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
};

app.get("/api/latest-session", async (req, res) => {
    try {
        const eventId = typeof req.query.eventId === "string" ? req.query.eventId : undefined;
        const { snapshot } = await getCalendar();
        const latestSession = await fetchLatestSession(cacheReader, snapshot, eventId);
        res.json({
            latestSession,
            formatted: latestSession ? formatSessionResults(latestSession.session, latestSession.results) : null,
        });
    } catch (error) {
        console.error("Unable to load latest Formula 1 session", error);
        res.status(503).json({ error: "Formula 1 data is temporarily unavailable." });
    }
});

app.get("/api/standings", async (_req, res) => {
    const season = await getSeason();
    const standings: StandingsSummary = await fetchStandings(cacheReader, season);
    res.json(standings);
});

app.get("/api/app-meta", async (_req, res) => {
    let totalRounds: number;
    try {
        totalRounds = (await getCalendar()).snapshot.totalRounds;
    } catch (error) {
        console.error("Unable to load Formula 1 calendar metadata", error);
        res.status(503).json({ error: "Formula 1 calendar is temporarily unavailable." });
        return;
    }
    const latestVersion = await settings.get<string>("latestVersion");
    let isModerator = false;

    try {
        const username = context.username ?? (await reddit.getCurrentUsername());
        if (username) {
            const moderators = await reddit
                .getModerators({
                    subredditName: context.subredditName,
                    username,
                    limit: 1,
                })
                .all();
            isModerator = moderators.length > 0;
        }
    } catch (error) {
        console.warn("Unable to check moderator status", error);
    }

    res.json({
        isModerator,
        latestVersion,
        totalRounds,
        now: new Date().toISOString(),
    });
});

app.post("/internal/menu/create-post", async (_req, res) => {
    const flairOptions = await getFlairOptions();
    res.json({
        showForm: {
            name: "postConfig",
            form: postConfigForm(flairOptions),
        },
    } as any);
});

app.post("/internal/menu/modify-scheduled-posts", async (_req, res) => {
    const jobs = await scheduler.listJobs();
    const flairTemplates = await reddit.getPostFlairTemplates(context.subredditName);
    const jobsData: Record<string, JsonRecord> = {};
    for (const job of jobs) {
        if ("runAt" in job && job.name === "createScheduledPost") {
            jobsData[job.id] = {
                name: asString(job.data?.postTitle, job.name),
                runAt: job.runAt.toISOString(),
                addToHighlights: job.data?.addToHighlights,
                postFlair: flairTemplates.find((template) => template.id === job.data?.postFlair)?.text ?? "None",
                postFlairId: String(job.data?.postFlair ?? ""),
                commentSort: firstSelected(job.data?.commentSort as SelectValue),
                team: firstSelected(job.data?.team as SelectValue),
                unpinDateString: job.data?.unpinDateString,
            };
        }
    }
    res.json({
        showForm: {
            name: "modifyScheduledPosts",
            form: modifyScheduledPostsForm(jobsData, getTimezone()),
            data: { jobsData },
        },
    } as any);
});

app.post("/internal/menu/discussion-config", async (_req, res) => {
    const configString = await redis.get("discussionPostConfig");
    const config = configString ? JSON.parse(configString) as JsonRecord : {};
    const flairOptions = await getFlairOptions();
    res.json({
        showForm: {
            name: "discussionConfig",
            form: discussionConfigForm(config, flairOptions),
        },
    } as any);
});

app.post("/internal/form/post-config", async (req, res) => {
    const values = req.body as JsonRecord;
    if (values.shouldSchedule) {
        const timezone = getTimezone();
        const now = new Date();
        const flairOptions = await getFlairOptions();
        res.json({
            showForm: {
                name: "schedulePost",
                form: schedulePostForm({
                    ...values,
                    datePlaceholder: now.toLocaleDateString("en-CA", { timeZone: timezone }),
                    timePlaceholder: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone }),
                    timezone,
                }, flairOptions),
            },
        } as any);
        return;
    }

    const post = await createPost(asString(values.postTitle, "Formula 1 Tracker"), values.team as SelectValue);
    await finishPostSetup(post, values);
    res.json({ navigateTo: { url: post.url } } as any);
});

app.post("/internal/form/schedule-post", async (req, res) => {
    const values = req.body as JsonRecord;
    try {
        const date = asString(values.date);
        const time = asString(values.time);
        if (time.length !== 5 || date.length !== 10) throw new Error("Invalid date or time format");
        const scheduledDateTime = new Date(convertToUTC(date, time, asString(values.timezone, "UTC")));
        await scheduler.runJob({
            name: "createScheduledPost",
            runAt: scheduledDateTime,
            data: {
                postTitle: asString(values.postTitle, "Formula 1 Tracker"),
                addToHighlights: Boolean(values.addToHighlights),
                commentSort: values.commentSort as string[],
                postFlair: firstSelected(values.postFlair as SelectValue) ?? "",
                team: values.team as string[],
            },
        });
        res.json({
            showToast: `Post will be created at ${formatDateTime(scheduledDateTime.toISOString(), asString(values.timezone, "UTC"), "en-CA", true)}`,
        } as any);
    } catch {
        const flairOptions = await getFlairOptions();
        res.json({
            showToast: "Invalid Date or Time. Please retry.",
            showForm: {
                name: "schedulePost",
                form: schedulePostForm(values, flairOptions),
            },
        } as any);
    }
});

app.post("/internal/form/modify-scheduled-posts", async (req, res) => {
    const values = req.body as Record<string, boolean>;
    for (const [jobId, keepEnabled] of Object.entries(values)) {
        if (!keepEnabled) {
            await scheduler.cancelJob(jobId);
            const redisKey = await redis.get(jobId);
            if (redisKey) {
                await redis.del(redisKey);
                await redis.del(jobId);
            }
        }
    }
    res.json({ showToast: "Chosen scheduled posts have been cancelled." } as any);
});

app.post("/internal/form/discussion-config", async (req, res) => {
    const values = req.body as JsonRecord;
    try {
        if (Number(values.minutesBefore) < 0 || Number(values.minutesAfter) < 0) {
            throw new Error("Please enter non-negative numbers for minutes before/after.");
        }
        const allowed = values.weekend ? ["year", "raceName"] : ["year", "raceName", "sessionName"];
        const template = asString(values.postTitleTemplate);
        for (const match of template.matchAll(/\{([^}]+)\}/g)) {
            if (!allowed.includes(match[1])) {
                throw new Error(values.weekend ? "{sessionName} can't be used when Weekend is selected." : `Invalid placeholder {${match[1]}}.`);
            }
        }
        await redis.set("temporaryDiscussionPostConfig", JSON.stringify(values));
        res.json({
            showForm: {
                name: "confirmDiscussionConfig",
                form: confirmDiscussionConfigForm(values),
            },
        } as any);
    } catch (error) {
        const flairOptions = await getFlairOptions();
        res.json({
            showToast: error instanceof Error ? error.message : "An error occurred while saving the configuration.",
            showForm: {
                name: "discussionConfig",
                form: discussionConfigForm({ ...values, errorMessage: "Try again. " + (error instanceof Error ? error.message : "An error occurred while saving the configuration.") }, flairOptions),
            },
        } as any);
    }
});

app.post("/internal/form/confirm-discussion-config", async (_req, res) => {
    const temporaryDiscussionPostConfig = await redis.get("temporaryDiscussionPostConfig");
    if (!temporaryDiscussionPostConfig) {
        res.json({ showToast: "Configuration Error. Please try again." } as any);
        return;
    }
    await redis.set("discussionPostConfig", temporaryDiscussionPostConfig);
    await scheduler.runJob({
        name: "scheduleTheRaceDiscussionPosts",
        runAt: new Date(Date.now() + 3_000),
    });
    res.json({ showToast: "Discussion Posts Configuration Saved." } as any);
});

app.post("/internal/scheduler/create-scheduled-post", async (req, res) => {
    const { data } = req.body as TaskRequest<any>;
    const post = await createPost(asString(data?.postTitle, "Formula 1 Tracker"), data?.team as SelectValue);
    await finishPostSetup(post, data ?? {}, asString(data?.unpinDateString));
    res.json({} as any);
});

app.post("/internal/scheduler/unpin-scheduled-post", async (req, res) => {
    const { data } = req.body as TaskRequest<any>;
    if (data?.postID) {
        const post = await reddit.getPostById(data.postID as any);
        if (post.stickied) await post.unsticky();
    }
    res.json({} as any);
});

app.post("/internal/scheduler/schedule-race-discussion-posts", async (_req, res) => {
    try {
        const configString = await redis.get("discussionPostConfig");
        if (configString) {
            const config = JSON.parse(configString) as JsonRecord;
            const { snapshot } = await getCalendar();
            const calendarEvents = hydrateCalendarSnapshotEvents(snapshot);
            const now = new Date();
            const nextRunAt = new Date(now);
            nextRunAt.setDate(nextRunAt.getDate() + 7);

            for (let i = 0; i < calendarEvents.length; i++) {
                const event = calendarEvents[i];
                const postAt = new Date(event.start.getTime() - Number(config.minutesBefore ?? 30) * 60_000);
                if (postAt > nextRunAt) break;
                if (now >= postAt) continue;

                let schedulePost = false;
                let unpinDateString = "";
                if (config.weekend && event.sessionLabel === "FP1") {
                    const weekendEnd = [...calendarEvents].reverse().find((candidate) => candidate.eventId === event.eventId) ?? event;
                    schedulePost = true;
                    unpinDateString = new Date(weekendEnd.end.getTime() + Number(config.minutesAfter ?? 30) * 60_000).toISOString();
                } else if (config.fp && ["FP1", "FP2", "FP3"].includes(event.sessionLabel) && event.sessionLabel === "FP1") {
                    schedulePost = true;
                    const practiceEnd = calendarEvents.find((candidate) =>
                        candidate.eventId === event.eventId && candidate.sessionLabel === "FP3"
                    ) ?? event;
                    unpinDateString = new Date(practiceEnd.end.getTime() + Number(config.minutesAfter ?? 30) * 60_000).toISOString();
                } else if (
                    (config.fp1 && event.sessionLabel === "FP1") ||
                    (config.fp2 && event.sessionLabel === "FP2") ||
                    (config.fp3 && event.sessionLabel === "FP3") ||
                    (config.sprintQualifying && event.sessionLabel === "Sprint Qualifying") ||
                    (config.qualifying && event.sessionLabel === "Qualifying") ||
                    (config.sprintRace && event.sessionLabel === "Sprint") ||
                    (config.race && event.sessionLabel === "Race")
                ) {
                    schedulePost = true;
                    unpinDateString = new Date(event.end.getTime() + Number(config.minutesAfter ?? 30) * 60_000).toISOString();
                }

                if (!schedulePost) continue;
                const redisKey = `${event.grandPrix}-${event.sessionLabel}-createDiscussion`;
                if (await redis.get(redisKey) === "exists") continue;
                const sessionName = config.fp && event.sessionLabel === "FP1" ? "FP" : event.sessionLabel;
                const jobId = await scheduler.runJob({
                    name: "createScheduledPost",
                    runAt: postAt,
                    data: {
                        postTitle: convertTemplateToTitle(
                            asString(config.postTitleTemplate, "{year} {raceName} {sessionName} Discussion Thread"),
                            event.start.getFullYear(),
                            `${event.grandPrix.split("Grand Prix")[0].trim()} GP`,
                            sessionName,
                        ),
                        addToHighlights: true,
                        commentSort: config.commentSort as string[],
                        postFlair: firstSelected(config.postFlair as SelectValue) ?? "",
                        team: config.team as string[],
                        unpinDateString,
                    },
                });
                await redis.set(redisKey, "exists");
                await redis.set(jobId, redisKey);
                await redis.expire(redisKey, 10 * 24 * 60 * 60);
                await redis.expire(jobId, 10 * 24 * 60 * 60);
            }
        }
        await scheduleTheRaceDiscussionPostsJob();
        res.json({} as any);
    } catch (error) {
        console.error("Failed to run discussion automation scheduler", error);
        res.status(200).json({} as any);
    }
});

app.post("/internal/triggers/app-installed", async (_req, res) => {
    const result = await runStartupScheduling("app-installed");
    res.json(result);
});

app.post("/internal/triggers/app-upgraded", async (_req, res) => {
    const result = await runStartupScheduling("app-upgraded");
    res.json(result);
});

app.get("/api/calendar", async (_req, res) => {
    try {
        const { snapshot, isStale } = await getCalendar();
        const events = hydrateCalendarSnapshotEvents(snapshot);
        res.json({
            season: snapshot.season,
            refreshedAt: snapshot.refreshedAt,
            isStale,
            totalRounds: snapshot.totalRounds,
            events: events.map((event) => ({
                ...event,
                start: event.start.toISOString(),
                end: event.end.toISOString(),
                details: convertToF1Event(event, snapshot.totalRounds),
            })),
        });
    } catch (error) {
        console.error("Unable to load Formula 1 calendar", error);
        res.status(503).json({ error: "Formula 1 calendar is temporarily unavailable." });
    }
});

const server = createServer(app);
server.on("error", (error) => console.error(`server error; ${error.stack}`));
server.listen(getServerPort());

export default server;

