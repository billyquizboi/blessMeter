const blurseTheRun = "Blurse the Run";
const blessTheRun = "Bless the Run";
const curseTheRun = "Curse the Run";

const numberOfBlessesKey = "numberOfBlesses";
const numberOfCursesKey = "numberOfCurses";
const numberOfBlursesKey = "numberOfBlurses";

const numberOfBlursesThatCursedKey = "numberOfBlursesThatCursed";
const numberOfBlursesThatBlessedKey = "numberOfBlursesThatBlessed";

// for testing use only you can set this to true
// don't use live or meter will change on every redeem of any type
const matchAnyRedemptionName = false;

const initialWidgetState = {
    current: {
        numberOfBlesses: 0,
        numberOfCurses: 0,
        numberOfBlurses: 0,
        numberOfBlursesThatCursed: 0,
        numberOfBlursesThatBlessed: 0
    },
    allTime: {
        numberOfBlesses: 0,
        numberOfCurses: 0,
        numberOfBlurses: 0,
        numberOfBlursesThatCursed: 0,
        numberOfBlursesThatBlessed: 0
    }
};

initialWidgetState.lastUpdated = new Date();

const STORE_KEY_NAME = "blessCurseMeterState";

const ATTRIBUTE_SHOW_ALL = "showAll";
const ATTRIBUTE_LAST_COUNT = "lastCount";

const animationDuration = 1000;
const shortAnimationDuration = 1;

var lastWidgetState = null;
initializeLastWidgetState();

function getBlessMeterFill() {
    return $("div.bless-container div.meter div.meter-fill");
}

function getCurseMeterFill() {
    return $("div.curse-container div.meter div.meter-fill");
}

function initializeLastWidgetState() {
    console.log("Trying to initialize last widget state");
    try {
        SE_API.store.get(STORE_KEY_NAME).then(obj => {
            lastWidgetState = obj;
        });
    } catch(error) {
        console.log(`Received error ${error}`);
    }
    if (lastWidgetState == null || lastWidgetState == undefined) {
        lastWidgetState = initialWidgetState;
    }
}

function updateState(toIncrement) {
    console.log(`Incrementing ${toIncrement}`);
    SE_API.store.get(STORE_KEY_NAME).then(obj => {
        console.log(`Retrieved widgetState from store is: ${JSON.stringify(obj)}`);
        if (storeHasBeenInitialized(obj)) {
            if (!canIncrement(obj, toIncrement)) {
                console.log(`Store has been initialized but cannot increment so something is wrong. Defaulting ${toIncrement} to 0 I guess.`);
                obj.current[toIncrement] = 0;
                obj.allTime[toIncrement] = 0;
            }
        } else {
            console.log("The store object has not yet been initialized. Setting up initial values.");
            obj = initialWidgetState;
        }
        // hanldes blurses
        if (toIncrement == numberOfBlursesKey) {
            if (Math.random() < 0.5) {
                // blessed af
                optionallyInitializeNumericField(obj, numberOfBlursesThatBlessedKey);
                obj.current[numberOfBlursesThatBlessedKey] += 1;
                obj.allTime[numberOfBlursesThatBlessedKey] += 1;
            } else {
                // curse it bby
                optionallyInitializeNumericField(obj, numberOfBlursesThatCursedKey);
                obj.current[numberOfBlursesThatCursedKey] += 1;
                obj.allTime[numberOfBlursesThatCursedKey] += 1;
            }
        }
        obj.current[toIncrement] += 1;
        obj.allTime[toIncrement] += 1;
        obj.lastUpdated = new Date();
        SE_API.store.set(STORE_KEY_NAME, obj);
        // the SE.store.set function emits an onEventReceived for every custom widget
        lastWidgetState = obj;
    });
}

function storeHasBeenInitialized(obj) {
    return obj != undefined
        && obj.current != undefined
        && obj.allTime != undefined;
}

function canIncrement(obj, toIncrement) {
    return obj != undefined
        && obj.current != undefined
        && obj.allTime != undefined
        && obj.current[toIncrement] != undefined
        && obj.allTime[toIncrement] != undefined;
}

function optionallyInitializeNumericField(obj, fieldName) {
    if (obj.current[fieldName] == undefined || typeof obj.current[fieldName] !== 'number') {
        obj.current[fieldName] = 0;
    }
    if (obj.allTime[fieldName] == undefined || typeof obj.allTime[fieldName] !== 'number') {
        obj.allTime[fieldName] = 0;
    }
}

