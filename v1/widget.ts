const blurseTheRun = "Blurse the Run";
const blessTheRun = "Bless the Run";
const curseTheRun = "Curse the Run";

const glowForeverClass = "animated-glow";
const curseGlowForeverClass = "animated-curse-glow";

const TYPE_BLESS = "bless";
const TYPE_CURSE = "curse";
const TYPE_BLURSE = "blurse";

/** Final Fantasy VI styled dialogue window, the widget's original look. */
const THEME_FFVI = "ffvi";
/** Chrono Trigger styled dialogue window. */
const THEME_CT = "ct";
/** Added to <body> to select {@link THEME_CT}; absent means {@link THEME_FFVI}. */
const CT_THEME_BODY_CLASS = "theme-ct";

const StateKeys = {
  numberOfBlesses: "numberOfBlesses",
  numberOfCurses: "numberOfCurses",
  numberOfBlurses: "numberOfBlurses",
  numberOfBlursesThatCursed: "numberOfBlursesThatCursed",
  numberOfBlursesThatBlessed: "numberOfBlursesThatBlessed",
  numberOfBlessesPreReset: "numberOfBlessesPreReset",
  numberOfCursesPreReset: "numberOfCursesPreReset",
  numberOfBlursesPreReset: "numberOfBlursesPreReset",
  numberOfBlursesThatCursedPreReset: "numberOfBlursesThatCursedPreReset",
  numberOfBlursesThatBlessedPreReset: "numberOfBlursesThatBlessedPreReset",
  redemptionHistory: "redemptionHistory",
  lastRedemption: "lastRedemption",
} as const;

// Lines 25–50 in original: object literal + separate lastUpdated assignment merged here
const initialWidgetState: WidgetState = {
  current: {
    // primary functionality fields
    numberOfBlesses: 0,
    numberOfCurses: 0,
    numberOfBlurses: 0,
    numberOfBlursesThatCursed: 0,
    numberOfBlursesThatBlessed: 0,
    // resetFunctionalityRelatedFields
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
  backgroundTheme: THEME_FFVI,
  lastUpdated: new Date(),
  redemptionHistory: {},
};

const STORE_KEY_NAME = "blessCurseMeterState";

const ATTRIBUTE_SHOW_ALL = "showAll" as const;

const ATTRIBUTE_BACKGROUND_THEME = "backgroundTheme" as const;

const animationDuration = 1000;
const shortAnimationDuration = 1;
const redemptionLetterDelayMs = 45;
/** Pause after typewriter finishes; overridden by {@link applyFieldData}. */
let redemptionHoldAfterTypeMs = 600;
const reportAllTimeHoldMs = 2000;
const topRedeemerLimit = 3;

type TopRedeemerCategory = "bless" | "curse" | "blurse";

let meterMaximum = 15;
let showChars = true;
let showRedemptionAnnouncements = true;
let numberOfSecondsBetweenReports = 90;
let reportsShouldDisplay = true;

let emoteBlessEnabled = false;
let emoteBlessEmoteNamesCsv = "Kappa,PogChamp";
let emoteBlessWindowSeconds = 120;
let emoteBlessRequiredMatches = 5;
let emoteBlessCooldownSeconds = 300;
let emoteBlessHeadlineText = "Mustache man blesses the run";
let trackedEmoteNamesLower = new Set<string>();

interface EmoteWindowEntry {
  timestamp: number;
  userId: string;
  displayName: string;
  emoteName: string;
}

let emoteWindowEntries: EmoteWindowEntry[] = [];
/** Timestamp of the last successful emote-bless trigger; 0 means never fired. */
let lastEmoteBlessTriggeredAt = 0;

let lastWidgetState: WidgetState | null = null;

/**
 * Id of the most recently announced redemption. Announcement intent travels
 * inside the persisted state via {@link LastRedemption.id} rather than through
 * a module-level flag, so whichever `kvstore:update` renders a redemption
 * announces it exactly once regardless of event ordering.
 */
let lastAnnouncedRedemptionId: string | null = null;

let redemptionIdCounter = 0;

let periodicReportTimerId: ReturnType<typeof setInterval> | null = null;

/**
 * Runs enqueued async tasks one at a time, in order — each task completes
 * before the next one starts. Errors are caught and logged so a failed task
 * doesn't stall the queue for later entries.
 */
class SequentialQueue {
  private tail: Promise<unknown> = Promise.resolve();

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(() => task());
    this.tail = result.catch((err) => {
      console.error("Queued display task failed:", err);
    });
    return result;
  }
}

const displayQueue = new SequentialQueue();

/**
 * Serializes SE_API.store get-modify-set work so overlapping redemptions
 * (for example a harness burst with gap 0) cannot read the same snapshot
 * and overwrite each other's increments.
 */
const storeMutationQueue = new SequentialQueue();

/** Returns the jQuery-wrapped meter fill element for the bless meter. */
function getBlessMeterFill(): JQuery<HTMLElement> {
  return $("div.bless-container div.meter div.meter-fill");
}

/** Returns the jQuery-wrapped meter fill element for the curse meter. */
function getCurseMeterFill(): JQuery<HTMLElement> {
  return $("div.curse-container div.meter div.meter-fill");
}

/** Returns the jQuery-wrapped bless character SVG element. */
function getBlessSvg(): JQuery<HTMLElement> {
  return $("svg.bless-svg");
}

/** Returns the jQuery-wrapped curse character SVG element. */
function getCurseSvg(): JQuery<HTMLElement> {
  return $("svg.curse-svg");
}

/**
 * Returns a jQuery-wrapped blurse character SVG element chosen at random
 * from the 9 available blurse SVGs.
 */
function getBlurseSvg(): JQuery<HTMLElement> {
  // if number of blurse SVGs changes this '9' would have to change
  const randInt = Math.floor(Math.random() * 9) + 1;
  return $(`svg.blurse-svg-${randInt}`);
}

/**
 * Attempts to load the last saved widget state from SE_API.store into
 * {@link lastWidgetState}. Falls back to {@link initialWidgetState} if the
 * store returns null. Called once at module load time.
 */
function initializeLastWidgetState(): void {
  console.log("Trying to initialize last widget state");
  try {
    SE_API.store.get(STORE_KEY_NAME).then((obj) => {
      lastWidgetState = obj;
    });
  } catch (error) {
    console.log(`Received error ${error}`);
  }
  if (lastWidgetState == null) {
    lastWidgetState = initialWidgetState;
  }
}

initializeLastWidgetState();

/**
 * Toggles the {@link ATTRIBUTE_SHOW_ALL} flag in SE_API.store between true
 * and false. Initializes state to {@link initialWidgetState} if the store has
 * not yet been set up. SE_API.store.set emits a kvstore:update event which
 * triggers {@link updateDisplay}.
 */
function toggleShowAllState(): void {
  console.log(`Toggling state showAll`);
  SE_API.store.get(STORE_KEY_NAME).then((obj) => {
    console.log(`Toggling showAll: Retrieved widgetState from store is: ${JSON.stringify(obj)}`);
    if (!storeHasBeenInitialized(obj)) {
      console.log(`Toggling state showAll: The store object has not yet been initialized. Setting up initial values.`);
      obj = initialWidgetState;
    }
    obj.lastUpdated = new Date();
    if (obj[ATTRIBUTE_SHOW_ALL] == undefined) {
      obj[ATTRIBUTE_SHOW_ALL] = true;
    } else {
      obj[ATTRIBUTE_SHOW_ALL] = !obj[ATTRIBUTE_SHOW_ALL];
    }
    SE_API.store.set(STORE_KEY_NAME, obj);
    // the SE.store.set function emits an onEventReceived for every custom widget
    lastWidgetState = obj;
  });
}

/**
 * Increments the named counter in both {@link WidgetState.current} and
 * {@link WidgetState.allTime} and persists the updated state via SE_API.store.
 * When {@link StateKeys.numberOfBlurses} is incremented, also randomly
 * increments either {@link StateKeys.numberOfBlursesThatBlessed} or
 * {@link StateKeys.numberOfBlursesThatCursed} (50/50 chance).
 * If both meters have reached {@link meterMaximum}, the current counters are
 * rolled into the preReset fields via {@link resetMetersButKeepCurrentState}
 * before saving.
 * @param toIncrement - A {@link StateKeys} value identifying the counter to increment.
 */
