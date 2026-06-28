import { useMemo } from "react";
import { TextAttributes } from "@opentui/core";
import { DialogSearchList } from "../dialog-search";
import { useDialog } from "../../providers/dialog";
import { useTheme } from "../../providers/theme";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

type FileEntry = {
    path: string;
    name: string;
    isDir: boolean;
};

function scanFiles(): FileEntry[] {
    const entries: FileEntry[] = [];
    try {
        const cwd = process.cwd();
        const scanDepth = (dir: string, depth: number) => {
            if (depth > 2) return;
            try {
                const items = readdirSync(dir);
                for (const item of items) {
                    if (item.startsWith(".") || item === "node_modules") continue;
                    const full = join(dir, item);
                    const rel = relative(cwd, full).replace(/\\/g, "/");
                    try {
                        const s = statSync(full);
                        entries.push({ path: rel, name: item, isDir: s.isDirectory() });
                        if (s.isDirectory() && depth < 1) {
                            scanDepth(full, depth + 1);
                        }
                    } catch {}
                }
            } catch {}
        };
        scanDepth(cwd, 0);
    } catch {}
    return entries;
}

type Props = {
    onSelectFile: (path: string) => void;
};

export function FileSearchDialog({ onSelectFile }: Props) {
    const { close } = useDialog();
    const { colors } = useTheme();

    const files = useMemo(() => scanFiles(), []);

    return (
        <DialogSearchList
            items={files}
            onSelect={(file) => {
                if (!file.isDir) {
                    onSelectFile(file.path);
                    close();
                }
            }}
            filterFn={(file, query) =>
                file.path.toLowerCase().includes(query.toLowerCase())
            }
            renderItem={(file, isSelected) => (
                <box flexDirection="row" width="100%" overflow="hidden">
                    <text
                        selectable={false}
                        fg={isSelected ? "black" : file.isDir ? colors.info : "white"}
                    >
                        {file.isDir ? ">" : " "} {file.path}
                    </text>
                </box>
            )}
            getKey={(file) => file.path}
            placeholder="Search files..."
            emptyText="No matching files"
        />
    );
}
