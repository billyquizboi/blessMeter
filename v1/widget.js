"use strict";
// TODO: Revert to commit e7d5013a2605f3fd846c7eacf57f649821f4abd5
// TODO: Then, implement my own redemption queue
//   + animation queue for each redemption queue item with sprite laugh & casting animations
//   + the sprite animations should be longer for each redeem to be more enjoyable
//   + add testing for the complex cases of many redeems occurring rapidly
const blurseTheRun = "Blurse the Run";
const blessTheRun = "Bless the Run";
const curseTheRun = "Curse the Run";
const glowForeverClass = "animated-glow";
const curseGlowForeverClass = "animated-curse-glow";
const TYPE_BLESS = "bless";
const TYPE_CURSE = "curse";
const TYPE_BLURSE = "blurse";
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
};
// Lines 25–50 in original: object literal + separate lastUpdated assignment merged here
const initialWidgetState = {
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
    lastUpdated: new Date(),
};
const STORE_KEY_NAME = "blessCurseMeterState";
const ATTRIBUTE_SHOW_ALL = "showAll";
const animationDuration = 1000;
const shortAnimationDuration = 1;
let meterMaximum = 15;
let showChars = true;
let lastWidgetState = null;
const displayQueue = [];
let displayRunning = false;
let pendingCharType = null;
/** Returns the jQuery-wrapped meter fill element for the bless meter. */
function getBlessMeterFill() {
    return $("div.bless-container div.meter div.meter-fill");
}
/** Returns the jQuery-wrapped meter fill element for the curse meter. */
function getCurseMeterFill() {
    return $("div.curse-container div.meter div.meter-fill");
}
/** Returns the jQuery-wrapped bless character SVG element. */
function getBlessSvg() {
    return $("svg.bless-svg");
}
/** Returns the jQuery-wrapped curse character SVG element. */
function getCurseSvg() {
    return $("svg.curse-svg");
}
/**
 * Returns a jQuery-wrapped blurse character SVG element chosen at random
 * from the 9 available blurse SVGs.
 */
function getBlurseSvg() {
    // if number of blurse SVGs changes this '9' would have to change
    const randInt = Math.floor(Math.random() * 9) + 1;
    return $(`svg.blurse-svg-${randInt}`);
}
/**
 * Attempts to load the last saved widget state from SE_API.store into
 * {@link lastWidgetState}. Falls back to {@link initialWidgetState} if the
 * store returns null. Called once at module load time.
 */
