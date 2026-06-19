import type { Command } from "./types";


export const COMMANDS: Command[]=[
    {
        name: "new",
        description: "Start a new conversation",
        value: "/new",
        action: (ctx) => {
            ctx.toast.show({ message: "Starting new conversation"});
        },
    },
    {
        name: "agents",
        description: "Select a agent",
        value: "/agent",
        action: (ctx) => {
            ctx.dialog.open({
                title:"select Mode",
                children: <text>Agent selection...</text>
            })
        },
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
        action: (ctx) => {
            ctx.dialog.open({
                title:"select Model",
                children: <text>Model selection...</text>
            })
        },
    },
    {
        name: "themes",
        description: "Select a theme",
        value: "/themes",
        action: (ctx) => {
            ctx.toast.show({ message: "Selecting a theme"});
        },
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