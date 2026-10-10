/**
 * Tests for the curse meter widget.
 *
 * Strategy: JSDOM loads widget/widget.html, real jQuery is injected, SE_API is
 * mocked, then the compiled widget/widget.js is eval'd into the window.  Because
 * widget functions are top-level `function` declarations (not const/let), they
 * become properties of the window object and are accessible as
 * dom.window.functionName().
 *
 * Build note: widget.js must be compiled before running tests.
 * Run `npm run build` first, or use `npm run test:all` (build + test).
 */

// Explicitly reference the ambient type declarations so VS Code resolves them
// regardless of which tsconfig it uses for this file in the IDE.
/// <reference path="./se-api.d.ts" />

import { JSDOM } from "jsdom";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// File paths
// ---------------------------------------------------------------------------
const WIDGET_HTML_PATH = path.resolve(__dirname, "widget.html");
const WIDGET_JS_PATH = path.resolve(__dirname, "widget.js");
const JQUERY_PATH = path.resolve(__dirname, "..", "node_modules", "jquery", "dist", "jquery.js");

declare global {
  // interface Window {
  //   profitwell(action: "start", { ["user_email"]: string })
  // }
}

// export {}

declare global {
  interface Window {
    // DOM helpers
    getBlessMeterFill: JQueryGetterFn;
    getCurseMeterFill: JQueryGetterFn;
    getBlessSvg: JQueryGetterFn;
    getCurseSvg: JQueryGetterFn;
    getBlurseSvg: JQueryGetterFn;
    getBlessInfoValue: JQueryGetterFn;
    getCurseInfoValue: JQueryGetterFn;
    getBlurseInfoValue: JQueryGetterFn;
    getBlessMeterTitle: JQueryGetterFn;
    getCurseMeterTitle: JQueryGetterFn;
    isCt: () => boolean;
    // State management
    initializeLastWidgetState: NoArgVoidFunction;
    toggleShowAllState: NoArgVoidFunction;
    incrementState: IncrementStateFn;
    optionallyInitializeNumericField: OptionallyInitializeNumericFieldFn;
    resetCurrentState: NoArgVoidFunction;
    resetAllTimeState: NoArgVoidFunction;
    resetMetersButKeepCurrentState: ResetMetersButKeepCurrentStateFn;
    // Event handlers
    eventReceivedHandler: EventHandlerFn;
    widgetLoadHandler: EventHandlerFn;
    handleRedemption: HandleRedemptionFn;
    // Display
    updateDisplay: UpdateDisplayFn;
    updateToggleButtonDisplay: UpdateToggleButtonDisplayFn;
    showCharSvg: ShowCharSvgFn;
    animateChange: AnimateChangeFn;
    parseCssWidthAsPercent: (width: string, element: HTMLElement) => number | null;
    animateGlowForever: GlowFn;
    endGlowForever: GlowFn;
    toggleAllTime: NoArgVoidFunction;
    // Background theme
    normalizeBackgroundTheme: NormalizeBackgroundThemeFn;
    getBackgroundTheme: GetBackgroundThemeFn;
    applyBackgroundTheme: ApplyBackgroundThemeFn;
    updateBackgroundThemeButtonDisplay: UpdateBackgroundThemeButtonDisplayFn;
    toggleBackgroundThemeState: NoArgVoidFunction;
    toggleBackgroundTheme: NoArgVoidFunction;
    // Predicates
    storeHasBeenInitialized: StoreHasBeenInitializedFn;
    canIncrement: CanIncrementFn;
    bothMetersAreAtMax: BothMetersAreAtMaxFn;
    isShowingAll: IsShowingAllFn;
    // Pure value functions
    getRedemptionName: GetRedemptionNameFn;
    getRedeemingUserName: (detail: SEEventDetail | undefined) => string | null;
    getRedemptionUserIdentity: (detail: SEEventDetail | undefined) => RedemptionUserRef | null;
    pickNonEmptyString: (...candidates: (string | undefined)[]) => string | null;
    getRedemptionHistoryDisplayName: (entry: RedemptionHistoryEntry, trackingKey: string) => string;
    getOrDefaultCount: GetOrDefaultCountFn;
    getCountFromState: GetCountFromStateFn;
    gletGlowForeverClass: GletGlowForeverClassFn;
    mockRedeemEvent: MockRedeemEventFn;
    // Redemption announcement
    hasValidLastRedemption: (lastRedemption: unknown) => boolean;
    formatRedemptionTypeLabel: (charType: string) => string;
    formatRedemptionImpactLabel: (meterTarget: string, meterAmount: number) => string;
    getTypeColorClass: (charType: string) => string;
    getMeterTargetColorClass: (meterTarget: string) => string;
    buildRedemptionAnnouncementSegments: (redemption: LastRedemption) => { text: string; colorClass?: string }[];
    typewriterSegments: (
      element: HTMLElement,
      segments: { text: string; colorClass?: string }[],
      letterDelayMs: number
    ) => Promise<void>;
    liftAnnouncementText: (element: HTMLElement, options?: { pinToTop?: boolean }) => void;
    animateRedemptionAnnouncement: (redemption: LastRedemption) => Promise<void>;
    animateOverlayTypewriter: (segments: { text: string; colorClass?: string }[]) => Promise<void>;
    createEmptyRedemptionHistoryEntry: () => RedemptionHistoryEntry;
    normalizeRedemptionHistoryEntry: (entry: RedemptionHistoryEntry) => RedemptionHistoryEntry;
    getTopRedeemers: (
      history: RedemptionHistory | undefined,
      category: "bless" | "curse" | "blurse",
      limit?: number
    ) => { userName: string; count: number }[];
    buildReportHeadlineSegments: (text: string) => { text: string; colorClass?: string }[];
    buildTopRedeemersTitleSegments: (title: string) => { text: string; colorClass?: string }[];
    buildTopRedeemersListSegments: (
      redeemers: { userName: string; count: number }[]
    ) => { text: string; colorClass?: string }[];
    buildTopRedeemersReportSegments: (
      title: string,
      redeemers: { userName: string; count: number }[]
    ) => { text: string; colorClass?: string }[];
    applyFieldData: (fieldData: FieldData) => void;
    getRedemptionAnnouncementId: (widgetState: WidgetState | null | undefined) => string | null;
    parseEmoteNamesCsv: (csv: string) => string[];
    findMatchingTrackedEmotesInChat: (message: ChatMessageData, trackedLower: Set<string>) => string[];
    handleChatMessage: (detail: SEEventDetail) => void;
    buildEmoteBlessAnnouncementSegments: (
      distinctDisplayNames: string[],
      matchCount: number
    ) => { text: string; colorClass?: string }[];
    formatEmoteBlessHeadline: (configuredText: string) => string;
    configurePeriodicReports: () => void;
    stopPeriodicReports: () => void;
    enqueuePeriodicReportCycle: (force?: boolean) => void;
    // Test helpers
    testBless: NoArgVoidFunction;
    testCurse: NoArgVoidFunction;
    testBlurse: NoArgVoidFunction;
  }
}

// ---------------------------------------------------------------------------
// Mock SE_API factory
// ---------------------------------------------------------------------------
interface MockSEAPI {
  store: {
    get: jest.Mock;
    set: jest.Mock;
    /** Direct access to the in-memory backing store for test assertions */
    _data: Record<string, WidgetState | null>;
  };
  resumeQueue: jest.Mock;
}