function eventReceivedHandler(obj) {
    console.log(`Received an event ${JSON.stringify(obj)}`);
    if (!obj.detail.event) {
        console.log("obj.detail does not exist so exiting");
      return;
    }
    if (typeof obj.detail.event.itemId !== "undefined") {
        console.log(`obj.detail.event.itemId ${obj.detail.event.itemId}`);
        obj.detail.listener = "redemption-latest"
    }
    var listener;
    if (obj.detail.listener == undefined) {
        console.log(`obj.detail.listener is undefined`);
        listener = undefined;
    } else {
        console.log(`obj.detail.listener is ${obj.detail.listener}`);
        listener = obj.detail.listener.split("-")[0];
        console.log(`Determined listener to be ${listener}`);
    }
    const event = obj.detail.event;

    if (listener != 'redemption') {
        if (event.type === 'channelPointsRedemption') {
            listener = 'redemption';
        }
    }

    if (listener === 'redemption') {
        console.log("Redemption message received");
        console.log(JSON.stringify(obj.detail));
        handleRedemption(obj.detail);
    } else if (obj.detail.listener === 'kvstore:update') {
        console.log(`Key store was updated so update the widget display ${JSON.stringify(obj)}`);
        if (event != undefined && event.data != undefined
        && event.data.key === STORE_KEY_NAME && event.data.value != undefined) {
            console.log("Updating widget display");
            updateDisplay(event.data.value, true);
        } else {
            console.log(`This kvstore update may be invalid or not for us but we are going to check current state anyway as a fallback. This was necessary during testing on SE site.`);
            console.log(`A different key store item was saved ${JSON.stringify(obj)}`);
            SE_API.store.get(STORE_KEY_NAME).then(state => {
                console.log(`Retrieved widget state: ${JSON.stringify(state)}`);
                lastWidgetState = state;
                updateDisplay(state, true);
            });
        }
    } else {
        console.log(`Not doing anything with object ${JSON.stringify(obj)} and detail ${JSON.stringify(obj.detail)}`);
    }
}

window.addEventListener('onEventReceived', eventReceivedHandler); 

function widgetLoadHandler(obj) {
    // since we initialize from stored state we don't need to re-process recents
    try {
        SE_API.store.get(STORE_KEY_NAME).then(retrieved => {
            console.log(`Initializing with retrieved widgetState from store: ${JSON.stringify(retrieved)}`);
            if (storeHasBeenInitialized(retrieved)) {
                updateDisplay(retrieved, true);
            } else {
                console.log("The store object has not yet been initialized. Setting up initial values.");
                initialWidgetState.lastUpdated = new Date();
                const toSave = initialWidgetState;
                SE_API.store.set(STORE_KEY_NAME, toSave);
                // the SE.store.set function emits an onEventReceived for every custom widget
                lastWidgetState = toSave;
            }
        });
    } catch(error) {
        console.log(`onWidgetLoad threw error ${error}`);
    }
}

window.addEventListener('onWidgetLoad', widgetLoadHandler);

function handleRedemption(detail) {
    console.log("In redemption handling");
    const redemptionName = getRedemptionName(detail);
    if (redemptionName != undefined && redemptionName != null) {
        // we can do something
        console.log(`Redemption name is ${redemptionName}`);
        if (redemptionName == blessTheRun) {
            console.log(`Bless it: Verily let this run be bless-ed`);
            updateState(numberOfBlessesKey);
            setTimeout(SE_API.resumeQueue, 1001);
        } else if (redemptionName == curseTheRun) {
            console.log(`Curse it: I say unto you Locke shall not steal this run.`);
            updateState(numberOfCursesKey);
            setTimeout(SE_API.resumeQueue, 1001);
        } else if (redemptionName == blurseTheRun) {
            console.log(`Blurse it - who knows? Maybe gau, maybe no gau. Maybe black belt, maybe trench death.`);
            updateState(numberOfBlursesKey);
            setTimeout(SE_API.resumeQueue, 1001);
        } else if (matchAnyRedemptionName) {
            // This is for testing the widget -- can make a random function or just always curse/always bless or whatever
            // Change 'matchAnyRedemptionName' variable at the top to one of true to use this, else should be false
            // add if wanted for testing
            updateState(numberOfBlursesKey);
            setTimeout(SE_API.resumeQueue, 1001);
        }
    } else {
        // we fukt
        console.log(`Feels bad man. Redemption name not located in detail ${JSON.stringify(detail)}`);
    }
}

