import "opentui-spinner/react"
import { useTheme } from "../providers/theme"
import { Mode } from "@KL-CODE/database/enums"


type Props = {
    mode?:Mode;
}

export function Spinner({ mode=Mode.BUILD}:Props) {
    const { colors } =useTheme()
    const activeColr = mode === Mode.PLAN ? colors.planMode : colors.primary

    return <spinner name="aesthetic" color={colors.primary}/>;
}