function createMockSEAPI(initialState?: WidgetState): MockSEAPI {
  const _data: Record<string, WidgetState | null> = {};
  if (initialState) {
    _data["blessCurseMeterState"] = initialState;
  }
  return {
    store: {
      _data,
      get: jest.fn((key: string) => Promise.resolve(_data[key] ?? null)),
      set: jest.fn((key: string, value: WidgetState) => {
        _data[key] = value;
        return Promise.resolve();
      }),
    },
    resumeQueue: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// JSDOM setup helper
// ---------------------------------------------------------------------------
interface TestEnv {
  dom: JSDOM;
  mockSEAPI: MockSEAPI;
  /** Convenience shortcut: dom.window cast to any for calling widget globals */
  w: Window;
}

function setupTestDOM(initialState?: WidgetState): TestEnv {
  const mockSEAPI = createMockSEAPI(initialState);

  const htmlContent = fs.readFileSync(WIDGET_HTML_PATH, "utf-8");
  const jqueryContent = fs.readFileSync(JQUERY_PATH, "utf-8");
  const widgetContent = fs.readFileSync(WIDGET_JS_PATH, "utf-8");

  const dom = new JSDOM(htmlContent, { runScripts: "dangerously" });

  // JSDOM does not implement the Web Animations API (WAAPI); mock it so
  // animateChange() does not throw when calling ele.animate().
  // Returns { finished: Promise.resolve() } so the animation queue drains correctly.
  (dom.window.Element.prototype as any).animate = jest.fn().mockReturnValue({
    finished: Promise.resolve(),
  });

  // SE_API must be on window BEFORE the widget script runs because
  // initializeLastWidgetState() is called immediately at module scope.
  (dom.window as any).SE_API = mockSEAPI;

  // Inject jQuery via a <script> element.  Using window.eval() with a
  // "use strict" script scopes declarations to the eval call; injecting via
  // <script> ensures top-level var/function declarations land on window.
  const jqueryScript = dom.window.document.createElement("script");
  jqueryScript.textContent = jqueryContent;
  dom.window.document.head.appendChild(jqueryScript);

  // Inject the compiled widget script the same way.
  const widgetScript = dom.window.document.createElement("script");
  widgetScript.textContent = widgetContent;
  dom.window.document.head.appendChild(widgetScript);

  const env: TestEnv = { dom, mockSEAPI, w: dom.window as any as Window };
  openTestEnvs.push(env);
  return env;
}

/** JSDOMs whose report intervals must be cleared so Jest can exit cleanly. */
const openTestEnvs: TestEnv[] = [];

afterEach(() => {
  for (const env of openTestEnvs) {
    env.w.stopPeriodicReports();
    env.dom.window.close();
  }
  openTestEnvs.length = 0;
});

/** Flush the microtask queue so Promise .then() callbacks have run. */
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Use instead of flushPromises while fake timers are active. */
const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

// ---------------------------------------------------------------------------
// Shared initial state fixture
// ---------------------------------------------------------------------------
function makeRedemptionHistoryEntry(overrides?: Partial<RedemptionHistoryEntry>): RedemptionHistoryEntry {
  return {
    numberOfBlesses: 0,
    numberOfCurses: 0,
    numberOfBlurses: 0,
    numberOfBlursesThatBlessed: 0,
    numberOfBlursesThatCursed: 0,
    ...overrides,
  };
}

/** Live Twitch channel-points payload shape (`listener: "event"`). */
function makeExampleTwitchChannelPointsRedemptionDetail(
  overrides?: Partial<SEEventDetail> & { redemption?: string }
): SEEventDetail {
  const redemption = overrides?.redemption ?? "Bless the Run";
  const { redemption: _ignored, ...detailOverrides } = overrides ?? {};
  return {
    listener: "event",
    event: {
      type: "channelPointsRedemption",
      provider: "twitch",
      channel: "testChannelId",
      flagged: false,
      createdAt: "2026-10-01T00:12:01.123Z",
      data: {
        amount: 500,
        username: "exampleUserName",
        displayName: "ExampleUserNameDisplay",
        providerId: "123456789",
        redemption,
        quantity: 0,
        avatar: "exampleUrlHereToAPng",
      },
      _id: "24CharId",
      expiresAt: "dateTime",
      updatedAt: "dateTime",
      activityId: "24CharId",
      sessionEventsCount: 1,
    },
    ...detailOverrides,
  };
}

function makeLastRedemption(overrides?: Partial<LastRedemption>): LastRedemption {
  return {
    redeemingUser: "testUserName",
    charType: "bless",
    meterTarget: "bless",
    meterAmount: 1,
    ...overrides,
  };
}

function makeState(overrides?: Partial<WidgetState>): WidgetState {
  return {
    current: {
      numberOfBlesses: 0,
      numberOfCurses: 0,
      numberOfBlurses: 0,
      numberOfBlursesThatCursed: 0,
      numberOfBlursesThatBlessed: 0,
      numberOfBlessesPreReset: 0,
      numberOfCursesPreReset: 0,
      numberOfBlursesPreReset: 0,
      numberOfBlursesThatCursedPreReset: 0,
      numberOfBlursesThatBlessedPreReset: 0,
    },
    allTime: {
      numberOfBlesses: 0,
      numberOfCurses: 0,
      numberOfBlurses: 0,
      numberOfBlursesThatCursed: 0,
      numberOfBlursesThatBlessed: 0,
    },
    showAll: false,
    lastUpdated: new Date(),
    ...overrides,
  };
}

// ===========================================================================
// storeHasBeenInitialized
// ===========================================================================
describe("storeHasBeenInitialized", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("returns false for null", () => {
    expect(w.storeHasBeenInitialized(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(w.storeHasBeenInitialized(undefined as any as WidgetState)).toBe(false);
  });

  it("returns false when current is missing", () => {
    expect(w.storeHasBeenInitialized({ allTime: {} } as any as WidgetState)).toBe(false);
  });

  it("returns false when allTime is missing", () => {
    expect(w.storeHasBeenInitialized({ current: {} } as any as WidgetState)).toBe(false);
  });

  it("returns true when both current and allTime are present", () => {
    expect(w.storeHasBeenInitialized({ current: {}, allTime: {} } as any as WidgetState)).toBe(true);
  });

  it("returns true for a full widget state", () => {
    expect(w.storeHasBeenInitialized(makeState())).toBe(true);
  });
});

// ===========================================================================
// canIncrement
// ===========================================================================
describe("canIncrement", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("returns false for null state", () => {
    expect(w.canIncrement(null, "numberOfBlesses")).toBe(false);
  });

  it("returns false when key is missing from current", () => {
    const state = makeState();
    expect(w.canIncrement(state, "nonExistentKey")).toBe(false);
  });

  it("returns true when key exists in both current and allTime", () => {
    const state = makeState();
    expect(w.canIncrement(state, "numberOfBlesses")).toBe(true);
  });

  it("returns true for all standard keys", () => {
    const state = makeState();
    const keys = [
      "numberOfBlesses",
      "numberOfCurses",
      "numberOfBlurses",
      "numberOfBlursesThatCursed",
      "numberOfBlursesThatBlessed",
    ];
    for (const key of keys) {
      expect(w.canIncrement(state, key)).toBe(true);
    }
  });
});

// ===========================================================================
// getOrDefaultCount
// ===========================================================================
describe("getOrDefaultCount", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("returns 0 for undefined", () => {
    expect(w.getOrDefaultCount(undefined)).toBe(0);
  });

  it("returns 0 for NaN", () => {
    expect(w.getOrDefaultCount(NaN)).toBe(0);
  });

  it("returns 0 for negative numbers", () => {
    expect(w.getOrDefaultCount(-5)).toBe(0);
    expect(w.getOrDefaultCount(-1)).toBe(0);
  });

  it("returns 0 for 0", () => {
    expect(w.getOrDefaultCount(0)).toBe(0);
  });

  it("returns the value for positive numbers", () => {
    expect(w.getOrDefaultCount(3)).toBe(3);
    expect(w.getOrDefaultCount(100)).toBe(100);
  });
});

// ===========================================================================
// isShowingAll
// ===========================================================================
describe("isShowingAll", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("returns false for null", () => {
    expect(w.isShowingAll(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(w.isShowingAll(undefined)).toBe(false);
  });

  it("returns false when showAll is false", () => {
    expect(w.isShowingAll(makeState({ showAll: false }))).toBe(false);
  });

  it("returns false when showAll is undefined", () => {
    const state = makeState();
    delete (state as any).showAll;
    expect(w.isShowingAll(state)).toBe(false);
  });

  it("returns true when showAll is true", () => {
    expect(w.isShowingAll(makeState({ showAll: true }))).toBe(true);
  });
});

// ===========================================================================
// gletGlowForeverClass
// ===========================================================================
describe("gletGlowForeverClass", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("returns bless glow class for 'bless' type", () => {
    expect(w.gletGlowForeverClass("bless")).toBe("animated-glow");
  });

  it("returns curse glow class for 'curse' type", () => {
    expect(w.gletGlowForeverClass("curse")).toBe("animated-curse-glow");
  });

  it("returns curse glow class for any other type (blurse, etc.)", () => {
    expect(w.gletGlowForeverClass("blurse")).toBe("animated-curse-glow");
    expect(w.gletGlowForeverClass("unknown")).toBe("animated-curse-glow");
  });
});

// ===========================================================================
// getRedemptionName
// ===========================================================================
describe("getRedemptionName", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("returns null for undefined detail", () => {
    expect(w.getRedemptionName(undefined)).toBeNull();
  });

  it("returns null for empty detail", () => {
    expect(w.getRedemptionName({})).toBeNull();
  });

  it("reads redemption from event.data.redemption (primary Twitch path)", () => {
    const detail: SEEventDetail = {
      event: { data: { redemption: "Bless the Run" } },
    };
    expect(w.getRedemptionName(detail)).toBe("Bless the Run");
  });

  it("reads redemption from session channel-points-latest (SE docs path)", () => {
    const detail: SEEventDetail = {
      session: {
        data: {
          "channel-points-latest": { redemption: "Curse the Run" },
        },
      },
    };
    expect(w.getRedemptionName(detail)).toBe("Curse the Run");
  });

  it("reads redemption from event.itemId (SE emulator path)", () => {
    const detail: SEEventDetail = {
      event: { itemId: "Blurse the Run" },
    };
    expect(w.getRedemptionName(detail)).toBe("Blurse the Run");
  });

  it("prefers event.data.redemption over itemId", () => {
    const detail: SEEventDetail = {
      event: {
        data: { redemption: "Bless the Run" },
        itemId: "Curse the Run",
      },
    };
    expect(w.getRedemptionName(detail)).toBe("Bless the Run");
  });
});

// ===========================================================================
// getRedemptionUserIdentity / getRedeemingUserName
// ===========================================================================
describe("getRedemptionUserIdentity", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("resolves username and displayName from a live Twitch channel-points detail", () => {
    const detail = makeExampleTwitchChannelPointsRedemptionDetail();
    expect(w.getRedemptionUserIdentity(detail)).toEqual({
      trackingKey: "exampleUserName",
      displayName: "ExampleUserNameDisplay",
    });
  });

  it("uses username as the tracking key when displayName differs from login", () => {
    const detail: SEEventDetail = {
      event: {
        type: "channelPointsRedemption",
        data: { username: "twitchlogin", displayName: "TwitchDisplay" },
      },
    };
    expect(w.getRedemptionUserIdentity(detail)).toEqual({
      trackingKey: "twitchlogin",
      displayName: "TwitchDisplay",
    });
  });

  it("falls back to event.name for SE emulator and -latest events", () => {
    const detail: SEEventDetail = {
      event: { name: "testUserName", data: { redemption: "Bless the Run" } },
    };
    expect(w.getRedemptionUserIdentity(detail)).toEqual({
      trackingKey: "testUserName",
      displayName: "testUserName",
    });
  });
});

describe("getRedeemingUserName", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("returns null for undefined detail", () => {
    expect(w.getRedeemingUserName(undefined)).toBeNull();
  });

  it("returns displayName from event.data when both username and displayName are set", () => {
    const detail = makeExampleTwitchChannelPointsRedemptionDetail();
    expect(w.getRedeemingUserName(detail)).toBe("ExampleUserNameDisplay");
  });

  it("reads username from event.data when displayName is absent", () => {
    const detail: SEEventDetail = {
      event: { data: { username: "viewer42" } },
    };
    expect(w.getRedeemingUserName(detail)).toBe("viewer42");
  });

  it("reads name from session channel-points-latest", () => {
    const detail: SEEventDetail = {
      session: { data: { "channel-points-latest": { name: "sessionUser" } } },
      event: { data: { redemption: "Bless the Run" } },
    };
    expect(w.getRedeemingUserName(detail)).toBe("sessionUser");
  });

  it("falls back to event.name for SE emulator and -latest events", () => {
    const detail: SEEventDetail = {
      event: { name: "testUserName", data: { redemption: "Bless the Run" } },
    };
    expect(w.getRedeemingUserName(detail)).toBe("testUserName");
  });

  it("prefers event.data displayName over event.name", () => {
    const detail: SEEventDetail = {
      event: {
        name: "legacyName",
        data: { displayName: "TwitchDisplay", username: "twitchlogin" },
      },
    };
    expect(w.getRedeemingUserName(detail)).toBe("TwitchDisplay");
  });
});