function incrementState(
  toIncrement: string,
  user: string | RedemptionUserRef | null,
  options?: IncrementStateOptions
): void {
  console.log(`Incrementing ${toIncrement}`);
  const userRef = resolveRedemptionUserRef(user);
  const trackingKey = userRef?.trackingKey ?? null;
  const recordRedemption = options?.recordRedemption ?? true;
  void storeMutationQueue.enqueue(() =>
    SE_API.store.get(STORE_KEY_NAME).then((obj) => {
      console.log(`Retrieved widgetState from store is: ${JSON.stringify(obj)}`);
      if (storeHasBeenInitialized(obj)) {
        if (!canIncrement(obj, toIncrement)) {
          console.log(
            `Store has been initialized but cannot increment so something is wrong. Defaulting ${toIncrement} to 0 I guess.`
          );
          (obj.current as Record<string, number>)[toIncrement] = 0;
          obj.allTime[toIncrement] = 0;
        }
      } else {
        console.log("The store object has not yet been initialized. Setting up initial values.");
        obj = initialWidgetState;
      }
      const redemptionHistoryKey = StateKeys.redemptionHistory;
      if (obj[redemptionHistoryKey] == null) {
        console.log("Initializing redemptionHistory  object");
        obj[redemptionHistoryKey] = {};
      }
      if (trackingKey != null) {
        if (obj[redemptionHistoryKey][trackingKey] == null) {
          console.log("Initializing redemptionHistory for user " + trackingKey);
          obj[redemptionHistoryKey][trackingKey] = createEmptyRedemptionHistoryEntry(userRef!.displayName);
        } else {
          obj[redemptionHistoryKey][trackingKey] = normalizeRedemptionHistoryEntry(
            obj[redemptionHistoryKey][trackingKey]
          );
          applyRedemptionHistoryDisplayName(obj[redemptionHistoryKey][trackingKey], userRef!.displayName);
        }
      }

      // stores info on the user who redeemed
      let charType: string | undefined = undefined;
      let meterTarget: string | undefined = undefined;
      let meterAmount: number | undefined = undefined;

      // handles blurses
      if (toIncrement == StateKeys.numberOfBlurses) {
        charType = TYPE_BLURSE;
        if (Math.random() < 0.5) {
          // blessed af
          optionallyInitializeNumericField(obj, StateKeys.numberOfBlursesThatBlessed);
          (obj.current as Record<string, number>)[StateKeys.numberOfBlursesThatBlessed] += 1;
          obj.allTime[StateKeys.numberOfBlursesThatBlessed] += 1;
          meterTarget = TYPE_BLESS;
          meterAmount = 2;
        } else {
          // curse it bby
          optionallyInitializeNumericField(obj, StateKeys.numberOfBlursesThatCursed);
          (obj.current as Record<string, number>)[StateKeys.numberOfBlursesThatCursed] += 1;
          obj.allTime[StateKeys.numberOfBlursesThatCursed] += 1;
          meterTarget = TYPE_CURSE;
          meterAmount = 2;
        }

        if (trackingKey != null && obj[redemptionHistoryKey][trackingKey] != null) {
          console.log("Incrementing blurses for user " + trackingKey);
          const userEntry = obj[redemptionHistoryKey][trackingKey];
          userEntry.numberOfBlurses = getOrDefaultCount(userEntry.numberOfBlurses) + 1;
          if (meterTarget === TYPE_BLESS) {
            userEntry.numberOfBlursesThatBlessed = getOrDefaultCount(userEntry.numberOfBlursesThatBlessed) + 1;
          } else {
            userEntry.numberOfBlursesThatCursed = getOrDefaultCount(userEntry.numberOfBlursesThatCursed) + 1;
          }
        }
      }
      (obj.current as Record<string, number>)[toIncrement] += 1;
      obj.allTime[toIncrement] += 1;
      obj.lastUpdated = new Date();

      if (trackingKey != null && obj[redemptionHistoryKey][trackingKey] != null) {
        if (toIncrement == StateKeys.numberOfBlesses) {
          console.log("Incrementing blesses for user " + trackingKey);
          obj[redemptionHistoryKey][trackingKey][StateKeys.numberOfBlesses] =
            obj[redemptionHistoryKey][trackingKey]["numberOfBlesses"] + 1;
          charType = TYPE_BLESS;
          meterTarget = TYPE_BLESS;
          meterAmount = 1;
        } else if (toIncrement == StateKeys.numberOfCurses) {
          console.log("Incrementing curses for user " + trackingKey);
          obj[redemptionHistoryKey][trackingKey][StateKeys.numberOfCurses] =
            obj[redemptionHistoryKey][trackingKey]["numberOfCurses"] + 1;
          charType = TYPE_CURSE;
          meterTarget = TYPE_CURSE;
          meterAmount = 1;
        }
      }

      // Reusing this id on the new lastRedemption marks it as already announced.
      const previousRedemptionId = getRedemptionAnnouncementId(obj);
      const metersReset = bothMetersAreAtMax(obj);

      if (
        recordRedemption &&
        userRef != null &&
        meterTarget != undefined &&
        meterAmount != undefined &&
        charType != undefined
      ) {
        obj["lastRedemption"] = {
          redeemingUser: userRef.displayName,
          charType: charType,
          meterTarget: meterTarget,
          meterAmount: meterAmount,
          // A reset swallows the announcement, so keep the prior id instead
          // of minting one that would read as "not yet announced".
          id: metersReset ? previousRedemptionId : createRedemptionId(),
        };
      }

      if (metersReset) {
        const newState = resetMetersButKeepCurrentState(obj);
        if (newState) {
          lastWidgetState = newState;
          return SE_API.store.set(STORE_KEY_NAME, newState);
        }
        lastWidgetState = obj;
        return;
      }
      lastWidgetState = obj;
      // the SE.store.set function emits an onEventReceived for every custom widget
      return SE_API.store.set(STORE_KEY_NAME, obj);
    })
  );
}

/**
 * Builds a new {@link WidgetState} where all current counters are zeroed and
 * the previous current counts are accumulated into the corresponding preReset
 * fields. allTime counts and showAll are preserved unchanged.
 * Returns undefined if the supplied state is invalid.
 * @param widgetState - The state to reset.
 * @returns The new zeroed state, or undefined if widgetState is invalid.
 */
function resetMetersButKeepCurrentState(widgetState: WidgetState): WidgetState | undefined {
  // Original used bitwise | (bug: should be ||). Behavior is identical for boolean
  // operands but || is required here for TypeScript strict mode compatibility.
  if (!widgetState || widgetState.current == undefined) {
    console.log(`Passed invalid widget state! Cannot reset meters and keep state ${widgetState}`);
    return;
  }

  const numberOfBlesses = getOrDefaultCount(widgetState.current[StateKeys.numberOfBlesses]);
  const numberOfCurses = getOrDefaultCount(widgetState.current[StateKeys.numberOfCurses]);
  const numberOfBlurses = getOrDefaultCount(widgetState.current[StateKeys.numberOfBlurses]);
  const numberOfBlursesThatBlessed = getOrDefaultCount(widgetState.current[StateKeys.numberOfBlursesThatBlessed]);
  const numberOfBlursesThatCursed = getOrDefaultCount(widgetState.current[StateKeys.numberOfBlursesThatCursed]);

  const numberOfBlessesPreReset =
    getOrDefaultCount(widgetState.current[StateKeys.numberOfBlessesPreReset]) + numberOfBlesses;
  const numberOfCursesPreReset =
    getOrDefaultCount(widgetState.current[StateKeys.numberOfCursesPreReset]) + numberOfCurses;
  const numberOfBlursesPreReset =
    getOrDefaultCount(widgetState.current[StateKeys.numberOfBlursesPreReset]) + numberOfBlurses;
  const numberOfBlursesThatBlessedPreReset =
    getOrDefaultCount(widgetState.current[StateKeys.numberOfBlursesThatBlessedPreReset]) + numberOfBlursesThatBlessed;
  const numberOfBlursesThatCursedPreReset =
    getOrDefaultCount(widgetState.current[StateKeys.numberOfBlursesThatCursedPreReset]) + numberOfBlursesThatCursed;

  // Structured as a complete WidgetState literal for TypeScript type safety.
  // Original built this incrementally via property assignments.
  const newState: WidgetState = {
    lastUpdated: new Date(),
    allTime: widgetState.allTime,
    showAll: widgetState.showAll,
    backgroundTheme: getBackgroundTheme(widgetState),
    redemptionHistory: widgetState.redemptionHistory,
    lastRedemption: widgetState.lastRedemption,
    current: {
      [StateKeys.numberOfBlesses]: 0,
      [StateKeys.numberOfCurses]: 0,
      [StateKeys.numberOfBlurses]: 0,
      [StateKeys.numberOfBlursesThatBlessed]: 0,
      [StateKeys.numberOfBlursesThatCursed]: 0,
      [StateKeys.numberOfBlessesPreReset]: numberOfBlessesPreReset,
      [StateKeys.numberOfCursesPreReset]: numberOfCursesPreReset,
      [StateKeys.numberOfBlursesPreReset]: numberOfBlursesPreReset,
      [StateKeys.numberOfBlursesThatBlessedPreReset]: numberOfBlursesThatBlessedPreReset,
      [StateKeys.numberOfBlursesThatCursedPreReset]: numberOfBlursesThatCursedPreReset,
    },
  };

  return newState;
}

/**
 * Type predicate. Returns true when {@link obj} is a fully initialized
 * {@link WidgetState} with both `current` and `allTime` properties present.
 * @param obj - The value to test.
 */
function storeHasBeenInitialized(obj: WidgetState | null): obj is WidgetState {
  return obj != undefined && obj.current != undefined && obj.allTime != undefined;
}

/**
 * Returns true when {@link obj} is a valid {@link WidgetState} and the named
 * field exists in both `current` and `allTime`, meaning it is safe to
 * increment without creating a NaN or undefined result.
 * @param obj - The widget state to check.
 * @param toIncrement - The field name to verify.
 */
function canIncrement(obj: WidgetState | null, toIncrement: string): boolean {
  return (
    obj != undefined &&
    obj.current != undefined &&
    obj.allTime != undefined &&
    obj.current[toIncrement] != undefined &&
    obj.allTime[toIncrement] != undefined
  );
}

/**
 * Ensures the named field exists as a numeric value in both
 * {@link WidgetState.current} and {@link WidgetState.allTime}.
 * If the field is missing or not a number it is set to 0.
 * Used to initialize blurse sub-fields before incrementing them.
 * @param obj - The widget state to mutate.
 * @param fieldName - The field to initialize if absent or non-numeric.
 */
function optionallyInitializeNumericField(obj: WidgetState, fieldName: string): void {
  if (obj.current[fieldName] == undefined || typeof obj.current[fieldName] !== "number") {
    (obj.current as Record<string, number>)[fieldName] = 0;
  }
  if (obj.allTime[fieldName] == undefined || typeof obj.allTime[fieldName] !== "number") {
    obj.allTime[fieldName] = 0;
  }
}

/**
 * Logs an incoming StreamElements window event. `JSON.stringify(event)` only
 * serializes DOM metadata (e.g. `isTrusted`); the payload is in `detail`.
 */
function logSeIncomingEvent(label: string, event: Event, detail?: SEEventDetail): void {
  const d = detail ?? (event as SECustomEvent).detail;
  const summary = d?.event != null ? { eventType: d.event.type, eventName: d.event.name } : d;
  console.log(`${label} type=${event.type} listener=${d?.listener ?? "?"}`, summary);
}

/**
 * Handles the StreamElements `onEventReceived` window event.
 * Routes the event to {@link handleRedemption} for channel point redemptions,
 * or calls {@link updateDisplay} when a `kvstore:update` signals that the
 * widget state has changed in the store.
 * @param event - The raw DOM event emitted by StreamElements.
 */
