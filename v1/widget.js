const blurseTheRun = "Blurse the run";
const blessTheRun = "Bless the run";
const curseTheRun = "Curse the run";

const numberOfBlessesKey = "numberOfBlesses";
const numberOfCursesKey = "numberOfCurses";
const numberOfBlursesKey = "numberOfBlurses";

// for testing use only you can set this to true
// don't use live or meter will change on every redeem of any type
const matchAnyRedemptionName = true;

const initialWidgetState = {
    current: {
        numberOfBlesses: 0,
        numberOfCurses: 0,
        numberOfBlurses: 0
    },
    allTime: {
        numberOfBlesses: 0,
        numberOfCurses: 0,
        numberOfBlurses: 0
    }
};

initialWidgetState.lastUpdated = new Date();

const STORE_KEY_NAME = "blessCurseMeterState";

const blessMeterFill = $("div.bless-container div.meter div.meter-fill")
const curseMeterFill = $("div.curse-container div.meter div.meter-fill")
const blurseMeterFill = $("div.blurse-container div.meter div.meter-fill")

const meters = [
    blessMeterFill,
    curseMeterFill,
    blurseMeterFill
];

if (blessMeterFill.length === 0 || curseMeterFill.length === 0 || blurseMeterFill.length === 0) {
    console.log("Didn't find all the meters. This is GGs I guess.");
    console.log(meters);
}

const animationDuration = 1000;

function updateState(toIncrement) {
    console.log(`Incrementing ${toIncrement}`);
    SE_API.store.get(STORE_KEY_NAME).then(obj => {
        console.log(`Retrieved widgetState from store is: ${obj}`);
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
        obj.lastUpdated = new Date();
        SE_API.store.set(STORE_KEY_NAME, obj);
        // the SE.store.set function emits an onEventReceived for every custom widget
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

function initialize() {
    widgetState.meters = $("div.block-meter");
    widgetState.current.numberOfBlesses = 0;
    widgetState.current.numberOfCurses = 0;
    widgetState.current.numberOfBlurses = 0;
    updateMeters();
}

window.addEventListener('onEventReceived', function (obj) {
    console.log(`Received an event ${obj}`);
    if (!obj.detail.event) {
      return;
    }
    if (typeof obj.detail.event.itemId !== "undefined") {
        obj.detail.listener = "redemption-latest"
    }
    const listener = obj.detail.listener.split("-")[0];
    const event = obj.detail.event;
    if (listener === 'redemption') {
        console.log("Redemption message received");
        console.log(obj.detail);
        handleRedemption(obj.detail);
    } else if (obj.detail.listener === 'kvstore:update') {
        console.log("Key store was updated so update the widget display");
        if (event != undefined && event.data != undefined
        && event.data.key === STORE_KEY_NAME && event.data.value != undefined) {
            console.log("Updating widget display");
            updateDisplay(event.data.value);
        } else {
            console.log("This kvstore update is invalid or isn't for us. A different key store item was saved matching name " + obj);
        }
    }
});

window.addEventListener('onWidgetLoad', function (obj) {
    // since we initialize from stored state we don't need to re-process recents 
    SE_API.store.get(STORE_KEY_NAME).then(obj => {
        console.log(`Initializing with retrieved widgetState from store: ${obj}`);
        if (storeHasBeenInitialized(obj)) {
            updateDisplay(obj);
        } else {
            console.log("The store object has not yet been initialized. Setting up initial values.");
            initialWidgetState.lastUpdated = new Date();
            obj = initialWidgetState;
            SE_API.store.set(STORE_KEY_NAME, obj);
            // the SE.store.set function emits an onEventReceived for every custom widget
        }
    });
});

function handleRedemption(detail) {
    console.log("In redemption handling");
    const redemptionName = getRedemptionName(detail);
    if (redemptionName != undefined && redemptionName != null) {
        // we can do something
        if (redemptionName == blessTheRun) {
            updateState(numberOfBlessesKey);
            setTimeout(SE_API.resumeQueue, 1001);
        } else if (redemptionName == curseTheRun) {
            updateState(numberOfCursesKey);
            setTimeout(SE_API.resumeQueue, 1001);
        } else if (redemptionName == blurseTheRun) {
            updateState(numberOfBlursesKey);
            setTimeout(SE_API.resumeQueue, 1001);
        } else if (matchAnyRedemptionName) {
            // This is for testing the widget -- can make a random function or just always curse/always bless or whatever
            // Change 'matchAnyRedemptionName' variable at the top to one of true to use this, else should be false
            // add if wanted for testing
        }
    } else {
        // we fukt
        console.log("Feels bad man. Redemption name not located in detail");
        console.log(detail);
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

function updateDisplay(widgetState) {
    if (widgetState != undefined && widgetState.current != undefined) {
        console.log("Updating meter display");
        const numberOfBlesses = getOrDefaultCount(widgetState.current[numberOfBlessesKey]);
        const numberOfCurses = getOrDefaultCount(widgetState.current[numberOfCursesKey]);
        const numberOfBlurses = getOrDefaultCount(widgetState.current[numberOfBlursesKey]);
        const total = numberOfBlesses + numberOfCurses + numberOfBlurses;
        if (total === 0) {
            console.log("No blesses, curses, or blurses. Hopefully this is expected in this scenario...");
            animateChange(blessMeterFill.get(0), blessMeterFill.width(), "33%");
            animateChange(curseMeterFill.get(0), curseMeterFill.width(), "33%");
            animateChange(blurseMeterFill.get(0), blurseMeterFill.width(), "33%");
        } else {
            console.log("Computing widths for the meters");
            console.log(`Current widths are bless: ${blessMeterFill.width()}, curse: ${curseMeterFill.width()}, blurse: ${blurseMeterFill.width()}`);
            const blessWidth = (numberOfBlesses / total).toFixed(2);
            const curseWidth = (numberOfCurses / total).toFixed(2);
            const blurseWidth = (numberOfBlurses / total).toFixed(2);
            console.log(`Updating widths to bless: ${blessWidth}, curse: ${curseWidth}, blurse: ${blurseWidth}`);
            animateChange(blessMeterFill.get(0), blessMeterFill.width(), blessWidth);
            animateChange(curseMeterFill.get(0), curseMeterFill.width(), curseWidth);
            animateChange(blurseMeterFill.get(0), blurseMeterFill.width(), blurseWidth);
        }
    } else {
        console.log("Current widget state is undefined! Feels bad man");
        console.log(widgetState);
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

function animateChange(ele, currentWidth, targetWidth) {
    ele.animate(
    [
        { width: currentWidth }, // Start width
        { width: targetWidth }  // End width
    ],
    {
        duration: animationDuration, // 1 second
        easing: 'ease-in-out', // Optional easing function
        fill: 'forwards' // Keep the final state after animation
    });
}

function resetCurrentState() {
    SE_API,store.get(STORE_KEY_NAME).then(obj => {
        obj.lastUpdated = new Date();
        obj.current = {
            numberOfBlesses: 0,
            numberOfCurses: 0,
            numberOfBlurses: 0
        };
    });
    SE_API.store.set(STORE_KEY_NAME, initialWidgetState);
}

function resetAllTimeState() {
    initialWidgetState.lastUpdated = new Date();
    SE_API.store.set(STORE_KEY_NAME, initialWidgetState);
}