// ===========================================================================
// bothMetersAreAtMax
// ===========================================================================
describe("bothMetersAreAtMax", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("returns false when both meters are empty", () => {
    expect(w.bothMetersAreAtMax(makeState())).toBe(false);
  });

  it("returns false when only bless is at max (15)", () => {
    const state = makeState();
    state.current.numberOfBlesses = 15;
    state.allTime.numberOfBlesses = 15;
    expect(w.bothMetersAreAtMax(state)).toBe(false);
  });

  it("returns false when only curse is at max (15)", () => {
    const state = makeState();
    state.current.numberOfCurses = 15;
    state.allTime.numberOfCurses = 15;
    expect(w.bothMetersAreAtMax(state)).toBe(false);
  });

  it("returns true when both meters reach max (15)", () => {
    const state = makeState();
    state.current.numberOfBlesses = 15;
    state.current.numberOfCurses = 15;
    state.allTime.numberOfBlesses = 15;
    state.allTime.numberOfCurses = 15;
    expect(w.bothMetersAreAtMax(state)).toBe(true);
  });

  it("counts blurse-that-blessed as 2x toward bless meter", () => {
    const state = makeState();
    // 7 blesses + 4 blurse-that-blessed * 2 = 15 effective blesses
    state.current.numberOfBlesses = 7;
    state.current.numberOfBlursesThatBlessed = 4;
    state.current.numberOfCurses = 15;
    state.allTime.numberOfBlesses = 7;
    state.allTime.numberOfBlursesThatBlessed = 4;
    state.allTime.numberOfCurses = 15;
    expect(w.bothMetersAreAtMax(state)).toBe(true);
  });

  it("does not reach max if effective bless is just below max", () => {
    const state = makeState();
    state.current.numberOfBlesses = 14;
    state.current.numberOfCurses = 15;
    expect(w.bothMetersAreAtMax(state)).toBe(false);
  });
});

// ===========================================================================
// resetMetersButKeepCurrentState
// ===========================================================================
describe("resetMetersButKeepCurrentState", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("returns undefined for null input", () => {
    expect(w.resetMetersButKeepCurrentState(null as any as WidgetState)).toBeUndefined();
  });

  it("returns undefined when state has no current", () => {
    expect(w.resetMetersButKeepCurrentState({ allTime: {}, showAll: false } as any as WidgetState)).toBeUndefined();
  });

  it("resets current counters to 0", () => {
    const state = makeState();
    state.current.numberOfBlesses = 5;
    state.current.numberOfCurses = 3;
    const result = w.resetMetersButKeepCurrentState(state);
    expect(result).toBeDefined();
    expect(result!.current.numberOfBlesses).toBe(0);
    expect(result!.current.numberOfCurses).toBe(0);
    expect(result!.current.numberOfBlurses).toBe(0);
  });

  it("accumulates previous counts into preReset fields", () => {
    const state = makeState();
    state.current.numberOfBlesses = 8;
    state.current.numberOfCurses = 6;
    state.current.numberOfBlessesPreReset = 3;
    state.current.numberOfCursesPreReset = 2;
    const result = w.resetMetersButKeepCurrentState(state);
    expect(result).toBeDefined();
    expect(result!.current.numberOfBlessesPreReset).toBe(3 + 8); // 11
    expect(result!.current.numberOfCursesPreReset).toBe(2 + 6); // 8
  });

  it("preserves allTime and showAll from the original state", () => {
    const state = makeState({ showAll: true });
    state.allTime.numberOfBlesses = 42;
    const result = w.resetMetersButKeepCurrentState(state);
    expect(result).toBeDefined();
    expect(result!.allTime.numberOfBlesses).toBe(42);
    expect(result!.showAll).toBe(true);
  });

  it("accumulates blurse preReset counts correctly", () => {
    const state = makeState();
    state.current.numberOfBlursesThatBlessed = 4;
    state.current.numberOfBlursesThatCursed = 2;
    state.current.numberOfBlursesThatBlessedPreReset = 1;
    state.current.numberOfBlursesThatCursedPreReset = 0;
    const result = w.resetMetersButKeepCurrentState(state);
    expect(result).toBeDefined();
    expect(result!.current.numberOfBlursesThatBlessedPreReset).toBe(1 + 4); // 5
    expect(result!.current.numberOfBlursesThatCursedPreReset).toBe(0 + 2); // 2
  });
});

// ===========================================================================
// updateToggleButtonDisplay
// ===========================================================================
describe("updateToggleButtonDisplay", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("sets button text to 'Show run' when showAll is true", () => {
    w.updateToggleButtonDisplay(true);
    const btn = w.document.getElementById("all-time-toggle");
    expect(btn).not.toBeNull();
    expect(btn!.textContent?.trim()).toBe("Show run");
  });

  it("sets button text to 'Show all' when showAll is false", () => {
    w.updateToggleButtonDisplay(false);
    const btn = w.document.getElementById("all-time-toggle");
    expect(btn).not.toBeNull();
    expect(btn!.textContent?.trim()).toBe("Show all");
  });
});

// ===========================================================================
// updateDisplay — DOM integration
// ===========================================================================
describe("updateDisplay", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM(makeState()));
  });

  it("updates bless info value span with bless count", async () => {
    const state = makeState();
    state.current.numberOfBlesses = 3;
    state.allTime.numberOfBlesses = 3;
    w.updateDisplay(state, false);
    await flushPromises();
    const span = w.document.querySelector("span.bless-info-value");
    expect(span).not.toBeNull();
    expect(span!.textContent).toBe("3");
  });

  it("updates curse info value span with curse count", async () => {
    const state = makeState();
    state.current.numberOfCurses = 7;
    state.allTime.numberOfCurses = 7;
    w.updateDisplay(state, false);
    await flushPromises();
    const span = w.document.querySelector("span.curse-info-value");
    expect(span).not.toBeNull();
    expect(span!.textContent).toBe("7");
  });

  it("sets toggle button to 'Show all' when showAll is false", async () => {
    const state = makeState({ showAll: false });
    state.current.numberOfBlesses = 2;
    state.allTime.numberOfBlesses = 2;
    w.updateDisplay(state, false);
    await flushPromises();
    const btn = w.document.getElementById("all-time-toggle");
    expect(btn).not.toBeNull();
    expect(btn!.textContent?.trim()).toBe("Show all");
  });

  it("sets toggle button to 'Show run' when showAll is true", async () => {
    const state = makeState({ showAll: true });
    state.allTime.numberOfBlesses = 5;
    state.allTime.numberOfCurses = 5;
    w.updateDisplay(state, false);
    await flushPromises();
    const btn = w.document.getElementById("all-time-toggle");
    expect(btn).not.toBeNull();
    expect(btn!.textContent?.trim()).toBe("Show run");
  });

  it("handles null state without throwing", () => {
    expect(() => w.updateDisplay(null, false)).not.toThrow();
  });

  it("shows preReset blesses in info value when total is zero", async () => {
    const state = makeState();
    state.current.numberOfBlessesPreReset = 4;
    // total (blesses+curses+blurses) is 0 so the zero-branch runs
    w.updateDisplay(state, false);
    await flushPromises();
    const span = w.document.querySelector("span.bless-info-value");
    expect(span).not.toBeNull();
    expect(span!.textContent).toBe("4");
  });
});

// ===========================================================================
// hasValidLastRedemption
// ===========================================================================
describe("hasValidLastRedemption", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("returns false for undefined", () => {
    expect(w.hasValidLastRedemption(undefined)).toBe(false);
  });

  it("returns false when redeemingUser is missing", () => {
    expect(w.hasValidLastRedemption({ charType: "bless", meterTarget: "bless", meterAmount: 1 })).toBe(false);
  });

  it("returns true for a complete lastRedemption", () => {
    expect(w.hasValidLastRedemption(makeLastRedemption())).toBe(true);
  });
});

// ===========================================================================
// formatRedemptionTypeLabel / formatRedemptionImpactLabel
// ===========================================================================
describe("formatRedemptionTypeLabel", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("returns BLESSED for bless", () => {
    expect(w.formatRedemptionTypeLabel("bless")).toBe("BLESSED");
  });

  it("returns CURSED for curse", () => {
    expect(w.formatRedemptionTypeLabel("curse")).toBe("CURSED");
  });

  it("returns BLURSED for blurse", () => {
    expect(w.formatRedemptionTypeLabel("blurse")).toBe("BLURSED");
  });
});

describe("formatRedemptionImpactLabel", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("formats bless, curse, and blurse meter movements", () => {
    expect(w.formatRedemptionImpactLabel("bless", 1)).toBe("+1 BLESS");
    expect(w.formatRedemptionImpactLabel("curse", 1)).toBe("+1 CURSE");
    expect(w.formatRedemptionImpactLabel("bless", 2)).toBe("+2 BLESS");
    expect(w.formatRedemptionImpactLabel("curse", 2)).toBe("+2 CURSE");
  });
});

// ===========================================================================
// getTypeColorClass / getMeterTargetColorClass
// ===========================================================================
describe("getTypeColorClass", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("maps bless, curse, and blurse to color classes", () => {
    expect(w.getTypeColorClass("bless")).toBe("redemption-text-bless");
    expect(w.getTypeColorClass("curse")).toBe("redemption-text-curse");
    expect(w.getTypeColorClass("blurse")).toBe("redemption-text-blurse");
  });
});

describe("getMeterTargetColorClass", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("maps bless and curse meter targets to color classes", () => {
    expect(w.getMeterTargetColorClass("bless")).toBe("redemption-text-bless");
    expect(w.getMeterTargetColorClass("curse")).toBe("redemption-text-curse");
  });
});

// ===========================================================================
// buildRedemptionAnnouncementSegments
// ===========================================================================
describe("buildRedemptionAnnouncementSegments", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("builds four segments with colored type and impact labels", () => {
    const segments = w.buildRedemptionAnnouncementSegments(makeLastRedemption());
    expect(segments).toHaveLength(4);
    expect(segments[0]).toEqual({ text: "testUserName\n" });
    expect(segments[1]).toEqual({ text: "BLESSED", colorClass: "redemption-text-bless" });
    expect(segments[2]).toEqual({ text: " the run\nImpact: " });
    expect(segments[3]).toEqual({ text: "+1 BLESS", colorClass: "redemption-text-bless" });
  });

  it("colors blurse meter movement by bless vs curse outcome", () => {
    const blessed = w.buildRedemptionAnnouncementSegments(
      makeLastRedemption({ charType: "blurse", meterTarget: "bless", meterAmount: 2 })
    );
    expect(blessed[1].colorClass).toBe("redemption-text-blurse");
    expect(blessed[3]).toEqual({ text: "+2 BLESS", colorClass: "redemption-text-bless" });

    const cursed = w.buildRedemptionAnnouncementSegments(
      makeLastRedemption({ charType: "blurse", meterTarget: "curse", meterAmount: 2 })
    );
    expect(cursed[3]).toEqual({ text: "+2 CURSE", colorClass: "redemption-text-curse" });
  });
});

