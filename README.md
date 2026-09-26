# Formula 1 Tracker

Track live sessions, results, and championship standings - right from Reddit.

[View the source code on GitHub](https://github.com/iwnedxw-reddit/formula1app)

## Features (for Moderators)
- Create the F1 Tracker Post from your subreddit menu using "F1 App: Create Post" ([Mobile](https://i.imgur.com/zJNoILi.png), [Desktop](https://i.imgur.com/VMvB2OJ.png))
    - Customize the post title, team theme, flair, and comment sort
    - Add to highlights
    - Schedule the post
- Configure automated discussion threads from your subreddit menu using "F1 App: Automate Race Discussion Threads" ([Mobile](https://i.imgur.com/zJNoILi.png), [Desktop](https://i.imgur.com/VMvB2OJ.png))
    - Enable discussion threads for individual sessions, combined practice, or the full weekend
    - Set how many minutes before a session starts to post the thread
    - Set how many minutes after a session ends to unpin the thread
    - Customize the post title template, flair, team theme, and default comment sort
- View or modify scheduled posts from the "F1 App: Modify Scheduled Posts" subreddit menu item.

## Features (for Users)
- **Countdown Timer**: See the countdown to the next race session.
- **Race Calendar**: View all session start times for the current or upcoming Grand Prix in your local timezone.
- **Latest Session Results**: View the latest ESPN session results with loading and error states.
- **Driver Standings**: Keep up with the Drivers' Championship.
- **Constructor Standings**: Track the Constructors' Championship.
- **Circuit Maps**: Open the bundled map for the next event.
- **Auto-Refresh**:
    - During active sessions, the app automatically refreshes every 30 seconds.
    - You can manually refresh the app any time using the refresh button.
    - When there is no active session, auto-refresh is paused to save resources.
- **Quick Access**: Open F1 live timing, official results, and the selected team's site from the post.

## Install the app
- Click the **"Add to community"** button at the top of this page.
- Choose the subreddit where you want to install the app.
- Use the subreddit menu to create the tracker post ([Mobile](https://i.imgur.com/zJNoILi.png), [Desktop](https://i.imgur.com/VMvB2OJ.png)).

## Development
- `npm run typecheck` runs the TypeScript checks.
- `npm run build` builds the Devvit Web client to `dist/client` and server bundle to `dist/server/index.cjs`.
- `npm run dev` builds the app and starts `devvit playtest formula1_app_dev2`.

## Update the app
- Go to the "My Installations" section at the bottom of this page and update the app.

## Feedback, Questions, and Support
- Use [GitHub Issues](https://github.com/iwnedxw-reddit/formula1app/issues) to report bugs, request features, or share feedback.

## Screenshot
![Screenshot](https://i.imgur.com/HSjxNAX.png)

## Fetch Domains
- `site.api.espn.com` - Used to fetch the latest race session data, plus constructor and driver standings.

## Changelog
- 2.8.0 - 2026.09.19
    - Add calendar support
    - Fetch the race calendar from ESPN instead of using a hardcoded schedule.
    - Highlighted drivers and constructors that match the selected team theme.
- 2.6.3
    - Show Laps during race
- 2.6.0
    - Migrated from deprecated Blocks rendering to Devvit Web.
    - Added a React/Vite client and Devvit Web server endpoints.
    - Preserved moderator create, schedule, modify, and discussion automation workflows.
- 1.6.0
    - Added Alpine, Aston, Audi, Cadillac and Ferrari themes
    - Removed Bahrain and Saudi GPs
- 1.3.3
    - chore: remove 2025 calendar
    - App now refreshes the data every 30 seconds during active sessions.
- 1.2.7
    - feat: add combined Free Practice threads feature in automated discussion threads
- 1.2.6
    - fix: Resolved issue where automated discussion posts were not scheduled when weekend is selected.
    - Bumped devvit to 0.12.13
- 1.1.2
    - Configure automated discussion threads from your subreddit menu using the "F1 App: Automate Race Discussion Threads" option ([Mobile](https://i.imgur.com/zJNoILi.png), [Desktop](https://i.imgur.com/VMvB2OJ.png))
        - Enable discussion threads for individual sessions or the full weekend
        - Set how many minutes before a session starts to post the thread
        - Set how many minutes after a session ends to unpin the thread
        - Customize the post title template, flair, and default comment sort
- 1.0.19
    - Add 2026 calendar support
    - Adjust the layout to accommodate 11 teams
    - Added an "Update" icon if a new version is available (only shown for Moderators)
    - Added app info and feedback icons
- 0.1.39
    - Fix UI bug
- 0.1.36
    - Added McLaren, Redbull, Mercedes theme
    - Minor improvements
- 0.1.33
    - Added a 2026 season placeholder until ESPN updates their website
    - Added Williams Team Theme
    - Minor improvements
- 0.1.22
    - Add Post Flair
    - Add to highlights
        - New posts unpin the prior post, but only if it was pinned by the app.
    - Customize the Post's default comment sort
- 0.1.18
    - Improved app performance by caching data
    - App now refreshes the data every minute during active sessions.
    - Added support for scheduling posts
- 0.1.13
    - Edit Post Title
    - Minor small-screen UI Tweaks
    - ESPN API bug fix
- 0.1.7
    - App launch
    - Features: Countdown, Latest session information, Driver and Team standings.
