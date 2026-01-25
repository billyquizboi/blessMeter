const blurseTheRun = "Blurse the Run";
const blessTheRun = "Bless the Run";
const curseTheRun = "Curse the Run";

const glowForeverClass = 'animated-glow';
const glowOnceClass = 'animated-glow-once';
const curseGlowForeverClass = "animated-curse-glow";
const curseGlowOnceClass = "animated-curse-glow-once"

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
    },
    showAll: false
};

initialWidgetState.lastUpdated = new Date();

const STORE_KEY_NAME = "blessCurseMeterState";

const ATTRIBUTE_SHOW_ALL = "showAll";

const animationDuration = 1000;
const shortAnimationDuration = 1;

let meterMaximum = 15;

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
        } else {
            obj[ATTRIBUTE_SHOW_ALL] = !obj[ATTRIBUTE_SHOW_ALL];
        }
        SE_API.store.set(STORE_KEY_NAME, obj);
        // the SE.store.set function emits an onEventReceived for every custom widget
        lastWidgetState = obj;
    });
}

function incrementState(toIncrement, showAll) {
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
        obj[ATTRIBUTE_SHOW_ALL] = showAll;
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
    if (obj.detail != null
        && obj.detail.fieldData != null
        && obj.detail.fieldData.meterMaximum != null
        && typeof obj.detail.fieldData.meterMaximum === 'number')
    {
        if (!Number.isInteger(meterMaximum)) {
            meterMaximum = Math.floor(meterMaximum);
        }
        if (Number.isInteger(meterMaximum)) {
            meterMaximum = obj.detail.fieldData.meterMaximum;
        }
    }
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
            incrementState(numberOfBlessesKey, false);
            setTimeout(SE_API.resumeQueue, 1001);
        } else if (redemptionName == curseTheRun) {
            console.log(`Curse it: I say unto you Locke shall not steal this run.`);
            incrementState(numberOfCursesKey, false);
            setTimeout(SE_API.resumeQueue, 1001);
        } else if (redemptionName == blurseTheRun) {
            console.log(`Blurse it - who knows? Maybe gau, maybe no gau. Maybe black belt, maybe trench death.`);
            incrementState(numberOfBlursesKey, false);
            setTimeout(SE_API.resumeQueue, 1001);
        } else if (matchAnyRedemptionName) {
            // This is for testing the widget -- can make a random function or just always curse/always bless or whatever
            // Change 'matchAnyRedemptionName' variable at the top to one of true to use this, else should be false
            // add if wanted for testing
            incrementState(numberOfBlursesKey. false);
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

        if (total === 0) {
            console.log("No blesses, curses, or blurses. Hopefully this is expected in this scenario...");
            // trigger the display change
            animateChange(blessMeterFill.get(0), blessMeterFill.css("width"), "0%", animationTime, "bless");
            animateChange(curseMeterFill.get(0), curseMeterFill.css("width"), "0%", animationTime, "curse");
            getBlessInfoValue().text(0);
            getCurseInfoValue().text(0);
            getBlurseInfoValue().text("0/0");
            updateToggleButtonDisplay(isShowingAll(widgetState));
        } else {
            const effectiveBlesses = numberOfBlesses + (numberOfBlursesThatBlessed * 2);
            const effectiveCurses = numberOfCurses + (numberOfBlursesThatCursed * 2);
            const effectiveTotal = effectiveBlesses + effectiveCurses;

            console.log("Computing widths for the meters");
            console.log(`Current widths are bless: ${blessMeterFill.css("width")}, curse: ${curseMeterFill.css("width")}`);

            var blessWidth;
            var curseWidth;
            if (isShowingAll(widgetState)) {
                console.log(`Showing all so meter length is relative`);
                blessWidth = ((effectiveBlesses / effectiveTotal) * 100).toFixed(2) + "%";
                curseWidth = ((effectiveCurses / effectiveTotal) * 100).toFixed(2) + "%";
            } else {
                console.log(`Showing run so meter length is based on ${meterMaximum} max`);
                blessWidth = ( (effectiveBlesses >= meterMaximum ? 100 : (effectiveBlesses / meterMaximum) * 100) ).toFixed(2) + "%";
                curseWidth = ( (effectiveCurses >= meterMaximum ? 100 : (effectiveCurses / meterMaximum) * 100) ).toFixed(2) + "%";
            }
            updateToggleButtonDisplay(isShowingAll(widgetState));
            console.log(`Updating widths to bless: ${blessWidth}, curse: ${curseWidth}`);
            
            // trigger the display change
            animateChange(blessMeterFill.get(0), blessMeterFill.css("width"), blessWidth, animationTime, "bless");
            animateChange(curseMeterFill.get(0), curseMeterFill.css("width"), curseWidth, animationTime, "curse");
            // update lastCount attributes
            getBlessInfoValue().text(numberOfBlesses);
            getCurseInfoValue().text(numberOfCurses);
            getBlurseInfoValue().text(`${numberOfBlursesThatBlessed}/${numberOfBlursesThatCursed}`); // numberOfBlurses
        }
    } else {
        console.log(`Current widget state is undefined! Feels bad man ${JSON.stringify(widgetState)}`);
    }
}