// ===========================================================================
// typewriterSegments
// ===========================================================================
describe("typewriterSegments", () => {
  let w: Window;

  beforeEach(() => {
    jest.useFakeTimers();
    ({ w } = setupTestDOM());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the full message immediately when delay is 0", async () => {
    const container = w.document.createElement("div");
    const segments = w.buildRedemptionAnnouncementSegments(makeLastRedemption());
    await w.typewriterSegments(container, segments, 0);
    expect(container.textContent).toBe("testUserName\nBLESSED the run\nImpact: +1 BLESS");
    const colored = Array.from(container.querySelectorAll("span")).map((span) => span.className);
    expect(colored).toContain("redemption-text-bless");
  });

  it("does not apply liftAnnouncementText margins while typing in headline overlays", async () => {
    const parent = w.document.createElement("div");
    parent.className = "redemption-announcement visible is-headline";
    const container = w.document.createElement("div");
    container.className = "redemption-announcement-text redemption-announcement-headline";
    parent.appendChild(container);
    w.document.body.appendChild(parent);

    await w.typewriterSegments(container, [{ text: "CURRENT RUN" }], 0);

    expect(container.style.marginTop).toBe("");
    expect(container.style.maxHeight).toBe("");
  });

  it("does not vertically recenter redemption overlays while typing", async () => {
    const parent = w.document.createElement("div");
    parent.className = "redemption-announcement visible is-redemption";
    Object.defineProperty(parent, "clientHeight", { value: 60, configurable: true });
    const container = w.document.createElement("div");
    container.className = "redemption-announcement-text";
    container.style.maxHeight = "60px";
    parent.appendChild(container);
    w.document.body.appendChild(parent);

    const segments = w.buildRedemptionAnnouncementSegments(makeLastRedemption());
    await w.typewriterSegments(container, segments, 0);

    expect(container.style.marginTop).toBe("");
  });

  it("does not vertically recenter list overlays while typing top redeemers", async () => {
    const parent = w.document.createElement("div");
    parent.className = "redemption-announcement visible is-list";
    Object.defineProperty(parent, "clientHeight", { value: 60, configurable: true });
    const container = w.document.createElement("div");
    container.className = "redemption-announcement-text redemption-announcement-list";
    container.style.maxHeight = "60px";
    parent.appendChild(container);
    w.document.body.appendChild(parent);

    await w.typewriterSegments(container, [{ text: "1. alice - 3\n2. bob - 2\n3. carol - 1" }], 0);

    expect(container.style.marginTop).toBe("");
  });

  it("reveals text one character at a time", async () => {
    const container = w.document.createElement("div");
    const promise = w.typewriterSegments(container, [{ text: "abc" }], 10);
    await flushMicrotasks();
    expect(container.textContent).toBe("a");
    jest.advanceTimersByTime(10);
    await flushMicrotasks();
    expect(container.textContent).toBe("ab");
    await jest.runAllTimersAsync();
    await promise;
    expect(container.textContent).toBe("abc");
  });
});

describe("liftAnnouncementText", () => {
  it("centers short copy and scrolls when the copy outgrows the window", () => {
    const { w } = setupTestDOM();
    const parent = w.document.createElement("div");
    const child = w.document.createElement("div");
    parent.appendChild(child);
    Object.defineProperty(parent, "clientHeight", { value: 60, configurable: true });
    Object.defineProperty(child, "scrollHeight", { value: 20, configurable: true });
    Object.defineProperty(child, "clientHeight", { value: 20, configurable: true });

    w.liftAnnouncementText(child);
    expect(child.style.marginTop).toBe("20px");
    expect(child.style.maxHeight).toBe("60px");
    expect(child.scrollTop).toBe(0);

    Object.defineProperty(child, "scrollHeight", { value: 80, configurable: true });
    Object.defineProperty(child, "clientHeight", { value: 60, configurable: true });
    w.liftAnnouncementText(child);
    expect(child.style.marginTop).toBe("0px");
    expect(child.scrollTop).toBe(20);
  });
});

