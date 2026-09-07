import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
  type RefObject,
} from "react";

// 工具栏完整出现的时长：挂载后先展示这么久，鼠标一直不在上面就收成小箭头。
const AUTO_COLLAPSE_DELAY_MS = 2500;

interface CollapsibleToolbarOptions {
  // 拖拽中、文字输入窗口或快捷键菜单打开时必须保持展开，否则会在操作途中收起。
  holdOpen: boolean;
  panelRef: RefObject<HTMLElement | null>;
}

export function useCollapsibleToolbar({ holdOpen, panelRef }: CollapsibleToolbarOptions) {
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  // 点「收起工具栏」时焦点会随按钮卸载而丢失，收起后要把焦点交回小箭头；
  // 这次主动聚焦不能再触发展开，否则收起和展开会来回打转。同一个标记兼任这两件事。
  const restoreFocusRef = useRef(false);

  useEffect(() => {
    if (collapsed || hovered || focusInside || holdOpen) return;
    const timer = window.setTimeout(() => setCollapsed(true), AUTO_COLLAPSE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [collapsed, focusInside, holdOpen, hovered]);

  useLayoutEffect(() => {
    if (!collapsed || !restoreFocusRef.current) return;
    panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    restoreFocusRef.current = false;
  }, [collapsed, panelRef]);

  const collapse = useCallback(() => {
    const active = document.activeElement;
    restoreFocusRef.current = Boolean(active instanceof Node && panelRef.current?.contains(active));
    setCollapsed(true);
  }, [panelRef]);

  const expand = useCallback(() => setCollapsed(false), []);

  const onPointerEnter = useCallback(() => {
    setHovered(true);
    setCollapsed(false);
  }, []);

  const onPointerLeave = useCallback((event: PointerEvent<HTMLElement>) => {
    setHovered(false);
    // 鼠标移开后清掉留在按钮上的焦点，否则点过按钮的工具栏会因为焦点还在里面而一直不收起。
    // 触摸指针抬起时同样会触发 pointerleave，那时焦点是触屏用户唯一的保持展开依据，不能清。
    if (event.pointerType !== "mouse") return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && event.currentTarget.contains(active)) active.blur();
  }, []);

  const onFocus = useCallback(() => {
    setFocusInside(true);
    if (restoreFocusRef.current) return;
    setCollapsed(false);
  }, []);

  const onBlur = useCallback((event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setFocusInside(false);
  }, []);

  return {
    collapsed,
    collapse,
    expand,
    sectionProps: { onBlur, onFocus, onPointerEnter, onPointerLeave },
  };
}
