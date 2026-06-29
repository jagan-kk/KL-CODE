import { TextAttributes } from "@opentui/core";
import type { ReactNode } from "react";
import { InputBar } from "./input-bar";
import { Spinner } from "./spinner";
import { usePromptConfig } from "../providers/prompt-config";
import type { ClientQuestionPart, Message } from "../hooks/use-chat";

type Props = {
    children?: ReactNode;
    onSubmit: (text:string)=> void;
    inputDisabled?:boolean;
    loading?:boolean;
    interruptable?:boolean;
    activeQuestion?: ClientQuestionPart | null;
    onAnswerQuestion?: (questionId: string, answers: string[]) => void;
    messages?: Message[];
    sessionId?: string;
    
}

export function SessionShell({
    children,
    onSubmit,
    inputDisabled = false,
    loading=false,
    interruptable=false,
    activeQuestion,
    onAnswerQuestion,
    messages,
    sessionId,

}:Props) {

    const {mode} =usePromptConfig();
    return (
        <box
        flexDirection="column"
        flexGrow={1}
        width="100%"
        height="100%"
        paddingY={1}
        paddingX={2}
        gap={1}
    >
        {activeQuestion && (
            <box
            border={["left"]}
            borderColor="yellow"
            width="100%"
            paddingX={2}
            paddingY={1}
            flexDirection="column"
            >
                <text attributes={TextAttributes.BOLD}>
                    <em fg="yellow">Question: {activeQuestion.header}</em>
                </text>
                <text>{activeQuestion.question}</text>
                {activeQuestion.options && activeQuestion.options.length > 0 && (
                    <box flexDirection="column" paddingY={1} gap={1}>
                        {activeQuestion.options.map((opt, oi) => (
                            <text key={oi}>
                                <text fg="cyan">[{oi + 1}]</text> {opt.label}
                                <text attributes={TextAttributes.DIM}> - {opt.description}</text>
                            </text>
                        ))}
                    </box>
                )}
                <text attributes={TextAttributes.DIM}>Type your answer and press Enter</text>
            </box>
        )}
        <scrollbox flexGrow={1} width="100%" stickyScroll stickyStart="bottom">
            <box gap={1}>{children}</box>
        </scrollbox>
        <box flexShrink={0}>
            <InputBar onSubmit={onSubmit} disabled={inputDisabled || !!activeQuestion} messages={messages} sessionId={sessionId} />
        </box>
        <box
        flexShrink={0}
        flexDirection="row"
        justifyContent="space-between"
        width="100%"
        height={1}
        gap={2}
        paddingLeft={1}
        >
            <box flexDirection="row" alignItems="center" gap={2}>
                {loading?(
                    <>
                    <Spinner mode={mode}/>
                    {interruptable ? <text>esc to interrupt </text>:null}

                    </>
                ):null}
            </box>

             <box flexDirection="row" gap={1} flexShrink={0} marginLeft="auto">
                <text>tab</text>
                <text attributes={TextAttributes.DIM}>agents</text>
             </box>
     
        </box>
    </box>
    )
}