// ===========================================================================
// animateRedemptionAnnouncement
// ===========================================================================
describe("animateRedemptionAnnouncement", () => {
  let w: Window;

  beforeEach(() => {
    jest.useFakeTimers();
    ({ w } = setupTestDOM());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("hides the meter panel during the announcement and restores it afterward", async () => {
    const meterPanel = w.document.querySelector(".meter-panel-content");
    const announcement = w.document.querySelector(".redemption-announcement");
    expect(meterPanel).not.toBeNull();
    expect(announcement).not.toBeNull();

    const promise = w.animateRedemptionAnnouncement(makeLastRedemption());
    await flushMicrotasks();

    expect(meterPanel!.classList.contains("hidden")).toBe(true);
    expect(announcement!.classList.contains("visible")).toBe(true);
    expect(w.document.querySelector(".redemption-announcement-text")?.textContent).toBe("t");

    await jest.runAllTimersAsync();
    await promise;

    expect(meterPanel!.classList.contains("hidden")).toBe(false);
    expect(announcement!.classList.contains("visible")).toBe(false);
    expect(announcement!.textContent).toBe("");
  });

  it("leaves type and impact labels in colored spans after typing completes", async () => {
    const container = w.document.createElement("div");
    const segments = w.buildRedemptionAnnouncementSegments(
      makeLastRedemption({ charType: "curse", meterTarget: "curse", meterAmount: 1 })
    );
    await w.typewriterSegments(container, segments, 0);
    const spans = Array.from(container.querySelectorAll("span"));
    expect(spans.some((span) => span.className === "redemption-text-curse" && span.textContent === "CURSED")).toBe(
      true
    );
    expect(spans.some((span) => span.className === "redemption-text-curse" && span.textContent === "+1 CURSE")).toBe(
      true
    );
  });
});

// ===========================================================================
// updateDisplay — redemption announcement integration
// ===========================================================================
describe("updateDisplay redemption announcement", () => {
  it("skips the announcement when showAnimate is false", async () => {
    const { w } = setupTestDOM(makeState());
    const state = makeState({ lastRedemption: makeLastRedemption() });
    state.current.numberOfBlesses = 2;
    state.allTime.numberOfBlesses = 2;
    w.updateDisplay(state, false);
    await flushPromises();

    expect(w.document.querySelector(".redemption-announcement")?.classList.contains("visible")).toBe(false);
    expect(w.document.querySelector("span.bless-info-value")?.textContent).toBe("2");
  });

  it("skips the announcement on load even when lastRedemption is present", async () => {
    const state = makeState({ lastRedemption: makeLastRedemption() });
    const { w } = setupTestDOM(state);
    w.updateDisplay(state, true);
    await flushPromises();

    expect(w.document.querySelector(".redemption-announcement")?.classList.contains("visible")).toBe(false);
  });

  it("skips the announcement when showRedemptionAnnouncements is false", async () => {
    const { w } = setupTestDOM(makeState());
    w.applyFieldData({
      showRedemptionAnnouncements: false,
      reportsShouldDisplay: false,
      numberOfSecondsBetweenReports: 0,
    });
    const state = makeState({ lastRedemption: makeLastRedemption() });
    state.current.numberOfBlesses = 2;
    state.allTime.numberOfBlesses = 2;
    w.updateDisplay(state, true, true);
    await flushPromises();

    expect(w.document.querySelector(".redemption-announcement")?.classList.contains("visible")).toBe(false);
    expect(w.document.querySelector("span.bless-info-value")?.textContent).toBe("2");
    w.stopPeriodicReports();
  });

  it("runs the announcement before updating meters for a fresh redemption", async () => {
    jest.useFakeTimers();
    try {
      const { w } = setupTestDOM(makeState());
      const state = makeState({ lastRedemption: makeLastRedemption() });
      state.current.numberOfBlesses = 2;
      state.allTime.numberOfBlesses = 2;
      w.updateDisplay(state, true, true);
      await flushMicrotasks();

      expect(w.document.querySelector(".meter-panel-content")?.classList.contains("hidden")).toBe(true);
      expect(w.document.querySelector(".redemption-announcement")?.classList.contains("visible")).toBe(true);

      await jest.runAllTimersAsync();
      await flushMicrotasks();

      expect(w.document.querySelector(".meter-panel-content")?.classList.contains("hidden")).toBe(false);
      expect(w.document.querySelector("span.bless-info-value")?.textContent).toBe("2");
    } finally {
      jest.useRealTimers();
    }
  });
});

// ===========================================================================
// incrementState — async SE_API interaction
// ===========================================================================
describe("incrementState", () => {
  it("calls SE_API.store.get then store.set with incremented bless count", async () => {
    const state = makeState();
    const { w, mockSEAPI } = setupTestDOM(state);

    w.incrementState("numberOfBlesses");
    await flushPromises();

    expect(mockSEAPI.store.get).toHaveBeenCalledWith("blessCurseMeterState");
    expect(mockSEAPI.store.set).toHaveBeenCalled();
    const saved = mockSEAPI.store._data["blessCurseMeterState"];
    expect(saved?.current.numberOfBlesses).toBe(1);
    expect(saved?.allTime.numberOfBlesses).toBe(1);
  });

  it("increments curse count correctly", async () => {
    const state = makeState();
    const { w, mockSEAPI } = setupTestDOM(state);

    w.incrementState("numberOfCurses");
    await flushPromises();

    const saved = mockSEAPI.store._data["blessCurseMeterState"];
    expect(saved?.current.numberOfCurses).toBe(1);
    expect(saved?.allTime.numberOfCurses).toBe(1);
  });

  it("initializes to zero when store returns null (no prior state)", async () => {
    const { w, mockSEAPI } = setupTestDOM(); // no initial state

    w.incrementState("numberOfBlesses");
    await flushPromises();

    expect(mockSEAPI.store.set).toHaveBeenCalled();
  });

  it("arms the announcement only when incrementing without a meter reset", async () => {
    const state = makeState();
    const { w, mockSEAPI } = setupTestDOM(state);

    w.incrementState("numberOfBlesses", "testUserName");
    await flushPromises();

    jest.useFakeTimers();
    try {
      w.updateDisplay(mockSEAPI.store._data["blessCurseMeterState"]!, true);
      await flushMicrotasks();
      expect(w.document.querySelector(".redemption-announcement")?.classList.contains("visible")).toBe(true);
      await jest.runAllTimersAsync();
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not arm the announcement when increment triggers a meter reset", async () => {
    const state = makeState({ lastRedemption: makeLastRedemption() });
    state.current.numberOfBlesses = 15;
    state.current.numberOfCurses = 15;
    const { w, mockSEAPI } = setupTestDOM(state);

    w.incrementState("numberOfBlesses", "testUserName");
    await flushPromises();

    w.updateDisplay(mockSEAPI.store._data["blessCurseMeterState"]!, true);
    await flushPromises();

    expect(w.document.querySelector(".redemption-announcement")?.classList.contains("visible")).toBe(false);
  });

  it("tracks per-user bless, curse, and blurse outcome counts in redemptionHistory", async () => {
    const state = makeState();
    const { w, mockSEAPI, dom } = setupTestDOM(state);

    w.incrementState("numberOfBlesses", "alice");
    await flushPromises();
    w.incrementState("numberOfCurses", "bob");
    await flushPromises();

    const blurseOutcomes = [0.1, 0.9];
    const randomSpy = jest.spyOn(dom.window.Math, "random").mockImplementation(() => blurseOutcomes.shift() ?? 0.5);
    w.incrementState("numberOfBlurses", "carol");
    await flushPromises();
    w.incrementState("numberOfBlurses", "carol");
    await flushPromises();
    randomSpy.mockRestore();

    const saved = mockSEAPI.store._data["blessCurseMeterState"];
    expect(saved?.redemptionHistory?.alice).toEqual(
      makeRedemptionHistoryEntry({ numberOfBlesses: 1, displayName: "alice" })
    );
    expect(saved?.redemptionHistory?.bob).toEqual(
      makeRedemptionHistoryEntry({ numberOfCurses: 1, displayName: "bob" })
    );
    expect(saved?.redemptionHistory?.carol).toEqual(
      makeRedemptionHistoryEntry({
        numberOfBlurses: 2,
        numberOfBlursesThatBlessed: 1,
        numberOfBlursesThatCursed: 1,
        displayName: "carol",
      })
    );
  });

  it("resets meters when both are at max and calls set with reset state", async () => {
    const state = makeState();
    // Put both meters at max (15 each)
    state.current.numberOfBlesses = 15;
    state.current.numberOfCurses = 15;
    state.allTime.numberOfBlesses = 15;
    state.allTime.numberOfCurses = 15;
    // Incrementing should trigger resetMetersButKeepCurrentState
    const { w, mockSEAPI } = setupTestDOM(state);

    w.incrementState("numberOfBlesses");
    await flushPromises();

    expect(mockSEAPI.store.set).toHaveBeenCalled();
    // After reset, current counts should be 0
    const saved = mockSEAPI.store._data["blessCurseMeterState"];
    expect(saved?.current.numberOfBlesses).toBe(0);
  });

  it("applies overlapping increments instead of letting the last write win", async () => {
    const state = makeState();
    const { w, mockSEAPI } = setupTestDOM(state);
    mockSEAPI.store.get.mockImplementation(
      (key: string) =>
        new Promise((resolve) => {
          setTimeout(() => resolve(mockSEAPI.store._data[key] ?? null), 15);
        })
    );

    w.incrementState("numberOfBlesses", "alice");
    w.incrementState("numberOfBlesses", "alice");
    await new Promise((resolve) => setTimeout(resolve, 80));

    const saved = mockSEAPI.store._data["blessCurseMeterState"];
    expect(saved?.current.numberOfBlesses).toBe(2);
    expect(saved?.allTime.numberOfBlesses).toBe(2);
    expect(saved?.redemptionHistory?.alice.numberOfBlesses).toBe(2);
  });
});

describe("animateChange", () => {
  it("skips interpolation when the fill is already at the target percent", async () => {
    const { w, dom } = setupTestDOM(makeState());
    const meter = dom.window.document.createElement("div");
    const fill = dom.window.document.createElement("div");
    meter.appendChild(fill);
    Object.defineProperty(meter, "clientWidth", { value: 200, configurable: true });
    w.document.body.appendChild(meter);

    await w.animateChange(fill, "40px", "20.00%", 1000, "bless")();

    expect(fill.animate).not.toHaveBeenCalled();
    expect(parseFloat(fill.style.width)).toBe(20);
  });

  it("animates percent-to-percent when the fill actually changes", async () => {
    const { w, dom } = setupTestDOM(makeState());
    const meter = dom.window.document.createElement("div");
    const fill = dom.window.document.createElement("div");
    meter.appendChild(fill);
    Object.defineProperty(meter, "clientWidth", { value: 200, configurable: true });
    w.document.body.appendChild(meter);

    await w.animateChange(fill, "40px", "40.00%", 1000, "curse")();

    expect(fill.animate).toHaveBeenCalledWith(
      [{ width: "20.00%" }, { width: "40.00%" }],
      expect.objectContaining({ fill: "forwards" })
    );
  });
});

// ===========================================================================
// toggleShowAllState — async SE_API interaction
// ===========================================================================

function blessMeterTitleText(w: Window): string | undefined {
  return w.document.querySelector(".bless-container .meter-title")?.textContent ?? undefined;
}

function curseMeterTitleText(w: Window): string | undefined {
  return w.document.querySelector(".curse-container .meter-title")?.textContent ?? undefined;
}

/** Runs updateDisplay and drains the widget display queue (needed for meter titles). */
async function renderWidgetState(w: Window, state: WidgetState): Promise<void> {
  w.updateDisplay(state, false);
  await flushPromises();
}

describe("toggleShowAllState", () => {
  it("toggles showAll from false to true", async () => {
    const state = makeState({ showAll: false });
    const { w, mockSEAPI } = setupTestDOM(state);

    w.toggleShowAllState();
    await flushPromises();

    expect(mockSEAPI.store.set).toHaveBeenCalled();
    const saved = mockSEAPI.store._data["blessCurseMeterState"];
    expect(saved?.showAll).toBe(true);
  });

  it("toggles showAll from true to false", async () => {
    const state = makeState({ showAll: true });
    const { w, mockSEAPI } = setupTestDOM(state);

    w.toggleShowAllState();
    await flushPromises();

    const saved = mockSEAPI.store._data["blessCurseMeterState"];
    expect(saved?.showAll).toBe(false);
  });

  it("toggles FFVI meter titles between current run and all-time", async () => {
    const state = makeState({ showAll: false, backgroundTheme: "ffvi" });
    const { w, mockSEAPI } = setupTestDOM(state);

    await renderWidgetState(w, state);
    expect(blessMeterTitleText(w)).toBe("BLESS");
    expect(curseMeterTitleText(w)).toBe("CURSE");

    w.toggleShowAllState();
    await flushPromises();
    let saved = mockSEAPI.store._data["blessCurseMeterState"];
    expect(saved?.showAll).toBe(true);
    await renderWidgetState(w, saved!);
    expect(blessMeterTitleText(w)).toBe("ALL");
    expect(curseMeterTitleText(w)).toBe("TIME");

    w.toggleShowAllState();
    await flushPromises();
    saved = mockSEAPI.store._data["blessCurseMeterState"];
    expect(saved?.showAll).toBe(false);
    await renderWidgetState(w, saved!);
    expect(blessMeterTitleText(w)).toBe("BLESS");
    expect(curseMeterTitleText(w)).toBe("CURSE");
  });

  it("toggles CT meter titles between current run and all-time", async () => {
    const state = makeState({ showAll: false, backgroundTheme: "ct" });
    const { w, mockSEAPI } = setupTestDOM(state);

    await renderWidgetState(w, state);
    expect(w.document.body.classList.contains("theme-ct")).toBe(true);
    expect(blessMeterTitleText(w)).toBe("BLESS");
    expect(curseMeterTitleText(w)).toBe("CURSE");

    w.toggleShowAllState();
    await flushPromises();
    let saved = mockSEAPI.store._data["blessCurseMeterState"];
    expect(saved?.showAll).toBe(true);
    await renderWidgetState(w, saved!);
    expect(blessMeterTitleText(w)).toBe("ALL BLESS");
    expect(curseMeterTitleText(w)).toBe("ALL CURSE");

    w.toggleShowAllState();
    await flushPromises();
    saved = mockSEAPI.store._data["blessCurseMeterState"];
    expect(saved?.showAll).toBe(false);
    await renderWidgetState(w, saved!);
    expect(blessMeterTitleText(w)).toBe("BLESS");
    expect(curseMeterTitleText(w)).toBe("CURSE");
  });
});

// ===========================================================================
// isCt / getBlessMeterTitle / getCurseMeterTitle
// ===========================================================================
describe("meter title DOM helpers", () => {
  describe("isCt", () => {
    it("returns false when the CT body class is not applied", () => {
      const { w } = setupTestDOM();
      expect(w.isCt()).toBe(false);
    });

    it("returns true after applyBackgroundTheme('ct')", () => {
      const { w } = setupTestDOM();
      w.applyBackgroundTheme("ct");
      expect(w.isCt()).toBe(true);
      expect(w.document.body.classList.contains("theme-ct")).toBe(true);
    });

    it("returns false after switching back to ffvi", () => {
      const { w } = setupTestDOM();
      w.applyBackgroundTheme("ct");
      w.applyBackgroundTheme("ffvi");
      expect(w.isCt()).toBe(false);
    });
  });

  describe("getBlessMeterTitle and getCurseMeterTitle", () => {
    it("return single elements for the bless and curse meter titles", () => {
      const { w } = setupTestDOM();
      const blessTitle = w.getBlessMeterTitle();
      const curseTitle = w.getCurseMeterTitle();

      expect(blessTitle.length).toBe(1);
      expect(curseTitle.length).toBe(1);
      expect(blessTitle.get(0)).toBe(w.document.querySelector(".bless-container .meter-title"));
      expect(curseTitle.get(0)).toBe(w.document.querySelector(".curse-container .meter-title"));
    });

    it("read initial title text from widget.html", () => {
      const { w } = setupTestDOM();
      expect(w.getBlessMeterTitle().text()).toBe("BLESS");
      expect(w.getCurseMeterTitle().text()).toBe("CURSE");
    });

    it("update visible title text via jQuery", () => {
      const { w } = setupTestDOM();
      w.getBlessMeterTitle().text("CUSTOM BLESS");
      w.getCurseMeterTitle().text("CUSTOM CURSE");
      expect(blessMeterTitleText(w)).toBe("CUSTOM BLESS");
      expect(curseMeterTitleText(w)).toBe("CUSTOM CURSE");
    });
  });
});

// ===========================================================================
// resetCurrentState — async SE_API interaction
// ===========================================================================
describe("resetCurrentState", () => {
  it("does not run the redemption announcement", async () => {
    const state = makeState({ lastRedemption: makeLastRedemption() });
    state.current.numberOfBlesses = 10;
    const { w, mockSEAPI } = setupTestDOM(state);

    w.resetCurrentState();
    await flushPromises();
    w.updateDisplay(mockSEAPI.store._data["blessCurseMeterState"]!, true);
    await flushPromises();

    expect(w.document.querySelector(".redemption-announcement")?.classList.contains("visible")).toBe(false);
  });

  it("zeroes all current counters but preserves allTime", async () => {
    const state = makeState();
    state.current.numberOfBlesses = 10;
    state.current.numberOfCurses = 8;
    state.allTime.numberOfBlesses = 25;
    state.allTime.numberOfCurses = 20;
    const { w, mockSEAPI } = setupTestDOM(state);

    w.resetCurrentState();
    await flushPromises();

    expect(mockSEAPI.store.set).toHaveBeenCalled();
    const saved = mockSEAPI.store._data["blessCurseMeterState"];
    expect(saved?.current.numberOfBlesses).toBe(0);
    expect(saved?.current.numberOfCurses).toBe(0);
    // allTime should be unchanged
    expect(saved?.allTime.numberOfBlesses).toBe(25);
    expect(saved?.allTime.numberOfCurses).toBe(20);
  });
});

// ===========================================================================
// resetAllTimeState — synchronous SE_API interaction
// ===========================================================================
describe("resetAllTimeState", () => {
  it("calls SE_API.store.set with fully zeroed state", () => {
    const state = makeState();
    state.allTime.numberOfBlesses = 100;
    const { w, mockSEAPI } = setupTestDOM(state);

    w.resetAllTimeState();

    expect(mockSEAPI.store.set).toHaveBeenCalled();
    // The first argument to the last call should be the store key
    const callArgs = mockSEAPI.store.set.mock.calls[0];
    expect(callArgs[0]).toBe("blessCurseMeterState");
    const saved = callArgs[1] as WidgetState;
    expect(saved.allTime.numberOfBlesses).toBe(0);
    expect(saved.current.numberOfBlesses).toBe(0);
  });
});

// ===========================================================================
// Event flow — onEventReceived dispatching
// ===========================================================================
describe("onEventReceived event dispatching", () => {
  it("handles Twitch channel-points detail with listener event", async () => {
    const state = makeState();
    const { w, mockSEAPI } = setupTestDOM(state);

    w.eventReceivedHandler(
      new CustomEvent("onEventReceived", { detail: makeExampleTwitchChannelPointsRedemptionDetail() })
    );
    await flushPromises();

    const saved = mockSEAPI.store._data["blessCurseMeterState"];
    expect(saved?.current.numberOfBlesses).toBe(1);
    expect(saved?.redemptionHistory?.exampleUserName?.numberOfBlesses).toBe(1);
    expect(saved?.redemptionHistory?.exampleUserName?.displayName).toBe("ExampleUserNameDisplay");
  });

  it("testBless dispatches an onEventReceived CustomEvent", () => {
    const { w } = setupTestDOM(makeState());
    const eventSpy = jest.fn();
    w.addEventListener("onEventReceived", eventSpy);

    w.testBless();

    expect(eventSpy).toHaveBeenCalledTimes(1);
    const detail = (eventSpy.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.event.data.redemption).toBe("Bless the Run");
  });

  it("testCurse dispatches an onEventReceived CustomEvent", () => {
    const { w } = setupTestDOM(makeState());
    const eventSpy = jest.fn();
    w.addEventListener("onEventReceived", eventSpy);

    w.testCurse();

    expect(eventSpy).toHaveBeenCalledTimes(1);
    const detail = (eventSpy.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.event.data.redemption).toBe("Curse the Run");
  });

  it("testBlurse dispatches an onEventReceived CustomEvent", () => {
    const { w } = setupTestDOM(makeState());
    const eventSpy = jest.fn();
    w.addEventListener("onEventReceived", eventSpy);

    w.testBlurse();

    expect(eventSpy).toHaveBeenCalledTimes(1);
    const detail = (eventSpy.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.event.data.redemption).toBe("Blurse the Run");
  });
});

// ===========================================================================
// handleRedemption — dispatches correct state increments
// ===========================================================================
describe("handleRedemption", () => {
  it("calls incrementState for 'Bless the Run'", async () => {
    const state = makeState();
    const { w, mockSEAPI } = setupTestDOM(state);

    const detail: SEEventDetail = {
      event: { type: "channelPointsRedemption", data: { redemption: "Bless the Run" } },
    };
    w.handleRedemption(detail);
    await flushPromises();

    const saved = mockSEAPI.store._data["blessCurseMeterState"];
    expect(saved?.current.numberOfBlesses).toBe(1);
  });

  it("records redemptionHistory keyed by username with displayName stored for reports", async () => {
    const state = makeState();
    const { w, mockSEAPI } = setupTestDOM(state);

    w.handleRedemption(makeExampleTwitchChannelPointsRedemptionDetail());
    await flushPromises();

    const saved = mockSEAPI.store._data["blessCurseMeterState"];
    expect(saved?.redemptionHistory?.exampleUserName).toEqual(
      makeRedemptionHistoryEntry({ numberOfBlesses: 1, displayName: "ExampleUserNameDisplay" })
    );
    expect(saved?.lastRedemption?.redeemingUser).toBe("ExampleUserNameDisplay");
  });

  it("calls incrementState for 'Curse the Run'", async () => {
    const state = makeState();
    const { w, mockSEAPI } = setupTestDOM(state);

    const detail: SEEventDetail = {
      event: { type: "channelPointsRedemption", data: { redemption: "Curse the Run" } },
    };
    w.handleRedemption(detail);
    await flushPromises();

    const saved = mockSEAPI.store._data["blessCurseMeterState"];
    expect(saved?.current.numberOfCurses).toBe(1);
  });

  it("calls incrementState for 'Blurse the Run'", async () => {
    const state = makeState();
    const { w, mockSEAPI } = setupTestDOM(state);

    const detail: SEEventDetail = {
      event: { type: "channelPointsRedemption", data: { redemption: "Blurse the Run" } },
    };
    w.handleRedemption(detail);
    await flushPromises();

    const saved = mockSEAPI.store._data["blessCurseMeterState"];
    expect(saved?.current.numberOfBlurses).toBe(1);
  });

  it("does not increment for an unknown redemption name", async () => {
    const state = makeState();
    const { w, mockSEAPI } = setupTestDOM(state);
    const setCallsBefore = mockSEAPI.store.set.mock.calls.length;

    const detail: SEEventDetail = {
      event: { data: { redemption: "Unknown Redemption" } },
    };
    w.handleRedemption(detail);
    await flushPromises();

    expect(mockSEAPI.store.set.mock.calls.length).toBe(setCallsBefore);
  });
});

// ===========================================================================
// mockRedeemEvent — event structure
// ===========================================================================
describe("mockRedeemEvent", () => {
  let w: any;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("creates a CustomEvent with onEventReceived type", () => {
    const event = w.mockRedeemEvent("Bless the Run");
    expect(event.type).toBe("onEventReceived");
  });

  it("includes the redemption name in event.detail.event.data.redemption", () => {
    const event = w.mockRedeemEvent("Curse the Run");
    expect(event.detail.event.data.redemption).toBe("Curse the Run");
  });

  it("sets event type to channelPointsRedemption", () => {
    const event = w.mockRedeemEvent("Blurse the Run");
    expect(event.detail.event.type).toBe("channelPointsRedemption");
  });
});

// ===========================================================================
// getTopRedeemers / buildTopRedeemersReportSegments
// ===========================================================================
describe("getTopRedeemers", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("shows stored displayName in leaderboard rows while tracking by username key", () => {
    const history: RedemptionHistory = {
      exampleUserName: makeRedemptionHistoryEntry({
        numberOfBlesses: 4,
        displayName: "ExampleUserNameDisplay",
      }),
    };
    expect(w.getTopRedeemers(history, "bless")).toEqual([{ userName: "ExampleUserNameDisplay", count: 4 }]);
  });

  it("returns the top bless redeemers sorted by count", () => {
    const history: RedemptionHistory = {
      alice: makeRedemptionHistoryEntry({ numberOfBlesses: 10 }),
      bob: makeRedemptionHistoryEntry({ numberOfBlesses: 5 }),
      carol: makeRedemptionHistoryEntry({ numberOfBlesses: 7 }),
      zero: makeRedemptionHistoryEntry({ numberOfBlesses: 0 }),
    };
    expect(w.getTopRedeemers(history, "bless")).toEqual([
      { userName: "alice", count: 10 },
      { userName: "carol", count: 7 },
      { userName: "bob", count: 5 },
    ]);
  });

  it("limits results to three redeemers", () => {
    const history: RedemptionHistory = {
      u1: makeRedemptionHistoryEntry({ numberOfCurses: 6 }),
      u2: makeRedemptionHistoryEntry({ numberOfCurses: 5 }),
      u3: makeRedemptionHistoryEntry({ numberOfCurses: 4 }),
      u4: makeRedemptionHistoryEntry({ numberOfCurses: 3 }),
      u5: makeRedemptionHistoryEntry({ numberOfCurses: 2 }),
      u6: makeRedemptionHistoryEntry({ numberOfCurses: 1 }),
    };
    expect(w.getTopRedeemers(history, "curse")).toHaveLength(3);
    expect(w.getTopRedeemers(history, "curse").map((row) => row.userName)).toContain("u1");
    expect(w.getTopRedeemers(history, "curse").map((row) => row.userName)).toContain("u2");
    expect(w.getTopRedeemers(history, "curse").map((row) => row.userName)).toContain("u3");
    expect(w.getTopRedeemers(history, "curse").map((row) => row.userName)).not.toContain("u4");
    expect(w.getTopRedeemers(history, "curse").map((row) => row.userName)).not.toContain("u5");
    expect(w.getTopRedeemers(history, "curse").map((row) => row.userName)).not.toContain("u6");
  });

  it("normalizes legacy redemption history entries missing blurse outcome fields", () => {
    const history: RedemptionHistory = {
      legacy: {
        numberOfBlesses: 2,
        numberOfCurses: 0,
        numberOfBlurses: 3,
        numberOfBlursesThatBlessed: undefined as unknown as number,
        numberOfBlursesThatCursed: undefined as unknown as number,
      },
    };
    expect(w.getTopRedeemers(history, "blurse")).toEqual([{ userName: "legacy", count: 3 }]);
  });
});

describe("buildTopRedeemersTitleSegments / buildTopRedeemersListSegments", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("builds a plain headline segment matching ALL TIME / CURRENT RUN", () => {
    expect(w.buildReportHeadlineSegments("CURRENT RUN")).toEqual([{ text: "CURRENT RUN" }]);
    expect(w.buildTopRedeemersTitleSegments("TOP BLESS REDEEMERS")).toEqual([{ text: "TOP BLESS REDEEMERS" }]);
  });

  it("builds ranked rows for the list overlay", () => {
    const segments = w.buildTopRedeemersListSegments([
      { userName: "alice", count: 3 },
      { userName: "bob", count: 1 },
    ]);
    expect(segments).toEqual([{ text: "1. alice - 3\n2. bob - 1" }]);
  });

  it("shows a fallback when there are no redeems", () => {
    expect(w.buildTopRedeemersListSegments([])).toEqual([{ text: "No redeems yet" }]);
  });
});

describe("buildTopRedeemersReportSegments", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("combines title and list segments for legacy callers", () => {
    const segments = w.buildTopRedeemersReportSegments("TOP BLESS REDEEMERS", [
      { userName: "alice", count: 3 },
      { userName: "bob", count: 1 },
    ]);
    expect(segments[0]).toEqual({ text: "TOP BLESS REDEEMERS\n" });
    expect(segments[1].text).toBe("1. alice - 3\n2. bob - 1");
  });
});

