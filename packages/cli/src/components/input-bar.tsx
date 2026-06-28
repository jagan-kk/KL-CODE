import { useRef, useCallback,useEffect, useState } from "react";
import { TextareaRenderable,type KeyEvent } from "@opentui/core";
import { useKeyboard,useRenderer } from "@opentui/react";
import type { KeyBinding } from "@opentui/core";
import { StatusBar} from "./status-bar";
import type { Command } from "./sub_command/types";
import { useCommandMenu } from "./sub_command/use-command-menu";
import { CommandMenu } from "./sub_command";
import { useToast } from "../providers/toast"
import { useKeyboardLayer } from "../providers/keyboard-layer";
import { useDialog } from "../providers/dialog";
import { useTheme } from "../providers/theme";
import { useNavigate } from "react-router";
import { usePromptConfig } from "../providers/prompt-config";
import {Mode} from "@KL-CODE/database/enums"
import { FileSearchDialog } from "./dialogs/file-search-dialog";

import type { Message } from "../hooks/use-chat";

type Props = {
    onSubmit: (text: string) => void;
    disabled?: boolean;
    messages?: Message[];
    sessionId?: string;
};

export const TEXTAREA_KEY_BINDINGS: KeyBinding[] =[
    { name: "return" , action: "submit" },
    { name : "enter" , action: "submit"},
    { name: "return" , shift: true, action: "newline"},
    { name: "enter" , shift: true, action:"newline"},
];




export function InputBar({ onSubmit, disabled = false, messages, sessionId }:Props) {
    const textareaRef = useRef<TextareaRenderable>(null);
    const onSubmitRef = useRef<() => void>(() => {});
    const renderer = useRenderer();
    const navigate =useNavigate();
    const toast = useToast();
    const { mode,toggleMode,setMode,setModel,showReasoning,setShowReasoning}=usePromptConfig();
    const dialog=useDialog();
    const { colors }= useTheme();
    const { isTopLayer, setResponder } = useKeyboardLayer();

    const [atPosition, setAtPosition] = useState(-1);


    const {
        showCommandMenu,
        commandQuery,
        selectedIndex,
        scrollRef,
        handleContentChange,
        resolveCommand,
        setSelectedIndex,

    } =useCommandMenu();
    

    const handleTextareaContentChange = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const text = textarea.plainText;
        handleContentChange(text);

        const atIdx = text.lastIndexOf("@");
        if (atIdx >= 0 && !text.startsWith("/")) {
            const afterAt = text.slice(atIdx + 1);
            if (afterAt.length > 0 && !afterAt.includes(" ")) {
                setAtPosition(atIdx);
            } else {
                setAtPosition(-1);
            }
        } else {
            setAtPosition(-1);
        }
    }, [handleContentChange])

    const handleSubmit = () => {
        if (disabled) return;

        const textarea= textareaRef.current;
        if (!textarea) return;

        const text = textarea.plainText.trim();
        if (text.length ===0) return;

        onSubmit(text);
        textarea.setText("");
    }

    const handleCommand = useCallback((
        command: Command | undefined
    )=> {
        const textarea = textareaRef.current;
        if (!textarea || !command)  return;
        textarea.setText("");

        if (command.action) {
            command.action({
                exit: () => renderer.destroy(),
                toast,
                dialog,
                navigate,
                mode,
                setMode,
                setModel,
                showReasoning,
                setShowReasoning,
                messages,
                sessionId,
            });
        }else {
            textarea.insertText(command.value + " ");
        }
    }, [renderer,toast,dialog,navigate,mode,setMode,setModel,showReasoning,setShowReasoning,messages,sessionId])

     const handleCommandExecute = useCallback((index : number) => {
        const command = resolveCommand(index);
        handleCommand(command)
    }, [resolveCommand,handleCommand],
    );




    useEffect(()=> {
        const textarea = textareaRef.current;
        if(!textarea) return;

        textarea.onSubmit =() => {
            onSubmitRef.current();
        };

        const ta = textarea as unknown as { handleKeyPress: (key: KeyEvent) => boolean };
        const originalHandleKeyPress = ta.handleKeyPress.bind(textarea);
        ta.handleKeyPress = (key: KeyEvent) => {
            if (key.name === "tab") {
                toggleMode();
                return true;
            }
            return originalHandleKeyPress(key);
        };
    }, []);

    const handleFileReference = useCallback((filePath: string) => {
        const textarea = textareaRef.current;
        if (!textarea || atPosition < 0) return;
        const text = textarea.plainText;
        const afterAt = text.slice(atPosition + 1);
        const endIdx = afterAt.search(/\s/);
        const queryLen = endIdx >= 0 ? endIdx : afterAt.length;
        const before = text.slice(0, atPosition);
        const after = text.slice(atPosition + 1 + queryLen);
        textarea.setText(`${before}${filePath}${after}`);
        setAtPosition(-1);
    }, [atPosition]);

    const handleOpenFileSearch = useCallback(() => {
        dialog.open({
            title: "Search files",
            children: <FileSearchDialog onSelectFile={handleFileReference} />,
        });
    }, [dialog, handleFileReference]);

    onSubmitRef.current = () => {
        if (disabled) return;

        if (showCommandMenu) {
            const command = resolveCommand(selectedIndex);
            handleCommand(command);
            return;
        }

        if (atPosition >= 0) {
            handleOpenFileSearch();
            return;
        }
        handleSubmit();
    }

    useKeyboard((key) => {
        if(disabled) return;
        if(!isTopLayer("base")) return;
        if(key.name =="tab") {
            key.preventDefault();
            toggleMode();
        }
    })



    useEffect(() => {
        setResponder("base", () => {
            if (disabled) return false;

            const textarea = textareaRef.current;
            if (textarea && textarea.plainText.length> 0) {
                textarea.setText("");
                return true;
            }
            return false;
        });
        return () => setResponder("base", null);    
    },[disabled,setResponder]);



    return (
        <box width="100%">
            <box
              border={["left"]}
              borderColor={mode===Mode.BUILD ? colors.primary :colors.planMode}
              width="100%"
            >
             <box
                position="relative"
                justifyContent="center"
                paddingX={2}
                paddingY={1}
                backgroundColor={colors.surface}
                width="100%"
                gap={1}
            >
                {showCommandMenu && (
                    <box
                    position="absolute"
                    bottom="100%"
                    left={0}
                    width="100%"
                    backgroundColor={colors.surface}
                    zIndex={10}

                    >
                      <CommandMenu
                       query={commandQuery}
                       selectedIndex={selectedIndex}
                       scrollRef={scrollRef}
                       onSelect={setSelectedIndex}
                       onExecute={handleCommandExecute}
                        />
                    </box>

                )}
                <textarea
                  ref = {textareaRef}
                  focused ={!disabled && (isTopLayer("base") || isTopLayer("command"))}
                  keyBindings={TEXTAREA_KEY_BINDINGS}
                  onContentChange={handleTextareaContentChange}
                  placeholder={'Ask anything..'}
                  height={1}
                />
                <StatusBar />
            </box>
        </box>
    </box>
    );
}