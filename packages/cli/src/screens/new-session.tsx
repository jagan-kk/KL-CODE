import { useEffect} from "react"
import {useNavigate,useLocation} from "react-router"
import { useTheme } from "../providers/theme"
import { SessionShell } from "../components/session-shell"
import { ErrorMessage,UserMessage,BotMessage } from "../components/messages"


export function Newsession() {
    const navigate = useNavigate()
    const location =useLocation()
    const { colors} =useTheme()

    const state = location.state as { message ?:string} |null;


    useEffect(() => {
        if(!state?.message) {
            navigate("/", {replace:true});
        }
    },[state,navigate]);

    if(!state?.message) return null;

    return (
        <SessionShell onSubmit={() => {}} >
            
        </SessionShell>
    )

}