function eventReceivedHandler(event: Event): void {
  const obj = event as SECustomEvent;
  logSeIncomingEvent("Received onEventReceived", event);
  if (obj.detail == undefined) {
    console.log("obj.detail does not exist so exiting");
    return;
  }
  if (obj.detail.event == undefined || !obj.detail.event) {
    console.log("obj.detail.event does not exist so exiting");
    return;
  }
  if (typeof obj.detail.event.itemId !== "undefined") {
    console.log(`obj.detail.event.itemId ${obj.detail.event.itemId}`);
    obj.detail.listener = "redemption-latest";
  }
  let listener: string | undefined;
  if (obj.detail.listener == undefined) {
    console.log(`obj.detail.listener is undefined`);
    listener = undefined;
  } else {
    console.log(`obj.detail.listener is ${obj.detail.listener}`);
    listener = obj.detail.listener.split("-")[0];
    console.log(`Determined listener to be ${listener}`);
  }
  const detail = obj.detail;
  const seEvent = detail.event;

  if (listener != "redemption") {
    if (seEvent && seEvent.type === "channelPointsRedemption") {
      listener = "redemption";
    }
  }

  if (listener === "redemption") {
    console.log("Redemption message received");
    console.log(JSON.stringify(detail));
    handleRedemption(detail);
  } else if (detail.listener === "message") {
    handleChatMessage(detail);
  } else if (detail.listener === "kvstore:update") {
    logSeIncomingEvent("Key store was updated so update the widget display", event, detail);
    if (
      seEvent != undefined &&
      seEvent.data != undefined &&
      seEvent.data.key === STORE_KEY_NAME &&
      seEvent.data.value != undefined
    ) {
      console.log("Updating widget display");
      updateDisplay(seEvent.data.value, true);
    } else {
      console.log(
        `This kvstore update may be invalid or not for us but we are going to check current state anyway as a fallback. This was necessary during testing on SE site.`
      );
      logSeIncomingEvent("A different key store item was saved", event, detail);
      SE_API.store.get(STORE_KEY_NAME).then((state) => {
        console.log(`Retrieved widget state: ${JSON.stringify(state)}`);
        lastWidgetState = state;
        updateDisplay(state, true);
      });
    }
  } else {
    logSeIncomingEvent("Not doing anything with", event, detail);
    console.log(`detail payload ${JSON.stringify(detail)}`);
  }
}

window.addEventListener("onEventReceived", eventReceivedHandler);

/**
 * Handles the StreamElements `onWidgetLoad` window event.
 * Reads field configuration ({@link meterMaximum}, {@link showChars}) from
 * `fieldData`, then loads persisted state from SE_API.store to initialize the
 * display. If no prior state exists, saves {@link initialWidgetState} to the
 * store.
 * @param event - The raw DOM event emitted by StreamElements.
 */
function widgetLoadHandler(event: Event): void {
  const obj = event as SECustomEvent;
  // since we initialize from stored state we don't need to re-process recents
  if (obj.detail != null && obj.detail.fieldData != null) {
    applyFieldData(obj.detail.fieldData);
  }
  try {
    SE_API.store.get(STORE_KEY_NAME).then((retrieved) => {
      console.log(`Initializing with retrieved widgetState from store: ${JSON.stringify(retrieved)}`);
      if (storeHasBeenInitialized(retrieved)) {
        // Treat whatever is already stored as announced so a refresh does
        // not replay the previous session's redemption.
        lastAnnouncedRedemptionId = getRedemptionAnnouncementId(retrieved);
        updateDisplay(retrieved, true);
      } else {
        console.log("The store object has not yet been initialized. Setting up initial values.");
        initialWidgetState.lastUpdated = new Date();
        const toSave = initialWidgetState;
        applyBackgroundTheme(getBackgroundTheme(toSave));
        SE_API.store.set(STORE_KEY_NAME, toSave);
        // the SE.store.set function emits an onEventReceived for every custom widget
        lastWidgetState = toSave;
      }
    });
  } catch (error) {
    console.log(`onWidgetLoad threw error ${error}`);
  }
}

window.addEventListener("onWidgetLoad", widgetLoadHandler);

/**
 * Processes a channel point redemption event detail.
 * Sets {@link pendingCharType} to the appropriate type constant so
 * {@link updateDisplay} can include the character SVG animation in the same
 * queue slot as the meter animations, then calls {@link incrementState}.
 * Unrecognized redemption names are ignored.
 * @param detail - The event detail payload from the redemption event.
 */
function handleRedemption(detail: SEEventDetail): void {
  console.log("In redemption handling");
  const redemptionName: string | null = getRedemptionName(detail);
  const redeemingUser: RedemptionUserRef | null = getRedemptionUserIdentity(detail);
  if (redemptionName != undefined && redemptionName != null) {
    console.log(`Redemption name is ${redemptionName}`);
    if (redemptionName == blessTheRun) {
      console.log(`Bless it: Verily let this run be bless-ed`);
      incrementState(StateKeys.numberOfBlesses, redeemingUser);
    } else if (redemptionName == curseTheRun) {
      console.log(`Curse it: I say unto you Locke shall not steal this run.`);
      incrementState(StateKeys.numberOfCurses, redeemingUser);
    } else if (redemptionName == blurseTheRun) {
      console.log(`Blurse it - who knows? Maybe gau, maybe no gau. Maybe black belt, maybe trench death.`);
      incrementState(StateKeys.numberOfBlurses, redeemingUser);
    } else {
      console.log(`Not handling redemption ${redemptionName}`);
    }
  } else {
    // we fukt
    console.log(`Feels bad man. Redemption name not located in detail ${JSON.stringify(detail)}`);
  }
}

/**
 * Shows the character SVG corresponding to the given redemption type and
 * returns a Promise that resolves when the show animation completes.
 * The SVG is hidden automatically after 800 ms (fire-and-forget hide).
 * Returns an already-resolved Promise if {@link showChars} is false or no
 * matching SVG element is found in the DOM.
 * Intended to be called inside an {@link enqueueAnimation} callback so it
 * runs concurrently with the meter animations as a single queue item.
 * @param type - One of `TYPE_BLESS`, `TYPE_CURSE`, or `TYPE_BLURSE`.
 * @returns A Promise that resolves once the SVG has been shown.
 */
function showCharSvg(type: string): Promise<void> {
  if (!showChars) {
    console.log("Not running the showChars functionality");
    return Promise.resolve();
  }
  let target: JQuery<HTMLElement>;
  const targets: JQuery<HTMLElement>[] = [getBlessSvg(), getCurseSvg(), getBlurseSvg()];
  if (type === TYPE_BLESS) {
    target = targets[0];
  } else if (type === TYPE_CURSE) {
    target = targets[1];
  } else if (type === TYPE_BLURSE) {
    target = targets[2];
  } else {
    console.log(`Unable to locate svg target for type '${type}'`);
    return Promise.resolve();
  }
  console.log(`For type '${type}' located target ${JSON.stringify(target.length > 0 ? target.get(0) : "None Found!")}`);
  if (target && target.length > 0) {
    console.log(`Showing ${JSON.stringify(target.get(0))}`);
    const finalTarget = target;
    return new Promise<void>((resolve) => {
      finalTarget.show({
        duration: 0,
        queue: true,
        complete: function () {
          console.log(`Animation complete: hiding ${JSON.stringify($(this))}`);
          setTimeout(() => $(this).hide(), 800);
          resolve();
        },
      });
    });
  }
  return Promise.resolve();
}

/**
 * Returns true when the effective bless count and effective curse count both
 * meet or exceed {@link meterMaximum}. Blurse-that-blessed contributes 2×
 * toward blesses and blurse-that-cursed contributes 2× toward curses.
 * @param widgetState - The state to evaluate.
 */
function bothMetersAreAtMax(widgetState: WidgetState): boolean {
  const numberOfBlesses = getOrDefaultCount(widgetState.current[StateKeys.numberOfBlesses]);
  const numberOfCurses = getOrDefaultCount(widgetState.current[StateKeys.numberOfCurses]);

  const numberOfBlursesThatBlessed = getOrDefaultCount(widgetState.current[StateKeys.numberOfBlursesThatBlessed]);
  const numberOfBlursesThatCursed = getOrDefaultCount(widgetState.current[StateKeys.numberOfBlursesThatCursed]);

  const effectiveBlesses = numberOfBlesses + numberOfBlursesThatBlessed * 2;
  const effectiveCurses = numberOfCurses + numberOfBlursesThatCursed * 2;

  return effectiveBlesses >= meterMaximum && effectiveCurses >= meterMaximum;
}

/**
 * Extracts the redemption name from a StreamElements event detail object.
 * Checks three locations in priority order:
 * 1. `detail.event.data.redemption` — live Twitch path
 * 2. `detail.session.data["channel-points-latest"].redemption` — SE docs path
 * 3. `detail.event.itemId` — SE emulator / in-editor test path
 * @param detail - The event detail to inspect, or undefined.
 * @returns The redemption name string, or null if not found in any location.
 */
function getRedemptionName(detail: SEEventDetail | undefined): string | null {
  let redemptionName: string | null = null;
  if (detail == undefined) {
    return null;
  }
  // for twitch this is where it actually is
  if (detail.event != undefined && detail.event.data != undefined) {
    redemptionName = detail.event.data.redemption ?? null;
  }
  // the rest of this is where I thought the redemption name would be either from the SE docs or SE mock redeems
  if (
    redemptionName == null &&
    detail.session != undefined &&
    detail.session.data != undefined &&
    detail.session.data["channel-points-latest"] != undefined
  ) {
    // the name in this case is here
    // the stream elements docs for twitch suggest this is where it would be
    // but the emulate function on stream elements always has it in detail.event.itemId
    redemptionName = detail.session.data["channel-points-latest"].redemption ?? null;
  }
  if (redemptionName == null || redemptionName == undefined || redemptionName.length == 0) {
    if (detail.event != undefined) {
      // for testing in stream elements, the redemption name is here I believe
      redemptionName = detail.event.itemId ?? null;
    }
  }
  return redemptionName;
}

/**
 * Resolves who redeemed for history tracking and UI labels.
 * Twitch channel points use `event.data.username` as the stable key and
 * `event.data.displayName` for display when present.
 * @param detail - StreamElements event detail for a redemption.
 */
function getRedemptionUserIdentity(detail: SEEventDetail | undefined): RedemptionUserRef | null {
  if (detail == null || detail.event == null) {
    return null;
  }
  const event = detail.event;

  if (event.data != undefined) {
    const identity = redemptionUserFromDataFields(event.data);
    if (identity != null) {
      console.log(`${identity.trackingKey} redeemed (event.data user fields)`);
      return identity;
    }
  }

  const channelPointsLatest = detail.session?.data?.["channel-points-latest"];
  if (channelPointsLatest != undefined) {
    const identity = redemptionUserFromSessionLatest(channelPointsLatest);
    if (identity != null) {
      console.log(`${identity.trackingKey} redeemed (session channel-points-latest)`);
      return identity;
    }
  }

  const fromEventName = pickNonEmptyString(event.name);
  if (fromEventName != null) {
    console.log(`${fromEventName} redeemed (event.name)`);
    return { trackingKey: fromEventName, displayName: fromEventName };
  }

  return null;
}

