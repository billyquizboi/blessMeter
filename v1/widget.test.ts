/**
 * Tests for the curse meter widget.
 *
 * Strategy: JSDOM loads v1/widget.html, real jQuery is injected, SE_API is
 * mocked, then the compiled v1/widget.js is eval'd into the window.  Because
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
const JQUERY_PATH = path.resolve(
  __dirname,
  "..",
  "node_modules",
  "jquery",
  "dist",
  "jquery.js"
);


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
    animateGlowForever: GlowFn;
    endGlowForever: GlowFn;
    toggleAllTime: NoArgVoidFunction;
    // Predicates
    storeHasBeenInitialized: StoreHasBeenInitializedFn;
    canIncrement: CanIncrementFn;
    bothMetersAreAtMax: BothMetersAreAtMaxFn;
    isShowingAll: IsShowingAllFn;
    // Pure value functions
    getRedemptionName: GetRedemptionNameFn;
    getOrDefaultCount: GetOrDefaultCountFn;
    getCountFromState: GetCountFromStateFn;
    gletGlowForeverClass: GletGlowForeverClassFn;
    mockRedeemEvent: MockRedeemEventFn;
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
  w: Window; // eslint-disable-line @typescript-eslint/no-explicit-any
}

function setupTestDOM(initialState?: WidgetState): TestEnv {
  const mockSEAPI = createMockSEAPI(initialState);

  const htmlContent = fs.readFileSync(WIDGET_HTML_PATH, "utf-8");
  const jqueryContent = fs.readFileSync(JQUERY_PATH, "utf-8");
  const widgetContent = fs.readFileSync(WIDGET_JS_PATH, "utf-8");

  const dom = new JSDOM(htmlContent, { runScripts: "dangerously" });

  // JSDOM does not implement the Web Animations API (WAAPI); mock it so
  // animateChange() does not throw when calling ele.animate().
  (dom.window.Element.prototype as any).animate = jest.fn();

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

  return { dom, mockSEAPI, w: dom.window as any as Window };
}

/** Flush the microtask queue so Promise .then() callbacks have run. */
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

// ---------------------------------------------------------------------------
// Shared initial state fixture
// ---------------------------------------------------------------------------
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
    expect(
      w.resetMetersButKeepCurrentState({ allTime: {}, showAll: false } as any as WidgetState)
    ).toBeUndefined();
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
    expect(result!.current.numberOfCursesPreReset).toBe(2 + 6);  // 8
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
    expect(result!.current.numberOfBlursesThatCursedPreReset).toBe(0 + 2);  // 2
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
});

// ===========================================================================
// toggleShowAllState — async SE_API interaction
// ===========================================================================
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
});

// ===========================================================================
// resetCurrentState — async SE_API interaction
// ===========================================================================
describe("resetCurrentState", () => {
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
