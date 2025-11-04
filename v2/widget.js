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
const matchAnyRedemptionName = true;

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
        numberOfBlursesThatBlessedKey: 0
    }
};

initialWidgetState.lastUpdated = new Date();

const STORE_KEY_NAME = "blessCurseMeterState_V2";

const ATTRIBUTE_SHOW_ALL = "data-showAll";
const ATTRIBUTE_LAST_COUNT = "data-lastCount";

const animationDuration = 500;
const shortAnimationDuration = 1;

var lastWidgetState = null;
initializeLastWidgetState();

function getBlessMeterFill() {
    return document.querySelector("div.bless-meter-fill");
}

function getCurseMeterFill() {
    return document.querySelector("div.curse-fill-container");
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
        obj.current[toIncrement] += 1;
        obj.allTime[toIncrement] += 1;

        // hanldes blurses
        if (toIncrement == numberOfBlursesKey) {
            if (Math.random() < 0.5) {
                // blessed af
                optionallyInitializeNumericField(obj, numberOfBlursesThatBlessedKey);
                obj.current[numberOfBlursesThatBlessedKey] += 1;
            } else {
                // curse it bby
                optionallyInitializeNumericField(obj, numberOfBlursesThatCursedKey);
                obj.current[numberOfBlursesThatCursedKey] += 1;
            }
        }
        obj.lastUpdated = new Date();
        SE_API.store.set(STORE_KEY_NAME, obj);
        // the SE.store.set function emits an onEventReceived for every custom widget
        lastWidgetState = obj;
    });
}

function optionallyInitializeNumericField(obj, fieldName) {
    if (obj.current[fieldName] == undefined || typeof obj.current[fieldName] !== 'number') {
        obj.current[fieldName] = 0;
    }
    if (obj.allTime[fieldName] == undefined || typeof obj.allTime[fieldName] !== 'number') {
        obj.allTime[fieldName] = 0;
    }
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

function eventReceivedHandler(obj) {
    console.log(`Received an event ${JSON.stringify(obj)}`);
    if (!obj.detail.event) {
      return;
    }
    if (typeof obj.detail.event.itemId !== "undefined") {
        obj.detail.listener = "redemption-latest"
    }
    var listener;
    if (obj.detail.listener == undefined) {
        listener = undefined;
    } else {
        listener = obj.detail.listener.split("-")[0];
    }
    const event = obj.detail.event;
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
            setTimeout(SE_API.resumeQueue, animationDuration + 1);
        } else if (redemptionName == curseTheRun) {
            console.log(`Curse it: I say unto you Locke shall not steal this run.`);
            updateState(numberOfCursesKey);
            setTimeout(SE_API.resumeQueue, animationDuration + 1);
        } else if (redemptionName == blurseTheRun) {
            console.log(`Blurse it - who knows? Maybe gau, maybe no gau. Maybe black belt, maybe trench death.`);
            updateState(numberOfBlursesKey);
            setTimeout(SE_API.resumeQueue, animationDuration + 1);
        } else if (matchAnyRedemptionName) {
            // This is for testing the widget -- can make a random function or just always curse/always bless or whatever
            // Change 'matchAnyRedemptionName' variable at the top to one of true to use this, else should be false
            // add if wanted for testing
            updateState(numberOfBlursesKey);
            setTimeout(SE_API.resumeQueue, animationDuration + 1);
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
    if (detail.session != undefined
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
        const numberOfBlesses = getEffectiveBlesses(widgetState);
        const numberOfCurses = getEffectiveCurses(widgetState);

        console.log(`Effective blesses ${numberOfBlesses}`);
        console.log(`Effective curses ${numberOfCurses}`);

        // TODO: handle displaying difference
        const total = numberOfBlesses + numberOfCurses;
        const animationTime = showAnimate ? animationDuration : shortAnimationDuration;

        const blessMeterFill = getBlessMeterFill();
        const curseMeterFill = getCurseMeterFill();

        const lastBlessCount = blessMeterFill.getAttribute(ATTRIBUTE_LAST_COUNT);
        const lastCurseCount = curseMeterFill.getAttribute(ATTRIBUTE_LAST_COUNT);

        if (numberOfBlesses === lastBlessCount
            && numberOfCurses === lastCurseCount) {
            console.log("No change detected to lastCount attributes. Will not update display.");
            return;
        }

        var targetBlessHeight = "0%";
        var targetCurseHeight = "0%";

        if (total === 0) {
            console.log("No blesses, curses, or blurses. Hopefully this is expected in this scenario...");
        } else {
            console.log("Computing heights for the meters");
            console.log(`Current heights are bless: ${blessMeterFill.offsetHeight + "px"}, curse: ${curseMeterFill.offsetHeight + "px"}`);
            
            const isBlessed = numberOfBlesses > numberOfCurses;
            const isCursed = numberOfCurses > numberOfBlesses;

            if (isBlessed) {
                var difference = (numberOfBlesses - numberOfCurses);
                if (difference > 50) {
                    difference = 50;
                }
                var blessedPixels = (( difference / 50 ) * 250).toFixed() + "px";
                console.log(`Bless is winning. Bless height is going to: ${blessedPixels}`);
                targetBlessHeight = blessedPixels;
            } else if (isCursed) {
                var difference = (numberOfCurses - numberOfBlesses);
                if (difference > 50) {
                    difference = 50;
                }
                var cursedPixels = (( difference / 50 ) * 250).toFixed() + "px";
                console.log(`Curse is winning. Curse height is going to: ${cursedPixels}`);
                targetCurseHeight = cursedPixels;
            } else {
                // is even
                console.log("It's all even");
            }
        }
        // trigger the display change
        animateChange(blessMeterFill, blessMeterFill.offsetHeight + "px", targetBlessHeight, animationTime);
        animateChange(curseMeterFill, curseMeterFill.offsetHeight + "px", targetCurseHeight, animationTime);
        // update lastCount attributes
        blessMeterFill.setAttribute(ATTRIBUTE_LAST_COUNT, numberOfBlesses);
        curseMeterFill.setAttribute(ATTRIBUTE_LAST_COUNT, numberOfCurses);
    } else {
        console.log(`Current widget state is undefined! Feels bad man ${JSON.stringify(widgetState)}`);
    }
}

function getEffectiveBlesses(widgetState) {
    return (getCountFromState(widgetState, numberOfBlessesKey) * 2) + getCountFromState(widgetState, numberOfBlursesThatBlessedKey);
}

function getEffectiveCurses(widgetState) {
    return (getCountFromState(widgetState, numberOfCursesKey) * 2) + getCountFromState(widgetState, numberOfBlursesThatCursedKey);
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

function animateChange(ele, currentHeight, targetHeight, durationOfAnimation) {
    ele.animate(
    [
        { height: currentHeight }, // Start height
        { height: targetHeight }  // End height
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

function isShowingAll() {
    return false;
}