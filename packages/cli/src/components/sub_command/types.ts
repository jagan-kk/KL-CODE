import type { SupportedChatModelId } from "@KL-CODE/shared";
import type { DialogContextValue } from "../../providers/dialog";
import type { ToastContextValue } from "../../providers/toast";
import { Mode } from "@KL-CODE/database/enums";


import type { Message } from "../../hooks/use-chat";

export type CommandContext = {
    exit: () => void;
    toast: ToastContextValue;
    dialog: DialogContextValue;
    navigate:(path:string) => void;
    mode:Mode;
    setMode:(mode:Mode)=> void;
    setModel:(model:SupportedChatModelId) =>void;
    showReasoning:boolean;
    setShowReasoning:(show:boolean)=>void;
    cwd:string;
    setCwd:(cwd:string)=>void;
    inputText?:string;
    messages?:Message[];
    sessionId?:string;
};

export type Command = {
    name:string;
    description: string;
    value:string;
    action?: (ctx:CommandContext) => void | Promise<void>;
};