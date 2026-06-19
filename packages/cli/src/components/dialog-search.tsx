import { useCallback,useRef,useState, type ReactNode } from "react";
import { InputRenderable, TextAttributes, type ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard} from "@opentui/react"
import { useKeyboardLayer } from "../providers/keyboard-layer";
import { useTheme } from "../providers/theme";


const MAX_VISIBLE_ITEMS=6   

type DialogSearchListProps<T> = {
    items: T[]
    onSelect: (items:T) => void;
    onHighlight?:(item:T) =>void;
    filterFn:(items: T,query:string) => boolean;
    renderItem:(item:T,isSelected:boolean)=> ReactNode;
    getKey:(item:T) => string;
    placeholder?: string;
    emptyText?: string;
};

export function DialogSearchList<T>({
    items,
    onSelect,
    onHighlight,
    filterFn,
    renderItem,
    getKey,
    placeholder="Search",
    emptyText="No Results",

}:DialogSearchListProps<T>) {
    const [selectedIndex,setSelectedIndex]=useState(0);
    const [searchValue,setSearchValue] = useState("");
    const inputRef=useRef<InputRenderable>(null);
    const scrollRef = useRef<ScrollBoxRenderable>(null);
    const { isTopLayer }= useKeyboardLayer();
    const {colors} = useTheme();

    const handleContentChange = useCallback(()=> {
        const text = inputRef.current?.value ??"";
        setSearchValue(text);
        setSelectedIndex(0);

        const scrollbox = scrollRef.current;
        if (scrollbox) {
            scrollbox.scrollTo(0);

        }
        },[]);

        const filterd = searchValue
        ? items.filter((items) => filterFn(items,searchValue))
        :items;

        const visibleHeight = Math.min(filterd.length,MAX_VISIBLE_ITEMS);

        useKeyboard((key)=> {
            if (!isTopLayer("dialog")) return;

            if (key.name ==="return" || key.name ==="enter"){
                const item = filterd[selectedIndex];
                if (item)
                    onSelect(item);
            } else if (key.name === "up") {
                setSelectedIndex((i)=> {
                const newIndex = Math.max(0,i-1);
                const sb= scrollRef.current;
                if (sb && newIndex < sb.scrollTop) {
                    sb.scrollTo(newIndex);
                }
                const item = filterd[newIndex];
                if(item && onHighlight) onHighlight(item);
                return newIndex;
                });
            } else if (key.name ==="down") {
                setSelectedIndex((i)=> {
                    const newIndex = Math.min(filterd.length-1,i+1)
                    const sb=scrollRef.current;
                    if(sb){
                        const viewportHeight = sb.viewport.height;
                        const visibileEnd=sb.scrollTop+viewportHeight - 1;
                        if(newIndex > visibileEnd) {
                            sb.scrollTo(newIndex - viewportHeight + 1);
                        }
                    }
                    const item = filterd[newIndex];
                    if (item && onHighlight) onHighlight(item);
                    return newIndex;
                })
            }
        });

        return (
            <box flexDirection="column" gap={1}>
                <input
                 ref={inputRef}
                 placeholder={placeholder}
                 focused
                 onContentChange={handleContentChange}
                 />
                 {
                    filterd.length ===0 ?(
                        <text attributes={TextAttributes.DIM}>
                            {emptyText}
                        </text>
                    ): (
                        <scrollbox ref={scrollRef} height={visibleHeight}>
                            {
                                filterd.map((item,i)=> {
                                    const isSelected = i ===selectedIndex;
                                    return (
                                        <box
                                        key={getKey(item)}
                                        flexDirection="row"
                                        height={1}
                                        overflow="hidden"
                                        backgroundColor={isSelected? colors.selection:undefined}
                                        onMouseMove={()=>{
                                            setSelectedIndex(i);
                                            if (onHighlight) onHighlight(item);
                                        }}
                                        onMouseDown={()=>onSelect(item)}    
                                        >
                                        {renderItem(item,isSelected)}
                                        </box>
                                    )
                                })
                            }
                        </scrollbox>
                    )
                 }
            </box>
        );

};