/**
 * @param detail - StreamElements event detail for a redemption.
 * @returns Display label for announcements and reports.
 */
function getRedeemingUserName(detail: SEEventDetail | undefined): string | null {
  return getRedemptionUserIdentity(detail)?.displayName ?? null;
}

function redemptionUserFromDataFields(data: SEEventData): RedemptionUserRef | null {
  const trackingKey = pickNonEmptyString(data.username, data.nick);
  const displayName = pickNonEmptyString(data.displayName, trackingKey, data.nick);
  if (trackingKey != null) {
    return { trackingKey, displayName: displayName ?? trackingKey };
  }
  if (displayName != null) {
    return { trackingKey: displayName, displayName };
  }
  return null;
}

function redemptionUserFromSessionLatest(
  latest: NonNullable<NonNullable<SESession["data"]>["channel-points-latest"]>
): RedemptionUserRef | null {
  const trackingKey = pickNonEmptyString(latest.username, latest.name);
  const displayName = pickNonEmptyString(latest.displayName, trackingKey);
  if (trackingKey != null) {
    return { trackingKey, displayName: displayName ?? trackingKey };
  }
  const nameOnly = pickNonEmptyString(latest.name, latest.displayName);
  if (nameOnly != null) {
    return { trackingKey: nameOnly, displayName: nameOnly };
  }
  return null;
}

/**
 * Normalizes string or {@link RedemptionUserRef} arguments for {@link incrementState}.
 */
function resolveRedemptionUserRef(user: string | RedemptionUserRef | null): RedemptionUserRef | null {
  if (user == null) {
    return null;
  }
  if (typeof user === "string") {
    const trimmed = user.trim();
    if (trimmed.length === 0) {
      return null;
    }
    return { trackingKey: trimmed, displayName: trimmed };
  }
  const trackingKey = user.trackingKey.trim();
  if (trackingKey.length === 0) {
    return null;
  }
  const displayName = pickNonEmptyString(user.displayName, trackingKey) ?? trackingKey;
  return { trackingKey, displayName };
}

