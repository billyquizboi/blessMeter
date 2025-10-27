// jest.setup.js
import { JSDOM } from 'jsdom';
import $ from 'jquery';

// global.TextEncoder = TextEncoder;
// global.TextDecoder = TextDecoder;

global.$ = global.jQuery = $;
global.SE_API = {
    resumeQueue: function() {},
    store: {
        get:  jest.fn(() => Promise.resolve({ data: {}})),
        set:  jest.fn(() => Promise.resolve({ data: {}}))
    }
}