function getCountFromState(widgetState, keyName) {
    if (isShowingAll(widgetState)) {
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

function updateToggleButtonDisplay(showAll) {
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

function animateChange(ele, currentWidth, targetWidth, durationOfAnimation, type) {
    if ("100.00%" === targetWidth) {
        animateGlowForever(ele, type);
    } else {
        animateGlowOnce(ele, type);
    }
    // animate the width
    ele.animate(
    [
        { width: currentWidth }, // Start width & color
        { width: targetWidth } // End width 
    ],
    {
        duration: durationOfAnimation, // 1 second
        easing: 'ease-in-out', // Optional easing function
        fill: 'forwards' // Keep the final state after animation
    });
}

function animateGlowOnce(ele, type) {
    var classToUse = getGlowOnceClass(type);
    var parent = ele.parentElement;
    var handler = function() {
        endGlowOnce(ele, classToUse);
    };
    parent.addEventListener("animationend", handler, false);
    parent.classList.add(classToUse);
}

function animateGlowForever(ele, type) {
    var classToUse = gletGlowForeverClass(type);

    var parent = ele.parentElement;
    if (parent.classList.contains(classToUse)) {
        endGlowOnce(ele, getGlowOnceClass(type));
    }
    if (!parent.classList.contains(classToUse)) {
        parent.classList.add(classToUse);
    }
}

function gletGlowForeverClass(type) {
    return (type == 'bless' ? glowForeverClass : curseGlowForeverClass);
}

function getGlowOnceClass(type) {
    return (type == 'bless' ? glowOnceClass : curseGlowOnceClass);
}

function endGlowOnce(ele) {
    ele.parentElement.removeEventListener("animationend", handler, false);
    ele.parentElement.classList.remove(glowOnceClass);
}

function endGlowForever(ele) {
    ele.parentElement.classList.remove(glowForeverClass);
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
            numberOfBlursesThatBlessed: 0,
            showAll: false
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
    console.log(`Toggling display ${JSON.stringify(lastWidgetState)}`);
    toggleShowAllState();
}

function isShowingAll(widgetState) {
    const isShowingAll = widgetState != undefined && widgetState[ATTRIBUTE_SHOW_ALL] != undefined && widgetState[ATTRIBUTE_SHOW_ALL];
    console.log(`isShowingAll? ${isShowingAll}`);
    return isShowingAll;
}

///////////////
// TESTING CODE 
///////////////
function testBless() {
    window.dispatchEvent(mockRedeemEvent(blessTheRun));
}

function testCurse() {
    window.dispatchEvent(mockRedeemEvent(curseTheRun));
}

function testBlurse() {
    window.dispatchEvent(mockRedeemEvent(blurseTheRun));
}

function mockRedeemEvent(redemptionName) {
    return new CustomEvent("onEventReceived", {
        detail: {
            event: {
                type: "channelPointsRedemption",
                data: {
                    redemption: redemptionName
                }
            }
        }
    });
}