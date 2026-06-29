import { SessionShell } from "../components/session-shell";
import { useParams,useLocation,useNavigate} from "react-router"
import {z} from "zod"
import type { InferResponseType} from "hono/client";
import {useState,useEffect,useMemo, useCallback} from "react"
import { UserMessage,BotMessage,ErrorMessage } from "../components/messages";
import { useToast} from "../providers/toast"
import { apiClient } from "../lib/api-clients";
import { useKeyboard } from "@opentui/react";
import { getErrorMessage } from "../lib/http-errors";
import prettyMs from "pretty-ms";
import {MessageStatus} from "@KL-CODE/database/enums"
import { usePromptConfig } from "../providers/prompt-config";
import { messagePartsSchema, type SupportedChatModelId } from "@KL-CODE/shared";
import { useChat, type Message, type ClientMessagePort } from "../hooks/use-chat";
import { exec } from "child_process";
import { promisify } from "util";
import { useKeyboardLayer } from "../providers/keyboard-layer";

const execAsync = promisify(exec);


type SessionData = InferResponseType<(typeof apiClient.sessions) [":id"]["$get"], 200>;


const sessionLocationSchema=z.object({
    session: z.custom<SessionData>((val)=> val!=null && typeof val==="object" && "id" in val),
});


function mapDbMessages(dbMessages:SessionData["messages"]):Message[] {
    return dbMessages.map((m):Message => {
        if(m.role =="ERROR"){
            return {id:m.id,role:"error",content:m.content};
        }

        if(m.role==="USER") {
            return {
                id:m.id,
                role:"user",
                content:m.content,
                mode:m.mode,
                model:m.model as SupportedChatModelId,
            };
        }

        const parsedParts =m.parts == null?null:messagePartsSchema.safeParse(m.parts);
        const parts:ClientMessagePort[]=parsedParts?.success ?
        parsedParts.data.map((p)=> {
            if (p.type==="tool-call") {
                return { ...p,status:"done" as const};
            }
            if (p.type==="question") {
                return {...p, answered: true};
            }
            return p;
        }):[]

        return {
            id:m.id,
            role:"assistant",
            content:m.content,
            model:m.model as SupportedChatModelId,
            mode:m.mode,
            parts,
            ...(m.duration !=null ? {duration:prettyMs(m.duration*1000)} : {}),
            interruped:m.status===MessageStatus.INTERRUPTED,

        }
    })
}





function ChatMessage(
    {msg}:{
        msg:Message
    }
){
    if(msg.role==="user") {
        return <UserMessage message={msg.content} mode={msg.mode} />;
    }

    if(msg.role==="error") {
        return <ErrorMessage message={msg.content} />;
    }


    return <BotMessage 
    parts = {msg.parts}
    model={msg.model}
    mode={msg.mode}
    duration={msg.duration}
    streaming={false}
    interrupted={msg.interruped}
    />;

}

function SessionChat({session} : { session:SessionData}) {
    const [initialMessages] = useState(()=>mapDbMessages(session.messages));
    const {mode,model} = usePromptConfig();
    const {isTopLayer} =useKeyboardLayer();
    const { messages,streaming,submit,abort,interrupt, answerQuestion, addMessage} = useChat(session.id,initialMessages);

    const handleBashCommand = useCallback(async (cmd: string) => {
        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: "user",
            content: `!${cmd}`,
            mode,
            model,
        };
        addMessage(userMessage);
        try {
            const { stdout, stderr } = await execAsync(`powershell -Command "${cmd.replace(/"/g, '\\"')}"`, { timeout: 30000 });
            const output = stderr ? `${stdout}\n${stderr}` : stdout;
            const assistantMessage: Message = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: output || "(no output)",
                mode,
                model,
                parts: [{ type: "text", text: output || "(no output)" }],
            };
            addMessage(assistantMessage);
        } catch (err) {
            const errorMessage: Message = {
                id: crypto.randomUUID(),
                role: "error",
                content: err instanceof Error ? err.message : "Command failed",
            };
            addMessage(errorMessage);
        }
    }, [mode, model, addMessage]);

    const activeQuestion = useMemo(() => {
        if (streaming.status === "streaming") {
            const lastPart = streaming.parts[streaming.parts.length - 1];
            if (lastPart?.type === "question" && !lastPart.answered) {
                return lastPart;
            }
        }
        return null;
    }, [streaming]);

    const handleAnswerQuestion = useCallback((questionId: string, answers: string[]) => {
        void answerQuestion(questionId, answers);
    }, [answerQuestion]);


    useEffect(()=> {
        return ()=> abort ();
    },[abort]);

    useKeyboard((key)=> {
        if(key.name ==="escape" && isTopLayer("base") && streaming.status === "streaming") {
            key.preventDefault();
            interrupt();
        }
    })

    return (
        <SessionShell
        onSubmit ={(text) => {
            if (text.startsWith("!")) {
                handleBashCommand(text.slice(1));
            } else {
                submit({userText:text,mode,model});
            }
        }}
        loading={streaming.status==="streaming"}
        interruptable={streaming.status === "streaming"}
        activeQuestion={activeQuestion}
        onAnswerQuestion={handleAnswerQuestion}
        messages={messages}
        sessionId={session.id}
        >
            {messages.map((msg)=> (
                <ChatMessage key={msg.id} msg={msg} />
            ))}
            {
                streaming.status==="streaming" && streaming.parts.length>0 && (
                    <BotMessage
                    parts={streaming.parts}
                    model={streaming.model}
                    mode={streaming.mode}
                    streaming
                    />
                )
            }
        </SessionShell>
    )
}


export function Session() {
    const {id}=useParams();
    const location=useLocation();
    const navigate = useNavigate();
    const toast = useToast();

    const prefetched = useMemo(()=> {
        const parsed = sessionLocationSchema.safeParse(location.state);
        return parsed.success ? parsed.data.session :null;
    },[location.state]);

    const [session,setSession] = useState<SessionData | null>(prefetched);

    useEffect(()=> {
        if (prefetched) return;
        setSession(null);

        if(!id) return;

        let ignore = false;
        const fetchSession = async () => {
            try {
                const res = await apiClient.sessions[":id"].$get({
                    param:{id},

                });
                if(ignore) return;
                if (!res.ok) throw new Error(await getErrorMessage(res));
                const resolved = await res.json();
                setSession(resolved);

            }catch (err){
                if(ignore) return;
                toast.show({
                    variant:"error",
                    message:err instanceof Error ? err.message :"Failed to load session"
                })
                navigate("/", { replace:true})
            }
        }
        fetchSession();
        return () => {
            ignore = true;
        }
    },[id,prefetched,toast,navigate])

        if (!session) {
            return<SessionShell onSubmit ={()=>{}} inputDisabled loading/>
        }

        return <SessionChat key={session.id} session ={session}/>

}