/** Returns the first non-empty trimmed string, or null. */
function pickNonEmptyString(...candidates: (string | null | undefined)[]): string | null {
  for (const candidate of candidates) {
    if (candidate != undefined && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

/**
 * Entry point for display updates. Captures and clears {@link pendingCharType},
 * then enqueues the update onto {@link displayQueue} so it runs after any
 * display cycle already in progress. This ensures meter width is always read
 * from the settled DOM state after the previous redemption's animations have
 * fully completed.
 * @param widgetState - The state to render, or null to skip the update.
 * @param showAnimate - When true uses the full {@link animationDuration};
 *   when false uses {@link shortAnimationDuration} for an instant update.
 * @param announceRedemption - When omitted, derives the intent from
 *   {@link LastRedemption.id} on the supplied state. Pass explicitly in tests.
 */
function updateDisplay(widgetState: WidgetState | null, showAnimate: boolean, announceRedemption?: boolean): void {
  if (widgetState == null || widgetState.current == undefined) {
    console.log(`Current widget state is undefined! Feels bad man ${JSON.stringify(widgetState)}`);
    return;
  }

  // Applied outside the queue so a theme switch lands immediately instead of
  // waiting behind any in-flight announcement or meter animation.
  applyBackgroundTheme(getBackgroundTheme(widgetState));

  // Claim the announcement synchronously so concurrent updates carrying the
  // same redemption id cannot both play it.
  const announcementId = getRedemptionAnnouncementId(widgetState);
  const announce = announceRedemption ?? (announcementId != null && announcementId !== lastAnnouncedRedemptionId);
  if (announce && announcementId != null) {
    lastAnnouncedRedemptionId = announcementId;
  }

  displayQueue.enqueue(async () => {
    if (showAnimate && announce && showRedemptionAnnouncements && hasValidLastRedemption(widgetState.lastRedemption)) {
      await animateRedemptionAnnouncement(widgetState.lastRedemption);
    }
    await processDisplay(widgetState, showAnimate);
  });
}

/**
 * Applies StreamElements widget field configuration to module-level settings.
 * @param fieldData - Field values from the widget editor or test harness.
 */
function applyFieldData(fieldData: FieldData | undefined): void {
  if (fieldData == undefined) {
    return;
  }
  if (fieldData.meterMaximum != null && typeof fieldData.meterMaximum === "number") {
    if (!Number.isInteger(meterMaximum)) {
      meterMaximum = Math.floor(meterMaximum);
    }
    if (Number.isInteger(meterMaximum)) {
      meterMaximum = fieldData.meterMaximum;
    }
  }
  if (fieldData.showChars != null && typeof fieldData.showChars === "boolean") {
    showChars = fieldData.showChars;
  }
  if (fieldData.showRedemptionAnnouncements != null && typeof fieldData.showRedemptionAnnouncements === "boolean") {
    showRedemptionAnnouncements = fieldData.showRedemptionAnnouncements;
  }
  if (
    fieldData.redemptionTypewriterHoldSeconds != null &&
    typeof fieldData.redemptionTypewriterHoldSeconds === "number"
  ) {
    redemptionHoldAfterTypeMs = Math.max(0, fieldData.redemptionTypewriterHoldSeconds) * 1000;
  }
  if (fieldData.numberOfSecondsBetweenReports != null && typeof fieldData.numberOfSecondsBetweenReports === "number") {
    numberOfSecondsBetweenReports = Math.max(0, Math.floor(fieldData.numberOfSecondsBetweenReports));
  }
  if (fieldData.reportsShouldDisplay != null && typeof fieldData.reportsShouldDisplay === "boolean") {
    reportsShouldDisplay = fieldData.reportsShouldDisplay;
  }
  if (fieldData.emoteBlessEnabled != null && typeof fieldData.emoteBlessEnabled === "boolean") {
    emoteBlessEnabled = fieldData.emoteBlessEnabled;
  }
  if (fieldData.emoteBlessEmoteNamesCsv != null && typeof fieldData.emoteBlessEmoteNamesCsv === "string") {
    emoteBlessEmoteNamesCsv = fieldData.emoteBlessEmoteNamesCsv;
  }
  if (fieldData.emoteBlessWindowSeconds != null && typeof fieldData.emoteBlessWindowSeconds === "number") {
    emoteBlessWindowSeconds = Math.max(1, Math.floor(fieldData.emoteBlessWindowSeconds));
  }
  if (fieldData.emoteBlessRequiredMatches != null && typeof fieldData.emoteBlessRequiredMatches === "number") {
    emoteBlessRequiredMatches = Math.max(1, Math.floor(fieldData.emoteBlessRequiredMatches));
  }
  if (fieldData.emoteBlessCooldownSeconds != null && typeof fieldData.emoteBlessCooldownSeconds === "number") {
    emoteBlessCooldownSeconds = Math.max(0, Math.floor(fieldData.emoteBlessCooldownSeconds));
  }
  if (fieldData.emoteBlessHeadlineText != null && typeof fieldData.emoteBlessHeadlineText === "string") {
    emoteBlessHeadlineText = fieldData.emoteBlessHeadlineText;
  }
  rebuildTrackedEmoteNameSet();
  // Only (re)start the report interval when those fields are in this payload.
  // Partial updates (headline, emote list, …) must not resurrect a 90s timer
  // from the module defaults — that leaks open handles in Jest.
  if (fieldData.reportsShouldDisplay != null || fieldData.numberOfSecondsBetweenReports != null) {
    configurePeriodicReports();
  }
}

/**
 * Parses {@link emoteBlessEmoteNamesCsv} into a lowercase lookup set for matching.
 */
function rebuildTrackedEmoteNameSet(): void {
  trackedEmoteNamesLower = new Set(parseEmoteNamesCsv(emoteBlessEmoteNamesCsv).map(normalizeEmoteNameForMatch));
}

/**
 * @param csv - Comma-separated emote names from widget field data.
 */
function parseEmoteNamesCsv(csv: string): string[] {
  if (csv == null || csv.trim() === "") {
    return [];
  }
  return csv
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * @param emoteName - Raw emote name from chat or config.
 */
function normalizeEmoteNameForMatch(emoteName: string): string {
  return emoteName.trim().toLowerCase();
}

/**
 * Returns tracked emote names found in a chat message (one entry per occurrence).
 * @param message - StreamElements chat payload at `event.data`.
 * @param trackedLower - Lowercase emote names to match.
 */
function findMatchingTrackedEmotesInChat(message: ChatMessageData, trackedLower: Set<string>): string[] {
  if (trackedLower.size === 0) {
    console.log("No tracked emotes configured");
    return [];
  }
  console.log(`Looking for tracked emotes ${JSON.stringify(trackedLower)}`);
  const matches: string[] = [];
  if (message.emotes != null && message.emotes.length > 0) {
    for (const emote of message.emotes) {
      if (emote.name == null) {
        continue;
      }
      if (trackedLower.has(normalizeEmoteNameForMatch(emote.name))) {
        matches.push(emote.name);
      }
    }
    console.log(`Found message.emotes ${matches.length} tracked emotes`);
    return matches;
  }
  if (message.text != null && message.text.trim() !== "") {
    const tokens = message.text.split(/\s+/);
    for (const token of tokens) {
      if (trackedLower.has(normalizeEmoteNameForMatch(token))) {
        matches.push(token);
      }
    }
  }
  console.log(`Found message.text ${matches.length} tracked emotes`);
  return matches;
}

/**
 * Drops emote window entries older than {@link windowMs}.
 * @param nowMs - Current timestamp.
 * @param windowMs - Rolling window length in milliseconds.
 */
function pruneEmoteWindowEntries(nowMs: number, windowMs: number): void {
  const cutoff = nowMs - windowMs;
  emoteWindowEntries = emoteWindowEntries.filter((entry) => entry.timestamp >= cutoff);
}

/**
 * Returns distinct display names among entries in the current emote window.
 */
function getDistinctUsersInEmoteWindow(): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const entry of emoteWindowEntries) {
    if (seen.has(entry.displayName)) {
      continue;
    }
    seen.add(entry.displayName);
    names.push(entry.displayName);
  }
  return names;
}

/**
 * Handles Twitch/YouTube chat messages for the emote-triggered bless feature.
 * @param detail - `onEventReceived` payload with `listener === "message"`.
 */
function handleChatMessage(detail: SEEventDetail): void {
  console.log("Handling chat message");
  if (!emoteBlessEnabled) {
    console.log("Emote bless is disabled");
    return;
  }
  console.log("Emote bless is enabled");
  const message = detail.event?.data;
  if (message == null) {
    console.log("No chat message data found");
    return;
  }
  console.log("Found message data: " + JSON.stringify(message));
  const matchedEmotes = findMatchingTrackedEmotesInChat(message, trackedEmoteNamesLower);
  if (matchedEmotes.length === 0) {
    console.log("No emotes matched");
    return;
  }
  console.log(`Matched ${matchedEmotes.length} emotes: ${matchedEmotes.join(", ")}`);

  const nowMs = Date.now();
  const userId = message.userId ?? message.nick ?? "unknown";
  const displayName = message.displayName ?? message.nick ?? userId;
  const windowMs = emoteBlessWindowSeconds * 1000;

  pruneEmoteWindowEntries(nowMs, windowMs);
  for (const emoteName of matchedEmotes) {
    emoteWindowEntries.push({
      timestamp: nowMs,
      userId,
      displayName,
      emoteName,
    });
  }

  if (emoteWindowEntries.length < emoteBlessRequiredMatches) {
    console.log(`Not enough emotes in window yet (${emoteWindowEntries.length}/${emoteBlessRequiredMatches})`);
    return;
  }

  if (isEmoteBlessOnCooldown(nowMs)) {
    console.log("Emote bless is on cooldown; ignoring this matching window");
    emoteWindowEntries = [];
    return;
  }

  const distinctUsers = getDistinctUsersInEmoteWindow();
  console.log(`Found ${distinctUsers.length} distinct users in window: ${distinctUsers.join(", ")}`);
  const matchCount = emoteWindowEntries.length;
  emoteWindowEntries = [];
  lastEmoteBlessTriggeredAt = nowMs;
  triggerEmoteBlessReward(distinctUsers, matchCount);
}

/**
 * @param nowMs - Current timestamp.
 * @returns True when a successful trigger happened recently enough that another
 *   must wait for {@link emoteBlessCooldownSeconds}.
 */
function isEmoteBlessOnCooldown(nowMs: number): boolean {
  if (emoteBlessCooldownSeconds <= 0 || lastEmoteBlessTriggeredAt <= 0) {
    return false;
  }
  return nowMs - lastEmoteBlessTriggeredAt < emoteBlessCooldownSeconds * 1000;
}

/**
 * Enqueues the emote-bless typewriter, then applies a +1 bless without a second announcement.
 * @param distinctDisplayNames - Unique chatters who contributed matching emotes.
 * @param matchCount - Total matching emotes that filled the window.
 */
function triggerEmoteBlessReward(distinctDisplayNames: string[], matchCount: number): void {
  console.log(`Triggering emote bless reward for ${distinctDisplayNames.length} distinct users`);
  displayQueue.enqueue(async () => {
    await animateOverlayTypewriter(buildEmoteBlessAnnouncementSegments(distinctDisplayNames, matchCount));
    const creditedUser = distinctDisplayNames.length === 1 ? distinctDisplayNames[0] : null;
    // The typewriter above is this feature's announcement, so skip stamping a
    // redemption id that would trigger a second one.
    incrementState(StateKeys.numberOfBlesses, creditedUser, { recordRedemption: false });
  });
}

/**
 * Typewriter copy for the emote-triggered bless animation.
 */
function buildEmoteBlessAnnouncementSegments(
  distinctDisplayNames: string[],
  matchCount: number
): AnnouncementSegment[] {
  // userSummary is currently unused, but may be used in the future.
  const userSummary = distinctDisplayNames.length === 0 ? "chat" : distinctDisplayNames.join(", ");
  return [
    { text: formatEmoteBlessHeadline(emoteBlessHeadlineText) },
    { text: "Impact: " },
    { text: "+1 BLESS", colorClass: "redemption-text-bless" },
  ];
}

/**
 * Ensures the configured headline is followed by a newline for the typewriter.
 * Empty or whitespace-only values fall back to the default "Mustache man blesses the run".
 * @param configuredText - Headline from widget field data.
 */
function formatEmoteBlessHeadline(configuredText: string): string {
  const body = configuredText.replace(/[\s\r\n]+$/g, "");
  const headline = body.length > 0 ? body : "Mustache man blesses the run";
  return `${headline}\n`;
}

/** Starts or stops the interval that enqueues top-redeemer report cycles. */
function configurePeriodicReports(): void {
  if (periodicReportTimerId != null) {
    window.clearInterval(periodicReportTimerId);
    periodicReportTimerId = null;
  }
  if (!reportsShouldDisplay || numberOfSecondsBetweenReports <= 0) {
    return;
  }
  periodicReportTimerId = window.setInterval(() => {
    enqueuePeriodicReportCycle();
  }, numberOfSecondsBetweenReports * 1000);
}

/** Clears the periodic report interval without changing field settings. */
function stopPeriodicReports(): void {
  if (periodicReportTimerId != null) {
    window.clearInterval(periodicReportTimerId);
    periodicReportTimerId = null;
  }
}

/**
 * Enqueues the top-redeemer report sequence followed by a temporary all-time view.
 * Does nothing when {@link reportsShouldDisplay} is false (unless {@link force} is true)
 * or when state is unavailable.
 * @param force - When true, enqueues even if periodic reports are disabled in field data.
 */
function enqueuePeriodicReportCycle(force = false): void {
  if (!force && !reportsShouldDisplay) {
    return;
  }
  const widgetState = lastWidgetState;
  if (widgetState == null || widgetState.current == undefined) {
    return;
  }

  displayQueue.enqueue(async () => {
    const stateForReport = lastWidgetState ?? widgetState;
    if (stateForReport == null || stateForReport.current == undefined) {
      return;
    }
    const history = stateForReport.redemptionHistory;
    await animateTopRedeemersReport("TOP BLESS REDEEMERS", getTopRedeemers(history, "bless"));
    await animateTopRedeemersReport("TOP CURSE REDEEMERS", getTopRedeemers(history, "curse"));
    await animateTopRedeemersReport("TOP BLURSE REDEEMERS", getTopRedeemers(history, "blurse"));
    await animateReportHeadline("ALL TIME");
    await processDisplay({ ...stateForReport, showAll: true }, true);
    await waitMs(reportAllTimeHoldMs);
    await animateReportHeadline("CURRENT RUN");
    await processDisplay({ ...stateForReport, showAll: false }, true);
  });
}

/**
 * Performs the actual DOM update and starts the meter and character SVG
 * animations for one redemption cycle. Returns a promise that resolves once
 * all animations for this cycle complete, so {@link displayQueue} knows when
 * it's safe to start the next queued entry. Only called via {@link updateDisplay}.
 * @param widgetState - The validated, non-null state to render.
 * @param showAnimate - When true uses the full {@link animationDuration};
 *   when false uses {@link shortAnimationDuration} for an instant update.
 */
function processDisplay(widgetState: WidgetState, showAnimate: boolean): Promise<void> {
  console.log(`Updating meter display ${JSON.stringify(widgetState)}`);
  const numberOfBlesses = getCountFromState(widgetState, StateKeys.numberOfBlesses);
  const numberOfCurses = getCountFromState(widgetState, StateKeys.numberOfCurses);
  const numberOfBlurses = getCountFromState(widgetState, StateKeys.numberOfBlurses);

  const numberOfBlursesThatBlessed = getCountFromState(widgetState, StateKeys.numberOfBlursesThatBlessed);
  const numberOfBlursesThatCursed = getCountFromState(widgetState, StateKeys.numberOfBlursesThatCursed);

  const total = numberOfBlesses + numberOfCurses + numberOfBlurses;
  const animationTime = showAnimate ? animationDuration : shortAnimationDuration;

  const preResetBlesses = getOrDefaultCount(widgetState.current[StateKeys.numberOfBlessesPreReset]);
  const preResetCurses = getOrDefaultCount(widgetState.current[StateKeys.numberOfCursesPreReset]);
  const preResetBlursesThatBlessed = getOrDefaultCount(
    widgetState.current[StateKeys.numberOfBlursesThatBlessedPreReset]
  );
  const preResetBlursesThatCursed = getOrDefaultCount(widgetState.current[StateKeys.numberOfBlursesThatCursedPreReset]);

  const blessMeterFill = getBlessMeterFill();
  const curseMeterFill = getCurseMeterFill();

  let blessFactory: () => Promise<void>;
  let curseFactory: () => Promise<void>;
  let blessCountText: number;
  let curseCountText: number;
  let blurseCountText: string;

  if (total === 0) {
    console.log("No blesses, curses, or blurses. Hopefully this is expected in this scenario...");
    // Build factories now (captures current widths; glow class changes happen immediately).
    blessFactory = animateMeterFill(blessMeterFill.get(0), "0%", animationTime, TYPE_BLESS);
    curseFactory = animateMeterFill(curseMeterFill.get(0), "0%", animationTime, TYPE_CURSE);
    blessCountText = preResetBlesses;
    curseCountText = preResetCurses;
    blurseCountText = `${preResetBlursesThatBlessed} / ${preResetBlursesThatCursed}`;
    updateToggleButtonDisplay(isShowingAll(widgetState));
  } else {
    const effectiveBlesses = numberOfBlesses + numberOfBlursesThatBlessed * 2;
    const effectiveCurses = numberOfCurses + numberOfBlursesThatCursed * 2;
    const effectiveTotal = effectiveBlesses + effectiveCurses;

    console.log("Computing widths for the meters");
    console.log(`Current widths are bless: ${blessMeterFill.css("width")}, curse: ${curseMeterFill.css("width")}`);

    let blessWidth: string;
    let curseWidth: string;
    if (isShowingAll(widgetState)) {
      console.log(`Showing all so meter length is relative`);
      blessWidth = ((effectiveBlesses / effectiveTotal) * 100).toFixed(2) + "%";
      curseWidth = ((effectiveCurses / effectiveTotal) * 100).toFixed(2) + "%";
    } else {
      console.log(`Showing run so meter length is based on ${meterMaximum} max`);
      blessWidth = (effectiveBlesses >= meterMaximum ? 100 : (effectiveBlesses / meterMaximum) * 100).toFixed(2) + "%";
      curseWidth = (effectiveCurses >= meterMaximum ? 100 : (effectiveCurses / meterMaximum) * 100).toFixed(2) + "%";
    }
    updateToggleButtonDisplay(isShowingAll(widgetState));
    console.log(`Updating widths to bless: ${blessWidth}, curse: ${curseWidth}`);

    // Build factories now (captures current widths; glow class changes happen immediately).
    blessFactory = animateMeterFill(blessMeterFill.get(0), blessWidth, animationTime, TYPE_BLESS);
    curseFactory = animateMeterFill(curseMeterFill.get(0), curseWidth, animationTime, TYPE_CURSE);

    // update lastCount attributes
    let blessCounterText = numberOfBlesses;
    let curseCounterText = numberOfCurses;
    let blurseThatBlessedCounterText = numberOfBlursesThatBlessed;
    let blurseThatCursedCounterText = numberOfBlursesThatCursed;
    if (!isShowingAll(widgetState)) {
      blessCounterText += preResetBlesses;
      curseCounterText += preResetCurses;
      blurseThatBlessedCounterText += preResetBlursesThatBlessed;
      blurseThatCursedCounterText += preResetBlursesThatCursed;
    }
    blessCountText = blessCounterText;
    curseCountText = curseCounterText;
    blurseCountText = `${blurseThatBlessedCounterText}/${blurseThatCursedCounterText}`;
  }

  const animations: Promise<void>[] = [];
  animations.push(blessFactory());
  animations.push(curseFactory());
  return Promise.all(animations).then(() => {
    // Counter text updates only once the animations for this queue entry
    // have fully settled, so the number and the meter width change together.
    getBlessInfoValue().text(blessCountText);
    getCurseInfoValue().text(curseCountText);
    getBlurseInfoValue().text(blurseCountText);
  });
}

/** @returns A process-unique id used to mark a redemption as awaiting announcement. */
function createRedemptionId(): string {
  redemptionIdCounter += 1;
  // The random suffix keeps ids distinct across widget instances, which each
  // keep their own counter but share the store.
  return `${Date.now()}-${redemptionIdCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Reads the announcement id carried by a state's lastRedemption.
 * @param widgetState - State to inspect.
 * @returns The id, or null when there is nothing announceable.
 */
function getRedemptionAnnouncementId(widgetState: WidgetState | null | undefined): string | null {
  const lastRedemption = widgetState?.lastRedemption;
  if (!hasValidLastRedemption(lastRedemption)) {
    return null;
  }
  return lastRedemption.id ?? null;
}

function hasValidLastRedemption(lastRedemption: any): lastRedemption is LastRedemption {
  return (
    lastRedemption != undefined &&
    typeof lastRedemption["redeemingUser"] === "string" &&
    typeof lastRedemption["charType"] === "string" &&
    typeof lastRedemption["meterTarget"] === "string" &&
    typeof lastRedemption["meterAmount"] === "number"
  );
}

/**
 * Hides the meter panel, types a redemption summary letter-by-letter into the
 * main dialogue window, holds briefly, then restores the meter panel.
 * @param redemption - The most recent redemption recorded in widget state.
 */
async function animateRedemptionAnnouncement(redemption: LastRedemption): Promise<void> {
  await animateOverlayTypewriter(buildRedemptionAnnouncementSegments(redemption));
}

/**
 * Hides the meter panel, runs a typewriter animation in the announcement overlay,
 * holds briefly, then restores the meter panel.
 * @param segments - Colored text segments to type out.
 */
type OverlayAnnouncementLayout = "default" | "headline" | "list";

interface OverlayTypewriterOptions {
  layout?: OverlayAnnouncementLayout;
}

/** Centered headline overlay used for report titles and meter view transitions. */
async function animateReportHeadline(text: string): Promise<void> {
  await animateOverlayTypewriter(buildReportHeadlineSegments(text), { layout: "headline" });
}

/**
 * Shows a report category title, then the ranked rows in a separate overlay step.
 */
async function animateTopRedeemersReport(
  title: string,
  redeemers: { userName: string; count: number }[]
): Promise<void> {
  await animateReportHeadline(title);
  await animateOverlayTypewriter(buildTopRedeemersListSegments(redeemers), { layout: "list" });
}

async function animateOverlayTypewriter(
  segments: AnnouncementSegment[],
  options?: OverlayTypewriterOptions
): Promise<void> {
  const layout = options?.layout ?? "default";
  const meterPanel = getMeterPanelContent();
  const announcement = getRedemptionAnnouncement();
  const announcementElement = announcement.get(0);
  if (!announcementElement) {
    return;
  }

  const textContainer = document.createElement("div");
  textContainer.className = "redemption-announcement-text";
  if (layout === "headline") {
    textContainer.classList.add("redemption-announcement-headline");
  } else if (layout === "list") {
    textContainer.classList.add("redemption-announcement-list");
  }

  announcement
    .removeClass("is-headline is-list is-redemption")
    .addClass("visible")
    .attr("aria-hidden", "false")
    .empty()
    .append(textContainer);
  if (layout === "headline") {
    announcement.addClass("is-headline");
  } else if (layout === "list") {
    announcement.addClass("is-list");
  } else {
    announcement.addClass("is-redemption");
  }

  meterPanel.addClass("hidden");

  if ((layout === "list" || layout === "default") && announcementElement) {
    textContainer.style.maxHeight = `${announcementElement.clientHeight}px`;
  }

  await typewriterSegments(textContainer, segments, redemptionLetterDelayMs);
  if (layout !== "headline") {
    liftAnnouncementText(textContainer, { pinToTop: true });
  }
  await waitMs(redemptionHoldAfterTypeMs);

  announcement.removeClass("visible is-headline is-list is-redemption").attr("aria-hidden", "true").empty();
  meterPanel.removeClass("hidden");
}

/** @returns A zeroed per-user redemption history entry. */
function createEmptyRedemptionHistoryEntry(displayName?: string): RedemptionHistoryEntry {
  const entry: RedemptionHistoryEntry = {
    numberOfBlesses: 0,
    numberOfCurses: 0,
    numberOfBlurses: 0,
    numberOfBlursesThatBlessed: 0,
    numberOfBlursesThatCursed: 0,
  };
  applyRedemptionHistoryDisplayName(entry, displayName);
  return entry;
}

/** Persists the latest Twitch display name on a history entry when provided. */
function applyRedemptionHistoryDisplayName(entry: RedemptionHistoryEntry, displayName?: string): void {
  const next = pickNonEmptyString(displayName);
  if (next != null) {
    entry.displayName = next;
  }
}

/** Label for leaderboards and reports. */
function getRedemptionHistoryDisplayName(entry: RedemptionHistoryEntry, trackingKey: string): string {
  return pickNonEmptyString(entry.displayName, trackingKey) ?? trackingKey;
}

/**
 * Fills in missing per-user redemption fields for entries saved before blurse
 * outcome tracking was added.
 * @param entry - A stored redemption history entry.
 */
function normalizeRedemptionHistoryEntry(entry: RedemptionHistoryEntry): RedemptionHistoryEntry {
  const normalized: RedemptionHistoryEntry = {
    numberOfBlesses: getOrDefaultCount(entry.numberOfBlesses),
    numberOfCurses: getOrDefaultCount(entry.numberOfCurses),
    numberOfBlurses: getOrDefaultCount(entry.numberOfBlurses),
    numberOfBlursesThatBlessed: getOrDefaultCount(entry.numberOfBlursesThatBlessed),
    numberOfBlursesThatCursed: getOrDefaultCount(entry.numberOfBlursesThatCursed),
  };
  applyRedemptionHistoryDisplayName(normalized, entry.displayName);
  return normalized;
}

/**
 * @param entry - A per-user redemption history entry.
 * @param category - Which redeem type to count.
 */
function getRedemptionHistoryCount(entry: RedemptionHistoryEntry, category: TopRedeemerCategory): number {
  if (category === "bless") {
    return getOrDefaultCount(entry.numberOfBlesses);
  }
  if (category === "curse") {
    return getOrDefaultCount(entry.numberOfCurses);
  }
  return getOrDefaultCount(entry.numberOfBlurses);
}

/**
 * Returns the highest-ranked redeemers for a category, sorted by count descending.
 * @param redemptionHistory - Per-user redemption totals from widget state.
 * @param category - bless, curse, or blurse leaderboard to build.
 * @param limit - Maximum number of rows to return (default {@link topRedeemerLimit}).
 */
function getTopRedeemers(
  redemptionHistory: RedemptionHistory | undefined,
  category: TopRedeemerCategory,
  limit = topRedeemerLimit
): { userName: string; count: number }[] {
  if (redemptionHistory == undefined) {
    return [];
  }
  const ranked: { userName: string; count: number }[] = [];
  for (const trackingKey in redemptionHistory) {
    if (!Object.prototype.hasOwnProperty.call(redemptionHistory, trackingKey)) {
      continue;
    }
    const entry = normalizeRedemptionHistoryEntry(redemptionHistory[trackingKey]);
    const count = getRedemptionHistoryCount(entry, category);
    if (count > 0) {
      ranked.push({ userName: getRedemptionHistoryDisplayName(entry, trackingKey), count });
    }
  }
  ranked.sort((left, right) => right.count - left.count || left.userName.localeCompare(right.userName));
  return ranked.slice(0, limit);
}

/** Segments for centered report headlines (category titles, ALL TIME, CURRENT RUN). */
function buildReportHeadlineSegments(text: string): AnnouncementSegment[] {
  return [{ text }];
}

/** @deprecated Use {@link buildReportHeadlineSegments}. */
function buildTopRedeemersTitleSegments(title: string): AnnouncementSegment[] {
  return buildReportHeadlineSegments(title);
}

/** Ranked rows for the list overlay that follows a report header. */
function buildTopRedeemersListSegments(redeemers: { userName: string; count: number }[]): AnnouncementSegment[] {
  if (redeemers.length === 0) {
    return [{ text: "No redeems yet" }];
  }
  return [
    {
      text: redeemers.map((row, index) => `${index + 1}. ${row.userName} - ${row.count}`).join("\n"),
    },
  ];
}

/**
 * Builds typewriter segments for a top-redeemers leaderboard overlay.
 * @deprecated Prefer {@link buildTopRedeemersTitleSegments} and {@link buildTopRedeemersListSegments}.
 */
function buildTopRedeemersReportSegments(
  title: string,
  redeemers: { userName: string; count: number }[]
): AnnouncementSegment[] {
  return [{ text: `${title}\n` }, ...buildTopRedeemersListSegments(redeemers)];
}

interface AnnouncementSegment {
  text: string;
  colorClass?: string;
}

/**
 * Builds the redemption summary as colored segments for the typewriter animation.
 * All text is white except {@link formatRedemptionTypeLabel} and
 * {@link formatRedemptionImpactLabel}, which receive type/meter-target colors.
 * @param redemption - The redemption to describe.
 */
function buildRedemptionAnnouncementSegments(redemption: LastRedemption): AnnouncementSegment[] {
  const typeLabel = formatRedemptionTypeLabel(redemption.charType);
  const impactLabel = formatRedemptionImpactLabel(redemption.meterTarget, redemption.meterAmount);
  return [
    { text: `${redemption.redeemingUser}\n` },
    { text: typeLabel, colorClass: getTypeColorClass(redemption.charType) },
    { text: " the run\nImpact: " },
    { text: impactLabel, colorClass: getMeterTargetColorClass(redemption.meterTarget) },
  ];
}

/**
 * @param charType - One of {@link TYPE_BLESS}, {@link TYPE_CURSE}, or {@link TYPE_BLURSE}.
 */
function getTypeColorClass(charType: string): string {
  if (charType === TYPE_BLESS) {
    return "redemption-text-bless";
  }
  if (charType === TYPE_CURSE) {
    return "redemption-text-curse";
  }
  if (charType === TYPE_BLURSE) {
    return "redemption-text-blurse";
  }
  return "";
}

/**
 * @param meterTarget - {@link TYPE_BLESS} or {@link TYPE_CURSE}: which meter moved.
 */
function getMeterTargetColorClass(meterTarget: string): string {
  if (meterTarget === TYPE_BLESS) {
    return "redemption-text-bless";
  }
  if (meterTarget === TYPE_CURSE) {
    return "redemption-text-curse";
  }
  return "";
}

/**
 * @param charType - One of {@link TYPE_BLESS}, {@link TYPE_CURSE}, or {@link TYPE_BLURSE}.
 */
function formatRedemptionTypeLabel(charType: string): string {
  if (charType === TYPE_BLESS) {
    return "BLESSED";
  }
  if (charType === TYPE_CURSE) {
    return "CURSED";
  }
  if (charType === TYPE_BLURSE) {
    return "BLURSED";
  }
  return charType.toUpperCase();
}

/**
 * Formats the meter movement stored on lastRedemption for the announcement.
 * @param meterTarget - {@link TYPE_BLESS} or {@link TYPE_CURSE}.
 * @param meterAmount - How many points the target meter gained.
 */
function formatRedemptionImpactLabel(meterTarget: string, meterAmount: number): string {
  const targetLabel = meterTarget === TYPE_BLESS ? "BLESS" : "CURSE";
  return `+${meterAmount} ${targetLabel}`;
}

/**
 * Reveals announcement segments one character at a time, left to right, preserving
 * per-segment colors via span elements.
 * @param element - The container whose child spans are updated.
 * @param segments - Text chunks and optional color classes.
 * @param letterDelayMs - Delay between characters; 0 reveals the full string immediately.
 */
function typewriterSegments(
  element: HTMLElement,
  segments: AnnouncementSegment[],
  letterDelayMs: number
): Promise<void> {
  const flatChars: { char: string; colorClass?: string }[] = [];
  for (const segment of segments) {
    for (const char of segment.text) {
      flatChars.push({ char: char, colorClass: segment.colorClass });
    }
  }

  return new Promise((resolve) => {
    element.innerHTML = "";
    if (flatChars.length === 0) {
      resolve();
      return;
    }
    if (letterDelayMs <= 0) {
      renderTypewriterChars(element, flatChars, flatChars.length);
      resolve();
      return;
    }
    let index = 0;
    const revealNext = () => {
      index += 1;
      renderTypewriterChars(element, flatChars, index);
      if (index >= flatChars.length) {
        resolve();
      } else {
        window.setTimeout(revealNext, letterDelayMs);
      }
    };
    revealNext();
  });
}

/**
 * Renders the first {@link visibleCount} characters of a flattened typewriter stream.
 * @param element - The container to populate with colored spans.
 * @param flatChars - Characters paired with optional color classes.
 * @param visibleCount - How many characters from the start to show.
 */
function renderTypewriterChars(
  element: HTMLElement,
  flatChars: { char: string; colorClass?: string }[],
  visibleCount: number
): void {
  element.innerHTML = "";
  let index = 0;
  while (index < visibleCount) {
    const colorClass = flatChars[index].colorClass;
    let end = index + 1;
    while (end < visibleCount && flatChars[end].colorClass === colorClass) {
      end += 1;
    }
    const span = document.createElement("span");
    if (colorClass) {
      span.className = colorClass;
    }
    span.textContent = flatChars
      .slice(index, end)
      .map((entry) => entry.char)
      .join("");
    element.appendChild(span);
    index = end;
  }
  const parent = element.parentElement;
  if (parent != null && !usesFixedOverlayLayout(parent)) {
    liftAnnouncementText(element);
  }
}

/** Overlays that must not vertically recenter on every typed character. */
function usesFixedOverlayLayout(parent: HTMLElement): boolean {
  return (
    parent.classList.contains("is-headline") ||
    parent.classList.contains("is-list") ||
    parent.classList.contains("is-redemption")
  );
}

/**
 * Positions overlay copy inside the fixed announcement window. Short messages
 * are vertically centered; taller reports stay top-aligned and scroll so the
 * latest typed line stays visible without clipping the header or footer rows.
 */
function liftAnnouncementText(element: HTMLElement, options?: { pinToTop?: boolean }): void {
  const parent = element.parentElement;
  if (!parent) {
    return;
  }
  element.style.marginTop = "0px";
  element.style.maxHeight = `${parent.clientHeight}px`;
  const overflows = element.scrollHeight > element.clientHeight;
  if (!overflows) {
    if (!usesFixedOverlayLayout(parent)) {
      const extraSpace = parent.clientHeight - element.scrollHeight;
      if (extraSpace > 0) {
        element.style.marginTop = `${Math.floor(extraSpace / 2)}px`;
      }
    }
    element.scrollTop = 0;
    return;
  }
  element.scrollTop = options?.pinToTop ? 0 : element.scrollHeight - element.clientHeight;
}

/** @param durationMs - How long to wait before resolving. */
function waitMs(durationMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, durationMs));
}

/**
 * Returns the count for the named key from the appropriate portion of state:
 * `allTime` when {@link isShowingAll} is true, `current` otherwise.
 * @param widgetState - The state to read from.
 * @param keyName - A {@link StateKeys} value identifying the counter.
 */
function getCountFromState(widgetState: WidgetState, keyName: string): number {
  if (isShowingAll(widgetState)) {
    return getOrDefaultCount(widgetState.allTime[keyName]);
  } else {
    return getOrDefaultCount(widgetState.current[keyName]);
  }
}

/**
 * Returns the numeric value clamped to a minimum of 0, or 0 if the value is
 * undefined, NaN, or negative.
 * @param value - The raw value from the widget state.
 * @returns A non-negative number, or 0 for invalid input.
 */
function getOrDefaultCount(value: number | boolean | undefined): number {
  // Original used `value == NaN` which is always false (NaN !== NaN).
  // Replaced with Number.isNaN() so the check is actually meaningful.
  if (value == undefined || Number.isNaN(value as number)) {
    return 0;
  } else if ((value as number) < 0) {
    return 0;
  } else {
    return value as number;
  }
}

/** Returns the jQuery-wrapped span element that displays the bless count. */
function getBlessInfoValue(): JQuery<HTMLElement> {
  return $("span.bless-info-value");
}

/** Returns the jQuery-wrapped span element that displays the curse count. */
function getCurseInfoValue(): JQuery<HTMLElement> {
  return $("span.curse-info-value");
}

/** Returns the jQuery-wrapped span element that displays the blurse count. */
function getBlurseInfoValue(): JQuery<HTMLElement> {
  return $("span.blurse-info-value");
}

/** Returns the meter panel inside the main dialogue window. */
function getMainMeterInnerWindow(): JQuery<HTMLElement> {
  return $("div.outer-dialogue-window-main > div.inner-dialogue-window").not(".user-redeem-window");
}

/** Returns the jQuery-wrapped meter readout content hidden during redemption announcements. */
function getMeterPanelContent(): JQuery<HTMLElement> {
  return getMainMeterInnerWindow().find(".meter-panel-content");
}

/** Returns the jQuery-wrapped element used for the redemption typewriter text. */
function getRedemptionAnnouncement(): JQuery<HTMLElement> {
  return getMainMeterInnerWindow().find(".redemption-announcement");
}

/**
 * Updates the all-time toggle button label.
 * Sets the text to "Show run" when `showAll` is true (all-time view is active)
 * or "Show all" when `showAll` is false (current-run view is active).
 * @param showAll - The current value of the showAll flag.
 */
function updateToggleButtonDisplay(showAll: boolean): void {
  const toggleButton = $("#all-time-toggle");
  if (showAll) {
    console.log("Show all");
    toggleButton.text("Show run");
    console.log(`Updated show all attribute to: ${showAll}`);
  } else {
    console.log("Show run");
    toggleButton.text("Show all");
    console.log(`Updated show all attribute to: ${showAll}`);
  }
}

/**
 * Handles glow state immediately (adds or removes the glow CSS class on the
 * meter container) then returns a factory function that starts the WAAPI width
 * animation when called.
 * The returned factory is invoked immediately inside {@link processDisplay}
 * so the animation only starts once the previous redemption's display cycle
 * has fully completed.
 * Percent units are used on both keyframes. jQuery's `.css("width")` is
 * pixels, so interpolating `"40px"` → `"13.33%"` makes an unchanged bar twitch.
 * Unchanged percents skip the animation.
 * @param ele - The meter fill element to animate, or undefined (no-op).
 * @param currentWidth - CSS width string representing the starting width.
 * @param targetWidth - CSS width string representing the ending width.
 * @param durationOfAnimation - Animation duration in milliseconds.
 * @param type - `TYPE_BLESS` or `TYPE_CURSE`, used to select the glow class.
 * @returns A factory that starts the animation and resolves when it finishes.
 */
function animateMeterFill(
  ele: HTMLElement | undefined,
  targetWidth: string,
  durationOfAnimation: number,
  type: string
): () => Promise<void> {
  if (!ele) {
    return () => Promise.resolve();
  }
  const parentWidth = ele.parentElement?.clientWidth ?? 0;
  const currentWidth =
    parentWidth > 0 ? `${((ele.offsetWidth / parentWidth) * 100).toFixed(2)}%` : ele.style.width || "0%";
  return animateChange(ele, currentWidth, targetWidth, durationOfAnimation, type);
}

function animateChange(
  ele: HTMLElement | undefined,
  currentWidth: string,
  targetWidth: string,
  durationOfAnimation: number,
  type: string
): () => Promise<void> {
  // Guard added for TypeScript: jQuery's .get(0) returns HTMLElement | undefined
  if (!ele) return () => Promise.resolve();

  if ("100.00%" === targetWidth) {
    animateGlowForever(ele, type);
  } else {
    endGlowForever(ele, type);
  }

  const fromPercent = parseCssWidthAsPercent(currentWidth, ele);
  const toPercent = parseCssWidthAsPercent(targetWidth, ele);
  if (fromPercent != null && toPercent != null && Math.abs(fromPercent - toPercent) < 0.05) {
    ele.style.width = `${toPercent.toFixed(2)}%`;
    return () => Promise.resolve();
  }

  const fromWidth = fromPercent != null ? `${fromPercent.toFixed(2)}%` : currentWidth;
  const toWidth = toPercent != null ? `${toPercent.toFixed(2)}%` : targetWidth;

  return () =>
    new Promise<void>((resolve) => {
      const animation = ele.animate([{ width: fromWidth }, { width: toWidth }], {
        duration: durationOfAnimation, // 1 second
        easing: "ease-in-out", // Optional easing function
        fill: "forwards", // Keep the final state after animation
      });
      animation.finished.then(() => resolve());
    });
}

/**
 * Interprets a CSS width as a percentage of the fill's parent meter.
 * @returns null when the width cannot be converted.
 */
function parseCssWidthAsPercent(width: string, element: HTMLElement): number | null {
  const trimmed = String(width ?? "").trim();
  if (trimmed.endsWith("%")) {
    const value = parseFloat(trimmed);
    return Number.isFinite(value) ? value : null;
  }
  const parentWidth = element.parentElement?.clientWidth ?? 0;
  if (parentWidth <= 0) {
    return null;
  }
  const pixels = parseFloat(trimmed);
  if (!Number.isFinite(pixels)) {
    return null;
  }
  return (pixels / parentWidth) * 100;
}

/**
 * Adds the glow-forever CSS class to the parent container of the given meter
 * fill element if the class is not already present. Called when a meter
 * reaches 100% to start the persistent glow animation.
 * @param ele - The meter fill element whose parent should receive the class.
 * @param type - `TYPE_BLESS` or `TYPE_CURSE`, used to select the CSS class.
 */
function animateGlowForever(ele: HTMLElement, type: string): void {
  const classToUse = gletGlowForeverClass(type);

  const parent = ele.parentElement;
  if (parent && !parent.classList.contains(classToUse)) {
    parent.classList.add(classToUse);
  }
}

/**
 * Returns the CSS class name for the glow-forever animation matching the given
 * type. `TYPE_BLESS` maps to {@link glowForeverClass}; all other types map to
 * {@link curseGlowForeverClass}.
 * @param type - `TYPE_BLESS` or `TYPE_CURSE`.
 */
function gletGlowForeverClass(type: string): string {
  return type == TYPE_BLESS ? glowForeverClass : curseGlowForeverClass;
}

/**
 * Removes the glow-forever CSS class from the parent container of the given
 * meter fill element. Called when a meter drops below 100%.
 * @param ele - The meter fill element whose parent should lose the class.
 * @param type - `TYPE_BLESS` or `TYPE_CURSE`, used to select the CSS class.
 */
function endGlowForever(ele: HTMLElement, type: string): void {
  if (ele.parentElement) {
    ele.parentElement.classList.remove(gletGlowForeverClass(type));
  }
}

//////////////////
// RESET FUNCTIONS
//////////////////

/**
 * Resets all current-run counters to zero and sets `showAll` to false, then
 * persists the updated state to SE_API.store. All-time counters are preserved.
 * Intended to be called between speedrun attempts via the reset button.
 */
function resetCurrentState(): void {
  SE_API.store.get(STORE_KEY_NAME).then((obj) => {
    if (!obj) return;
    obj.lastUpdated = new Date();
    obj.current = {
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
    };
    obj.showAll = false;
    SE_API.store.set(STORE_KEY_NAME, obj);
    lastWidgetState = obj;
  });
}

/**
 * Resets the entire widget state to {@link initialWidgetState} (all zeros) and
 * persists it to SE_API.store. Clears both current-run and all-time counters.
 */
function resetAllTimeState(): void {
  initialWidgetState.lastUpdated = new Date();
  // The theme is a display preference rather than run data, so it survives a reset.
  initialWidgetState[ATTRIBUTE_BACKGROUND_THEME] = getBackgroundTheme(lastWidgetState);
  SE_API.store.set(STORE_KEY_NAME, initialWidgetState);
  lastWidgetState = initialWidgetState;
}

//////////////////
// TOGGLE ALL TIME
//////////////////

/**
 * Toggles the all-time display mode by delegating to {@link toggleShowAllState}.
 * Intended to be wired to the all-time toggle button's onclick handler.
 */
function toggleAllTime(): void {
  console.log(`Toggling display ${JSON.stringify(lastWidgetState)}`);
  toggleShowAllState();
}

//////////////////////
// BACKGROUND THEME
//////////////////////

/**
 * Coerces a stored or user-supplied value to a known theme, defaulting to
 * {@link THEME_FFVI} so legacy and malformed states render the original look.
 * @param value - Candidate theme value.
 */
function normalizeBackgroundTheme(value: unknown): string {
  return value === THEME_CT ? THEME_CT : THEME_FFVI;
}

/**
 * @param widgetState - The state to read the theme from, or null/undefined.
 * @returns {@link THEME_FFVI} or {@link THEME_CT}.
 */
function getBackgroundTheme(widgetState: WidgetState | null | undefined): string {
  return normalizeBackgroundTheme(widgetState?.[ATTRIBUTE_BACKGROUND_THEME]);
}

/**
 * Applies the theme to the document and syncs the toggle button label.
 * @param theme - The theme to render.
 */
function applyBackgroundTheme(theme: string): void {
  const normalized = normalizeBackgroundTheme(theme);
  if (normalized === THEME_CT) {
    document.body.classList.add(CT_THEME_BODY_CLASS);
  } else {
    document.body.classList.remove(CT_THEME_BODY_CLASS);
  }
  updateBackgroundThemeButtonDisplay(normalized);
}

/**
 * Labels the toggle with the theme a click switches to, matching how the
 * all-time button advertises its action rather than its current state.
 * @param theme - The theme currently applied.
 */
function updateBackgroundThemeButtonDisplay(theme: string): void {
  const label = normalizeBackgroundTheme(theme) === THEME_CT ? "FF6" : "CT";
  $("#background-theme-toggle").text(label);
}

/**
 * Flips {@link ATTRIBUTE_BACKGROUND_THEME} in SE_API.store. The resulting
 * kvstore:update re-renders every widget instance with the new theme.
 */
function toggleBackgroundThemeState(): void {
  SE_API.store.get(STORE_KEY_NAME).then((obj) => {
    if (!storeHasBeenInitialized(obj)) {
      console.log("Toggling theme: the store object has not yet been initialized. Setting up initial values.");
      obj = initialWidgetState;
    }
    obj.lastUpdated = new Date();
    obj[ATTRIBUTE_BACKGROUND_THEME] = getBackgroundTheme(obj) === THEME_CT ? THEME_FFVI : THEME_CT;
    console.log(`Toggled background theme to ${obj[ATTRIBUTE_BACKGROUND_THEME]}`);
    SE_API.store.set(STORE_KEY_NAME, obj);
    // the SE.store.set function emits an onEventReceived for every custom widget
    lastWidgetState = obj;
  });
}

/**
 * Toggles between the FFVI and Chrono Trigger backgrounds.
 * Wired to the theme button's onclick handler.
 */
function toggleBackgroundTheme(): void {
  toggleBackgroundThemeState();
}

/**
 * Returns true when the widget is currently displaying all-time counts
 * (i.e. {@link ATTRIBUTE_SHOW_ALL} is present and truthy on `widgetState`).
 * @param widgetState - The state to check, or null/undefined.
 */
function isShowingAll(widgetState: WidgetState | null | undefined): boolean {
  const result =
    widgetState != undefined && widgetState[ATTRIBUTE_SHOW_ALL] != undefined && widgetState[ATTRIBUTE_SHOW_ALL];
  console.log(`isShowingAll? ${result}`);
  return result;
}

///////////////
// TESTING CODE
///////////////
/**
 * Dispatches a mock "Bless the Run" channel point redemption event on the
 * window. Used for testing in the StreamElements widget editor.
 */
function testBless(): void {
  window.dispatchEvent(mockRedeemEvent(blessTheRun));
}

/**
 * Dispatches a mock "Curse the Run" channel point redemption event on the
 * window. Used for testing in the StreamElements widget editor.
 */
function testCurse(): void {
  window.dispatchEvent(mockRedeemEvent(curseTheRun));
}

/**
 * Dispatches a mock "Blurse the Run" channel point redemption event on the
 * window. Used for testing in the StreamElements widget editor.
 */
function testBlurse(): void {
  window.dispatchEvent(mockRedeemEvent(blurseTheRun));
}

/**
 * Creates a synthetic StreamElements `onEventReceived` CustomEvent that mimics
 * a channel point redemption. Used by {@link testBless}, {@link testCurse},
 * and {@link testBlurse}.
 * @param redemptionName - The channel point reward name to simulate.
 * @returns A CustomEvent ready to be dispatched on the window.
 */
function mockRedeemEvent(redemptionName: string): CustomEvent<SEEventDetail> {
  return new CustomEvent<SEEventDetail>("onEventReceived", {
    detail: {
      event: {
        type: "channelPointsRedemption",
        data: {
          redemption: redemptionName,
        },
        name: "testUserName",
      },
    },
  });
}
