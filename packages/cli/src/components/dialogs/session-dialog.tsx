import { useEffect, useState } from "react";
import { useDialog } from "../../providers/dialog";
import { useToast } from "../../providers/toast";
import { apiClient } from "../../lib/api-clients";
import { getErrorMessage } from "../../lib/http-errors";
import type { InferResponseType } from "hono";

type Session = InferResponseType<(typeof apiClient.sessions)["$get"], 200>[number]

export const SessionDialogContent = () => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const { close } = useDialog()
    const { show } = useToast()

    useEffect(() => {
        let ignore = false
        const fetchSessions = async () => {
            try {
                const res = await apiClient.sessions.$get();
                if (!res.ok) {
                    throw new Error(await getErrorMessage(res));
                }
                const data = await res.json();
                if (!ignore) {
                    setSessions(data);
                }
            } catch (error) {
                if (!ignore) {
                    show({
                        variant: "error",
                        message: error instanceof Error ? error.message : "Failed to fetch sessions"
                    })
                    close();
                }
            }
        }
        fetchSessions();
        return () => { ignore = true }
    }, [close, show])

    return (
        <box flexDirection="column" gap={1}>
            <text>sessions: {sessions.length}</text>
        </box>
    )
}