function getRedemptionName(detail) {
    var redemptionName = null;
    if (detail == undefined) {
        return null;
    }
    // for twitch this is where it actually is
    if (detail.event != undefined && detail.event.data != undefined) {
        redemptionName = detail.event.data.redemption;
    }
    // the rest of this is where I thought the redemption name would be either from the SE docs or SE mock redeems
    if (redemptionName == null && detail.session != undefined
      && detail.session.data != undefined
      && detail["session"]["data"]["channel-points-latest"] != undefined
    ) {
        // the name in this case is here
        // the stream elements docs for twitch suggest this is where it would be
        // but the emulate function on stream elements always has it in detail.event.itemId
        redemptionName = detail["session"]["data"]["channel-points-latest"]["redemption"];
    }
    if (redemptionName == null || redemptionName == undefined || redemptionName.length == 0) {
        if (detail.event != undefined) {
            // for testing in stream elements, the redemption name is here I believe
            redemptionName = detail.event.itemId;
        }
    }
    return redemptionName;
}

// TODO: If removing the blurse meter will have to change code relating to blurses
// - blurse meter was removed
// - needs to be effective curse/blurse +2 or -2 randomly
// - counters were added
// - counters need to be toggleable also for showing current vs. all
// - for current run:
//   - meters fill up to max of 25 and then counter keeps going but meter does not
// - for showing all:
//   - meters show relative size based on all time data

function updateDisplay(widgetState, showAnimate) {
    if (widgetState != undefined && widgetState.current != undefined) {
        console.log(`Updating meter display ${JSON.stringify(widgetState)}`);
        const numberOfBlesses = getCountFromState(widgetState, numberOfBlessesKey);
        const numberOfCurses = getCountFromState(widgetState, numberOfCursesKey);
        const numberOfBlurses = getCountFromState(widgetState, numberOfBlursesKey);

        const numberOfBlursesThatBlessed = getCountFromState(widgetState, numberOfBlursesThatBlessedKey);
        const numberOfBlursesThatCursed = getCountFromState(widgetState, numberOfBlursesThatCursedKey);

        const total = numberOfBlesses + numberOfCurses + numberOfBlurses;
        const animationTime = showAnimate ? animationDuration : shortAnimationDuration;

        const blessMeterFill = getBlessMeterFill();
        const curseMeterFill = getCurseMeterFill();

        if (numberOfBlesses === blessMeterFill.attr(ATTRIBUTE_LAST_COUNT)
            && numberOfCurses === curseMeterFill.attr(ATTRIBUTE_LAST_COUNT)) {
            console.log("No change detected to lastCount attributes. Will not update display.");
            return;
        }

        if (total === 0) {
            console.log("No blesses, curses, or blurses. Hopefully this is expected in this scenario...");
            // trigger the display change
            animateChange(blessMeterFill.get(0), blessMeterFill.css("width"), "0%", animationTime);
            animateChange(curseMeterFill.get(0), curseMeterFill.css("width"), "0%", animationTime);
            // update lastCount attributes
            blessMeterFill.attr(ATTRIBUTE_LAST_COUNT, numberOfBlesses);
            curseMeterFill.attr(ATTRIBUTE_LAST_COUNT, numberOfCurses);
        } else {
            const effectiveBlesses = numberOfBlesses + (numberOfBlursesThatBlessed * 2);
            const effectiveCurses = numberOfCurses + (numberOfBlursesThatCursed * 2);

            console.log("Computing widths for the meters");
            console.log(`Current widths are bless: ${blessMeterFill.css("width")}, curse: ${curseMeterFill.css("width")}`);

            var blessWidth;
            var curseWidth;
            var blurseWidth;
            if (isShowingAll()) {
                console.log(`Showing all so meter length is relative`);
                blessWidth = ((numberOfBlesses / total) * 100).toFixed(2) + "%";
                curseWidth = ((numberOfCurses / total) * 100).toFixed(2) + "%";
                blurseWidth = ((numberOfBlurses / total) * 100).toFixed(2) + "%";
            } else {
                console.log(`Showing all so meter length is based on 25 max`);
                blessWidth = ( (effectiveBlesses >= 25 ? 100 : (effectiveBlesses / 25) * 100) ).toFixed(2) + "%";
                curseWidth = ( (effectiveCurses >= 25 ? 100 : (effectiveCurses / 25) * 100) ).toFixed(2) + "%";
                blurseWidth = ( (numberOfBlurses >= 25 ? 100 : (numberOfBlurses / 25) * 100) ).toFixed(2) + "%";
            }
            console.log(`Updating widths to bless: ${blessWidth}, curse: ${curseWidth}, blurse: ${blurseWidth}`);
            
            // trigger the display change
            animateChange(blessMeterFill.get(0), blessMeterFill.css("width"), blessWidth, animationTime);
            animateChange(curseMeterFill.get(0), curseMeterFill.css("width"), curseWidth, animationTime);
            // update lastCount attributes
            // update lastCount attributes
            blessMeterFill.attr(ATTRIBUTE_LAST_COUNT, numberOfBlesses);
            curseMeterFill.attr(ATTRIBUTE_LAST_COUNT, numberOfCurses);

            getBlessInfoValue().text(numberOfBlesses);
            getCurseInfoValue().text(numberOfCurses);
            getBlurseInfoValue().text(numberOfBlurses);
        }
    } else {
        console.log(`Current widget state is undefined! Feels bad man ${JSON.stringify(widgetState)}`);
    }
}

