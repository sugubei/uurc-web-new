import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RemoteCommandBar, type RemoteCommandBarProps } from "../src/components/RemoteCommandBar.js";
import { AppMotionProvider } from "../src/motion/AppMotionProvider.js";
import { rectFrom } from "./appTestValues.js";

// 只接管 setTimeout：motion 和 jsdom 依赖的 requestAnimationFrame 保持真实实现。
function useCollapseTimers() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
}

function settle(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function renderCommandBar(overrides: Partial<RemoteCommandBarProps> = {}) {
  const props: RemoteCommandBarProps = {
    busy: null,
    controlChannelState: "open",
    inputControlActive: true,
    isFullscreen: false,
    nextAction: { label: "重新连接", detail: "", disabled: false },
    onNextAction: vi.fn(),
    onRemoteShortcut: vi.fn(),
    onStageViewModeChange: vi.fn(),
    onToggleInputControl: vi.fn(),
    onToggleFullscreen: vi.fn(),
    canSendText: true,
    onSendText: vi.fn(() => true),
    remoteAudio: {
      elementRef: { current: null },
      available: false,
      muted: false,
      volume: 1,
      playbackState: "idle",
      playbackErrorName: "",
      onToggleMuted: vi.fn(),
      onVolumeChange: vi.fn(),
      onResumePlayback: vi.fn(),
    },
    remoteShortcutPlatform: "mac",
    remoteStageViewMode: "fit",
    ...overrides,
  };

  return render(
    <AppMotionProvider>
      <div className="control-stage-frame">
        <RemoteCommandBar {...props} />
      </div>
    </AppMotionProvider>,
  );
}

function getToolbar() {
  return screen.getByLabelText("远控主流程");
}

describe("RemoteCommandBar dock", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows the full toolbar first, collapses to an arrow, and follows hover", () => {
    useCollapseTimers();
    renderCommandBar();
    const toolbar = getToolbar();

    expect(toolbar).not.toHaveClass("control-command-bar--collapsed");
    expect(screen.getByRole("button", { name: "拖动工具栏" })).toBeInTheDocument();

    settle(2500);
    expect(toolbar).toHaveClass("control-command-bar--collapsed");
    expect(screen.getByRole("button", { name: "展开远控工具栏" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "拖动工具栏" })).not.toBeInTheDocument();

    fireEvent.pointerOver(toolbar);
    expect(toolbar).not.toHaveClass("control-command-bar--collapsed");
    expect(screen.getByRole("button", { name: "收起工具栏" })).toBeInTheDocument();

    fireEvent.pointerOut(toolbar, { relatedTarget: document.body });
    expect(toolbar).not.toHaveClass("control-command-bar--collapsed");
    settle(2500);
    expect(toolbar).toHaveClass("control-command-bar--collapsed");
  });

  it("keeps the connect action reachable while the control channel is not open", () => {
    useCollapseTimers();
    renderCommandBar({
      controlChannelState: "connecting",
      inputControlActive: false,
      nextAction: { label: "开始连接", detail: "", disabled: false },
    });

    settle(10_000);
    expect(getToolbar()).not.toHaveClass("control-command-bar--collapsed");
    expect(screen.getByRole("button", { name: /开始连接/ })).toBeInTheDocument();
  });

  it("keeps the toolbar expanded while the text input dialog is open", () => {
    useCollapseTimers();
    renderCommandBar();

    fireEvent.click(screen.getByRole("button", { name: "输入文字" }));
    settle(10_000);

    expect(getToolbar()).not.toHaveClass("control-command-bar--collapsed");
    expect(screen.getByRole("dialog", { name: "输入文字" })).toBeInTheDocument();
  });

  it("drags across the whole viewport instead of only the stage", () => {
    vi.stubGlobal("innerWidth", 1200);
    vi.stubGlobal("innerHeight", 800);
    const { container } = renderCommandBar();
    const toolbar = getToolbar();
    const stageFrame = container.querySelector(".control-stage-frame") as HTMLElement;
    const dragHandle = screen.getByRole("button", { name: "拖动工具栏" });

    // 未拖动时不写内联样式，停靠位置交给 CSS。
    expect(toolbar.style.position).toBe("");
    expect(toolbar.style.transform).toBe("");

    // 画布只占视口左上角一小块，工具栏要能停到画布之外。
    vi.spyOn(stageFrame, "getBoundingClientRect").mockReturnValue(
      rectFrom({ left: 100, top: 100, width: 400, height: 300 }),
    );
    vi.spyOn(toolbar, "getBoundingClientRect").mockReturnValue(
      rectFrom({ left: 150, top: 110, width: 420, height: 50 }),
    );

    fireEvent.pointerDown(dragHandle, { pointerId: 1, clientX: 170, clientY: 130 });
    fireEvent.pointerMove(dragHandle, { pointerId: 1, clientX: 700, clientY: 500 });
    fireEvent.pointerUp(dragHandle, { pointerId: 1, clientX: 700, clientY: 500 });

    // 锚点是水平中心与顶边：centerX = 700 + 190，top = 500 - 20。
    // 中心 890 已经超出画布右边界 500。
    expect(toolbar).toHaveStyle({ position: "fixed", left: "890px", top: "480px" });
    // 与样式表里的默认停靠写同一个 transform，首次拖动不会触发 transform 补间，
    // 也就不会先闪到左边再弹回指针位置。
    expect(toolbar.style.transform).toBe("translateX(-50%)");
  });

  it("clamps the parked position to the viewport", () => {
    vi.stubGlobal("innerWidth", 1200);
    vi.stubGlobal("innerHeight", 800);
    renderCommandBar();
    const toolbar = getToolbar();
    const dragHandle = screen.getByRole("button", { name: "拖动工具栏" });
    vi.spyOn(toolbar, "getBoundingClientRect").mockReturnValue(
      rectFrom({ left: 150, top: 110, width: 420, height: 50 }),
    );

    fireEvent.pointerDown(dragHandle, { pointerId: 1, clientX: 360, clientY: 130 });
    fireEvent.pointerMove(dragHandle, { pointerId: 1, clientX: 4000, clientY: 4000 });
    fireEvent.pointerUp(dragHandle, { pointerId: 1, clientX: 4000, clientY: 4000 });

    // centerX 上限 1200 - 8 - 210，top 上限 800 - 8 - 50。
    expect(toolbar).toHaveStyle({ left: "982px", top: "742px" });
  });

  it("collapses on demand and hands focus back to the arrow", () => {
    renderCommandBar();
    const collapseButton = screen.getByRole("button", { name: "收起工具栏" });

    collapseButton.focus();
    fireEvent.click(collapseButton);

    const arrow = screen.getByRole("button", { name: "展开远控工具栏" });
    expect(getToolbar()).toHaveClass("control-command-bar--collapsed");
    expect(document.activeElement).toBe(arrow);
  });
});
