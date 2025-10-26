// import expect from "expect";
// import { afterAll, beforeEach } from "jest-circus";
// import { describe } from "yargs";
// import jQuery from 'jquery';
// import $ from 'jquery';

const widget = require("./widget");

const SE_API = {
    resumeQueue: function() {},
    store: {
        get: function() {},
        set: function() {}
    }
}

// MOCK for the SE_API
beforeEach(() => {
    global.SE_API = {
        resumeQueue: function() {},
        store: {
            get: function() {},
            set: function() {}
        }
    }
});

afterAll(() => {
    delete global.SE_API;
});

describe("Test loads", () => {
    test("Should run to confirm test environment loaded as expected", () => {
        expect(1).toEqual(1);
    });
});

describe('My Component', () => {
    test('should render correctly', () => {
      expect(true).toBe(true); // Example test
    });
});

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