// ===========================================================================
// Emote-triggered bless
// ===========================================================================
describe("emote bless helpers", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
  });

  it("parseEmoteNamesCsv splits and trims entries", () => {
    expect(w.parseEmoteNamesCsv(" Kappa , PogChamp, ")).toEqual(["Kappa", "PogChamp"]);
    expect(w.parseEmoteNamesCsv("")).toEqual([]);
  });

  it("findMatchingTrackedEmotesInChat matches emote objects case-insensitively", () => {
    const tracked = new Set(["kappa", "pogchamp"]);
    const fromEmotes = w.findMatchingTrackedEmotesInChat({ emotes: [{ name: "Kappa" }, { name: "LUL" }] }, tracked);
    expect(fromEmotes).toEqual(["Kappa"]);

    const fromText = w.findMatchingTrackedEmotesInChat({ text: "hello PogChamp world" }, tracked);
    expect(fromText).toEqual(["PogChamp"]);
  });

  it("buildEmoteBlessAnnouncementSegments includes match and user summary", () => {
    const segments = w.buildEmoteBlessAnnouncementSegments(["alice", "bob"], 5);
    expect(segments[0].text).toBe("Mustache man blesses the run\n");
    expect(segments[1].text).toContain("Impact:");
    expect(segments[2].text).toBe("+1 BLESS");
  });

  it("uses the configured headline and always appends a newline", () => {
    w.applyFieldData({ emoteBlessHeadlineText: "POGGERS" });
    const segments = w.buildEmoteBlessAnnouncementSegments(["alice"], 1);
    expect(segments[0].text).toBe("POGGERS\n");
    expect(w.formatEmoteBlessHeadline("")).toBe("Mustache man blesses the run\n");
    expect(w.formatEmoteBlessHeadline("Custom\n")).toBe("Custom\n");
  });
});

