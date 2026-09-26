import { F1CalendarEvent } from "./calendarParser.js";

export function getSessionFullName(sessionLabel: F1CalendarEvent["sessionLabel"]): string {
    switch (sessionLabel) {
        case "FP1":
            return "Free Practice 1";
        case "FP2":
            return "Free Practice 2";
        case "FP3":
            return "Free Practice 3";
        default:
            return sessionLabel;
    }
}

export const SHORT_SESSION_NAMES: Record<string, string> = {
    fp1: "FP1",
    fp2: "FP2",
    fp3: "FP3",
    qualifying: "Quali",
    sprint: "Sprint",
    "sprint-qualifying": "S-Quali",
    race: "Race"
};

export const teamThemes: Record<string, any> = {
            "f1":{
                "lightText": "#ee0000",
                "darkText": "#ee0000",
                "logoHeight": "15px",
                "logoWidth":"60px",
                "buttonColor": "#bc0117",
                "buttonHoverColor": "#eb001f",
                "buttonRedirectLink": "https://www.formula1.com",
                "previewLogoHeight": "25px",
                "previewLogoWidth": "100px",
                "spinnerPath": "spinners/red.gif"
            },
            "williams":{
                "lightText": "#0090c8",
                "darkText": "#00a0de",
                "logoHeight": "25px",
                "logoWidth":"32px",
                "buttonColor": "#00a0de",
                "buttonHoverColor": "AlienBlue-600",
                "buttonRedirectLink": "https://www.williamsf1.com/",
                "previewLogoHeight": "50px",
                "previewLogoWidth": "65px",
                "spinnerPath": "spinners/blue.gif"
            },
            "mclaren":{
                "lightText": "#e67300",
                "darkText": "#ff8000",
                "logoHeight": "35px",
                "logoWidth":"35px",
                "buttonColor": "#ff8000",
                "buttonHoverColor": "YellowOrange-400",
                "buttonRedirectLink": "https://www.mclaren.com/racing/formula-1/",
                "previewLogoHeight": "65px",
                "previewLogoWidth": "65px",
                "spinnerPath": "spinners/orange.gif"
            },
            "redbull":{
                "lightText": "#ee0000",
                "darkText": "#ee0000",
                "logoHeight": "30px",
                "logoWidth":"60px",
                "buttonColor": "#ee0000",
                "buttonHoverColor": "#ee0000",
                "buttonRedirectLink": "https://www.redbullracing.com/int-en",
                "previewLogoHeight": "35px",
                "previewLogoWidth": "70px",
                "spinnerPath": "spinners/red.gif"
            },
            "mercedes":{
                "lightText": "#006f6c",
                "darkText": "#00f5d0",
                "logoHeight": "35px",
                "logoWidth":"35px",
                "buttonColor": "#006f6c",
                "buttonHoverColor": "#00a88f",
                "buttonRedirectLink": "https://www.mercedesamgf1.com/",
                "previewLogoHeight": "65px",
                "previewLogoWidth": "65px",
                "spinnerPath": "spinners/mercGreen.gif"
            },
            "cadillac":{
                "lightText": "#ee0000",
                "darkText": "#ee0000",
                "logoHeight": "23px",
                "logoWidth":"60px",
                "buttonColor": "#ee0000",
                "buttonHoverColor": "#ee0000",
                "buttonRedirectLink": "https://www.cadillacf1team.com/",
                "previewLogoHeight": "38px",
                "previewLogoWidth": "100px",
                "spinnerPath": "spinners/red.gif"
            },
            "audi":{
                "lightText": "#ff2d00",
                "darkText": "#ff2d00",
                "logoHeight": "20px",
                "logoWidth":"60px",
                "buttonColor": "#ff2d00",
                "buttonHoverColor": "#ff2d00",
                "buttonRedirectLink": "https://www.audif1.com/",
                "previewLogoHeight": "30px",
                "previewLogoWidth": "90px",
                "spinnerPath": "spinners/red.gif"
            },
            "astonmartin":{
                "lightText": "#00665e",
                "darkText": "#00f5d0",
                "logoHeight": "15px",
                "logoWidth":"60px",
                "buttonColor": "#00665e",
                "buttonHoverColor": "#00a88f",
                "buttonRedirectLink": "https://www.astonmartinf1.com/",
                "previewLogoHeight": "25px",
                "previewLogoWidth": "100px",
                "spinnerPath": "spinners/green.gif"
            },
            "ferrari":{
                "lightText": "#ee0000",
                "darkText": "#ee0000",
                "logoHeight": "50px",
                "logoWidth":"60px",
                "buttonColor": "#bc0117",
                "buttonHoverColor": "#eb001f",
                "buttonRedirectLink": "https://www.ferrari.com/en-EN/formula1",
                "previewLogoHeight": "90px",
                "previewLogoWidth": "75px",
                "spinnerPath": "spinners/red.gif"
            },
            "alpine":{
                "lightText": "#ff3a92",
                "darkText": "#ff88bd",
                "logoHeight": "30px",
                "logoWidth":"60px",
                "buttonColor": "#ff88bd",
                "buttonHoverColor": "#ff88bd",
                "buttonRedirectLink": "https://www.alpinef1.com/",
                "previewLogoHeight": "35px",
                "previewLogoWidth": "70px",
                "spinnerPath": "spinners/blue.gif"
            }
        }


export const teamOptionsInForms:any =  [
    { label: "F1 (Neutral)", value: "f1" },
    { label: "Williams", value: "williams" },
    { label: "McLaren", value: "mclaren" },
    { label: "Red Bull", value: "redbull" },
    { label: "Mercedes", value: "mercedes" },
    { label: "Audi", value: "audi" },
    { label: "Aston Martin", value: "astonmartin" },
    { label: "Ferrari", value: "ferrari" },
    { label: "Alpine", value: "alpine" },
    { label: "Cadillac", value: "cadillac" }
]
