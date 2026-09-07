import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";

type FloatingPanelAnchor = {
  centerX: number;
  top: number;
};

type DragState = {
  pointerId: number;
  offsetX: number;
  offsetY: number;
};

const PANEL_MARGIN = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// 锚点是面板的水平中心与顶边，取值范围是整个视口：工具栏可以停到顶栏、侧栏等画面之外的位置。
function constrainPanelAnchor(panel: HTMLElement, centerX: number, top: number): FloatingPanelAnchor {
  const rect = panel.getBoundingClientRect();
  const halfWidth = rect.width / 2;
  const minCenterX = PANEL_MARGIN + halfWidth;
  const maxCenterX = Math.max(minCenterX, window.innerWidth - PANEL_MARGIN - halfWidth);
  const maxTop = Math.max(PANEL_MARGIN, window.innerHeight - PANEL_MARGIN - rect.height);

  return {
    centerX: clamp(centerX, minCenterX, maxCenterX),
    top: clamp(top, PANEL_MARGIN, maxTop),
  };
}

export function useDraggableFloatingPanel<T extends HTMLElement>() {
  const panelRef = useRef<T | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [anchor, setAnchor] = useState<FloatingPanelAnchor | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const hasAnchor = anchor !== null;

  const panelStyle = useMemo<CSSProperties | undefined>(() => {
    if (!anchor) return undefined;
    // 拖动后改用 position:fixed + 视口坐标，避免父级布局变化造成位置跳动。
    // transform 与 CSS 默认停靠写的是同一个值，首次拖拽不会触发 transform 过渡。
    return {
      position: "fixed",
      left: `${anchor.centerX}px`,
      top: `${anchor.top}px`,
      transform: "translateX(-50%)",
    };
  }, [anchor]);

  const moveToPointer = useCallback((clientX: number, clientY: number) => {
    const panel = panelRef.current;
    const dragState = dragStateRef.current;
    if (!panel || !dragState) return;

    setAnchor(constrainPanelAnchor(panel, clientX - dragState.offsetX, clientY - dragState.offsetY));
  }, []);

  // 折叠与展开会改变面板尺寸，尺寸变化后要把锚点重新收回视口内。
  const clampAnchor = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    setAnchor((current) => {
      if (!current) return current;
      const next = constrainPanelAnchor(panel, current.centerX, current.top);
      return next.centerX === current.centerX && next.top === current.top ? current : next;
    });
  }, []);

  useEffect(() => {
    if (!hasAnchor) return;
    const panel = panelRef.current;
    const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(clampAnchor) : undefined;
    if (panel) resizeObserver?.observe(panel);

    window.addEventListener("resize", clampAnchor);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", clampAnchor);
    };
  }, [clampAnchor, hasAnchor]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    const panel = panelRef.current;
    if (!panel) return;

    const panelRect = panel.getBoundingClientRect();
    dragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - (panelRect.left + panelRect.width / 2),
      offsetY: event.clientY - panelRect.top,
    };
    setIsDragging(true);
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic pointer events used by tests do not always create an active pointer.
    }
    event.preventDefault();
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (dragStateRef.current?.pointerId !== event.pointerId) return;
      moveToPointer(event.clientX, event.clientY);
      event.preventDefault();
    },
    [moveToPointer],
  );

  useEffect(() => {
    const onWindowPointerMove = (event: globalThis.PointerEvent) => {
      if (dragStateRef.current?.pointerId !== event.pointerId) return;
      moveToPointer(event.clientX, event.clientY);
      event.preventDefault();
    };
    const onWindowPointerEnd = (event: globalThis.PointerEvent) => {
      if (dragStateRef.current?.pointerId !== event.pointerId) return;
      dragStateRef.current = null;
      setIsDragging(false);
    };
    const onWindowBlur = () => {
      dragStateRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener("pointermove", onWindowPointerMove, { passive: false });
    window.addEventListener("pointerup", onWindowPointerEnd);
    window.addEventListener("pointercancel", onWindowPointerEnd);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerEnd);
      window.removeEventListener("pointercancel", onWindowPointerEnd);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [moveToPointer]);

  const finishDrag = useCallback((event: PointerEvent<HTMLElement>) => {
    if (dragStateRef.current?.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    setIsDragging(false);
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // The pointer may already be released by the browser or a test harness.
    }
    event.preventDefault();
  }, []);

  return {
    panelRef,
    panelStyle,
    isDragging,
    clampAnchor,
    dragHandleProps: {
      onPointerCancel: finishDrag,
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
    },
  };
}
