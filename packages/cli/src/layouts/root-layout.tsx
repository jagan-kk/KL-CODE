import { Outlet} from "react-router";
import { ToastProvider } from "../providers/toast";
import { DialogProvider } from "../providers/dialog";
import { KeyboardLayerProvider } from "../providers/keyboard-layer";
import { ThemeProvider } from "../providers/theme";
import { ThemeRoot } from "./themed-root";


export function RootLayout() {
    return (
            <ThemeProvider>
              <KeyboardLayerProvider>
                <DialogProvider>
                  <ToastProvider>
                     <ThemeRoot>
                        <Outlet/>
                     </ThemeRoot>
                  </ToastProvider>
                </DialogProvider>
              </KeyboardLayerProvider>
            </ThemeProvider>
    )
}