describe("handleChatMessage emote bless", () => {
  const emoteFieldData: FieldData = {
    emoteBlessEnabled: true,
    emoteBlessEmoteNamesCsv: "Kappa",
    emoteBlessWindowSeconds: 120,
    emoteBlessRequiredMatches: 2,
  };

  it("increments bless after enough matching emotes in the window", async () => {
    const state = makeState();
    const { w, mockSEAPI } = setupTestDOM(state);
    w.applyFieldData(emoteFieldData);
    w.animateOverlayTypewriter = jest.fn().mockResolvedValue(undefined);

    const makeMessageDetail = (displayName: string, emoteName: string): SEEventDetail => ({
      listener: "message",
      event: {
        data: {
          displayName,
          userId: displayName,
          emotes: [{ name: emoteName }],
          text: emoteName,
        },
      },
    });

    w.handleChatMessage(makeMessageDetail("alice", "Kappa"));
    w.handleChatMessage(makeMessageDetail("bob", "Kappa"));
    await flushPromises();
    await flushPromises();

    const saved = mockSEAPI.store._data["blessCurseMeterState"];
    expect(saved?.current.numberOfBlesses).toBe(1);
    expect(w.animateOverlayTypewriter).toHaveBeenCalled();
  });

  it("ignores chat when the feature is disabled", async () => {
    const state = makeState();
    const { w, mockSEAPI } = setupTestDOM(state);
    w.applyFieldData({ ...emoteFieldData, emoteBlessEnabled: false });

    w.handleChatMessage({
      listener: "message",
      event: { data: { displayName: "alice", emotes: [{ name: "Kappa" }] } },
    });
    w.handleChatMessage({
      listener: "message",
      event: { data: { displayName: "bob", emotes: [{ name: "Kappa" }] } },
    });
    await flushPromises();

    expect(mockSEAPI.store._data["blessCurseMeterState"]?.current.numberOfBlesses).toBe(0);
  });

  it("does not trigger again until the cooldown elapses", async () => {
    const state = makeState();
    const { w, mockSEAPI } = setupTestDOM(state);
    const now = jest.spyOn((w as unknown as { Date: DateConstructor }).Date, "now");
    now.mockReturnValue(1_000_000);
    try {
      w.applyFieldData({ ...emoteFieldData, emoteBlessCooldownSeconds: 300 });
      w.animateOverlayTypewriter = jest.fn().mockResolvedValue(undefined);

      const makeMessageDetail = (displayName: string): SEEventDetail => ({
        listener: "message",
        event: {
          data: {
            displayName,
            userId: displayName,
            emotes: [{ name: "Kappa" }],
            text: "Kappa",
          },
        },
      });

      w.handleChatMessage(makeMessageDetail("alice"));
      w.handleChatMessage(makeMessageDetail("bob"));
      await flushPromises();
      await flushPromises();
      expect(mockSEAPI.store._data["blessCurseMeterState"]?.current.numberOfBlesses).toBe(1);

      w.handleChatMessage(makeMessageDetail("carol"));
      w.handleChatMessage(makeMessageDetail("dave"));
      await flushPromises();
      await flushPromises();
      expect(mockSEAPI.store._data["blessCurseMeterState"]?.current.numberOfBlesses).toBe(1);

      now.mockReturnValue(1_000_000 + 299_000);
      w.handleChatMessage(makeMessageDetail("erin"));
      w.handleChatMessage(makeMessageDetail("frank"));
      await flushPromises();
      await flushPromises();
      expect(mockSEAPI.store._data["blessCurseMeterState"]?.current.numberOfBlesses).toBe(1);

      now.mockReturnValue(1_000_000 + 300_000);
      w.handleChatMessage(makeMessageDetail("gina"));
      w.handleChatMessage(makeMessageDetail("hank"));
      await flushPromises();
      await flushPromises();
      expect(mockSEAPI.store._data["blessCurseMeterState"]?.current.numberOfBlesses).toBe(2);
    } finally {
      now.mockRestore();
    }
  });
});

// ===========================================================================
// Background theme toggle (FFVI <-> Chrono Trigger)
// ===========================================================================
describe("background theme", () => {
  const themeClass = "theme-ct";
  const themeButtonText = (w: Window) => w.document.getElementById("background-theme-toggle")?.textContent;
  const hasCtTheme = (w: Window) => w.document.body.classList.contains(themeClass);

  describe("normalizeBackgroundTheme", () => {
    it("passes through the Chrono Trigger theme", () => {
      const { w } = setupTestDOM();
      expect(w.normalizeBackgroundTheme("ct")).toBe("ct");
    });

    it("falls back to ffvi for unknown, missing, or malformed values", () => {
      const { w } = setupTestDOM();
      expect(w.normalizeBackgroundTheme("ffvi")).toBe("ffvi");
      expect(w.normalizeBackgroundTheme(undefined)).toBe("ffvi");
      expect(w.normalizeBackgroundTheme(null)).toBe("ffvi");
      expect(w.normalizeBackgroundTheme("chrono")).toBe("ffvi");
      expect(w.normalizeBackgroundTheme(7)).toBe("ffvi");
    });
  });

  describe("getBackgroundTheme", () => {
    it("defaults to ffvi for states saved before the theme existed", () => {
      const { w } = setupTestDOM();
      expect(w.getBackgroundTheme(makeState())).toBe("ffvi");
      expect(w.getBackgroundTheme(null)).toBe("ffvi");
    });

    it("reads ct from state", () => {
      const { w } = setupTestDOM();
      expect(w.getBackgroundTheme(makeState({ backgroundTheme: "ct" }))).toBe("ct");
    });
  });

  describe("applyBackgroundTheme", () => {
    it("adds the body class and labels the button FF6 for ct", () => {
      const { w } = setupTestDOM();

      w.applyBackgroundTheme("ct");

      expect(hasCtTheme(w)).toBe(true);
      expect(themeButtonText(w)).toBe("FF6");
    });

    it("removes the body class and labels the button CT for ffvi", () => {
      const { w } = setupTestDOM();
      w.applyBackgroundTheme("ct");

      w.applyBackgroundTheme("ffvi");

      expect(hasCtTheme(w)).toBe(false);
      expect(themeButtonText(w)).toBe("CT");
    });

    it("treats an unknown theme as ffvi", () => {
      const { w } = setupTestDOM();
      w.applyBackgroundTheme("ct");

      w.applyBackgroundTheme("nonsense");

      expect(hasCtTheme(w)).toBe(false);
    });
  });

  describe("toggleBackgroundThemeState", () => {
    it("persists ct when the stored theme is ffvi", async () => {
      const { w, mockSEAPI } = setupTestDOM(makeState());

      w.toggleBackgroundThemeState();
      await flushPromises();

      expect(mockSEAPI.store._data["blessCurseMeterState"]?.backgroundTheme).toBe("ct");
    });

    it("persists ffvi when the stored theme is ct", async () => {
      const { w, mockSEAPI } = setupTestDOM(makeState({ backgroundTheme: "ct" }));

      w.toggleBackgroundThemeState();
      await flushPromises();

      expect(mockSEAPI.store._data["blessCurseMeterState"]?.backgroundTheme).toBe("ffvi");
    });

    it("leaves the run counters untouched", async () => {
      const state = makeState();
      state.current.numberOfBlesses = 4;
      state.allTime.numberOfBlesses = 9;
      const { w, mockSEAPI } = setupTestDOM(state);

      w.toggleBackgroundThemeState();
      await flushPromises();

      const saved = mockSEAPI.store._data["blessCurseMeterState"];
      expect(saved?.current.numberOfBlesses).toBe(4);
      expect(saved?.allTime.numberOfBlesses).toBe(9);
    });
  });

  describe("updateDisplay", () => {
    it("applies the theme carried by the rendered state", async () => {
      const { w } = setupTestDOM(makeState());

      w.updateDisplay(makeState({ backgroundTheme: "ct" }), false);
      await flushPromises();

      expect(hasCtTheme(w)).toBe(true);
      expect(themeButtonText(w)).toBe("FF6");
    });

    it("switches back when a later state carries ffvi", async () => {
      const { w } = setupTestDOM(makeState());
      w.updateDisplay(makeState({ backgroundTheme: "ct" }), false);
      await flushPromises();

      w.updateDisplay(makeState(), false);
      await flushPromises();

      expect(hasCtTheme(w)).toBe(false);
    });
  });

  describe("persistence across resets", () => {
    it("keeps the theme through resetCurrentState", async () => {
      const { w, mockSEAPI } = setupTestDOM(makeState({ backgroundTheme: "ct" }));

      w.resetCurrentState();
      await flushPromises();

      expect(mockSEAPI.store._data["blessCurseMeterState"]?.backgroundTheme).toBe("ct");
    });

    it("keeps the theme through resetAllTimeState", async () => {
      const { w, mockSEAPI } = setupTestDOM(makeState({ backgroundTheme: "ct" }));
      // resetAllTimeState reads the theme from the last rendered state.
      w.updateDisplay(makeState({ backgroundTheme: "ct" }), false);
      await flushPromises();

      w.resetAllTimeState();
      await flushPromises();

      expect(mockSEAPI.store._data["blessCurseMeterState"]?.backgroundTheme).toBe("ct");
    });

    it("keeps the theme when both meters max out and the run resets", async () => {
      const state = makeState({ backgroundTheme: "ct" });
      state.current.numberOfBlesses = 15;
      state.current.numberOfCurses = 15;
      const { w, mockSEAPI } = setupTestDOM(state);

      w.incrementState("numberOfBlesses", "alice");
      await flushPromises();

      expect(mockSEAPI.store._data["blessCurseMeterState"]?.backgroundTheme).toBe("ct");
    });
  });
});

