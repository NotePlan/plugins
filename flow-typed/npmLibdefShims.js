// react-dom's libdef still names this old global.
// Flow 0.286 does not declare it (use React.Component in application code).

declare class React$Component<Props, State = any> {}

// Flow 0.286's bundled react lib no longer declares the Synthetic* event classes.
// These match the flow-typed jsx environment (v0.261+), without redeclaring $JSXIntrinsics.

type ModifierKey =
  | 'Alt'
  | 'AltGraph'
  | 'CapsLock'
  | 'Control'
  | 'Fn'
  | 'FnLock'
  | 'Hyper'
  | 'Meta'
  | 'NumLock'
  | 'ScrollLock'
  | 'Shift'
  | 'Super'
  | 'Symbol'
  | 'SymbolLock'

declare class SyntheticEvent<+T: EventTarget = EventTarget, +E: Event = Event> {
  bubbles: boolean,
  cancelable: boolean,
  +currentTarget: T,
  defaultPrevented: boolean,
  eventPhase: number,
  isDefaultPrevented(): boolean,
  isPropagationStopped(): boolean,
  isTrusted: boolean,
  +nativeEvent: E,
  persist(): void,
  preventDefault(): void,
  stopPropagation(): void,
  // This should not be `T`. Use `currentTarget` instead.
  +target: EventTarget,
  timeStamp: number,
  type: string,
}

declare class SyntheticAnimationEvent<+T: EventTarget = EventTarget> extends SyntheticEvent<T> {
  animationName: string,
  elapsedTime: number,
  pseudoElement: string,
}

declare class SyntheticClipboardEvent<+T: EventTarget = EventTarget> extends SyntheticEvent<T> {
  clipboardData: any,
}

declare class SyntheticCompositionEvent<+T: EventTarget = EventTarget> extends SyntheticEvent<T> {
  data: any,
}

declare class SyntheticInputEvent<+T: EventTarget = EventTarget> extends SyntheticEvent<T> {
  data: any,
  +target: HTMLInputElement,
}

declare class SyntheticUIEvent<+T: EventTarget = EventTarget, +E: Event = Event> extends SyntheticEvent<T, E> {
  detail: number,
  view: any,
}

declare class SyntheticFocusEvent<+T: EventTarget = EventTarget> extends SyntheticUIEvent<T> {
  relatedTarget: EventTarget,
}

declare class SyntheticKeyboardEvent<+T: EventTarget = EventTarget> extends SyntheticUIEvent<T, KeyboardEvent> {
  altKey: boolean,
  charCode: number,
  ctrlKey: boolean,
  getModifierState(key: ModifierKey): boolean,
  key: string,
  keyCode: number,
  locale: string,
  location: number,
  metaKey: boolean,
  repeat: boolean,
  shiftKey: boolean,
  which: number,
}

declare class SyntheticMouseEvent<+T: EventTarget = EventTarget, +E: Event = MouseEvent> extends SyntheticUIEvent<T, E> {
  altKey: boolean,
  button: number,
  buttons: number,
  clientX: number,
  clientY: number,
  ctrlKey: boolean,
  getModifierState(key: ModifierKey): boolean,
  metaKey: boolean,
  pageX: number,
  pageY: number,
  relatedTarget: EventTarget,
  screenX: number,
  screenY: number,
  shiftKey: boolean,
}

declare class SyntheticDragEvent<+T: EventTarget = EventTarget> extends SyntheticMouseEvent<T, DragEvent> {
  dataTransfer: any,
}

declare class SyntheticWheelEvent<+T: EventTarget = EventTarget> extends SyntheticMouseEvent<T, WheelEvent> {
  deltaMode: number,
  deltaX: number,
  deltaY: number,
  deltaZ: number,
}

declare class SyntheticPointerEvent<+T: EventTarget = EventTarget> extends SyntheticMouseEvent<T, PointerEvent> {
  height: number,
  isPrimary: boolean,
  pointerId: number,
  pointerType: string,
  pressure: number,
  tangentialPressure: number,
  tiltX: number,
  tiltY: number,
  twist: number,
  width: number,
}

declare class SyntheticTouchEvent<+T: EventTarget = EventTarget> extends SyntheticUIEvent<T, TouchEvent> {
  altKey: boolean,
  changedTouches: TouchList,
  ctrlKey: boolean,
  getModifierState(key: ModifierKey): boolean,
  metaKey: boolean,
  shiftKey: boolean,
  targetTouches: TouchList,
  touches: TouchList,
}

declare class SyntheticTransitionEvent<+T: EventTarget = EventTarget> extends SyntheticEvent<T> {
  elapsedTime: number,
  propertyName: string,
  pseudoElement: string,
}