function initializeLastWidgetState() {
    console.log("Trying to initialize last widget state");
    try {
        SE_API.store.get(STORE_KEY_NAME).then(obj => {
            lastWidgetState = obj;
        });
    }
    catch (error) {
        console.log(`Received error ${error}`);
    }
    if (lastWidgetState == null || lastWidgetState == undefined) {
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
function toggleShowAllState() {
    console.log(`Toggling state showAll`);
    SE_API.store.get(STORE_KEY_NAME).then(obj => {
        console.log(`Toggling showAll: Retrieved widgetState from store is: ${JSON.stringify(obj)}`);
        if (!storeHasBeenInitialized(obj)) {
            console.log(`Toggling state showAll: The store object has not yet been initialized. Setting up initial values.`);
            obj = initialWidgetState;
        }
        obj.lastUpdated = new Date();
        if (obj[ATTRIBUTE_SHOW_ALL] == undefined) {
            obj[ATTRIBUTE_SHOW_ALL] = true;
        }
        else {
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
function incrementState(toIncrement) {
    console.log(`Incrementing ${toIncrement}`);
    SE_API.store.get(STORE_KEY_NAME).then(obj => {
        console.log(`Retrieved widgetState from store is: ${JSON.stringify(obj)}`);
        if (storeHasBeenInitialized(obj)) {
            if (!canIncrement(obj, toIncrement)) {
                console.log(`Store has been initialized but cannot increment so something is wrong. Defaulting ${toIncrement} to 0 I guess.`);
                obj.current[toIncrement] = 0;
                obj.allTime[toIncrement] = 0;
            }
        }
        else {
            console.log("The store object has not yet been initialized. Setting up initial values.");
            obj = initialWidgetState;
        }
        // hanldes blurses
        if (toIncrement == StateKeys.numberOfBlurses) {
            if (Math.random() < 0.5) {
                // blessed af
                optionallyInitializeNumericField(obj, StateKeys.numberOfBlursesThatBlessed);
                obj.current[StateKeys.numberOfBlursesThatBlessed] += 1;
                obj.allTime[StateKeys.numberOfBlursesThatBlessed] += 1;
            }
            else {
                // curse it bby
                optionallyInitializeNumericField(obj, StateKeys.numberOfBlursesThatCursed);
                obj.current[StateKeys.numberOfBlursesThatCursed] += 1;
                obj.allTime[StateKeys.numberOfBlursesThatCursed] += 1;
            }
        }
        obj.current[toIncrement] += 1;
        obj.allTime[toIncrement] += 1;
        obj.lastUpdated = new Date();
        if (bothMetersAreAtMax(obj)) {
            const newState = resetMetersButKeepCurrentState(obj);
            if (newState) {
                SE_API.store.set(STORE_KEY_NAME, newState);
            }
        }
        else {
            SE_API.store.set(STORE_KEY_NAME, obj);
        }
        // the SE.store.set function emits an onEventReceived for every custom widget
        lastWidgetState = obj;
    });
}
/**
 * Builds a new {@link WidgetState} where all current counters are zeroed and
 * the previous current counts are accumulated into the corresponding preReset
 * fields. allTime counts and showAll are preserved unchanged.
 * Returns undefined if the supplied state is invalid.
 * @param widgetState - The state to reset.
 * @returns The new zeroed state, or undefined if widgetState is invalid.
 */
function resetMetersButKeepCurrentState(widgetState) {
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
    const numberOfBlessesPreReset = getOrDefaultCount(widgetState.current[StateKeys.numberOfBlessesPreReset]) + numberOfBlesses;
    const numberOfCursesPreReset = getOrDefaultCount(widgetState.current[StateKeys.numberOfCursesPreReset]) + numberOfCurses;
    const numberOfBlursesPreReset = getOrDefaultCount(widgetState.current[StateKeys.numberOfBlursesPreReset]) + numberOfBlurses;
    const numberOfBlursesThatBlessedPreReset = getOrDefaultCount(widgetState.current[StateKeys.numberOfBlursesThatBlessedPreReset]) + numberOfBlursesThatBlessed;
    const numberOfBlursesThatCursedPreReset = getOrDefaultCount(widgetState.current[StateKeys.numberOfBlursesThatCursedPreReset]) + numberOfBlursesThatCursed;
    // Structured as a complete WidgetState literal for TypeScript type safety.
    // Original built this incrementally via property assignments.
    const newState = {
        lastUpdated: new Date(),
        allTime: widgetState.allTime,
        showAll: widgetState.showAll,
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
function storeHasBeenInitialized(obj) {
    return obj != undefined
        && obj.current != undefined
        && obj.allTime != undefined;
}
/**
 * Returns true when {@link obj} is a valid {@link WidgetState} and the named
 * field exists in both `current` and `allTime`, meaning it is safe to
 * increment without creating a NaN or undefined result.
 * @param obj - The widget state to check.
 * @param toIncrement - The field name to verify.
 */
function canIncrement(obj, toIncrement) {
    return obj != undefined
        && obj.current != undefined
        && obj.allTime != undefined
        && obj.current[toIncrement] != undefined
        && obj.allTime[toIncrement] != undefined;
}
/**
 * Ensures the named field exists as a numeric value in both
 * {@link WidgetState.current} and {@link WidgetState.allTime}.
 * If the field is missing or not a number it is set to 0.
 * Used to initialize blurse sub-fields before incrementing them.
 * @param obj - The widget state to mutate.
 * @param fieldName - The field to initialize if absent or non-numeric.
 */
function optionallyInitializeNumericField(obj, fieldName) {
    if (obj.current[fieldName] == undefined || typeof obj.current[fieldName] !== "number") {
        obj.current[fieldName] = 0;
    }
    if (obj.allTime[fieldName] == undefined || typeof obj.allTime[fieldName] !== "number") {
        obj.allTime[fieldName] = 0;
    }
}
/**
 * Handles the StreamElements `onEventReceived` window event.
 * Routes the event to {@link handleRedemption} for channel point redemptions,
 * or calls {@link updateDisplay} when a `kvstore:update` signals that the
 * widget state has changed in the store.
 * @param event - The raw DOM event emitted by StreamElements.
 */
function eventReceivedHandler(event) {
    const obj = event;
    console.log(`Received an event ${JSON.stringify(obj)}`);
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
    let listener;
    if (obj.detail.listener == undefined) {
        console.log(`obj.detail.listener is undefined`);
        listener = undefined;
    }
    else {
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
    }
    else if (detail.listener === "kvstore:update") {
        console.log(`Key store was updated so update the widget display ${JSON.stringify(obj)}`);
        if (seEvent != undefined && seEvent.data != undefined
            && seEvent.data.key === STORE_KEY_NAME && seEvent.data.value != undefined) {
            console.log("Updating widget display");
            updateDisplay(seEvent.data.value, true);
        }
        else {
            console.log(`This kvstore update may be invalid or not for us but we are going to check current state anyway as a fallback. This was necessary during testing on SE site.`);
            console.log(`A different key store item was saved ${JSON.stringify(obj)}`);
            SE_API.store.get(STORE_KEY_NAME).then(state => {
                console.log(`Retrieved widget state: ${JSON.stringify(state)}`);
                lastWidgetState = state;
                updateDisplay(state, true);
            });
        }
    }
    else {
        console.log(`Not doing anything with object ${JSON.stringify(obj)} and detail ${JSON.stringify(detail)}`);
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
function widgetLoadHandler(event) {
    const obj = event;
    // since we initialize from stored state we don't need to re-process recents
    if (obj.detail != null && obj.detail.fieldData != null) {
        if (obj.detail.fieldData.meterMaximum != null && typeof obj.detail.fieldData.meterMaximum === "number") {
            if (!Number.isInteger(meterMaximum)) {
                meterMaximum = Math.floor(meterMaximum);
            }
            if (Number.isInteger(meterMaximum)) {
                meterMaximum = obj.detail.fieldData.meterMaximum;
            }
        }
        if (obj.detail.fieldData.showChars != null && typeof obj.detail.fieldData.showChars === "boolean") {
            showChars = obj.detail.fieldData.showChars;
        }
    }
    try {
        SE_API.store.get(STORE_KEY_NAME).then(retrieved => {
            console.log(`Initializing with retrieved widgetState from store: ${JSON.stringify(retrieved)}`);
            if (storeHasBeenInitialized(retrieved)) {
                updateDisplay(retrieved, true);
            }
            else {
                console.log("The store object has not yet been initialized. Setting up initial values.");
                initialWidgetState.lastUpdated = new Date();
                const toSave = initialWidgetState;
                SE_API.store.set(STORE_KEY_NAME, toSave);
                // the SE.store.set function emits an onEventReceived for every custom widget
                lastWidgetState = toSave;
            }
        });
    }
    catch (error) {
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
function handleRedemption(detail) {
    console.log("In redemption handling");
    const redemptionName = getRedemptionName(detail);
    if (redemptionName != undefined && redemptionName != null) {
        // we can do something
        console.log(`Redemption name is ${redemptionName}`);
        if (redemptionName == blessTheRun) {
            console.log(`Bless it: Verily let this run be bless-ed`);
            pendingCharType = TYPE_BLESS;
            incrementState(StateKeys.numberOfBlesses);
        }
        else if (redemptionName == curseTheRun) {
            console.log(`Curse it: I say unto you Locke shall not steal this run.`);
            pendingCharType = TYPE_CURSE;
            incrementState(StateKeys.numberOfCurses);
        }
        else if (redemptionName == blurseTheRun) {
            console.log(`Blurse it - who knows? Maybe gau, maybe no gau. Maybe black belt, maybe trench death.`);
            pendingCharType = TYPE_BLURSE;
            incrementState(StateKeys.numberOfBlurses);
        }
        else {
            console.log(`Not handling redemption ${redemptionName}`);
        }
    }
    else {
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
function showCharSvg(type) {
    if (!showChars) {
        console.log("Not running the showChars functionality");
        return Promise.resolve();
    }
    let target = null;
    const targets = [
        getBlessSvg(),
        getCurseSvg(),
        getBlurseSvg(),
    ];
    if (type === TYPE_BLESS) {
        target = targets[0];
    }
    else if (type === TYPE_CURSE) {
        target = targets[1];
    }
    else if (type === TYPE_BLURSE) {
        target = targets[2];
    }
    else {
        console.log(`Unable to locate svg target for type '${type}'`);
        return Promise.resolve();
    }
    console.log(`For type '${type}' located target ${JSON.stringify(target.length > 0 ? target.get(0) : "None Found!")}`);
    if (target && target.length > 0) {
        console.log(`Showing ${JSON.stringify(target.get(0))}`);
        const finalTarget = target;
        return new Promise(resolve => {
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
function bothMetersAreAtMax(widgetState) {
    const numberOfBlesses = getOrDefaultCount(widgetState.current[StateKeys.numberOfBlesses]);
    const numberOfCurses = getOrDefaultCount(widgetState.current[StateKeys.numberOfCurses]);
    const numberOfBlursesThatBlessed = getOrDefaultCount(widgetState.current[StateKeys.numberOfBlursesThatBlessed]);
    const numberOfBlursesThatCursed = getOrDefaultCount(widgetState.current[StateKeys.numberOfBlursesThatCursed]);
    const effectiveBlesses = numberOfBlesses + (numberOfBlursesThatBlessed * 2);
    const effectiveCurses = numberOfCurses + (numberOfBlursesThatCursed * 2);
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
function getRedemptionName(detail) {
    var _a, _b, _c;
    let redemptionName = null;
    if (detail == undefined) {
        return null;
    }
    // for twitch this is where it actually is
    if (detail.event != undefined && detail.event.data != undefined) {
        redemptionName = (_a = detail.event.data.redemption) !== null && _a !== void 0 ? _a : null;
    }
    // the rest of this is where I thought the redemption name would be either from the SE docs or SE mock redeems
    if (redemptionName == null && detail.session != undefined
        && detail.session.data != undefined
        && detail.session.data["channel-points-latest"] != undefined) {
        // the name in this case is here
        // the stream elements docs for twitch suggest this is where it would be
        // but the emulate function on stream elements always has it in detail.event.itemId
        redemptionName = (_b = detail.session.data["channel-points-latest"].redemption) !== null && _b !== void 0 ? _b : null;
    }
    if (redemptionName == null || redemptionName == undefined || redemptionName.length == 0) {
        if (detail.event != undefined) {
            // for testing in stream elements, the redemption name is here I believe
            redemptionName = (_c = detail.event.itemId) !== null && _c !== void 0 ? _c : null;
        }
    }
    return redemptionName;
}
/**
 * Entry point for display updates. Captures and clears {@link pendingCharType},
 * then either processes the update immediately (via {@link processDisplay}) or
 * enqueues it in {@link displayQueue} if a display cycle is already in
 * progress. This ensures meter width is always read from the settled DOM state
 * after the previous redemption's animations have fully completed.
 * @param widgetState - The state to render, or null to skip the update.
 * @param showAnimate - When true uses the full {@link animationDuration};
 *   when false uses {@link shortAnimationDuration} for an instant update.
 */
function updateDisplay(widgetState, showAnimate) {
    // Capture and clear before any async work so rapid redemptions don't bleed over.
    const charType = pendingCharType;
    pendingCharType = null;
    if (widgetState == null || widgetState.current == undefined) {
        console.log(`Current widget state is undefined! Feels bad man ${JSON.stringify(widgetState)}`);
        return;
    }
    if (displayRunning) {
        displayQueue.push({ widgetState, charType, showAnimate });
        return;
    }
    processDisplay(widgetState, charType, showAnimate);
}
/**
 * Performs the actual DOM update and starts the meter and character SVG
 * animations for one redemption cycle. Sets {@link displayRunning} to true
 * for the duration and calls {@link drainDisplayQueue} when all animations
 * resolve, triggering the next queued entry if one is present.
 * Only called by {@link updateDisplay} and {@link drainDisplayQueue}.
 * @param widgetState - The validated, non-null state to render.
 * @param charType - The character SVG type to show, or null if none.
 * @param showAnimate - When true uses the full {@link animationDuration};
 *   when false uses {@link shortAnimationDuration} for an instant update.
 */
function processDisplay(widgetState, charType, showAnimate) {
    displayRunning = true;
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
    const preResetBlursesThatBlessed = getOrDefaultCount(widgetState.current[StateKeys.numberOfBlursesThatBlessedPreReset]);
    const preResetBlursesThatCursed = getOrDefaultCount(widgetState.current[StateKeys.numberOfBlursesThatCursedPreReset]);
    const blessMeterFill = getBlessMeterFill();
    const curseMeterFill = getCurseMeterFill();
    let blessFactory;
    let curseFactory;
    if (total === 0) {
        console.log("No blesses, curses, or blurses. Hopefully this is expected in this scenario...");
        // Build factories now (captures current widths; glow class changes happen immediately).
        blessFactory = animateChange(blessMeterFill.get(0), blessMeterFill.css("width"), "0%", animationTime, TYPE_BLESS);
        curseFactory = animateChange(curseMeterFill.get(0), curseMeterFill.css("width"), "0%", animationTime, TYPE_CURSE);
        getBlessInfoValue().text(preResetBlesses);
        getCurseInfoValue().text(preResetCurses);
        getBlurseInfoValue().text(`${preResetBlursesThatBlessed} / ${preResetBlursesThatCursed}`);
        updateToggleButtonDisplay(isShowingAll(widgetState));
    }
    else {
        const effectiveBlesses = numberOfBlesses + (numberOfBlursesThatBlessed * 2);
        const effectiveCurses = numberOfCurses + (numberOfBlursesThatCursed * 2);
        const effectiveTotal = effectiveBlesses + effectiveCurses;
        console.log("Computing widths for the meters");
        console.log(`Current widths are bless: ${blessMeterFill.css("width")}, curse: ${curseMeterFill.css("width")}`);
        let blessWidth;
        let curseWidth;
        if (isShowingAll(widgetState)) {
            console.log(`Showing all so meter length is relative`);
            blessWidth = ((effectiveBlesses / effectiveTotal) * 100).toFixed(2) + "%";
            curseWidth = ((effectiveCurses / effectiveTotal) * 100).toFixed(2) + "%";
        }
        else {
            console.log(`Showing run so meter length is based on ${meterMaximum} max`);
            blessWidth = ((effectiveBlesses >= meterMaximum ? 100 : (effectiveBlesses / meterMaximum) * 100)).toFixed(2) + "%";
            curseWidth = ((effectiveCurses >= meterMaximum ? 100 : (effectiveCurses / meterMaximum) * 100)).toFixed(2) + "%";
        }
        updateToggleButtonDisplay(isShowingAll(widgetState));
        console.log(`Updating widths to bless: ${blessWidth}, curse: ${curseWidth}`);
        // Build factories now (captures current widths; glow class changes happen immediately).
        blessFactory = animateChange(blessMeterFill.get(0), blessMeterFill.css("width"), blessWidth, animationTime, TYPE_BLESS);
        curseFactory = animateChange(curseMeterFill.get(0), curseMeterFill.css("width"), curseWidth, animationTime, TYPE_CURSE);
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
        getBlessInfoValue().text(blessCounterText);
        getCurseInfoValue().text(curseCounterText);
        getBlurseInfoValue().text(`${blurseThatBlessedCounterText}/${blurseThatCursedCounterText}`);
    }
    const animations = [blessFactory(), curseFactory()];
    if (charType !== null) {
        animations.push(showCharSvg(charType));
    }
    Promise.all(animations).then(() => drainDisplayQueue());
}
/**
 * Returns the count for the named key from the appropriate portion of state:
 * `allTime` when {@link isShowingAll} is true, `current` otherwise.
 * @param widgetState - The state to read from.
 * @param keyName - A {@link StateKeys} value identifying the counter.
 */
function getCountFromState(widgetState, keyName) {
    if (isShowingAll(widgetState)) {
        return getOrDefaultCount(widgetState.allTime[keyName]);
    }
    else {
        return getOrDefaultCount(widgetState.current[keyName]);
    }
}
/**
 * Returns the numeric value clamped to a minimum of 0, or 0 if the value is
 * undefined, NaN, or negative.
 * @param value - The raw value from the widget state.
 * @returns A non-negative number, or 0 for invalid input.
 */
function getOrDefaultCount(value) {
    // Original used `value == NaN` which is always false (NaN !== NaN).
    // Replaced with Number.isNaN() so the check is actually meaningful.
    if (value == undefined || Number.isNaN(value)) {
        return 0;
    }
    else if (value < 0) {
        return 0;
    }
    else {
        return value;
    }
}
/** Returns the jQuery-wrapped span element that displays the bless count. */
function getBlessInfoValue() {
    return $("span.bless-info-value");
}
/** Returns the jQuery-wrapped span element that displays the curse count. */
function getCurseInfoValue() {
    return $("span.curse-info-value");
}
/** Returns the jQuery-wrapped span element that displays the blurse count. */
function getBlurseInfoValue() {
    return $("span.blurse-info-value");
}
/**
 * Updates the all-time toggle button label.
 * Sets the text to "Show run" when `showAll` is true (all-time view is active)
 * or "Show all" when `showAll` is false (current-run view is active).
 * @param showAll - The current value of the showAll flag.
 */
function updateToggleButtonDisplay(showAll) {
    const toggleButton = $("#all-time-toggle");
    if (showAll) {
        console.log("Show all");
        toggleButton.text("Show run");
        console.log(`Updated show all attribute to: ${showAll}`);
    }
    else {
        console.log("Show run");
        toggleButton.text("Show all");
        console.log(`Updated show all attribute to: ${showAll}`);
    }
}
/**
 * Processes the next entry in {@link displayQueue} by calling
 * {@link processDisplay} with the queued state. Sets {@link displayRunning}
 * to false and returns when the queue is empty, allowing the next
 * {@link updateDisplay} call to proceed immediately.
 */
function drainDisplayQueue() {
    const next = displayQueue.shift();
    if (!next) {
        displayRunning = false;
        return;
    }
    processDisplay(next.widgetState, next.charType, next.showAnimate);
}
/**
 * Handles glow state immediately (adds or removes the glow CSS class on the
 * meter container) then returns a factory function that starts the WAAPI width
 * animation when called.
 * The returned factory is invoked immediately inside {@link processDisplay}
 * so the animation only starts once the previous redemption's display cycle
 * has fully completed.
 * @param ele - The meter fill element to animate, or undefined (no-op).
 * @param currentWidth - CSS width string representing the starting width.
 * @param targetWidth - CSS width string representing the ending width.
 * @param durationOfAnimation - Animation duration in milliseconds.
 * @param type - `TYPE_BLESS` or `TYPE_CURSE`, used to select the glow class.
 * @returns A factory that starts the animation and resolves when it finishes.
 */
function animateChange(ele, currentWidth, targetWidth, durationOfAnimation, type) {
    // Guard added for TypeScript: jQuery's .get(0) returns HTMLElement | undefined
    if (!ele)
        return () => Promise.resolve();
    if ("100.00%" === targetWidth) {
        animateGlowForever(ele, type);
    }
    else {
        endGlowForever(ele, type);
    }
    return () => new Promise(resolve => {
        const animation = ele.animate([
            { width: currentWidth }, // Start width & color
            { width: targetWidth }, // End width
        ], {
            duration: durationOfAnimation, // 1 second
            easing: "ease-in-out", // Optional easing function
            fill: "forwards", // Keep the final state after animation
        });
        animation.finished.then(() => resolve());
    });
}
/**
 * Adds the glow-forever CSS class to the parent container of the given meter
 * fill element if the class is not already present. Called when a meter
 * reaches 100% to start the persistent glow animation.
 * @param ele - The meter fill element whose parent should receive the class.
 * @param type - `TYPE_BLESS` or `TYPE_CURSE`, used to select the CSS class.
 */
function animateGlowForever(ele, type) {
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
function gletGlowForeverClass(type) {
    return type == TYPE_BLESS ? glowForeverClass : curseGlowForeverClass;
}
/**
 * Removes the glow-forever CSS class from the parent container of the given
 * meter fill element. Called when a meter drops below 100%.
 * @param ele - The meter fill element whose parent should lose the class.
 * @param type - `TYPE_BLESS` or `TYPE_CURSE`, used to select the CSS class.
 */
function endGlowForever(ele, type) {
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
function resetCurrentState() {
    SE_API.store.get(STORE_KEY_NAME).then(obj => {
        if (!obj)
            return;
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
function resetAllTimeState() {
    initialWidgetState.lastUpdated = new Date();
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
function toggleAllTime() {
    console.log(`Toggling display ${JSON.stringify(lastWidgetState)}`);
    toggleShowAllState();
}
/**
 * Returns true when the widget is currently displaying all-time counts
 * (i.e. {@link ATTRIBUTE_SHOW_ALL} is present and truthy on `widgetState`).
 * @param widgetState - The state to check, or null/undefined.
 */
function isShowingAll(widgetState) {
    const result = widgetState != undefined
        && widgetState[ATTRIBUTE_SHOW_ALL] != undefined
        && !!widgetState[ATTRIBUTE_SHOW_ALL];
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
function testBless() {
    window.dispatchEvent(mockRedeemEvent(blessTheRun));
}
/**
 * Dispatches a mock "Curse the Run" channel point redemption event on the
 * window. Used for testing in the StreamElements widget editor.
 */
function testCurse() {
    window.dispatchEvent(mockRedeemEvent(curseTheRun));
}
/**
 * Dispatches a mock "Blurse the Run" channel point redemption event on the
 * window. Used for testing in the StreamElements widget editor.
 */
function testBlurse() {
    window.dispatchEvent(mockRedeemEvent(blurseTheRun));
}
/**
 * Creates a synthetic StreamElements `onEventReceived` CustomEvent that mimics
 * a channel point redemption. Used by {@link testBless}, {@link testCurse},
 * and {@link testBlurse}.
 * @param redemptionName - The channel point reward name to simulate.
 * @returns A CustomEvent ready to be dispatched on the window.
 */
function mockRedeemEvent(redemptionName) {
    return new CustomEvent("onEventReceived", {
        detail: {
            event: {
                type: "channelPointsRedemption",
                data: {
                    redemption: redemptionName,
                },
            },
        },
    });
}
