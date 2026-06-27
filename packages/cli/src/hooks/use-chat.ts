import {useState,useRef,useCallback,useEffect} from "react";
import { EventSourceParserStream} from "eventsource-parser/stream"
import prettyMs from "pretty-ms"
import type {ClientResponse} from "hono/client"
import {apiClient} from "../lib/api-clients"
import {getErrorMessage} from "../lib/http-errors"
import type {Mode} from "@KL-CODE/database/enums"
import {
    chatStreamEventSchema,
    type SupportedChatModel,
    type SupportedChatModelId
} from "@KL-CODE/shared"


export type ClientMessagePort ={ type:"text";text:string};

export type Message = | {id:string;role:"user";content:string;mode:Mode;model:SupportedChatModelId} |
                    {
                        id:string;
                        role:"assistant";
                        content:string;
                        mode:Mode;
                        model:SupportedChatModelId;
                        parts:ClientMessagePort[];
                        duration?:string;
                        interruped?:boolean;
                    }

                    |
                    {
                        id:string;
                        role:"error";
                        content:string;
                    }

            type StreamingState = | {status:"idle"}
            | {
                status:"streaming";
                parts:ClientMessagePort[];
                mode:Mode;
                model:SupportedChatModelId
            }

            type ActiveStream ={
                requestId: string;
                controller:AbortController;
                mode:Mode;
                model:SupportedChatModelId;
                parts:ClientMessagePort[];
                interrupedCaptured:boolean
            };


            type SubmitParams = {
                userText:string;
                mode:Mode;
                model:SupportedChatModelId;
            }

            type RunStreamParams = {
                mode:Mode;
                model:SupportedChatModelId;
                request:(controller:AbortController)=>Promise<ClientResponse<unknown>>;
            };

            export function useChat(
                sessionId:string,
                initialMessages:Message[],

            ){
                const [messages,setMessages] = useState<Message[]>(initialMessages);
                const [streaming,setStreaming] = useState<StreamingState> ({
                    status:"idle"
                });
                const activeStreamRef = useRef<ActiveStream | null>(null);

                const updateMessages = useCallback((
                    updater:(prev:Message[])=> Message[])=>{
                    setMessages((prev)=> updater(prev));    

                    },[])

                const isActiveRequest = useCallback((requestId:string)=>{
                    return activeStreamRef.current?.requestId===requestId;
                },[])

            const emitParts = useCallback((
                requestId:string,
                parts:ClientMessagePort[],
            )=>{

                if(!isActiveRequest(requestId)) return;

                const snapshot =[...parts];
                const activeStream = activeStreamRef.current;
                if(!activeStream) return;

                activeStream.parts=snapshot;
                setStreaming({
                    status:"streaming",
                    parts:snapshot,
                    mode:activeStream.mode,
                    model:activeStream.model,
                })


            },[isActiveRequest]);

                const captureInterruptedMessage =useCallback((
                    activeStream:ActiveStream
                )=> {
                    if( 
                        activeStream.interrupedCaptured ||
                        activeStream.parts.length ===0
                    ) {
                        return;
                    }
                    activeStream.interrupedCaptured=true;
                    const parts =[...activeStream.parts];
                    const fullText =parts.filter((p)=> p.type==="text")
                    .map((p)=> p.text)
                    .join("");
                    updateMessages((prev)=> [
                        ...prev,
                        {
                            id:crypto.randomUUID(),
                            role:"assistant",
                            content:fullText,
                            mode:activeStream.mode,
                            model:activeStream.model,
                            parts,
                            interrupted:true
                        }
                    ])
                },[updateMessages])


                const clearStream = useCallback(
                (requestId:string)=> {
                    if(!isActiveRequest(requestId)) return;

                    activeStreamRef.current=null;
                    setStreaming({status:"idle"});
                },[isActiveRequest],
            )
        
                const handleStream = useCallback(async(
                    response:ClientResponse<unknown>,
                    activeStream:ActiveStream
                ) => {
                    if(!isActiveRequest(activeStream.requestId)) return;
                    if(!response.ok) {
                        const message = await getErrorMessage(response);
                        updateMessages((prev) => [
                        ...prev,
                        {
                            id:crypto.randomUUID(),
                            role:"error",
                            content:message,
                        }
                    ])

                    return;
                    }

                    const parts:ClientMessagePort[] =[];
                    const stream = response
                    .body!.pipeThrough(new TextDecoderStream())
                    .pipeThrough(new EventSourceParserStream());

                    for await (const {data} of stream) {
                        if(!isActiveRequest (activeStream.requestId)) return;
                        
                        let event

                        try {
                            event = chatStreamEventSchema.parse(JSON.parse(data));
                        } catch(err){
                            const message =err instanceof Error ? err.message : "Invalid stream event";

                            updateMessages((prev)=> [
                                ...prev,
                                {
                                    id:crypto.randomUUID(),
                                    role:"error",
                                    content:message,
                                },
                            ]);
                            break;
                        }

                        switch (event.type) {
                            case "text-delta": {
                                const last = parts[parts.length-1];
                                if (last && last.type ==="text") {
                                    last.text += event.text;

                                } else {
                                    parts.push({ type: "text", text:event.text});
                                }
                                emitParts(activeStream.requestId,parts);
                                break;
                            }

                            case "done":{
                                if(!isActiveRequest(activeStream.requestId)) return;
                               
                                const fullText = parts
                                .filter((p) => p.type === "text")
                                .map((p) => p.text)
                                .join("")


                                updateMessages((prev) => [
                                    ...prev,
                                    {
                                        id:event.messageId,
                                        role:"assistant",
                                        content:fullText,
                                        mode:activeStream.mode,
                                        model:activeStream.model,
                                        duration:prettyMs(event.durationMs),
                                        parts:[...parts]

                                    }
                        
                                ])
                                break;
                            }
                            case "error":
                                updateMessages((prev) => [
                                    ...prev,
                                    {
                                        id:crypto.randomUUID(),
                                        role:"error",
                                        content:event.message,
                                    }
                                ]);
                                break;


                        }

                    }

                },[updateMessages,emitParts,isActiveRequest]);


            const runStream = useCallback(async (
                {mode,model,request}: RunStreamParams
            ) => {
                const controller = new AbortController()
                const activeStream : ActiveStream = {
                    requestId:crypto.randomUUID(),
                    controller,
                    mode,
                    model,
                    parts: [],
                    interrupedCaptured:false
                }

                activeStreamRef.current = activeStream;
                setStreaming({ status:"streaming",parts:[],mode,model});

                try {
                    const response = await request (controller);
                    await handleStream(response,activeStream)
                } catch(err) {
                    if (err instanceof DOMException && err.name === "AbortError") {
                        return;
                    }

                    if (!isActiveRequest(activeStream.requestId)) return;

                    const msg = err instanceof Error ? err.message : String(err);
                    updateMessages((prev) => [
                        ...prev,
                        {
                            id:crypto.randomUUID(),
                            role:"error",
                            content:msg,
                        }
                    ]);
                } finally {
                    clearStream (activeStream.requestId)
                }
            },[clearStream,handleStream,isActiveRequest,updateMessages]);

            const stopeActiveStream = useCallback((
                capturedPartial:boolean
            )=>{
                const activeStream = activeStreamRef.current;
                if(!activeStream) return;
                if(capturedPartial){
                    captureInterruptedMessage(activeStream);
                }
                activeStreamRef.current=null;
                setStreaming({status:"idle"});
                activeStream.controller.abort(); 
            },[captureInterruptedMessage]);

            const resume = useCallback(async ( {mode,model}:Omit<SubmitParams, "userText">)=>{
                await runStream ({
                    mode,
                    model,
                    request:async (controller) => {
                         return apiClient.chat[":sessionId"].resume.$post(
                            {param: {sessionId}},
                            { init: { signal:controller.signal}},
                        )
                    }

                })
            },[runStream,sessionId]);

            const hasAutoResumedRef =  useRef (false);
            useEffect (()=> {
                if(hasAutoResumedRef.current) return;
                const last = initialMessages[initialMessages.length-1];
                if(!last || last.role != "user") return ;

                hasAutoResumedRef.current = true;
                void resume({ mode:last.mode,model: last.model});

            },[initialMessages,resume]);

            const submit = useCallback( async(
                {userText,mode,model}: SubmitParams
            )=> {

                stopeActiveStream(true);
                const userMessage:Message = {
                    id:crypto.randomUUID(),
                    role:"user",
                    content:userText,
                    mode,
                    model,
                }
                updateMessages((prev)=>[...prev,userMessage])
                
                await runStream({
                    mode,
                    model,
                    request:async (controller) => {
                        return apiClient.chat[":sessionId"].$post(
                            {
                                param:{sessionId},
                                json:{content:userText,mode,model}
                            },
                            { init: {signal:controller.signal}}

                        )
                    }
                })
            },[runStream,sessionId,updateMessages,stopeActiveStream])

            const abort = useCallback(()=> {
                stopeActiveStream(false);
            },[stopeActiveStream]);

            const interrupt = useCallback(() => {
                stopeActiveStream(true);

            },[stopeActiveStream])

                return { messages,streaming,submit,abort,interrupt}
            }
