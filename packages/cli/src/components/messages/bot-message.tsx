import { TextAttributes } from "@opentui/core";
import { useTheme } from "../../providers/theme";
import type { ClientMessagePort,ClientToolCallPart } from "../../hooks/use-chat";
import { Mode } from "@KL-CODE/database/enums";
import type { ThemeColors } from "../../theme";
import { usePromptConfig } from "../../providers/prompt-config";

type Props = {
    parts:ClientMessagePort[]
    model:string;
    mode:Mode
    duration?:string;
    streaming?:boolean;
    interrupted?:boolean
}


function formatToolName(name:string):string {
    return name
    .replace(/([a-z0-9])([A-Z])/g,"$1,$2")
    .replace(/^./, (c)=>c.toUpperCase())
};

function formatToolArgs(tc:ClientToolCallPart):string {
    return Object.values(tc.args).map(String).join(" ");
}

type PartGroup ={
    type:ClientMessagePort["type"];
    parts:ClientMessagePort[];
    key:string;
}

function groupConsecutiveParts(parts:ClientMessagePort[]):PartGroup[] {
    const groups:PartGroup[] = [];

    for (let i =0; i< parts.length;i++) {
        const part =parts[i]!;
        const lastGroup = groups[groups.length-1];

        if(lastGroup && lastGroup.type===part.type) {
            lastGroup?.parts.push(part);

        }else {
            let key: string;
            if (part.type === "tool-call") {
                key = `group-tc-${part.id}`;
            } else {
                key = `group-${part.type}-${i}`;
            }
            groups.push({ type:part.type,parts:[part],key})
        }
    }
    return groups;
}

function statusIcon(status: string): string {
    switch (status) {
        case "completed": return "✓";
        case "in_progress": return "◉";
        case "cancelled": return "✕";
        default: return "○";
    }
}

function priorityFg(priority: string, colors: ThemeColors): string {
    switch (priority) {
        case "high": return colors.error;
        case "medium": return colors.info;
        default: return colors.dimSeparator;
    }
}


export function BotMessage({
  parts,
  model,
  mode,
  duration,
  streaming = false,
  interrupted = false,
}: Props) {
  const { colors } = useTheme();
  const { showReasoning } = usePromptConfig();
  const visibleParts = showReasoning ? parts : parts.filter((p) => p.type !== "reasoning");

  return (
    <box width="100%" flexDirection="column">
      {/* Message */}
      <box width="100%" alignItems="center">
        {groupConsecutiveParts(visibleParts).map((group) => (
          <box key={group.key} paddingY={1} width="100%">
            {group.parts.map((part, j) => {
              if (part.type === "reasoning") {
                return (
                  <box
                    key={`reasoning-${j}`}
                    border={["left"]}
                    borderColor={colors.thinkingBorder}
                    width="100%"
                    paddingX={2}
                  >
                    <text attributes={TextAttributes.DIM}>
                      <em fg={colors.thinking}>Thinking:</em> {part.text}
                    </text>
                  </box>
                );
              }

              if (part.type === "tool-call") {
                return (
                  <box
                    key={part.id}
                    border={["left"]}
                    borderColor={colors.thinkingBorder}
                    width="100%"
                    paddingX={2}
                  >
                    <text attributes={TextAttributes.DIM}>
                      <em fg={colors.info}>
                        {formatToolName(part.name)}
                      </em>
                      {formatToolArgs(part)}
                      {part.status === "calling" ? " ..." : ""}
                    </text>
                  </box>
                );
              }

              if (part.type === "question") {
                return (
                  <box
                    key={`question-${part.questionId}`}
                    border={["left"]}
                    borderColor={colors.info}
                    width="100%"
                    paddingX={2}
                    flexDirection="column"
                  >
                    <text attributes={TextAttributes.BOLD}>
                      <em fg={colors.info}>Question: {part.header}</em>
                    </text>
                    <text>{part.question}</text>
                    {part.options && part.options.length > 0 && (
                      <box flexDirection="column" paddingX={1} paddingY={1}>
                        {part.options.map((opt, oi) => (
                          <text key={oi} attributes={TextAttributes.DIM}>
                            {part.multiple ? "□" : "○"} {opt.label}: {opt.description}
                          </text>
                        ))}
                      </box>
                    )}
                    {!part.answered && (
                      <text attributes={TextAttributes.DIM} fg={colors.info}>
                        (waiting for your response...)
                      </text>
                    )}
                  </box>
                );
              }

              if (part.type === "todo") {
                return (
                  <box
                    key={`todo-${j}`}
                    border={["left"]}
                    borderColor={colors.thinkingBorder}
                    width="100%"
                    paddingX={2}
                    flexDirection="column"
                  >
                    <text attributes={TextAttributes.BOLD}>Tasks:</text>
                    <box flexDirection="column" paddingX={1}>
                      {part.todos.map((todo, ti) => (
                        <text key={ti}>
                          <text fg={priorityFg(todo.priority, colors)}>
                            {statusIcon(todo.status)}
                          </text>
                          {` ${todo.content} `}
                          <text attributes={TextAttributes.DIM}>({todo.priority})</text>
                        </text>
                      ))}
                    </box>
                  </box>
                );
              }

              if (part.type === "text") {
                return (
                  <box key={`text-${j}`} paddingX={3} width="100%">
                    <text>{part.text}</text>
                  </box>
                );
              }

              return null;
            })}
          </box>
        ))}
      </box>

      {/* Footer */}
      <box paddingX={3} paddingBottom={1} gap={1} width="100%">
        <box flexDirection="row" gap={2}>
          <text
            attributes={interrupted ? TextAttributes.DIM : 0}
            fg={
              interrupted
                ? undefined
                : mode === Mode.PLAN
                ? colors.planMode
                : colors.primary
            }
          >
            ◉
          </text>

          <box flexDirection="row" gap={1}>
            <text attributes={interrupted ? TextAttributes.DIM : 0}>
              {mode === Mode.PLAN ? "Plan" : "Build"}
            </text>

            <text
              attributes={TextAttributes.DIM}
              fg={colors.dimSeparator}
            >
              {">"}
            </text>

            <text attributes={TextAttributes.DIM}>{model}</text>

            {(duration || interrupted) && (
              <>
                <text
                  attributes={TextAttributes.DIM}
                  fg={colors.dimSeparator}
                >
                  {">"}
                </text>

                <text attributes={TextAttributes.DIM}>
                  {interrupted ? "interrupted" : duration}
                </text>
              </>
            )}
          </box>
        </box>
      </box>
    </box>
  );
}
