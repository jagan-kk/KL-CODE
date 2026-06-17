import type { Command } from "./types";


export const COMMANDS: Command[]=[
    {
        name: "new",
        description: "Start a new conversation",
        value: "/new",
    },
    {
        name: "agents",
        description: "Select a agent",
        value: "/agent",
    },
    {
        name: "login",
        description: "Sign In to your account",
        value: "/login",
    },
    {
        name: "sessions",
        description: "Select session",
        value: "/sessions",
    },
    {
        name: "model",
        description: "select a model",
        value: "/model",
    },
    {
        name: "themes",
        description: "Select a theme",
        value: "/themes",
    },
    {
        name: "logout",
        description: "signout of account",
        value:"/logout",
    },
    {
        name: "upgrade",
        description: "buy more credit",
        value:"/upgrade",
    },
    {
        name: "usage",
        description: "open billing portal",
        value:"/usage",
    },
    {
        name: "exit",
        description: "quit the application",
        value:"/exit",
        action: (ctx) => {
            ctx.exit();
        },
    },

];