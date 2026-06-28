import { AsciiMotionTui } from "./ascii-motion-tui";

export function Header() {
    return (
        <box justifyContent="center" alignItems="center">
            <AsciiMotionTui
                autoPlay
                loop
                hasDarkBackground
            />
        </box>
    );
}