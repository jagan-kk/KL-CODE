export type ThemeColors ={
    primary:string;
    planMode:string;
    selection:string;
    thinking:string;
    success:string;
    error:string;
    info:string;
    background:string;
    surface:string;
    dialogSurface:string;
    thinkingBorder:string;
    dimSeparator:string;

};

export type Theme = {
    name:string;
    colors:ThemeColors;

};

export const THEMES: Theme[] = [
    {
        name: "Nightfox",
        colors: {
            primary: "#56d6c2",
            planMode: "#cf8ef4",
            selection: "#89b4fa",
            thinking: "#cf8ef4",
            success: "#82e0aa",
            error: "#e74c5e",
            info: "#56d6c2",
            background: "#0d0d12",
            surface: "#1a1a24",
            dialogSurface: "#0a0a10",
            thinkingBorder: "#34344a",
            dimSeparator: "#4e4e66"
        }
    },
    {
        name: "Cyberpunk Neon",
        colors: {
            primary: "#ff007f",
            planMode: "#00f0ff",
            selection: "#ffe600",
            thinking: "#00f0ff",
            success: "#39ff14",
            error: "#ff3333",
            info: "#00f0ff",
            background: "#0a0612",
            surface: "#180f2b",
            dialogSurface: "#05030a",
            thinkingBorder: "#3c2263",
            dimSeparator: "#56328c"
        }
    },
    {
        name: "Nordic Frost",
        colors: {
            primary: "#88c0d0",
            planMode: "#b48ead",
            selection: "#8fbcbb",
            thinking: "#b48ead",
            success: "#a3be8c",
            error: "#bf616a",
            info: "#81a1c1",
            background: "#2e3440",
            surface: "#3b4252",
            dialogSurface: "#242933",
            thinkingBorder: "#4c566a",
            dimSeparator: "#434c5e"
        }
    },
    {
        name: "Rose Pine",
        colors: {
            primary: "#ea9a97",
            planMode: "#c4a7e7",
            selection: "#f6c177",
            thinking: "#c4a7e7",
            success: "#9ccfd8",
            error: "#eb6f92",
            info: "#31748f",
            background: "#191724",
            surface: "#1f1d2e",
            dialogSurface: "#12101a",
            thinkingBorder: "#403d52",
            dimSeparator: "#6e6a86"
        }
    },
    {
        name: "Forest Moss",
        colors: {
            primary: "#a3b18a",
            planMode: "#dda15e",
            selection: "#bc6c25",
            thinking: "#dda15e",
            success: "#588157",
            error: "#e63946",
            info: "#457b9d",
            background: "#1c2321",
            surface: "#2a3431",
            dialogSurface: "#131716",
            thinkingBorder: "#3e4c48",
            dimSeparator: "#4f615c"
        }
    },
    {
        name: "Monochrome Latte",
        colors: {
            primary: "#4f46e5", // Snappy accent indigo
            planMode: "#7c3aed",
            selection: "#e0e7ff",
            thinking: "#7c3aed",
            success: "#16a34a",
            error: "#dc2626",
            info: "#2563eb",
            background: "#fafafa",
            surface: "#ffffff",
            dialogSurface: "#f4f4f5",
            thinkingBorder: "#e4e4e7",
            dimSeparator: "#d4d4d8"
        }
    }
];

export const DEFAULT_THEME = THEMES.find((t) => t.name === "Nightfox")!;
