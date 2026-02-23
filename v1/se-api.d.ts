// ============================================================
// Widget State Types
// ============================================================

/**
 * The "current run" portion of the widget state.
 * The index signature allows dynamic string-key access used
 * throughout the widget (e.g. obj.current[someKey] += 1).
 * All named properties must be assignable to the index type.
 */
interface CurrentState {
  [key: string]: number | boolean | undefined;
  numberOfBlesses: number;
  numberOfCurses: number;
  numberOfBlurses: number;
  numberOfBlursesThatCursed: number;
  numberOfBlursesThatBlessed: number;
  numberOfBlessesPreReset: number;
  numberOfCursesPreReset: number;
  numberOfBlursesPreReset: number;
  numberOfBlursesThatCursedPreReset: number;
  numberOfBlursesThatBlessedPreReset: number;
}

/**
 * The all-time aggregate portion of the widget state.
 * Index signature allows dynamic string-key reads/writes.
 */
interface AllTimeState {
  [key: string]: number;
  numberOfBlesses: number;
  numberOfCurses: number;
  numberOfBlurses: number;
  numberOfBlursesThatCursed: number;
  numberOfBlursesThatBlessed: number;
}

/**
 * The full widget state object persisted via SE_API.store.
 * showAll is optional because older persisted states may
 * pre-date the field being introduced.
 */
interface WidgetState {
  current: CurrentState;
  allTime: AllTimeState;
  showAll?: boolean;
  lastUpdated: Date;
}

// ============================================================
// StreamElements API Global
// ============================================================

declare const SE_API: {
  store: {
    get(key: string): Promise<WidgetState | null>;
    set(key: string, value: WidgetState): Promise<void>;
  };
  resumeQueue(): void;
};

// ============================================================
// StreamElements Event Payload Types
// ============================================================

interface SEEventData {
  redemption?: string;
  key?: string;
  value?: WidgetState;
}

interface SEEvent {
  type?: string;
  itemId?: string;
  data?: SEEventData;
}

interface SESession {
  data?: {
    "channel-points-latest"?: {
      redemption?: string;
    };
  };
}

interface FieldData {
  meterMaximum?: number;
  showChars?: boolean;
}

interface SEEventDetail {
  listener?: string;
  event?: SEEvent;
  session?: SESession;
  fieldData?: FieldData;
}

/**
 * Custom event shape emitted by StreamElements for both
 * onEventReceived and onWidgetLoad. The detail field is
 * typed as SEEventDetail which covers both event types.
 */
interface SECustomEvent extends Event {
  detail?: SEEventDetail;
}

// ============================================================
// Widget Function Types
// ============================================================

// DOM helpers — return jQuery-wrapped elements
type GetBlessMeterFillFn  = () => JQuery<HTMLElement>;
type GetCurseMeterFillFn  = () => JQuery<HTMLElement>;
type GetBlessSvgFn        = () => JQuery<HTMLElement>;
type GetCurseSvgFn        = () => JQuery<HTMLElement>;
type GetBlurseSvgFn       = () => JQuery<HTMLElement>;
type GetBlessInfoValueFn  = () => JQuery<HTMLElement>;
type GetCurseInfoValueFn  = () => JQuery<HTMLElement>;
type GetBlurseInfoValueFn = () => JQuery<HTMLElement>;

// Void state / side-effect functions
type InitializeLastWidgetStateFn        = () => void;
type ToggleShowAllStateFn               = () => void;
type IncrementStateFn                   = (toIncrement: string) => void;
type OptionallyInitializeNumericFieldFn = (obj: WidgetState, fieldName: string) => void;
type EventReceivedHandlerFn             = (event: Event) => void;
type WidgetLoadHandlerFn                = (event: Event) => void;
type HandleRedemptionFn                 = (detail: SEEventDetail) => void;
type ShowCharSvgFn                      = (type: string) => void;
type UpdateToggleButtonDisplayFn        = (showAll: boolean) => void;
type AnimateGlowForeverFn               = (ele: HTMLElement, type: string) => void;
type EndGlowForeverFn                   = (ele: HTMLElement, type: string) => void;
type UpdateDisplayFn                    = (widgetState: WidgetState | null, showAnimate: boolean) => void;
type ResetCurrentStateFn                = () => void;
type ResetAllTimeStateFn                = () => void;
type ToggleAllTimeFn                    = () => void;
type TestBlessFn                        = () => void;
type TestCurseFn                        = () => void;
type TestBlurseFn                       = () => void;

// Predicate / boolean functions
type StoreHasBeenInitializedFn = (obj: WidgetState | null) => obj is WidgetState;
type CanIncrementFn            = (obj: WidgetState | null, toIncrement: string) => boolean;
type BothMetersAreAtMaxFn      = (widgetState: WidgetState) => boolean;
type IsShowingAllFn            = (widgetState: WidgetState | null | undefined) => boolean;

// Value-returning functions
type ResetMetersButKeepCurrentStateFn = (widgetState: WidgetState) => WidgetState | undefined;
type GetRedemptionNameFn              = (detail: SEEventDetail | undefined) => string | null;
type GetOrDefaultCountFn              = (value: number | boolean | undefined) => number;
type GetCountFromStateFn              = (widgetState: WidgetState, keyName: string) => number;
type GletGlowForeverClassFn           = (type: string) => string;
type AnimateChangeFn                  = (ele: HTMLElement | undefined, currentWidth: string, targetWidth: string, durationOfAnimation: number, type: string) => void;
type MockRedeemEventFn                = (redemptionName: string) => CustomEvent<SEEventDetail>;