function getCountFromState(widgetState, keyName) {
    if (isShowingAll()) {
        return getOrDefaultCount(widgetState.allTime[keyName]);
    } else {
        return getOrDefaultCount(widgetState.current[keyName]);
    }
}

function getOrDefaultCount(value) {
    if (value == undefined || value == NaN) {
        return 0;
    } else if (value < 0) {
        return 0;
    } else {
        return value;
    }
}

function getBlessInfoValue() {
    return $("span.bless-info-value");
}

function getCurseInfoValue() {
    return $("span.curse-info-value");
}

function getBlurseInfoValue() {
    return $("span.blurse-info-value");
}

function animateChange(ele, currentWidth, targetWidth, durationOfAnimation) {
    ele.animate(
    [
        { width: currentWidth }, // Start width
        { width: targetWidth }  // End width
    ],
    {
        duration: durationOfAnimation, // 1 second
        easing: 'ease-in-out', // Optional easing function
        fill: 'forwards' // Keep the final state after animation
    });
}

//////////////////
// RESET FUNCTIONS 
//////////////////

function resetCurrentState() {
    SE_API.store.get(STORE_KEY_NAME).then(obj => {
        obj.lastUpdated = new Date();
        obj.current = {
            numberOfBlesses: 0,
            numberOfCurses: 0,
            numberOfBlurses: 0,
            numberOfBlursesThatCursed: 0,
            numberOfBlursesThatBlessed: 0
        };
        SE_API.store.set(STORE_KEY_NAME, obj);
        lastWidgetState = obj;
    });
}

function resetAllTimeState() {
    initialWidgetState.lastUpdated = new Date();
    SE_API.store.set(STORE_KEY_NAME, initialWidgetState);
    lastWidgetState = initialWidgetState;
}


//////////////////
// TOGGLE ALL TIME 
//////////////////

function toggleAllTime() {
    toggleButton();
    updateDisplay(lastWidgetState, false);
}

function isShowingAll() {
    let showingAll = $("#all-time-toggle").attr(ATTRIBUTE_SHOW_ALL) == "true";
    console.log(`isShowingAll? ${showingAll}`);
    return showingAll;
}

function toggleButton() {
    console.log(`Toggling display ${JSON.stringify(lastWidgetState)}`);
    const button = $("#all-time-toggle");
    if (isShowingAll()) {
        console.log("Show all");
        button.text("Show all");
        button.attr(ATTRIBUTE_SHOW_ALL, "false");
        console.log(`Updated show all attribute to: ${button.attr(ATTRIBUTE_SHOW_ALL)}`);
    } else {
        console.log("Show run");
        button.text("Show run");
        button.attr(ATTRIBUTE_SHOW_ALL, "true");
        console.log(`Updated show all attribute to: ${button.attr(ATTRIBUTE_SHOW_ALL)}`);
    }
}

///////////////
// TESTING CODE 
///////////////

function testMeters() {
    for (var i = 0; i < 5; i++) {
        window.dispatchEvent(mockRedeemEvent(blessTheRun));
        setTimeout(() => {}, 1001);
    }

    for (var i = 0; i < 5; i++) {
        window.dispatchEvent(mockRedeemEvent(curseTheRun));
        setTimeout(() => {}, 1001);
    }

    for (var i = 0; i < 5; i++) {
        window.dispatchEvent(mockRedeemEvent(blurseTheRun));
        setTimeout(() => {}, 1001);
    }

    for (var i = 0; i < 5; i++) {
        window.dispatchEvent(mockRedeemEvent(blessTheRun));
        setTimeout(() => {}, 1001);
        window.dispatchEvent(mockRedeemEvent(curseTheRun));
        setTimeout(() => {}, 1001);
        window.dispatchEvent(mockRedeemEvent(blurseTheRun));
        setTimeout(() => {}, 1001);
    }
}

function mockRedeemEvent(redemptionName) {
    return new CustomEvent("onEventReceived", {
        detail: {
            event: {
                itemId: redemptionName
            }
        }
    });
}