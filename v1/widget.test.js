// import expect from "expect";
// import { afterAll, beforeEach } from "jest-circus";
// import { describe } from "yargs";
// import jQuery from 'jquery';
// import $ from 'jquery';
// const path = require('path');
import path from 'path';
import fs from 'fs';
import { JSDOM } from 'jsdom';
const widget = require("./widget");

// MOCK for the SE_API
beforeEach(() => {
    global.SE_API = {
        resumeQueue: function() {},
        store: {
            get: jest.fn((keyName) => Promise.resolve(initialWidgetState)),
            set: jest.fn((keyName, obj) => {})
        }
    };
    // Setup the dom for testing
    const htmlFilePath = path.resolve(__dirname, '.', 'widget.html');
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');

    const dom = new JSDOM(htmlContent);

    // Expose the window and document objects globally for Jest
    global.window = dom.window;
    global.document = dom.window.document;

    console.log("Loaded dom.window.document:" + JSON.stringify(dom.window.document));
    console.log(dom.serialize());
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
/////////////// info

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