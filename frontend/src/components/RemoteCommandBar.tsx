import {
  ChevronDown,
  ChevronUp,
  Eye,
  GripHorizontal,
  Keyboard,
  Send,
  LoaderCircle,
  Maximize2,
  MousePointerClick,
  PlugZap,
  Scan,
} from "lucide-react";
import { useLayoutEffect, useState } from "react";

import type { BusyAction, NextAction, RemoteStageViewMode } from "../app/remoteControlTypes.js";
import type { RemoteShortcut } from "../remote/remoteShortcuts.js";
import { RemoteAudioControl, type RemoteAudioControlProps } from "./RemoteAudioControl.js";
import { RemoteShortcutMenu } from "./RemoteShortcutMenu.js";
import { useCollapsibleToolbar } from "./useCollapsibleToolbar.js";
import { useDraggableFloatingPanel } from "./useDraggableFloatingPanel.js";
import { Dialog } from "./ui/Dialog.js";

export interface RemoteCommandBarProps {
  busy: BusyAction;
  controlChannelState: RTCDataChannelState;
  inputControlActive: boolean;
  isFullscreen: boolean;
  nextAction: NextAction;
  onNextAction: (force?: boolean) => void;
  onRemoteShortcut: (shortcut: RemoteShortcut) => void;
  onStageViewModeChange: (mode: RemoteStageViewMode) => void;
  onToggleInputControl: () => void;
  onToggleFullscreen: () => void;
  canSendText: boolean;
  onSendText: (text: string) => boolean;
  remoteAudio: RemoteAudioControlProps;
  remoteShortcutPlatform: string;
  remoteStageViewMode: RemoteStageViewMode;
}

export function RemoteCommandBar({
  busy,
  controlChannelState,
  inputControlActive,
  isFullscreen,
  nextAction,
  onNextAction,
  onRemoteShortcut,
  onStageViewModeChange,
  onToggleInputControl,
  onToggleFullscreen,
  canSendText,
  onSendText,
  remoteAudio,
  remoteShortcutPlatform,
  remoteStageViewMode,
}: RemoteCommandBarProps) {
  const nextStageMode = remoteStageViewMode === "fit" ? "fill" : "fit";
  const [textOpen, setTextOpen] = useState(false);
  const [textDraft, setTextDraft] = useState("");
  const [shortcutMenuOpen, setShortcutMenuOpen] = useState(false);
  const { clampAnchor, dragHandleProps, isDragging, panelRef, panelStyle } = useDraggableFloatingPanel<HTMLElement>();
  const connected = controlChannelState === "open";
  // 未连接时「开始连接」主操作按钮就在工具栏里，收起会让用户找不到入口，
  // 而此时画面还是占位图，本来也没有内容被遮挡。连上之后画面铺满，才按空闲计时收起。
  const { collapse, collapsed, expand, sectionProps } = useCollapsibleToolbar({
    holdOpen: !connected || isDragging || shortcutMenuOpen || textOpen,
    panelRef,
  });

  // 折叠与展开会改变工具栏宽度，绘制前按新尺寸把锚点收回视口，避免出现一帧越界画面。
  useLayoutEffect(() => {
    clampAnchor();
  }, [clampAnchor, collapsed]);

  return (
    <section
      ref={panelRef}
      className={`control-command-bar${collapsed ? " control-command-bar--collapsed" : ""}`}
      style={panelStyle}
      aria-label="远控主流程"
      {...sectionProps}
    >
      {/* 折叠态与展开态复用同一个按钮节点，键盘用户 Tab 进来时展开不会丢焦点。 */}
      <button
        className={collapsed ? "command-dock-tab" : "command-drag-handle"}
        type="button"
        aria-label={collapsed ? "展开远控工具栏" : "拖动工具栏"}
        aria-expanded={collapsed ? false : undefined}
        onClick={collapsed ? expand : undefined}
        {...dragHandleProps}
      >
        {collapsed ? <ChevronDown size={15} /> : <GripHorizontal size={17} />}
      </button>
      {collapsed ? null : (
        <>
          <div className="command-action-group command-action-primary">
            {connected ? (
              <div className="control-mode-switch" role="group" aria-label="控制模式">
                <button
                  type="button"
                  className={!inputControlActive ? "is-active" : ""}
                  aria-pressed={!inputControlActive}
                  onClick={() => {
                    if (inputControlActive) onToggleInputControl();
                  }}
                >
                  <Eye size={16} />
                  仅查看
                </button>
                <button
                  type="button"
                  className={inputControlActive ? "is-active" : ""}
                  aria-pressed={inputControlActive}
                  onClick={() => {
                    if (!inputControlActive) onToggleInputControl();
                  }}
                >
                  <MousePointerClick size={16} />
                  控制中
                </button>
              </div>
            ) : (
              <button className="primary-action-button" onClick={() => onNextAction()} disabled={nextAction.disabled}>
                {busy ? <LoaderCircle className="spin" size={17} /> : <PlugZap size={17} />}
                {nextAction.label}
              </button>
            )}
          </div>
          {!connected && nextAction.detail ? <p className="operation-note">{nextAction.detail}</p> : null}
          <div className="command-action-group command-action-tools" aria-label="远控工具栏">
            <RemoteAudioControl {...remoteAudio} />
            <button
              type="button"
              title="输入文字"
              aria-label="输入文字"
              disabled={!canSendText}
              onClick={() => setTextOpen(true)}
            >
              <Keyboard size={17} />
            </button>
            <button onClick={() => onStageViewModeChange(nextStageMode)}>
              <Scan size={17} />
              {remoteStageViewMode === "fit" ? "填充画面" : "适应画面"}
            </button>
            <button onClick={onToggleFullscreen}>
              <Maximize2 size={17} />
              {isFullscreen ? "退出全屏" : "全屏"}
            </button>
            <RemoteShortcutMenu
              disabled={!inputControlActive}
              platformKey={remoteShortcutPlatform}
              onOpenChange={setShortcutMenuOpen}
              onRemoteShortcut={onRemoteShortcut}
            />
          </div>
          <button
            className="command-collapse-button"
            type="button"
            aria-label="收起工具栏"
            aria-expanded
            onClick={collapse}
          >
            <ChevronUp size={17} />
          </button>
          <Dialog open={textOpen} onClose={() => setTextOpen(false)} ariaLabel="输入文字">
            <label className="remote-text-input">
              <span>输入文字</span>
              <textarea rows={5} value={textDraft} onChange={(event) => setTextDraft(event.target.value)} />
            </label>
            <div className="remote-text-actions">
              <button type="button" onClick={() => setTextOpen(false)}>
                取消
              </button>
              <button
                type="button"
                disabled={!canSendText || !textDraft}
                onClick={() => {
                  if (onSendText(textDraft)) {
                    setTextDraft("");
                    setTextOpen(false);
                  }
                }}
              >
                <Send size={16} />
                发送
              </button>
            </div>
          </Dialog>
        </>
      )}
    </section>
  );
}