// ===========================================================================
// Redemption announcement de-duplication (lastRedemption.id)
// ===========================================================================
describe("redemption announcement de-duplication", () => {
  const isAnnouncementVisible = (w: Window) =>
    w.document.querySelector(".redemption-announcement")?.classList.contains("visible");

  const savedState = (mockSEAPI: MockSEAPI) => mockSEAPI.store._data["blessCurseMeterState"]!;

  it("stamps a fresh announcement id on a recorded redemption", async () => {
    const { w, mockSEAPI } = setupTestDOM(makeState());

    w.incrementState("numberOfBlesses", "alice");
    await flushPromises();

    expect(w.getRedemptionAnnouncementId(savedState(mockSEAPI))).toEqual(expect.any(String));
  });

  it("does not stamp an id when recordRedemption is false", async () => {
    const { w, mockSEAPI } = setupTestDOM(makeState());

    w.incrementState("numberOfBlesses", "alice", { recordRedemption: false });
    await flushPromises();

    expect(w.getRedemptionAnnouncementId(savedState(mockSEAPI))).toBeNull();
    w.updateDisplay(savedState(mockSEAPI), true);
    await flushPromises();
    expect(isAnnouncementVisible(w)).toBe(false);
  });

  it("announces only once when the same redemption is rendered twice", async () => {
    const { w, mockSEAPI } = setupTestDOM(makeState());
    w.incrementState("numberOfBlesses", "alice");
    await flushPromises();
    const state = savedState(mockSEAPI);

    jest.useFakeTimers();
    try {
      w.updateDisplay(state, true);
      await flushMicrotasks();
      expect(isAnnouncementVisible(w)).toBe(true);
      await jest.runAllTimersAsync();
      await flushMicrotasks();

      // A second kvstore:update carrying the same redemption must not replay it.
      w.updateDisplay(state, true);
      await flushMicrotasks();
      expect(isAnnouncementVisible(w)).toBe(false);
      await jest.runAllTimersAsync();
    } finally {
      jest.useRealTimers();
    }
  });

  it("still announces the next redemption after a non-recorded increment resets the meters", async () => {
    const state = makeState({ lastRedemption: makeLastRedemption() });
    state.current.numberOfBlesses = 15;
    state.current.numberOfCurses = 15;
    const { w, mockSEAPI } = setupTestDOM(state);

    // Emote bless tips both meters to max, which swallows its own announcement.
    w.incrementState("numberOfBlesses", "alice", { recordRedemption: false });
    await flushPromises();

    w.incrementState("numberOfBlesses", "bob");
    await flushPromises();

    jest.useFakeTimers();
    try {
      w.updateDisplay(savedState(mockSEAPI), true);
      await flushMicrotasks();
      expect(isAnnouncementVisible(w)).toBe(true);
      await jest.runAllTimersAsync();
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not replay a stored redemption on widget load", async () => {
    const { w, mockSEAPI } = setupTestDOM(makeState());
    w.incrementState("numberOfBlesses", "alice");
    await flushPromises();
    expect(w.getRedemptionAnnouncementId(savedState(mockSEAPI))).toEqual(expect.any(String));

    const loadEvent = new (w as unknown as { CustomEvent: typeof CustomEvent }).CustomEvent("onWidgetLoad", {
      detail: { fieldData: { reportsShouldDisplay: false, numberOfSecondsBetweenReports: 0 } },
    });
    w.widgetLoadHandler(loadEvent);
    await flushPromises();

    expect(isAnnouncementVisible(w)).toBe(false);
    w.stopPeriodicReports();
  });
});

// ===========================================================================
// applyFieldData / periodic reports
// ===========================================================================
describe("applyFieldData", () => {
  let w: Window;

  beforeEach(() => {
    ({ w } = setupTestDOM());
    w.stopPeriodicReports();
  });

  afterEach(() => {
    w.stopPeriodicReports();
  });

  it("applies redemptionTypewriterHoldSeconds to the post-typewriter pause", async () => {
    const { w } = setupTestDOM(makeState());
    w.applyFieldData({ redemptionTypewriterHoldSeconds: 2.5 });
    const waitSpy = jest
      .spyOn(w as Window & { waitMs: (ms: number) => Promise<void> }, "waitMs")
      .mockResolvedValue(undefined);
    jest.spyOn(w, "typewriterSegments").mockResolvedValue(undefined);

    await w.animateOverlayTypewriter([{ text: "hold test" }]);

    expect(waitSpy).toHaveBeenCalledWith(2500);
    waitSpy.mockRestore();
  });

  it("applies showRedemptionAnnouncements and report timing settings", async () => {
    w.applyFieldData({
      showRedemptionAnnouncements: false,
      numberOfSecondsBetweenReports: 45,
      reportsShouldDisplay: false,
    });
    const state = makeState({ lastRedemption: makeLastRedemption() });
    w.updateDisplay(state, true, true);
    await flushPromises();
    expect(w.document.querySelector(".redemption-announcement")?.classList.contains("visible")).toBe(false);
  });
});

describe("periodic top-redeemer reports", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not enqueue reports when reportsShouldDisplay is false", async () => {
    jest.useFakeTimers();
    try {
      const state = makeState({
        redemptionHistory: { alice: makeRedemptionHistoryEntry({ numberOfBlesses: 1 }) },
      });
      const { w } = setupTestDOM(state);
      w.applyFieldData({ reportsShouldDisplay: false, numberOfSecondsBetweenReports: 10 });
      w.incrementState("numberOfBlesses", "alice");
      await flushMicrotasks();

      jest.advanceTimersByTime(10_000);
      await flushMicrotasks();

      expect(w.document.querySelector(".redemption-announcement")?.classList.contains("visible")).toBe(false);
      w.stopPeriodicReports();
    } finally {
      jest.useRealTimers();
    }
  });

  it("enqueues a forced report even when reportsShouldDisplay is false", async () => {
    const state = makeState({
      redemptionHistory: { alice: makeRedemptionHistoryEntry({ numberOfBlesses: 2 }) },
    });
    const { w } = setupTestDOM(state);
    w.stopPeriodicReports();
    w.applyFieldData({ reportsShouldDisplay: false, numberOfSecondsBetweenReports: 0 });
    w.incrementState("numberOfBlesses", "alice");
    await flushPromises();

    w.enqueuePeriodicReportCycle(true);
    await flushMicrotasks();

    const announcement = w.document.querySelector(".redemption-announcement");
    expect(announcement?.classList.contains("visible")).toBe(true);
    expect(announcement?.classList.contains("is-headline")).toBe(true);
    w.stopPeriodicReports();
  });

  it("enqueues the first top-redeemer overlay when a report cycle starts", async () => {
    const state = makeState({
      redemptionHistory: {
        alice: makeRedemptionHistoryEntry({ numberOfBlesses: 5 }),
        bob: makeRedemptionHistoryEntry({ numberOfCurses: 3 }),
        carol: makeRedemptionHistoryEntry({ numberOfBlurses: 2 }),
      },
    });
    const { w } = setupTestDOM(state);
    w.stopPeriodicReports();
    w.incrementState("numberOfBlesses", "alice");
    await flushPromises();

    w.enqueuePeriodicReportCycle();
    await flushMicrotasks();

    expect(w.document.querySelector(".redemption-announcement")?.classList.contains("visible")).toBe(true);
    expect(w.document.querySelector(".meter-panel-content")?.classList.contains("hidden")).toBe(true);
    w.stopPeriodicReports();
  });

  it("temporarily shows all-time meters during a report cycle without persisting showAll", async () => {
    jest.useFakeTimers();
    try {
      const state = makeState({
        current: {
          numberOfBlesses: 2,
          numberOfCurses: 1,
          numberOfBlurses: 0,
          numberOfBlursesThatCursed: 0,
          numberOfBlursesThatBlessed: 0,
          numberOfBlessesPreReset: 0,
          numberOfCursesPreReset: 0,
          numberOfBlursesPreReset: 0,
          numberOfBlursesThatCursedPreReset: 0,
          numberOfBlursesThatBlessedPreReset: 0,
        },
        allTime: {
          numberOfBlesses: 20,
          numberOfCurses: 10,
          numberOfBlurses: 0,
          numberOfBlursesThatCursed: 0,
          numberOfBlursesThatBlessed: 0,
        },
        showAll: false,
      });
      const { w, mockSEAPI } = setupTestDOM(state);
      w.stopPeriodicReports();
      w.incrementState("numberOfBlesses", "alice");
      await flushMicrotasks();

      w.enqueuePeriodicReportCycle();
      await jest.runAllTimersAsync();
      await flushMicrotasks();

      expect(w.document.querySelector("#all-time-toggle")?.textContent).toBe("Show all");
      expect(mockSEAPI.store._data["blessCurseMeterState"]?.showAll).not.toBe(true);
      w.stopPeriodicReports();
    } finally {
      jest.useRealTimers();
    }
  }, 30_000);

  it("runs the report cycle on the configured interval", async () => {
    jest.useFakeTimers();
    try {
      const state = makeState({
        redemptionHistory: { alice: makeRedemptionHistoryEntry({ numberOfBlesses: 2 }) },
      });
      const { w } = setupTestDOM(state);
      w.stopPeriodicReports();
      w.applyFieldData({ reportsShouldDisplay: true, numberOfSecondsBetweenReports: 30 });
      w.incrementState("numberOfBlesses", "alice");
      await flushMicrotasks();

      jest.advanceTimersByTime(30_000);
      await flushMicrotasks();
      expect(w.document.querySelector(".redemption-announcement")?.classList.contains("visible")).toBe(true);
      w.stopPeriodicReports();
    } finally {
      jest.useRealTimers();
    }
  });
});
