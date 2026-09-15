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
 * Per-user redemption counts, tracked for the lifetime of the run.
 */
interface RedemptionHistoryEntry {
  numberOfBlesses: number;
  numberOfCurses: number;
  numberOfBlurses: number;
  numberOfBlursesThatBlessed: number;
  numberOfBlursesThatCursed: number;
}

/**
 * Maps a redeeming user's name to their {@link RedemptionHistoryEntry}.
 */
interface RedemptionHistory {
  [userName: string]: RedemptionHistoryEntry;
}

interface LastRedemption {
  redeemingUser: string,
  charType: string,
  meterTarget: string,
  meterAmount: number,
  /**
   * Identifies this redemption for announcement de-duplication. A fresh id means
   * the redemption has not been announced yet; reusing a prior id (or null)
   * marks it as already announced. Optional because states persisted before
   * announcement ids were introduced do not carry one.
   */
  id?: string | null,
}

/**
 * The full widget state object persisted via SE_API.store.
 * showAll and redemptionHistory are optional because older persisted
 * states may pre-date those fields being introduced.
 */
interface WidgetState {
  current: CurrentState;
  allTime: AllTimeState;
  showAll?: boolean;
  /**
   * Which background styling the widget renders: "ffvi" (default) or "ct".
   * Optional because states persisted before the theme toggle existed do not
   * carry one; those fall back to "ffvi".
   */
  backgroundTheme?: string;
  lastUpdated: Date;
  redemptionHistory?: RedemptionHistory;
  lastRedemption?: LastRedemption;
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

interface ChatEmote {
  name?: string;
}

interface ChatMessageData {
  text?: string;
  displayName?: string;
  nick?: string;
  userId?: string;
  emotes?: ChatEmote[];
}

interface SEEventData extends ChatMessageData {
  redemption?: string;
  key?: string;
  value?: WidgetState;
}

interface SEEvent {
  type?: string;
  itemId?: string;
  data?: SEEventData;
  name?: string;
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
  showRedemptionAnnouncements?: boolean;
  numberOfSecondsBetweenReports?: number;
  reportsShouldDisplay?: boolean;
  emoteBlessEnabled?: boolean;
  emoteBlessEmoteNamesCsv?: string;
  emoteBlessWindowSeconds?: number;
  emoteBlessRequiredMatches?: number;
}

interface IncrementStateOptions {
  /**
   * When false, the increment does not stamp a new {@link LastRedemption} id,
   * so no redemption announcement is played for it. Used by flows that render
   * their own announcement (e.g. the emote-triggered bless).
   */
  recordRedemption?: boolean;
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
type JQueryGetterFn  = () => JQuery<HTMLElement>;

// Void state / side-effect functions
type NoArgVoidFunction                  = () => void;
type IncrementStateFn                   = (toIncrement: string, name?: string | null, options?: IncrementStateOptions) => void;
type OptionallyInitializeNumericFieldFn = (obj: WidgetState, fieldName: string) => void;
type EventHandlerFn                     = (event: Event) => void;
type HandleRedemptionFn                 = (detail: SEEventDetail) => void;
type ShowCharSvgFn                      = (type: string) => Promise<void>;
type UpdateToggleButtonDisplayFn        = (showAll: boolean) => void;
type GlowFn                             = (ele: HTMLElement, type: string) => void;
type UpdateDisplayFn                    = (widgetState: WidgetState | null, showAnimate: boolean, announceRedemption?: boolean) => void;

// Predicate / boolean functions
type StoreHasBeenInitializedFn = (obj: WidgetState | null) => obj is WidgetState;
type CanIncrementFn            = (obj: WidgetState | null, toIncrement: string) => boolean;
type BothMetersAreAtMaxFn      = (widgetState: WidgetState) => boolean;
type IsShowingAllFn            = (widgetState: WidgetState | null | undefined) => boolean;

// Background theme
type NormalizeBackgroundThemeFn           = (value: unknown) => string;
type GetBackgroundThemeFn                 = (widgetState: WidgetState | null | undefined) => string;
type ApplyBackgroundThemeFn               = (theme: string) => void;
type UpdateBackgroundThemeButtonDisplayFn = (theme: string) => void;

// Value-returning functions
type ResetMetersButKeepCurrentStateFn = (widgetState: WidgetState) => WidgetState | undefined;
type GetRedemptionNameFn              = (detail: SEEventDetail | undefined) => string | null;
type GetOrDefaultCountFn              = (value: number | boolean | undefined) => number;
type GetCountFromStateFn              = (widgetState: WidgetState, keyName: string) => number;
type GletGlowForeverClassFn           = (type: string) => string;
type AnimateChangeFn                  = (ele: HTMLElement | undefined, currentWidth: string, targetWidth: string, durationOfAnimation: number, type: string) => () => Promise<void>;
type MockRedeemEventFn                = (redemptionName: string) => CustomEvent<SEEventDetail>;
